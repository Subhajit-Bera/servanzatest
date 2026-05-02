import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../store/hooks';
import { restoreSession } from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import ServiceSelectionScreen from '../screens/auth/ServiceSelectionScreen';
import { COLORS } from '../config/theme';
// JobRequestManager removed - now handled by JobRequestContext with JobAlertContainer

export default function MainNavigator() {
  const dispatch = useDispatch<any>();
  const { isAuthenticated, loading, user } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // 1. Not Logged In
  if (!isAuthenticated || !user) {
    return <AuthNavigator initialRouteName="Welcome" />;
  }

  // 2. Onboarding Checks (when not verified)
  if (!user.isVerified) {
    // Step 1: Profile Creation - check if basic profile is done
    if (!user.email) {
      return <AuthNavigator initialRouteName="ProfileCreation" />;
    }

    // Step 2: Identification - check if documents (aadhaarFront, aadhaarBack, pan) are uploaded
    const hasIdentificationDocs = user.documents &&
      user.documents.aadhaarFront &&
      user.documents.aadhaarBack &&
      user.documents.pan;

    if (!hasIdentificationDocs) {
      return <AuthNavigator initialRouteName="Identification" />;
    }

    // Step 3: Bank Details - OPTIONAL (user can skip and add later from Profile)
    // Only show if user hasn't provided emergency contact yet
    const hasEmergencyContact = user.emergencyContact &&
      user.emergencyContact.name &&
      user.emergencyContact.phone;

    if (!hasEmergencyContact) {
      // Check if user has already skipped or submitted bank details
      const hasBankDetails = user.bankDetails &&
        (user.bankDetails.accountNumber || user.bankDetails.bankDocument);

      // If no bank details AND we're coming through onboarding, show BankDetails (can skip)
      // If user has bank details, go to EmergencyContact
      if (!hasBankDetails) {
        return <AuthNavigator initialRouteName="BankDetails" />;
      }
      return <AuthNavigator initialRouteName="EmergencyContact" />;
    }

    // Step 4: All onboarding complete (bank details is optional), waiting for verification
    return <AuthNavigator initialRouteName="VerificationPending" />;
  }

  // 3. Service Selection (if no skills selected yet)
  if (user.isVerified && (!user.skills || user.skills.length === 0)) {
    return <ServiceSelectionScreen />;
  }

  // 4. Verified & skills selected -> Show Home
  // Training banner will be shown in Home screen if training not started/completed
  // User can only go online after training is complete and current date >= jobStartDate
  return <AppNavigator />;
}