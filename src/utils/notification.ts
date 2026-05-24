import {
  getMessaging,
  requestPermission,
  AuthorizationStatus,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
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
  | 'chat-message'
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
      // Navigate to Dashboard or History
      navigate('Home');
      break;

    case 'chat-message':
      // Navigate to Chat
      navigate('Chat', {
        bookingId: remoteMessage.data.bookingId,
        customerName: remoteMessage.data.customerName || 'Customer',
      });
      break;

    default:
      // Default behavior: just go to Home
      navigate('Home');
  }
};

// 3. Permission & Token Logic (modular API)
export async function requestUserPermission() {
  console.log('[FCM] Requesting notification permission...');
  const authStatus = await requestPermission(getMessaging());
  const enabled =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  console.log('[FCM] Permission status:', authStatus, 'enabled:', enabled);

  if (enabled) {
    await registerFCMToken();
  }
}

// Exported so it can be called after login
export async function registerFCMToken() {
  try {
    const token = await getToken(getMessaging());
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

// 4. Main Listener Function (modular API)
export function NotificationListener() {
  const messaging = getMessaging();

  // A. Foreground Messages
  // NOTE: We intentionally do NOT show a popup for buddy-assignment here
  // because the socket event already triggers the popup via JobRequestContext.
  // This prevents duplicate popups when both socket and push arrive.
  const unsubscribe = onMessage(messaging, async remoteMessage => {
    console.log('[FCM] Foreground notification received:', remoteMessage.data?.type);

    // For buddy-assignment, emit to JobRequestContext and show local notification
    if (remoteMessage.data?.type === 'buddy-assignment') {
      console.log('[FCM] buddy-assignment received in foreground. Emitting local event & showing notification.');
      
      let dataPayload = { ...remoteMessage.data };
      if (typeof dataPayload.metadata === 'string') {
          try {
              dataPayload.metadata = JSON.parse(dataPayload.metadata);
          } catch(e) {}
      }

      DeviceEventEmitter.emit('incoming-job-request', dataPayload);

      // Show local notification using expo-notifications
      const title = 'New Job Assignment!';
      const body = dataPayload.serviceTitle ? `${dataPayload.serviceTitle} at ${dataPayload.address}` : 'You have a new job request.';
      
      Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: dataPayload as any,
          sound: true,
        },
        trigger: null,
      });
      return;
    }

    if (remoteMessage.data?.type === 'chat-message') {
      // ChatContext handles foreground chat messages
      // We can optionally persist it here if they aren't on the chat screen,
      // but ChatContext handles that logic.
      return;
    }

    // Other notification types can be handled here if needed
  });

  // B. Background Handler (When App is running in background and user taps notification)
  onNotificationOpenedApp(messaging, remoteMessage => {
    console.log('App opened from background state by notification');
    handleNotificationNavigation(remoteMessage);
  });

  // C. Quit State Handler (When App is completely killed and user taps notification)
  getInitialNotification(messaging).then(remoteMessage => {
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

// Helper: persist a notification to AsyncStorage so NotificationContext picks it up
const NOTIFICATIONS_STORAGE_KEY = 'stored_notifications';
const UNREAD_COUNT_KEY = 'unread_notifications';

async function persistNotificationToStorage(
  type: string,
  title: string,
  message: string,
  data: any,
) {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const current = stored ? JSON.parse(stored) : [];

    const newNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      data,
      timestamp: Date.now(),
      read: false,
    };

    const updated = [newNotification, ...current];
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));

    // Increment unread count
    const countStr = await AsyncStorage.getItem(UNREAD_COUNT_KEY);
    const newCount = (parseInt(countStr || '0', 10) + 1).toString();
    await AsyncStorage.setItem(UNREAD_COUNT_KEY, newCount);

    console.log('[BGHandler] Persisted notification:', type, 'Total:', updated.length);
  } catch (e) {
    console.error('[BGHandler] Error persisting notification:', e);
  }
}

// 5. Background Message Handler (Headless Task)
export const backgroundMessageHandler = async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
  console.log('Message handled in the background/quit state!', remoteMessage);

  try {
    const data = remoteMessage.data || {};
    const type = data.type as string;

    if (type === 'buddy-assignment' && data.bookingId) {
      const jobData = {
        assignmentId: data.assignmentId,
        bookingId: data.bookingId,
        serviceTitle: data.serviceTitle,
        address: data.address,
        distance: data.distance,
        price: data.price,
        isImmediate: data.isImmediate,
        scheduledStart: data.scheduledStart,
      };

      // Persist to stored_notifications for NotificationScreen
      await persistNotificationToStorage(
        'job-assignment',
        'New Job Available',
        `${data.serviceTitle} at ${data.address}`,
        jobData,
      );

      // Also keep pending_job_request for popup on app open
      await AsyncStorage.setItem('pending_job_request', JSON.stringify(jobData));
      await AsyncStorage.setItem('latest_job_id', String(data.bookingId));

    } else if (type === 'booking-cancelled') {
      await persistNotificationToStorage(
        'booking-cancelled',
        'Booking Cancelled',
        String(data.message || '') || `${data.serviceTitle} has been cancelled by the customer.`,
        {
          bookingId: data.bookingId,
          serviceTitle: data.serviceTitle || 'Booking',
          message: data.message || 'A booking has been cancelled by the customer.',
        },
      );
    } else if (type === 'chat-message') {
      await persistNotificationToStorage(
        'chat-message',
        `New Message from ${data.customerName || 'Customer'}`,
        String(data.content || 'Tap to view'),
        {
          bookingId: data.bookingId,
          customerName: data.customerName || 'Customer',
          messageId: data.messageId,
          content: data.content,
        },
      );
    } else {
      // Generic notification — still persist so badge count matches content
      await persistNotificationToStorage(
        'general',
        String(data.title || 'Notification'),
        String(data.body || data.message || ''),
        data,
      );
    }
  } catch (e) {
    console.error('Error in background handler', e);
  }
};
