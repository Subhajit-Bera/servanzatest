import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Button, TextInput, Checkbox, Avatar } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buddyApi } from '../../api/client';
import { COLORS, SHADOWS } from '../../config/theme';
import { RootState } from '../../store';

export default function ProfileCreationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useSelector((state: RootState) => state.auth);
  const { profile } = useSelector((state: RootState) => state.buddy);

  const [loading, setLoading] = useState(false);

  const isVerified = profile?.isVerified || false;
  // Only Read-Only if we are in Edit mode AND verified.
  // If we are in Onboarding mode (even if verified flag is somehow true), we let them edit.
  const isReadOnly = isVerified && route.name === 'EditProfile';

  const [form, setForm] = useState({
    name: '',
    email: '',
    dob: '',
    whatsapp: '',
    secondaryPhone: '',
    bloodGroup: '',
    city: '',
    permanentAddress: '',
    currentAddress: '',
    languages: '',
    profileImage: null as string | null,
  });

  const [sameAsPrimary, setSameAsPrimary] = useState(false);
  const [sameAsPermanent, setSameAsPermanent] = useState(false);

  useEffect(() => {
    const source = profile || user;

    if (source) {
      // Check if name is the default "User 1234" pattern
      let initialName = source.user?.name || source.name || '';
      if (initialName.startsWith('User ') && source.phone && initialName.includes(source.phone.slice(-4))) {
        initialName = ''; // Clear default name so user types their own
      }

      setForm({
        name: initialName,
        email: source.user?.email || source.email || '',
        dob: source.dob || '',
        whatsapp: source.whatsapp || '',
        secondaryPhone: source.secondaryPhone || '',
        bloodGroup: source.bloodGroup || '',
        city: source.city || '',
        permanentAddress: source.permanentAddress || '',
        currentAddress: source.currentAddress || '',
        languages: Array.isArray(source.languages)
          ? source.languages.join(', ')
          : (source.languages || ''),
        profileImage: source.user?.profileImage || source.profileImage || null,
      });
    }
  }, [profile, user]);

  // ... (handleSamePhone, handleSameAddress, pickImage - Keep existing code)
  const handleSamePhone = () => {
    if (isReadOnly) return;
    setSameAsPrimary(!sameAsPrimary);
    if (!sameAsPrimary && user?.phone) {
      setForm(prev => ({ ...prev, whatsapp: user.phone }));
    }
  };

  const handleSameAddress = () => {
    if (isReadOnly) return;
    setSameAsPermanent(!sameAsPermanent);
    if (!sameAsPermanent) {
      setForm(prev => ({ ...prev, currentAddress: prev.permanentAddress }));
    }
  };

  const pickImage = async () => {
    if (isReadOnly) {
      Alert.alert("Profile Locked", "You cannot change your photo after verification.");
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setForm({ ...form, profileImage: result.assets[0].uri });
    }
  };

  const handleSubmit = async () => {
    if (isReadOnly) {
      navigation.goBack();
      return;
    }

    if (!form.name || !form.email || !form.permanentAddress || !form.city || !form.dob) {
      Alert.alert('Missing Fields', 'Please fill all mandatory fields.');
      return;
    }

    setLoading(true);
    try {
      let finalProfileImageUrl = form.profileImage;

      if (form.profileImage && form.profileImage.startsWith('file://')) {
        const formData = new FormData();
        formData.append('file', {
          uri: form.profileImage,
          name: 'profile_pic.jpg',
          type: 'image/jpeg'
        } as any);

        const uploadRes = await buddyApi.uploadProfileImage(formData);
        if (uploadRes.data?.data?.profileImage) {
          finalProfileImageUrl = uploadRes.data.data.profileImage;
        }
      }

      const languagesArray = form.languages
        ? form.languages.split(',').map(lang => lang.trim()).filter(lang => lang.length > 0)
        : [];

      const payload = {
        name: form.name,
        email: form.email,
        dob: form.dob,
        whatsapp: form.whatsapp,
        secondaryPhone: form.secondaryPhone,
        bloodGroup: form.bloodGroup,
        city: form.city,
        permanentAddress: form.permanentAddress,
        currentAddress: form.currentAddress || form.permanentAddress,
        languages: languagesArray,
        profileImage: finalProfileImageUrl,
      };

      await buddyApi.updateProfile(payload);

      // ✅ Check route name to determine navigation
      if (route.name === 'EditProfile') {
        Alert.alert("Success", "Profile Updated");
        navigation.goBack();
      } else {
        navigation.navigate('Identification');
      }
    } catch (error: any) {
      console.error("Profile Update Error:", error);
      const msg = error.response?.data?.message || 'Failed to update profile.';
      // Extract validation details if available
      const details = error.response?.data?.errors?.map((e: any) => e.message).join('\n');
      Alert.alert('Error', details ? `${msg}\n${details}` : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.offWhite }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{isReadOnly ? "Personal Information" : "Complete Profile"}</Text>

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={pickImage} disabled={isReadOnly}>
            {form.profileImage ? (
              <Avatar.Image size={100} source={{ uri: form.profileImage }} />
            ) : (
              <Avatar.Icon size={100} icon="camera" />
            )}
          </TouchableOpacity>
          {!isReadOnly && <Text style={{ marginTop: 8, color: COLORS.primary }}>Change Photo</Text>}
        </View>

        <TextInput label="Full Name *" mode="outlined" value={form.name} onChangeText={t => setForm({ ...form, name: t })} style={styles.input} disabled={isReadOnly} />
        <TextInput label="Email *" mode="outlined" value={form.email} onChangeText={t => setForm({ ...form, email: t })} style={styles.input} disabled={isReadOnly} />
        <TextInput label="Date of Birth (DD/MM/YYYY) *" mode="outlined" value={form.dob} onChangeText={t => setForm({ ...form, dob: t })} style={styles.input} disabled={isReadOnly} />

        <TextInput label="Primary Phone" mode="outlined" value={user?.phone} disabled style={[styles.input, { backgroundColor: '#eee' }]} />

        <View style={styles.checkboxRow}>
          <Checkbox status={sameAsPrimary ? 'checked' : 'unchecked'} onPress={handleSamePhone} color={COLORS.primary} disabled={isReadOnly} />
          <Text onPress={handleSamePhone}>Whatsapp same as Primary?</Text>
        </View>
        <TextInput label="Whatsapp Number" mode="outlined" value={form.whatsapp} onChangeText={t => setForm({ ...form, whatsapp: t })} style={styles.input} keyboardType="number-pad" disabled={isReadOnly} />

        <TextInput label="Secondary Phone" mode="outlined" value={form.secondaryPhone} onChangeText={t => setForm({ ...form, secondaryPhone: t })} style={styles.input} keyboardType="number-pad" disabled={isReadOnly} />
        <TextInput label="Blood Group" mode="outlined" value={form.bloodGroup} onChangeText={t => setForm({ ...form, bloodGroup: t })} style={styles.input} disabled={isReadOnly} />
        <TextInput label="City *" mode="outlined" value={form.city} onChangeText={t => setForm({ ...form, city: t })} style={styles.input} disabled={isReadOnly} />

        <TextInput label="Permanent Address *" mode="outlined" multiline numberOfLines={3} value={form.permanentAddress} onChangeText={t => setForm({ ...form, permanentAddress: t })} style={styles.input} disabled={isReadOnly} />

        <View style={styles.checkboxRow}>
          <Checkbox status={sameAsPermanent ? 'checked' : 'unchecked'} onPress={handleSameAddress} color={COLORS.primary} disabled={isReadOnly} />
          <Text onPress={handleSameAddress}>Current address same as Permanent?</Text>
        </View>
        <TextInput label="Current Address" mode="outlined" multiline numberOfLines={3} value={form.currentAddress} onChangeText={t => setForm({ ...form, currentAddress: t })} style={styles.input} disabled={isReadOnly} />

        <TextInput label="Languages" mode="outlined" value={form.languages} onChangeText={t => setForm({ ...form, languages: t })} style={styles.input} disabled={isReadOnly} />

        {!isReadOnly && (
          <Button mode="contained" onPress={handleSubmit} loading={loading} style={[styles.button, SHADOWS.green]}>
            {route.name === 'EditProfile' ? "Save Changes" : "Continue"}
          </Button>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: COLORS.offWhite },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: COLORS.charcoal },
  input: { marginBottom: 12, backgroundColor: COLORS.white },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: -5 },
  button: { marginTop: 20, marginBottom: 40, borderRadius: 12, paddingVertical: 6, backgroundColor: COLORS.primary }
});