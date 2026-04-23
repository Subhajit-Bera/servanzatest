import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { buddyApi } from '../../api/client';
import { EarningsSummary } from '../../types';

// Define the State Interface
interface BuddyState {
  profile: any | null;
  earnings: EarningsSummary | null;
  isAvailable: boolean;
  activeJob: any | null;
  loading: boolean;
  error: string | null;
}

// Initial State
const initialState: BuddyState = {
  profile: null,
  earnings: null,
  isAvailable: false,
  activeJob: null,
  loading: false,
  error: null,
};

// --- THUNKS (Async Actions) ---

// 1. Fetch Buddy Profile
export const fetchProfile = createAsyncThunk(
  'buddy/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await buddyApi.getProfile();
      // FIX: Access response.data.data to get the actual buddy object
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

// 2. Toggle Availability (Online/Offline)
export const toggleAvailability = createAsyncThunk(
  'buddy/toggleAvailability',
  async (status: boolean, { rejectWithValue }) => {
    try {
      const response = await buddyApi.updateStatus(status);
      // FIX: Access response.data.data
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update status');
    }
  }
);

// 3. Fetch Earnings Summary (Dashboard Stats)
export const fetchEarningsSummary = createAsyncThunk(
  'buddy/fetchEarningsSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await buddyApi.getEarningsSummary();
      // FIX: Access response.data.data
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch earnings');
    }
  }
);

// --- SLICE ---

const buddySlice = createSlice({
  name: 'buddy',
  initialState,
  reducers: {
    setActiveJob: (state, action: PayloadAction<any>) => {
      state.activeJob = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    // Clear all buddy state on logout
    clearBuddyState: (state) => {
      state.profile = null;
      state.earnings = null;
      state.isAvailable = false;
      state.activeJob = null;
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle Fetch Profile
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        // Sync local availability state with the fetched profile
        state.isAvailable = action.payload.isAvailable;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Handle Toggle Availability
      .addCase(toggleAvailability.pending, (state) => {
        state.loading = true;
      })
      .addCase(toggleAvailability.fulfilled, (state, action) => {
        state.loading = false;
        // Update both the specific flag and the profile object
        state.isAvailable = action.payload.isAvailable;
        if (state.profile) {
          state.profile.isAvailable = action.payload.isAvailable;
        }
      })
      .addCase(toggleAvailability.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Handle Fetch Earnings
      .addCase(fetchEarningsSummary.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEarningsSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.earnings = action.payload;
      })
      .addCase(fetchEarningsSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Listen for auth/logout action and clear buddy state
      .addMatcher(
        (action) => action.type === 'auth/logout',
        (state) => {
          console.log('[buddySlice] Clearing state on logout');
          state.profile = null;
          state.earnings = null;
          state.isAvailable = false;
          state.activeJob = null;
          state.loading = false;
          state.error = null;
        }
      );
  },
});

export const { setActiveJob, clearError, clearBuddyState } = buddySlice.actions;
export default buddySlice.reducer;