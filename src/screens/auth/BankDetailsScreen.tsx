import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { Button, TextInput, HelperText } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { RootState } from '../../store';
import { buddyApi } from '../../api/client';
import { restoreSession } from '../../store/slices/authSlice';
import { COLORS, SHADOWS } from '../../config/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type MethodType = 'ACCOUNT_DETAILS' | 'DOCUMENT_UPLOAD';

export default function BankDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch<any>();

  const { user } = useSelector((state: RootState) => state.auth);
  const isUpdateMode = route.params?.mode === 'update';
  const isSubmitMode = route.params?.mode === 'submit'; // Coming from VerificationPending

  const [loading, setLoading] = useState(false);

  // Check if method is already locked (previously submitted)
  const existingMethod = user?.bankDetailsMethod;
  // const [method, setMethod] = useState<MethodType | null>(existingMethod || null);
  const [method, setMethod] = useState<MethodType | null>(existingMethod || 'ACCOUNT_DETAILS');
  const [methodLocked, setMethodLocked] = useState(!!existingMethod);

  const [form, setForm] = useState({
    accountNumber: user?.bankDetails?.accountNumber || '',
    ifscCode: user?.bankDetails?.ifscCode || '',
    accountHolderName: user?.bankDetails?.accountHolderName || '',
    bankName: user?.bankDetails?.bankName || '',
  });

  const [bankDocument, setBankDocument] = useState<string | null>(user?.bankDetails?.bankDocument || null);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (user?.bankDetails) {
      setForm({
        accountNumber: user.bankDetails.accountNumber || '',
        ifscCode: user.bankDetails.ifscCode || '',
        accountHolderName: user.bankDetails.accountHolderName || '',
        bankName: user.bankDetails.bankName || '',
      });
      if (user.bankDetails.bankDocument) {
        setBankDocument(user.bankDetails.bankDocument);
      }
    }
  }, [user]);

  const pickBankDocument = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setBankDocument(result.assets[0].uri);
    }
  };

  const validate = () => {
    let newErrors: any = {};

    if (!method) {
      Alert.alert('Select Method', 'Please choose a submission method first.');
      return false;
    }

    if (method === 'ACCOUNT_DETAILS') {
      if (!form.accountNumber || form.accountNumber.length < 8) newErrors.accountNumber = "Valid Account Number required";
      if (!form.ifscCode || form.ifscCode.length !== 11) newErrors.ifscCode = "Valid 11-digit IFSC required";
      if (!form.accountHolderName) newErrors.accountHolderName = "Holder Name required";
    } else {
      if (!bankDocument) newErrors.bankDocument = "Please upload cancelled check or passbook";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      let bankDetailsData: any = {};

      if (method === 'ACCOUNT_DETAILS') {
        bankDetailsData = {
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          accountHolderName: form.accountHolderName,
          bankName: form.bankName,
        };
      } else {
        if (bankDocument && bankDocument.startsWith('file://')) {
          const formData = new FormData();
          formData.append('file', {
            uri: bankDocument,
            name: 'bankDocument.jpg',
            type: 'image/jpeg'
          } as any);
          formData.append('documentType', 'bankDocument');

          // Retry logic for Network Error (common in React Native)
          let uploadRes: any = null;
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              console.log(`[BankDetails] Uploading document (attempt ${attempt})...`);
              uploadRes = await buddyApi.uploadDocument(formData);
              console.log('[BankDetails] Upload successful');
              break; // Success, exit loop
            } catch (err: any) {
              console.warn(`[BankDetails] Upload attempt ${attempt} failed:`, err.message);
              if (err.message === 'Network Error' && attempt < 2) {
                console.log('[BankDetails] Retrying upload...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }
              throw err; // Rethrow on final attempt or non-network error
            }
          }

          if (uploadRes?.data?.data?.url) {
            bankDetailsData = { bankDocument: uploadRes.data.data.url };
          }
        } else if (bankDocument) {
          bankDetailsData = { bankDocument };
        }
      }

      await buddyApi.updateProfile({
        bankDetails: bankDetailsData,
        bankDetailsMethod: method,
      });

      setMethodLocked(true);
      await dispatch(restoreSession());

      if (isUpdateMode || isSubmitMode) {
        // If user is already verified, just go back to Profile
        // If not verified, they're in onboarding flow - go to VerificationPending
        const isVerified = user?.isVerified;
        Alert.alert('Success', 'Bank details saved successfully!', [
          {
            text: 'OK',
            onPress: () => {
              if (isVerified) {
                // Already verified - go back to Profile
                navigation.goBack();
              } else {
                // Not verified yet - go to VerificationPending (onboarding flow)
                navigation.navigate('VerificationPending');
              }
            }
          }
        ]);
      } else {
        navigation.navigate('EmergencyContact');
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save bank details');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Navigate directly to EmergencyContact without dispatching restoreSession
    navigation.navigate('EmergencyContact');
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const selectMethod = (selectedMethod: MethodType) => {
    if (methodLocked) return;
    setMethod(selectedMethod);
    setErrors({});
  };

  // Method selection buttons
  const MethodSelector = () => (
    <View style={styles.methodContainer}>
      <Text style={styles.methodTitle}>How would you like to submit?</Text>
      <View style={styles.methodButtonsRow}>
        <TouchableOpacity
          style={[
            styles.methodButton,
            method === 'ACCOUNT_DETAILS' && styles.methodButtonActive,
            methodLocked && method !== 'ACCOUNT_DETAILS' && styles.methodButtonDisabled
          ]}
          onPress={() => selectMethod('ACCOUNT_DETAILS')}
          disabled={methodLocked && method !== 'ACCOUNT_DETAILS'}
        >
          <MaterialCommunityIcons
            name="keyboard"
            size={28}
            color={method === 'ACCOUNT_DETAILS' ? COLORS.white : COLORS.primary}
          />
          <Text style={[
            styles.methodButtonText,
            method === 'ACCOUNT_DETAILS' && styles.methodButtonTextActive
          ]}>
            Enter Manually
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.methodButton,
            method === 'DOCUMENT_UPLOAD' && styles.methodButtonActive,
            methodLocked && method !== 'DOCUMENT_UPLOAD' && styles.methodButtonDisabled
          ]}
          onPress={() => selectMethod('DOCUMENT_UPLOAD')}
          disabled={methodLocked && method !== 'DOCUMENT_UPLOAD'}
        >
          <MaterialCommunityIcons
            name="file-image"
            size={28}
            color={method === 'DOCUMENT_UPLOAD' ? COLORS.white : COLORS.primary}
          />
          <Text style={[
            styles.methodButtonText,
            method === 'DOCUMENT_UPLOAD' && styles.methodButtonTextActive
          ]}>
            Upload Document
          </Text>
        </TouchableOpacity>
      </View>
      {methodLocked && (
        <View style={styles.lockedNotice}>
          <MaterialCommunityIcons name="lock" size={14} color={COLORS.mediumGray} />
          <Text style={styles.lockedNoticeText}>Method locked after submission</Text>
        </View>
      )}
    </View>
  );

  // Account details form
  const AccountDetailsForm = () => (
    <View style={styles.formSection}>
      <TextInput
        label="Account Holder Name *"
        mode="outlined"
        value={form.accountHolderName}
        onChangeText={t => setForm({ ...form, accountHolderName: t })}
        error={!!errors.accountHolderName}
        style={styles.input}
        activeOutlineColor={COLORS.primary}
      />
      <HelperText type="error" visible={!!errors.accountHolderName}>{errors.accountHolderName}</HelperText>

      <TextInput
        label="Account Number *"
        mode="outlined"
        value={form.accountNumber}
        onChangeText={t => setForm({ ...form, accountNumber: t.replace(/[^0-9]/g, '') })}
        keyboardType="number-pad"
        error={!!errors.accountNumber}
        style={styles.input}
        activeOutlineColor={COLORS.primary}
      />
      <HelperText type="error" visible={!!errors.accountNumber}>{errors.accountNumber}</HelperText>

      <TextInput
        label="IFSC Code *"
        mode="outlined"
        value={form.ifscCode}
        onChangeText={t => setForm({ ...form, ifscCode: t.toUpperCase() })}
        autoCapitalize="characters"
        maxLength={11}
        error={!!errors.ifscCode}
        style={styles.input}
        activeOutlineColor={COLORS.primary}
      />
      <HelperText type="error" visible={!!errors.ifscCode}>{errors.ifscCode}</HelperText>

      <TextInput
        label="Bank Name (Optional)"
        mode="outlined"
        value={form.bankName}
        onChangeText={t => setForm({ ...form, bankName: t })}
        style={styles.input}
        activeOutlineColor={COLORS.primary}
      />
    </View>
  );

  // Document upload section
  const DocumentUploadSection = () => (
    <View style={styles.formSection}>
      <Text style={styles.uploadLabel}>Cancelled Check / Passbook <Text style={{ color: 'red' }}>*</Text></Text>
      <Text style={styles.uploadHint}>Upload a clear image (PNG, JPG, JPEG only)</Text>
      <TouchableOpacity style={styles.uploadBox} onPress={pickBankDocument}>
        {bankDocument ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: bankDocument }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.changeButton}
              onPress={pickBankDocument}
            >
              <MaterialCommunityIcons name="camera-retake" size={16} color={COLORS.white} />
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadPlaceholder}>
            <MaterialCommunityIcons name="camera-plus" size={40} color={COLORS.mediumGray} />
            <Text style={{ color: COLORS.mediumGray, marginTop: 8 }}>Tap to upload Image</Text>
          </View>
        )}
      </TouchableOpacity>
      <HelperText type="error" visible={!!errors.bankDocument}>{errors.bankDocument}</HelperText>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          {isUpdateMode ? 'Update Bank Details' : isSubmitMode ? 'Submit Bank Details' : 'Bank Details'}
        </Text>
        <Text style={styles.subtitle}>
          {isUpdateMode
            ? 'Your bank details were rejected. Please update them.'
            : 'Add your bank account details or upload a cancelled check/passbook. You cannot change the method once submitted.'}
        </Text>

        <View style={[styles.card, SHADOWS.medium]}>
          <MethodSelector />

          {method === 'ACCOUNT_DETAILS' && <AccountDetailsForm />}
          {method === 'DOCUMENT_UPLOAD' && <DocumentUploadSection />}

          {method && (
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              style={[styles.button, SHADOWS.green]}
              contentStyle={{ height: 50 }}
            >
              {isUpdateMode || isSubmitMode ? 'Submit' : 'Save & Continue'}
            </Button>
          )}

          {isUpdateMode || isSubmitMode ? (
            <Button
              mode="text"
              onPress={handleCancel}
              textColor={COLORS.mediumGray}
              style={{ marginTop: 10 }}
            >
              Cancel
            </Button>
          ) : (
            <Button
              mode="text"
              onPress={handleSkip}
              textColor={COLORS.mediumGray}
              style={{ marginTop: 10 }}
            >
              Skip for now
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.offWhite,
    padding: 20,
    paddingTop: 60
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.mediumGray,
    marginBottom: 24,
    lineHeight: 22
  },
  card: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16
  },
  methodContainer: {
    marginBottom: 20
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: COLORS.charcoal,
    textAlign: 'center'
  },
  methodButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  methodButton: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white
  },
  methodButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  methodButtonDisabled: {
    opacity: 0.4,
    borderColor: COLORS.mediumGray
  },
  methodButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center'
  },
  methodButtonTextActive: {
    color: COLORS.white
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6
  },
  lockedNoticeText: {
    fontSize: 12,
    color: COLORS.mediumGray
  },
  formSection: {
    marginTop: 20
  },
  uploadLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: COLORS.charcoal,
  },
  uploadHint: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.white,
    marginBottom: 2
  },
  uploadBox: {
    minHeight: 180,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    padding: 20,
  },
  previewContainer: {
    width: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  changeButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: COLORS.primary
  },
});