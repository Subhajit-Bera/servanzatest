import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';
import appCheck from '@react-native-firebase/app-check';
import {
  deduplicateRequest,
  getCachedResponse,
  cacheResponse,
  getRequestKey,
  canFetch,
  recordFetch,
  retryWithBackoff,
  clearCache,
} from './requestUtils';

import { CONFIG } from '../config/constants';

// UPDATE IN src/config/constants.ts
const BASE_URL = CONFIG.API_BASE_URL;

// Minimum interval between jobs fetches
const JOBS_FETCH_INTERVAL = CONFIG.JOBS_FETCH_INTERVAL;
// Cache TTL for jobs
const JOBS_CACHE_TTL = CONFIG.CACHE_TTL;

// Helper to invalidate jobs cache (call after status changes)
const invalidateJobsCache = () => {
  const cacheKey = getRequestKey('GET', '/buddies/jobs');
  clearCache(cacheKey);
  console.log('[API] Jobs cache invalidated');
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// 1. Request Interceptor: Attach Token
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Queue to hold requests that fail while token is refreshing
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 2. Response Interceptor: Handle Token Expiry (401)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 (Unauthorized) and we haven't retried yet
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Call refresh endpoint using a clean axios instance to avoid loops
        const response = await axios.post(`${BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        // Use correct data structure from existing file
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        // Save new tokens
        await SecureStore.setItemAsync('auth_token', accessToken);
        await SecureStore.setItemAsync('refresh_token', newRefreshToken);

        // Update global defaults for future requests
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // Process queue with new token
        processQueue(null, accessToken);
        isRefreshing = false;

        return apiClient(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        console.error('Token refresh failed:', refreshError);
        // Clear tokens to force login
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('refresh_token');
        return Promise.reject(refreshError);
      }
    }

    // Handle 429 Rate Limit
    if (error.response && error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      console.warn(`[API] Rate limited. Retry after: ${retryAfter || 'unknown'} seconds`);
      // Don't retry automatically here - let the caller handle it
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// Firebase Phone Auth Helper (modular API)
// signInWithPhone now returns verificationId (plain string) instead of the full
// confirmation object. This fixes the React Navigation non-serializable state
// warning: the verificationId can be safely passed through nav params.
export const firebaseAuth = {
  signInWithPhone: async (phoneNumber: string): Promise<string> => {
    try {
      console.log('[FirebaseAuth] Attempting sign-in for:', phoneNumber);
      // Modular API: signInWithPhoneNumber(auth, phone)
      const confirmation = await signInWithPhoneNumber(getAuth(), phoneNumber);

      console.log('[FirebaseAuth] OTP sent successfully');
      // confirmation.verificationId is typed string | null in v24 — it is always
      // a populated string when signInWithPhoneNumber resolves successfully.
      return confirmation.verificationId!;
    } catch (error: any) {
      console.error('[FirebaseAuth] Sign In Error:', error);
      console.error('[FirebaseAuth] Error Code:', error.code);
      console.error('[FirebaseAuth] Error Message:', error.message);
      throw error;
    }
  },

  // confirmCode now takes (verificationId, code) instead of (confirmationObject, code).
  // Uses PhoneAuthProvider.credential to build the credential then signInWithCredential.
  confirmCode: async (verificationId: string, code: string): Promise<string | undefined> => {
    try {
      console.log('[FirebaseAuth] Confirming code...');
      const { PhoneAuthProvider, signInWithCredential, getIdToken } = await import('@react-native-firebase/auth');
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const userCredential = await signInWithCredential(getAuth(), credential);
      const idToken = await getIdToken(userCredential.user);
      console.log('[FirebaseAuth] Code confirmed, ID Token retrieved');
      return idToken;
    } catch (error) {
      console.error('[FirebaseAuth] Confirmation Error:', error);
      throw error;
    }
  }
};

export const authApi = {
  // Check phone existence
  checkPhone: (phone: string) => apiClient.post('/auth/check-phone', { phone, role: 'BUDDY' }),

  verifyFirebasePhone: (idToken: string) => apiClient.post('/auth/phone/firebase', { idToken, role: 'BUDDY' }),
  updateDeviceToken: (token: string) => apiClient.post('/users/device-token', { token, appSource: 'BUDDY_APP' }),
};

export const buddyApi = {
  getProfile: () => apiClient.get('/buddies/profile'),
  updateProfile: (data: any) => apiClient.put('/buddies/profile', data),
  updateStatus: (isAvailable: boolean) => apiClient.put('/buddies/availability', { isAvailable }),
  updateLocation: (lat: number, long: number) => apiClient.post('/buddies/location', { latitude: lat, longitude: long }),
  getActiveJob: () => apiClient.get('/buddies/jobs/active'),

  // Optimized getJobs with deduplication, caching, and minimum interval
  getJobs: async () => {
    const endpoint = '/buddies/jobs';
    const cacheKey = getRequestKey('GET', endpoint);

    // Check cache first
    const cached = getCachedResponse(cacheKey, JOBS_CACHE_TTL);
    if (cached) {
      console.log('[API] Returning cached jobs response');
      return cached;
    }

    // Enforce minimum interval between fetches
    if (!canFetch(endpoint, JOBS_FETCH_INTERVAL)) {
      console.log('[API] Throttling jobs fetch - too recent');
      // Return cached if available, otherwise allow the fetch
      const oldCached = getCachedResponse(cacheKey, 60000); // Use stale cache up to 1 minute
      if (oldCached) return oldCached;
    }

    // Deduplicate simultaneous requests
    return deduplicateRequest(cacheKey, async () => {
      recordFetch(endpoint);
      const response = await apiClient.get(endpoint);
      cacheResponse(cacheKey, response);
      return response;
    });
  },

  updateSkills: (serviceIds: string[]) => apiClient.put('/buddies/profile', { serviceIds }),

  uploadDocument: (formData: FormData) => {
    return apiClient.post('/buddy-documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        // Prevent axios from converting body to JSON
        'Accept': 'application/json',
      },
      transformRequest: (data) => data, // Keep FormData as-is
      timeout: 60000, // 60 second timeout for file uploads
    });
  },

  uploadProfileImage: (formData: FormData) => {
    return apiClient.post('/buddy-documents/upload-profile-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json',
      },
      transformRequest: (data) => data,
      timeout: 60000,
    });
  },

  acceptJob: async (assignmentId: string) => {
    const response = await apiClient.post(`/buddies/jobs/${assignmentId}/accept`);
    invalidateJobsCache();
    return response;
  },
  rejectJob: async (assignmentId: string) => {
    const response = await apiClient.post(`/buddies/jobs/${assignmentId}/reject`);
    invalidateJobsCache();
    return response;
  },
  getJobDetails: (assignmentId: string) => apiClient.get(`/buddies/jobs/${assignmentId}`),
  startTracking: async (assignmentId: string) => {
    const response = await apiClient.post(`/buddies/jobs/${assignmentId}/start-tracking`);
    invalidateJobsCache(); // Clear cache so Active tab shows ON_WAY status
    return response;
  },
  markArrived: async (assignmentId: string) => {
    const response = await apiClient.post(`/buddies/jobs/${assignmentId}/arrived`);
    invalidateJobsCache(); // Clear cache so Active tab shows ARRIVED status
    return response;
  },
  startJob: async (assignmentId: string) => {
    const response = await apiClient.post(`/buddies/jobs/${assignmentId}/start`);
    invalidateJobsCache(); // Clear cache so Active tab shows IN_PROGRESS status
    return response;
  },
  completeJob: async (assignmentId: string) => {
    const response = await apiClient.post(`/buddies/jobs/${assignmentId}/complete`);
    invalidateJobsCache(); // Clear cache so Active tab shows COMPLETED status
    return response;
  },
  getJobHistory: (params: { page: number; limit: number }) => apiClient.get('/buddies/jobs/history', { params }),

  getEarnings: (filters?: { startDate?: string; endDate?: string }) => apiClient.get('/buddies/earnings', { params: filters }),
  getEarningsSummary: () => apiClient.get('/buddies/earnings/summary'),
  getReviews: (page = 1, limit = 10) => apiClient.get('/buddies/reviews', { params: { page, limit } }),

  // Job Completion OTP
  sendCompletionOTP: (assignmentId: string) => apiClient.post(`/buddies/jobs/${assignmentId}/send-otp`),
  verifyCompletionOTP: (assignmentId: string, otp: string) => apiClient.post(`/buddies/jobs/${assignmentId}/verify-otp`, { otp }),

  getAllServices: () => apiClient.get('/services'),

  // Verification status
  getVerificationStatus: () => apiClient.get('/buddies/verification-status'),

  // Training
  selectTrainingStartDate: (trainingStartDate: string) => apiClient.post('/buddies/training/select-date', { trainingStartDate }),
};

export default apiClient;