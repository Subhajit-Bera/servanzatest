import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, TextInput, HelperText } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { buddyApi } from '../../api/client';
import { restoreSession } from '../../store/slices/authSlice';
import { COLORS, SHADOWS } from '../../config/theme';

export default function EmergencyContactScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch<any>();
  const { user } = useSelector((state: RootState) => state.auth);
  const isUpdateMode = route.params?.mode === 'update';

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: user?.emergencyContact?.name || '',
    relationship: user?.emergencyContact?.relationship || '',
    phone: user?.emergencyContact?.phone || '',
  });

  useEffect(() => {
    if (user?.emergencyContact) {
      setForm({
        name: user.emergencyContact.name || '',
        relationship: user.emergencyContact.relationship || '',
        phone: user.emergencyContact.phone || '',
      });
    }
  }, [user]);

  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    let newErrors: any = {};
    if (!form.name) newErrors.name = "Full Name is required";
    if (!form.relationship) newErrors.relationship = "Relationship is required";
    if (!form.phone || form.phone.length < 10) newErrors.phone = "Valid Phone Number is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      await buddyApi.updateProfile({
        emergencyContact: form
      });

      await dispatch(restoreSession());

      if (isUpdateMode) {
        Alert.alert('Success', 'Emergency contact updated successfully!', [
          { text: 'OK', onPress: () => navigation.navigate('VerificationPending') }
        ]);
      } else {
        navigation.navigate('VerificationPending');
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          {isUpdateMode ? 'Update Emergency Contact' : 'Emergency Details'}
        </Text>
        <Text style={styles.subtitle}>
          {isUpdateMode
            ? 'Your emergency contact details were rejected. Please update them.'
            : 'Please provide the Emergency Details, it will help us to reach you if any emergency came up.'}
        </Text>

        <View style={[styles.card, SHADOWS.medium]}>
          <TextInput
            label="Full Name of Contact"
            mode="outlined"
            value={form.name}
            onChangeText={t => setForm({ ...form, name: t })}
            style={styles.input}
            error={!!errors.name}
            activeOutlineColor={COLORS.primary}
          />
          <HelperText type="error" visible={!!errors.name}>{errors.name}</HelperText>

          <TextInput
            label="Relationship to You"
            mode="outlined"
            value={form.relationship}
            onChangeText={t => setForm({ ...form, relationship: t })}
            style={styles.input}
            error={!!errors.relationship}
            activeOutlineColor={COLORS.primary}
          />
          <HelperText type="error" visible={!!errors.relationship}>{errors.relationship}</HelperText>

          <TextInput
            label="Phone Number"
            mode="outlined"
            value={form.phone}
            onChangeText={t => setForm({ ...form, phone: t.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            maxLength={10}
            style={styles.input}
            error={!!errors.phone}
            activeOutlineColor={COLORS.primary}
          />
          <HelperText type="error" visible={!!errors.phone}>{errors.phone}</HelperText>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            style={[styles.button, SHADOWS.green]}
            contentStyle={{ height: 50 }}
          >
            {isUpdateMode ? 'Submit' : 'Continue'}
          </Button>

          {isUpdateMode && (
            <Button
              mode="text"
              onPress={handleCancel}
              textColor={COLORS.mediumGray}
              style={{ marginTop: 10 }}
            >
              Cancel
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.offWhite, padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.charcoal, marginBottom: 8 },
  subtitle: { fontSize: 15, color: COLORS.mediumGray, marginBottom: 24, lineHeight: 22 },
  card: { backgroundColor: COLORS.white, padding: 20, borderRadius: 16 },
  input: { backgroundColor: COLORS.white, marginBottom: 2 },
  button: { marginTop: 15, borderRadius: 12, backgroundColor: COLORS.primary },
});