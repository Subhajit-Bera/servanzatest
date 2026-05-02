import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Alert, Keyboard, Platform } from 'react-native';
import { Text, TextInput, Button, Checkbox, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../../config/theme';
import { authApi, firebaseAuth } from '../../api/client';

type AuthMode = 'LOGIN' | 'SIGNUP';

export default function LoginScreen() {
  const navigation = useNavigation<any>();

  const [mode, setMode] = useState<AuthMode>('SIGNUP'); // Default to Signup
  const [phone, setPhone] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleMode = () => {
    setMode((prev) => (prev === 'SIGNUP' ? 'LOGIN' : 'SIGNUP'));
    setError('');
    setAgreeToTerms(false);
  };

  const handleSendOtp = async () => {
    // 1. Validation
    if (phone.length < 10) {
      setError('Please enter a valid mobile number');
      return;
    }
    if (mode === 'SIGNUP' && !agreeToTerms) {
      setError('You must agree to the Terms of Use');
      return;
    }

    try {
      setLoading(true);
      setError('');
      Keyboard.dismiss();

      const formattedPhone = `+91${phone}`;

      // 2. Check User Existence
      const checkRes = await authApi.checkPhone(formattedPhone);
      const userExists = checkRes.data.data.exists;

      // 3. Logic Handling
      if (mode === 'SIGNUP' && userExists) {
        Alert.alert(
          "Account Exists",
          "You already have an account. Please login.",
          [{ text: "Login Now", onPress: () => setMode('LOGIN') }]
        );
        setLoading(false);
        return;
      }

      if (mode === 'LOGIN' && !userExists) {
        Alert.alert(
          "Account Not Found",
          "No account found with this number. Please create an account.",
          [{ text: "Create Account", onPress: () => setMode('SIGNUP') }]
        );
        setLoading(false);
        return;
      }

      // 4. Send OTP — returns verificationId (plain string, safe for nav params)
      const verificationId = await firebaseAuth.signInWithPhone(formattedPhone);

      navigation.navigate('OtpVerification', {
        phone: formattedPhone,
        verificationId
      });

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a while before trying again.');
      } else if (err.message?.includes('quota')) {
        setError('SMS quota exceeded. Please try again later.');
      } else {
        setError('Failed to send verification code.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/loginimage.png')}
          style={styles.logo}
        />

        <Text style={styles.title}>
          {mode === 'SIGNUP' ? 'Be a Servanza Buddy' : 'Welcome Back!'}
        </Text>

        <Text style={styles.subtitle}>
          {mode === 'SIGNUP'
            ? 'Join our community of professionals'
            : 'Login to manage your jobs'}
        </Text>

        <TextInput
          mode="outlined"
          label="Mobile Number"
          value={phone}
          onChangeText={(text) => {
            setPhone(text.replace(/[^0-9]/g, ''));
            setError('');
          }}
          keyboardType="number-pad"
          maxLength={10}
          left={<TextInput.Affix text="+91 " />}
          style={styles.input}
          activeOutlineColor={COLORS.primary}
          error={!!error}
        />

        <HelperText type="error" visible={!!error}>{error}</HelperText>

        {mode === 'SIGNUP' && (
          <View style={styles.termsContainer}>
            <Checkbox.Android
              status={agreeToTerms ? 'checked' : 'unchecked'}
              onPress={() => setAgreeToTerms(!agreeToTerms)}
              color={COLORS.primary}
            />
            <Text style={styles.termsText} onPress={() => setAgreeToTerms(!agreeToTerms)}>
              I agree to the <Text style={styles.link}>Terms of Use</Text> & <Text style={styles.link}>Privacy Policy</Text>
            </Text>
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleSendOtp}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={{ height: 50 }}
        >
          {mode === 'SIGNUP' ? 'Get OTP' : 'Login'}
        </Button>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {mode === 'SIGNUP' ? 'Already have an account?' : "Don't have an account?"}
          </Text>
          <TouchableOpacity onPress={toggleMode}>
            <Text style={styles.footerLink}>
              {mode === 'SIGNUP' ? ' Login Now' : ' Create Account'}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  logo: { width: 100, height: 100, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.charcoal, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.mediumGray, textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: COLORS.white, marginBottom: 5 },
  termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  termsText: { flex: 1, fontSize: 14, color: COLORS.mediumGray, marginLeft: 8 },
  link: { color: COLORS.primary, fontWeight: 'bold' },
  button: { borderRadius: 12, backgroundColor: COLORS.primary, marginTop: 10 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: COLORS.mediumGray, fontSize: 15 },
  footerLink: { color: COLORS.primary, fontWeight: 'bold', fontSize: 15 },
});