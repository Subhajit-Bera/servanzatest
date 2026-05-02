import {
  initializeAppCheck as firebaseInitializeAppCheck,
} from '@react-native-firebase/app-check';
import type { ReactNativeFirebaseAppCheckProvider as AppCheckProviderType } from '@react-native-firebase/app-check';

// ReactNativeFirebaseAppCheckProvider is a runtime class but its re-export in
// modular.d.ts loses the constructor signature for TypeScript. The package's
// exports map only exposes the root index, so deep path imports are blocked.
// Solution: access via require() with an explicit minimal type declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ReactNativeFirebaseAppCheckProvider } = require('@react-native-firebase/app-check') as {
  ReactNativeFirebaseAppCheckProvider: new () => AppCheckProviderType;
};

const DEBUG_TOKEN = 'EDC3104C-B6F8-47EC-A5BB-F7C4A4979ED3';

/**
 * Initialize Firebase App Check.
 * Uses debug provider in dev and the native provider (Play Integrity / AppAttest) in prod.
 */
export const initializeAppCheck = async (): Promise<void> => {
    try {
        const rnfbProvider = new ReactNativeFirebaseAppCheckProvider();

        rnfbProvider.configure({
            android: {
                provider: __DEV__ ? 'debug' : 'playIntegrity',
                debugToken: __DEV__ ? DEBUG_TOKEN : undefined,
            },
            apple: {
                provider: __DEV__ ? 'debug' : 'appAttest',
                debugToken: __DEV__ ? DEBUG_TOKEN : undefined,
            },
        });

        await firebaseInitializeAppCheck(undefined, {
            provider: rnfbProvider,
            isTokenAutoRefreshEnabled: true,
        });

        console.log('[AppCheck] ✅ Firebase App Check initialized successfully');

        if (__DEV__) {
            console.log('[AppCheck] Using debug token:', DEBUG_TOKEN);
            console.log('[AppCheck] Make sure this token is added to Firebase Console → App Check → Manage debug tokens');
        }
    } catch (error) {
        console.warn('[AppCheck] Failed to initialize:', error);
    }
};