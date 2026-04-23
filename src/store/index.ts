import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import buddyReducer from './slices/buddySlice'; // Ensure we have this file from previous steps

export const store = configureStore({
  reducer: {
    auth: authReducer,
    buddy: buddyReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;