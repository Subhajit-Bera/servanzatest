import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Keyboard } from 'react-native';
import { Button, TextInput, HelperText } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../../config/theme';
import { authApi, firebaseAuth } from '../../api/client';
import { restoreSession } from '../../store/slices/authSlice';

export default function OtpVerificationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<any>();

  // verificationId is now a plain string (not a Firebase class instance),
  // so it is safe for React Navigation serialization — fixes the
  // "Non-serializable values were found in the navigation state" warning.
  const { phone, verificationId: initialVerificationId } = route.params;

  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Track verificationId in state so resend can update it
  const [verificationId, setVerificationId] = useState(initialVerificationId);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      setError('');
      Keyboard.dismiss();

      // 1. Confirm with Firebase using verificationId + code (modular pattern)
      const idToken = await firebaseAuth.confirmCode(verificationId, otp);
      if (!idToken) throw new Error("Failed to get ID token");

      // 2. Send ID Token to Backend
      const response = await authApi.verifyFirebasePhone(idToken);
      const { tokens } = response.data.data;

      // 3. Save Tokens (Critical for Silent Refresh)
      await SecureStore.setItemAsync('auth_token', tokens.accessToken);
      await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);

      // 4. Fetch Full Profile via restoreSession
      // Unwrap to get the User object immediately for navigation checks
      const actionResult = await dispatch(restoreSession()).unwrap();
      const user = actionResult.user;

      // 5. Navigate based on verification status
      if (user.isVerified) {
        // MainNavigator observes 'isAuthenticated' and 'user' from Redux.
        // It should automatically switch to the App Stack (Home).
      } else {
        // User is authenticated but profile is incomplete
        navigation.navigate('ProfileCreation');
      }

    } catch (err: any) {
      console.error(err);
      setError('Invalid code or verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setTimer(30);
      // signInWithPhone now returns a verificationId string — update state
      const newVerificationId = await firebaseAuth.signInWithPhone(phone);
      setVerificationId(newVerificationId);
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a while before trying again.');
      } else {
        setError('Failed to resend OTP');
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.card, SHADOWS.medium]}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>Enter the code sent to {phone}</Text>

        <TextInput
          mode="outlined"
          label="Enter 6-digit OTP"
          value={otp}
          onChangeText={(text) => {
            setOtp(text.replace(/[^0-9]/g, ''));
            setError('');
          }}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.input}
          activeOutlineColor={COLORS.primary}
          error={!!error}
          autoFocus
        />

        <HelperText type="error" visible={!!error}>{error}</HelperText>

        <Button
          mode="contained"
          onPress={handleVerify}
          loading={loading}
          disabled={otp.length !== 6 || loading}
          style={[styles.button, (otp.length === 6) && SHADOWS.green]}
          contentStyle={{ height: 50 }}
        >
          Verify & Login
        </Button>

        <View style={styles.resendContainer}>
          {timer > 0 ? (
            <Text style={styles.timerText}>Resend code in {timer}s</Text>
          ) : (
            <Button mode="text" onPress={handleResend} textColor={COLORS.primary}>
              Resend OTP
            </Button>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: COLORS.white, padding: 24, borderRadius: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.charcoal, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.mediumGray, marginBottom: 24, textAlign: 'center' },
  input: { backgroundColor: COLORS.white, marginBottom: 5, fontSize: 18, textAlign: 'center' },
  button: { borderRadius: 12, backgroundColor: COLORS.primary, marginTop: 10 },
  resendContainer: { marginTop: 20, alignItems: 'center' },
  timerText: { color: COLORS.mediumGray },
});