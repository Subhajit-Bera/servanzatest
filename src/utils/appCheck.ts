import appCheck from '@react-native-firebase/app-check';

const DEBUG_TOKEN = 'EDC3104C-B6F8-47EC-A5BB-F7C4A4979ED3';

export const initializeAppCheck = async () => {
    try {
        // Create the React Native Firebase App Check provider
        const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();

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

        await appCheck().initializeAppCheck({
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



// import appCheck from '@react-native-firebase/app-check';

// // Double-check this matches Firebase Console > App Check > Manage debug tokens
// const DEBUG_TOKEN = 'EDC3104C-B6F8-47EC-A5BB-F7C4A4979ED3';

// export const initializeAppCheck = async () => {
//     try {
//         // 1. Get the provider instance
//         const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();

//         // 2. FORCE 'debug' provider. Do not use __DEV__ check.
//         // This ensures your Development Build ALWAYS uses the token, 
//         // bypassing the Play Integrity check that fails on dev builds.
//         rnfbProvider.configure({
//             android: {
//                 provider: 'debug', 
//                 debugToken: DEBUG_TOKEN,
//             },
//             apple: {
//                 provider: 'debug',
//                 debugToken: DEBUG_TOKEN,
//             },
//         });

//         // 3. Initialize
//         await appCheck().initializeAppCheck({
//             provider: rnfbProvider,
//             isTokenAutoRefreshEnabled: true,
//         });

//         console.log('[AppCheck] ✅ Enforced Debug Provider with token:', DEBUG_TOKEN);
        
//     } catch (error) {
//         console.error('[AppCheck] Failed to initialize:', error);
//     }
// };