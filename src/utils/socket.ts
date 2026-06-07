import io from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

import { CONFIG } from '../config/constants';

// Replace with your backend URL
const SOCKET_URL = CONFIG.SOCKET_URL;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  query: {
    supportsAck: 'true'
  }
});

let isReconnecting = false;

// Helper to get fresh token from SecureStore
const getFreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch (error) {
    console.error('[Socket] Error getting fresh token:', error);
    return null;
  }
};

export const initSocket = (token: string) => {
  console.log('[Socket] Initializing socket connection to:', SOCKET_URL);
  socket.auth = { token };
  socket.connect();

  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected to socket server, socket.id:', socket.id);
    isReconnecting = false;
  });

  socket.on('connected', (data: any) => {
    console.log('[Socket] Server welcome message:', data);
  });

  socket.on('disconnect', (reason: string) => {
    console.log('[Socket] ❌ Disconnected from socket server, reason:', reason);
  });

  socket.on('connect_error', async (error: Error) => {
    console.warn('[Socket] Connection issue (will retry):', error.message);

    // Check if it's an authentication error
    if (error.message.includes('Authentication') ||
      error.message.includes('jwt') ||
      error.message.includes('expired') ||
      error.message.includes('Invalid token')) {

      // Prevent multiple simultaneous reconnection attempts
      if (isReconnecting) {
        console.log('[Socket] Already attempting to reconnect with fresh token');
        return;
      }

      isReconnecting = true;
      console.log('[Socket] Auth error detected, getting fresh token...');

      // Get fresh token from SecureStore
      const freshToken = await getFreshToken();
      const currentToken = (socket.auth as { token?: string })?.token;
      if (freshToken && freshToken !== currentToken) {
        console.log('[Socket] Got fresh token, reconnecting...');
        socket.auth = { token: freshToken };

        // Disconnect and reconnect with new token
        socket.disconnect();
        setTimeout(() => {
          socket.connect();
        }, 500);
      } else {
        console.log('[Socket] No fresh token available or same as before');
        isReconnecting = false;
      }
    }
  });

  socket.on('error', (error: any) => {
    console.error('[Socket] Error:', error);

    // Handle rate limiting specifically
    if (error.type === 'RATE_LIMITED') {
      console.warn('[Socket] ⚠ Rate limited, retry after:', error.retryAfterMs, 'ms');
      // Rate limit is typically silent - the action just won't complete
      // The backend already prevents the action, no need to alert user
    }
  });

  // Handle pending messages delivered on reconnection
  socket.on('pending_messages', (messages: any[]) => {
    console.log('[Socket] 📬 Received pending messages:', messages.length);
    // These are messages the user missed while offline
    // Each message has: { event, data, createdAt }
    messages.forEach((msg) => {
      // Trigger local listeners for the event without sending back to server
      const listeners = socket.listeners(msg.event);
      if (listeners.length > 0) {
        listeners.forEach((fn: any) => fn(msg.data));
      } else if (msg.event === 'buddy-assignment') {
        // Fallback for buddy-assignment if socket listeners aren't ready
        const { DeviceEventEmitter } = require('react-native');
        DeviceEventEmitter.emit('incoming-job-request', msg.data);
      }
    });
  });
};

// Function to update socket token (call this after token refresh)
export const updateSocketToken = (newToken: string) => {
  console.log('[Socket] Updating socket auth token');
  socket.auth = { token: newToken };

  if (socket.connected) {
    // Reconnect with new token
    socket.disconnect();
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
