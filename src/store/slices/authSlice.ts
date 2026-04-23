import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { buddyApi } from '../../api/client';
import { User, AuthState } from '../../types';

const initialState: AuthState = {
  token: null,
  isAuthenticated: false,
  user: null,
  loading: true,
  error: null,
};

export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const refreshToken = await SecureStore.getItemAsync('refresh_token');

      if (!token) {
        return null;
      }

      // Fetch fresh profile data
      // API Client Interceptor will handle 401/Refresh logic automatically here
      const response = await buddyApi.getProfile();

      const fullProfile = response.data.data;

      // ✅ Map Backend Data to Client User Interface
      const user: User = {
        ...fullProfile.user,
        isVerified: fullProfile.isVerified,
        verifiedAt: fullProfile.verifiedAt,

        skills: fullProfile.services && fullProfile.services.length > 0
          ? fullProfile.services.map((s: any) => s.title)
          : (fullProfile.skills || []),

        dob: fullProfile.dob,
        whatsapp: fullProfile.whatsapp,
        secondaryPhone: fullProfile.secondaryPhone,
        bloodGroup: fullProfile.bloodGroup,
        city: fullProfile.city,
        languages: fullProfile.languages,

        permanentAddress: fullProfile.permanentAddress,
        currentAddress: fullProfile.currentAddress,
        bankDetails: fullProfile.bankDetails,
        bankDetailsMethod: fullProfile.bankDetailsMethod,
        emergencyContact: fullProfile.emergencyContact,

        // Training fields
        trainingStartDate: fullProfile.trainingStartDate,
        trainingDaysTaken: fullProfile.trainingDaysTaken,
        isTrainingCompleted: fullProfile.isTrainingCompleted,
        jobStartDate: fullProfile.jobStartDate,

        // Documents - map correctly with aadhaarFront/aadhaarBack
        documents: {
          aadhaarFront: fullProfile.documents?.aadhaarFront,
          aadhaarBack: fullProfile.documents?.aadhaarBack,
          pan: fullProfile.documents?.pan,
          bankDocument: fullProfile.documents?.bankDocument,
        },

        // Verification status
        verificationStatus: fullProfile.verificationStatus,
      };

      return { token, user };
    } catch (error: any) {
      // If interceptor retry failed, we genuinely have an expired session
      if (error.response && error.response.status === 401) {
        console.log("Session expired (Refresh failed or invalid).");
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('refresh_token');
        return rejectWithValue('Session expired');
      }

      console.error("Session Restore Error:", error);
      throw error;
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; token: string; refreshToken: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      SecureStore.setItemAsync('auth_token', action.payload.token);
      SecureStore.setItemAsync('refresh_token', action.payload.refreshToken);
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      SecureStore.deleteItemAsync('auth_token');
      SecureStore.deleteItemAsync('refresh_token');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.token = action.payload.token;
          state.user = action.payload.user;
          state.isAuthenticated = true;
        } else {
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
        }
      })
      .addCase(restoreSession.rejected, (state, action) => {
        state.loading = false;
        if (action.payload === 'Session expired') {
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
        }
      });
  },
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;