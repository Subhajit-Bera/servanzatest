import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';
import { useDispatch, useSelector } from 'react-redux';

// Screens
import HomeScreen from '../screens/dashboard/HomeScreen';
import JobExecutionScreen from '../screens/jobs/JobExecutionScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';
import EarningsScreen from '../screens/dashboard/EarningsScreen';
import JobsListScreen from '../screens/jobs/JobsListScreen';
// import DocumentsScreen from '../screens/dashboard/DocumentsScreen';
import JobTrackingScreen from '../screens/jobs/JobTrackingScreen';
import JobInProgressScreen from '../screens/jobs/JobInProgressScreen';
import JobCompletionScreen from '../screens/jobs/JobCompletionScreen';
import TrainingSelectionScreen from '../screens/auth/TrainingSelectionScreen';
import NotificationScreen from '../screens/dashboard/NotificationScreen';

// Reusing Auth Screens for Editing
import ProfileCreationScreen from '../screens/auth/ProfileCreationScreen';
import ServiceSelectionScreen from '../screens/auth/ServiceSelectionScreen';
import BankDetailsScreen from '../screens/auth/BankDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack for Dashboard
function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={HomeScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="JobDetails" component={JobExecutionScreen} />
      <Stack.Screen
        name="JobTracking"
        component={JobTrackingScreen}
        options={{ headerShown: true, title: 'Track Location', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="JobInProgress"
        component={JobInProgressScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="JobCompletion"
        component={JobCompletionScreen}
        options={{ headerShown: false }}
      />
      {/* <Stack.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ headerShown: true, title: 'Documents', headerBackTitle: 'Back' }}
      /> */}
      <Stack.Screen
        name="TrainingSelection"
        component={TrainingSelectionScreen}
        options={{ headerShown: true, title: 'Training', headerBackTitle: 'Back' }}
      />
    </Stack.Navigator>
  );
}

// Stack for Profile (Added Edit Screens Here)
function ProfileStack() {
  const { user } = useSelector((state: any) => state.auth);
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />

      {/* Renamed to EditProfile for logic differentiation */}
      <Stack.Screen
        name="EditProfile"
        component={ProfileCreationScreen}
        options={{ headerShown: true, title: `${user?.name}Profile`, headerBackTitle: 'Back' }}
      />

      <Stack.Screen
        name="ServiceSelection"
        component={ServiceSelectionScreen}
        options={{ headerShown: true, title: 'Manage Services', headerBackTitle: 'Back' }}
      />

      {/* <Stack.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ headerShown: true, title: 'My Documents', headerBackTitle: 'Back' }}
      /> */}

      {/* Bank Details - for submitting/updating bank details from Profile */}
      <Stack.Screen
        name="BankDetails"
        component={BankDetailsScreen}
        options={{ headerShown: true, title: 'Bank Details', headerBackTitle: 'Back' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.mediumGray,
        tabBarIcon: ({ color, size }) => {
          let iconName: any;
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Jobs') iconName = 'briefcase';
          else if (route.name === 'Earnings') iconName = 'wallet';
          else if (route.name === 'Profile') iconName = 'account';
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // When Home tab is pressed, reset to DashboardHome
            navigation.navigate('Home', {
              screen: 'DashboardHome',
            });
          },
        })}
      />
      <Tab.Screen name="Jobs" component={JobsListScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // When Profile tab is pressed, reset to ProfileHome
            navigation.navigate('Profile', {
              screen: 'ProfileHome',
            });
          },
        })}
      />
    </Tab.Navigator>
  );
}