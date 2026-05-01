import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox } from 'react-native'; // ✅ Added Import

// Config & Store
import { store } from './src/store';
import { theme } from './src/config/theme';
import { navigationRef } from './src/utils/navigationRef';

// Contexts & Navigators
import MainNavigator from './src/navigation/MainNavigator';
import { SocketProvider } from './src/context/SocketContext';
import { JobRequestProvider } from './src/context/JobRequestContext';
import { ActiveJobProvider } from './src/context/ActiveJobContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ChatProvider } from './src/context/ChatContext';

// Utils
import { requestUserPermission, NotificationListener } from './src/utils/notification';
import { initializeAppCheck } from './src/utils/appCheck';

// ✅ Ignore noisy warnings
// LogBox.ignoreLogs([
//   'Non-serializable values were found in the navigation state',
//   'This method is deprecated',
//   'Method called was',
// ]);

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { NetworkBanner } from './src/components/NetworkBanner';
import IncomingCallOverlay from './src/components/IncomingCallOverlay';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60, // 1 minute
    },
  },
});

export default function App() {

  // ... useEffect logic ...

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          {/* PaperProvider passes the theme to all UI components */}
          <PaperProvider theme={theme}>
            <SafeAreaProvider>
              {/* SocketProvider must be inside Redux Provider to access auth token */}
              <SocketProvider>
                <ChatProvider>
                  {/* NotificationProvider manages persistent notifications */}
                  <NotificationProvider>
                  {/* ActiveJobProvider manages persistent job timer */}
                  <ActiveJobProvider>
                    {/* JobRequestProvider handles global job request popups */}
                    <JobRequestProvider>
                      <NetworkBanner />
                      {/* NavigationContainer manages the navigation tree and history */}
                      <NavigationContainer ref={navigationRef}>
                        <IncomingCallOverlay />
                        <MainNavigator />
                        <StatusBar style="auto" />
                      </NavigationContainer>
                    </JobRequestProvider>
                  </ActiveJobProvider>
                </NotificationProvider>
                </ChatProvider>
              </SocketProvider>
            </SafeAreaProvider>
          </PaperProvider>
        </Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
