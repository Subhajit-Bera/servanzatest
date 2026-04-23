import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api/client';
import { navigate } from './navigationRef';
import EventEmitter from 'eventemitter3';

// Event Emitter for Job Requests (used by JobRequestContext)
export const notificationEvents = new EventEmitter();

// 1. Define Notification Types (Matching your Backend)
type NotificationType =
  | 'buddy-assignment'
  | 'booking-completed'
  | 'booking-cancelled'
  | 'payment-received'
  | 'general';

// 2. Handle Navigation based on Payload
const handleNotificationNavigation = (remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
  if (!remoteMessage?.data) return;

  const type = remoteMessage.data.type as NotificationType;
  const bookingId = remoteMessage.data.bookingId;

  console.log('Handling Notification Navigation:', type, bookingId);

  switch (type) {
    case 'buddy-assignment':
      // Emit event for JobRequestContext to handle (show popup)
      notificationEvents.emit('newJobRequest', {
        assignmentId: remoteMessage.data.assignmentId,
        bookingId: remoteMessage.data.bookingId,
        serviceTitle: remoteMessage.data.serviceTitle,
        address: remoteMessage.data.address,
        distance: remoteMessage.data.distance,
        price: parseFloat(String(remoteMessage.data.price ?? '0')),
        isImmediate: remoteMessage.data.isImmediate === 'true',
        scheduledStart: remoteMessage.data.scheduledStart, // Booking scheduled time
      });
      break;

    case 'booking-completed':
    case 'payment-received':
      // Navigate to Earnings or History
      navigate('Earnings');
      break;

    case 'booking-cancelled':
      // Emit event for NotificationContext to store
      notificationEvents.emit('bookingCancelled', {
        bookingId: remoteMessage.data.bookingId,
        serviceTitle: remoteMessage.data.serviceTitle || 'Booking',
        message: remoteMessage.data.message || 'A booking has been cancelled by the customer.',
      });
      // Navigate to Dashboard or History
      navigate('Home');
      break;

    default:
      // Default behavior: just go to Home
      navigate('Home');
  }
};

// 3. Permission & Token Logic
export async function requestUserPermission() {
  console.log('[FCM] Requesting notification permission...');
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  console.log('[FCM] Permission status:', authStatus, 'enabled:', enabled);

  if (enabled) {
    await registerFCMToken();
  }
}

// Exported so it can be called after login
export async function registerFCMToken() {
  try {
    const token = await messaging().getToken();
    console.log('[FCM] Got device token:', token?.substring(0, 20) + '...');

    if (token) {
      // Check for auth token before sending to backend
      const authToken = await SecureStore.getItemAsync('auth_token');

      if (authToken) {
        console.log('[FCM] Uploading token to backend...');
        await authApi.updateDeviceToken(token);
        console.log('[FCM] ✅ Device token uploaded successfully');
      } else {
        console.log('[FCM] User not logged in, skipping token upload');
      }
    } else {
      console.warn('[FCM] No token received from Firebase');
    }
  } catch (error) {
    console.error('[FCM] ❌ Error getting/uploading FCM token:', error);
  }
}

// 4. Main Listener Function
export function NotificationListener() {

  // A. Foreground Messages
  // NOTE: We intentionally do NOT show a popup for buddy-assignment here
  // because the socket event already triggers the popup via JobRequestContext.
  // This prevents duplicate popups when both socket and push arrive.
  const unsubscribe = messaging().onMessage(async remoteMessage => {
    console.log('[FCM] Foreground notification received:', remoteMessage.data?.type);

    // For buddy-assignment, socket handles the popup - don't do anything here
    if (remoteMessage.data?.type === 'buddy-assignment') {
      console.log('[FCM] buddy-assignment - socket handles popup, skipping');
      return;
    }

    // Other notification types can be handled here if needed
  });

  // B. Background Handler (When App is running in background and user taps notification)
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('App opened from background state by notification');
    handleNotificationNavigation(remoteMessage);
  });

  // C. Quit State Handler (When App is completely killed and user taps notification)
  messaging().getInitialNotification().then(remoteMessage => {
    if (remoteMessage) {
      console.log('App opened from quit state by notification');
      // We need a slight delay to ensure NavigationContainer is ready
      setTimeout(() => {
        handleNotificationNavigation(remoteMessage);
      }, 1000);
    }
  });

  return unsubscribe;
}

// 5. Background Message Handler (Headless Task)
export const backgroundMessageHandler = async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
  console.log('Message handled in the background/quit state!', remoteMessage);

  try {
    // Increment a local "unread" counter
    const currentCount = await AsyncStorage.getItem('unread_notifications');
    const newCount = (parseInt(currentCount || '0') + 1).toString();
    await AsyncStorage.setItem('unread_notifications', newCount);

    // Store latest job ID for when app opens
    if (remoteMessage.data?.type === 'buddy-assignment' && remoteMessage.data.bookingId) {
      const bookingId = String(remoteMessage.data.bookingId);
      await AsyncStorage.setItem('latest_job_id', bookingId);

      // Store the full job data for popup when app opens
      await AsyncStorage.setItem('pending_job_request', JSON.stringify({
        assignmentId: remoteMessage.data.assignmentId,
        bookingId: remoteMessage.data.bookingId,
        serviceTitle: remoteMessage.data.serviceTitle,
        address: remoteMessage.data.address,
        distance: remoteMessage.data.distance,
        price: remoteMessage.data.price,
        isImmediate: remoteMessage.data.isImmediate,
        scheduledStart: remoteMessage.data.scheduledStart, // Booking scheduled time
      }));
    }
  } catch (e) {
    console.error('Error in background handler', e);
  }
};
