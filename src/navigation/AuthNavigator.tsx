import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import ProfileCreationScreen from '../screens/auth/ProfileCreationScreen';
import IdentificationScreen from '../screens/auth/IdentificationScreen';
import BankDetailsScreen from '../screens/auth/BankDetailsScreen';
import EmergencyContactScreen from '../screens/auth/EmergencyContactScreen';
import VerificationPendingScreen from '../screens/auth/VerificationPendingScreen';
import TrainingSelectionScreen from '../screens/auth/TrainingSelectionScreen';

const Stack = createStackNavigator();

interface AuthNavigatorProps {
  initialRouteName?: string;
}

export default function AuthNavigator({ initialRouteName = "Welcome" }: AuthNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      
      {/* Onboarding Flow */}
      <Stack.Screen name="ProfileCreation" component={ProfileCreationScreen} />
      <Stack.Screen name="Identification" component={IdentificationScreen} />
      <Stack.Screen name="BankDetails" component={BankDetailsScreen} />
      <Stack.Screen name="EmergencyContact" component={EmergencyContactScreen} />
      <Stack.Screen name="VerificationPending" component={VerificationPendingScreen} />
      <Stack.Screen name="TrainingSelection" component={TrainingSelectionScreen} />
    </Stack.Navigator>
  );
}