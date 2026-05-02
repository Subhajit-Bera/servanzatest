import { registerRootComponent } from 'expo';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

import App from './App';
import { backgroundMessageHandler } from './src/utils/notification';

// Register FCM background handler BEFORE app registration (modular API)
// This is REQUIRED for push notifications to work when app is closed/killed
setBackgroundMessageHandler(getMessaging(), backgroundMessageHandler);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
