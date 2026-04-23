import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { Button } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { buddyApi } from '../../api/client';
import { restoreSession } from '../../store/slices/authSlice';
import { COLORS, SHADOWS } from '../../config/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function IdentificationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const dispatch = useDispatch<any>();
  const [loading, setLoading] = useState(false);

  // Check if we're in update mode for a specific rejected field
  const rejectedField = route.params?.rejectedField;
  const isUpdateMode = route.params?.mode === 'update';

  const [docs, setDocs] = useState<{ [key: string]: string | null }>({
    aadhaarFront: null,
    aadhaarBack: null,
    pan: null
  });

  const pickDoc = async (type: string) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setDocs(prev => ({ ...prev, [type]: result.assets[0].uri }));
    }
  };

  // For update mode - only upload the rejected field
  const handleUpdate = async () => {
    if (!rejectedField || !docs[rejectedField]) {
      Alert.alert('Required', `Please upload the ${getFieldLabel(rejectedField)} image.`);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri: docs[rejectedField], name: `${rejectedField}.jpg`, type: 'image/jpeg' } as any);
      formData.append('documentType', rejectedField);

      console.log(`[Identification] Uploading ${rejectedField}...`);

      // Retry logic for Network Error (common in React Native)
      let lastError: any = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await buddyApi.uploadDocument(formData);
          console.log(`[Identification] Upload successful for ${rejectedField}`);

          await dispatch(restoreSession());

          Alert.alert('Success', 'Document updated successfully!', [
            { text: 'OK', onPress: () => navigation.navigate('VerificationPending') }
          ]);
          return; // Success, exit function
        } catch (err: any) {
          lastError = err;
          console.warn(`[Identification] Upload attempt ${attempt} failed:`, err.message);

          // Only retry on Network Error
          if (err.message === 'Network Error' && attempt < 2) {
            console.log(`[Identification] Retrying upload...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
            continue;
          }
          throw err; // Rethrow non-network errors or final attempt
        }
      }

    } catch (error: any) {
      console.error('[Identification] Upload error:', error);
      console.error('[Identification] Error response:', error.response?.data);

      // Show more detailed error message
      const errorMessage = error.response?.data?.message || error.message || 'Please try again.';
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to upload with retry
  const uploadWithRetry = async (formData: FormData, docType: string): Promise<void> => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Identification] Uploading ${docType} (attempt ${attempt})...`);
        await buddyApi.uploadDocument(formData);
        console.log(`[Identification] Upload successful for ${docType}`);
        return; // Success
      } catch (err: any) {
        console.warn(`[Identification] Upload attempt ${attempt} for ${docType} failed:`, err.message);
        if (err.message === 'Network Error' && attempt < 2) {
          console.log(`[Identification] Retrying ${docType} upload...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw err;
      }
    }
  };

  // For onboarding mode - upload all documents
  const handleContinue = async () => {
    if (!docs.aadhaarFront || !docs.aadhaarBack || !docs.pan) {
      Alert.alert('Required', 'Please upload Aadhaar front, Aadhaar back, and PAN card.');
      return;
    }

    setLoading(true);
    try {
      // Upload Aadhaar Front with retry
      const formDataFront = new FormData();
      formDataFront.append('file', { uri: docs.aadhaarFront, name: 'aadhaarFront.jpg', type: 'image/jpeg' } as any);
      formDataFront.append('documentType', 'aadhaarFront');
      await uploadWithRetry(formDataFront, 'aadhaarFront');

      // Upload Aadhaar Back with retry
      const formDataBack = new FormData();
      formDataBack.append('file', { uri: docs.aadhaarBack, name: 'aadhaarBack.jpg', type: 'image/jpeg' } as any);
      formDataBack.append('documentType', 'aadhaarBack');
      await uploadWithRetry(formDataBack, 'aadhaarBack');

      // Upload PAN with retry
      const formPan = new FormData();
      formPan.append('file', { uri: docs.pan, name: 'pan.jpg', type: 'image/jpeg' } as any);
      formPan.append('documentType', 'pan');
      await uploadWithRetry(formPan, 'pan');

      await dispatch(restoreSession());
      navigation.navigate('BankDetails');
    } catch (error: any) {
      console.error('[Identification] Upload error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Please try again.';
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'aadhaarFront': return 'Aadhaar Card (Front)';
      case 'aadhaarBack': return 'Aadhaar Card (Back)';
      case 'pan': return 'PAN Card';
      default: return field;
    }
  };

  const UploadBox = ({ label, type }: { label: string, type: string }) => (
    <View style={styles.uploadContainer}>
      <Text style={styles.label}>{label} <Text style={{ color: 'red' }}>*</Text></Text>
      <TouchableOpacity style={styles.uploadBox} onPress={() => pickDoc(type)}>
        {docs[type] ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: docs[type]! }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => pickDoc(type)}
            >
              <MaterialCommunityIcons name="camera-retake" size={16} color={COLORS.white} />
              <Text style={styles.changeButtonText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadPlaceholder}>
            <MaterialCommunityIcons name="camera-plus" size={40} color={COLORS.mediumGray} />
            <Text style={styles.uploadText}>Tap to upload Image</Text>
            <Text style={styles.uploadHint}>PNG, JPG, JPEG only</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  // UPDATE MODE: Show only the rejected field
  if (isUpdateMode && rejectedField) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Update {getFieldLabel(rejectedField)}</Text>
        <Text style={styles.sub}>
          Your {getFieldLabel(rejectedField)} was rejected. Please upload a clear image.
        </Text>

        <UploadBox label={getFieldLabel(rejectedField)} type={rejectedField} />

        <Button
          mode="contained"
          onPress={handleUpdate}
          loading={loading}
          disabled={!docs[rejectedField]}
          style={[styles.btn, SHADOWS.green]}
          contentStyle={{ height: 50 }}
        >
          Submit
        </Button>

        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          textColor={COLORS.mediumGray}
          style={{ marginTop: 10 }}
        >
          Cancel
        </Button>
      </ScrollView>
    );
  }

  // ONBOARDING MODE: Show all fields
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Identification Details</Text>
      <Text style={styles.sub}>Upload clean images of your Aadhaar (front and back) and PAN card.</Text>

      <UploadBox label="Aadhaar Card (Front)" type="aadhaarFront" />
      <UploadBox label="Aadhaar Card (Back)" type="aadhaarBack" />
      <UploadBox label="PAN Card" type="pan" />

      <Button
        mode="contained"
        onPress={handleContinue}
        loading={loading}
        style={[styles.btn, SHADOWS.green]}
        contentStyle={{ height: 50 }}
      >
        Continue
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 60,
    flexGrow: 1,
    backgroundColor: COLORS.offWhite
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  sub: {
    color: COLORS.mediumGray,
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 22,
  },
  uploadContainer: {
    marginBottom: 20
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: COLORS.charcoal,
  },
  uploadBox: {
    minHeight: 150,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    padding: 20,
  },
  uploadText: {
    color: COLORS.mediumGray,
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  uploadHint: {
    color: COLORS.mediumGray,
    marginTop: 4,
    fontSize: 12,
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
  btn: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: COLORS.primary
  }
});