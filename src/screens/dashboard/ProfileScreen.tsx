import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { Button, List, Divider, Avatar, Card, Surface } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../../config/theme';
import { logout } from '../../store/slices/authSlice';
import { fetchProfile } from '../../store/slices/buddySlice';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const { user } = useSelector((state: any) => state.auth);
  const { profile } = useSelector((state: any) => state.buddy);

  useEffect(() => {
    dispatch(fetchProfile());
  }, []);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", onPress: () => dispatch(logout()), style: 'destructive' }
      ]
    );
  };

  const buddyImage = user?.profileImage || profile?.user?.profileImage || 'https://via.placeholder.com/150';
  const buddyName = user?.name || profile?.user?.name || 'Buddy';
  const buddyPhone = user?.phone || profile?.user?.phone || '+91 XXXXX XXXXX';
  const isVerified = profile?.isVerified || false;

  // Get verification status
  const verificationStatus = user?.verificationStatus || profile?.verificationStatus;

  // Get bank details
  const bankDetails = user?.bankDetails || profile?.bankDetails;
  const bankDetailsMethod = user?.bankDetailsMethod || profile?.bankDetailsMethod;

  // Get documents
  const documents = user?.documents || profile?.documents;

  const renderVerificationBadge = (verified: boolean) => {
    if (verified) {
      return (
        <View style={styles.verifiedTag}>
          <MaterialCommunityIcons name="check-circle" size={14} color={COLORS.primary} />
          <Text style={styles.verifiedTagText}>Verified</Text>
        </View>
      );
    }
    return (
      <View style={styles.pendingTag}>
        <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.warning} />
        <Text style={styles.pendingTagText}>Pending</Text>
      </View>
    );
  };

  const renderIdentificationSection = () => {
    const aadhaarFrontVerified = verificationStatus?.aadhaarFront?.verified || false;
    const aadhaarBackVerified = verificationStatus?.aadhaarBack?.verified || false;
    const panVerified = verificationStatus?.pan?.verified || false;

    return (
      <View style={[styles.section, SHADOWS.light]}>
        <Text style={styles.sectionTitle}>Identification Details</Text>

        {/* Aadhaar Front */}
        <View style={styles.documentRow}>
          <View style={styles.documentInfo}>
            <MaterialCommunityIcons name="card-account-details" size={24} color={COLORS.primary} />
            <Text style={styles.documentLabel}>Aadhaar Card (Front)</Text>
          </View>
          <View style={styles.documentStatus}>
            {documents?.aadhaarFront ? (
              <>
                {renderVerificationBadge(aadhaarFrontVerified)}
                <MaterialCommunityIcons name="lock" size={16} color={COLORS.mediumGray} style={{ marginLeft: 8 }} />
              </>
            ) : (
              <Text style={styles.notSubmittedText}>Not Submitted</Text>
            )}
          </View>
        </View>
        <Divider style={styles.divider} />

        {/* Aadhaar Back */}
        <View style={styles.documentRow}>
          <View style={styles.documentInfo}>
            <MaterialCommunityIcons name="card-account-details-outline" size={24} color={COLORS.primary} />
            <Text style={styles.documentLabel}>Aadhaar Card (Back)</Text>
          </View>
          <View style={styles.documentStatus}>
            {documents?.aadhaarBack ? (
              <>
                {renderVerificationBadge(aadhaarBackVerified)}
                <MaterialCommunityIcons name="lock" size={16} color={COLORS.mediumGray} style={{ marginLeft: 8 }} />
              </>
            ) : (
              <Text style={styles.notSubmittedText}>Not Submitted</Text>
            )}
          </View>
        </View>
        <Divider style={styles.divider} />

        {/* PAN */}
        <View style={styles.documentRow}>
          <View style={styles.documentInfo}>
            <MaterialCommunityIcons name="card-text" size={24} color={COLORS.primary} />
            <Text style={styles.documentLabel}>PAN Card</Text>
          </View>
          <View style={styles.documentStatus}>
            {documents?.pan ? (
              <>
                {renderVerificationBadge(panVerified)}
                <MaterialCommunityIcons name="lock" size={16} color={COLORS.mediumGray} style={{ marginLeft: 8 }} />
              </>
            ) : (
              <Text style={styles.notSubmittedText}>Not Submitted</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderBankDetailsSection = () => {
    const bankDetailsVerified = verificationStatus?.bankDetails?.verified || false;
    const bankDetailsRejected = verificationStatus?.bankDetails?.comment ? true : false;
    const hasBankDetails = bankDetails && (bankDetails.accountNumber || bankDetails.bankDocument);

    // Navigate to BankDetails screen with appropriate mode
    const handleBankDetailsTap = () => {
      if (!hasBankDetails) {
        // Not submitted - go to submit
        navigation.navigate('BankDetails', { mode: 'submit' });
      } else if (bankDetailsRejected) {
        // Rejected - go to update
        navigation.navigate('BankDetails', { mode: 'update', rejectedField: 'bankDetails' });
      }
      // If verified, do nothing (locked)
    };

    // Determine if the section should be clickable
    const isClickable = !hasBankDetails || bankDetailsRejected;

    return (
      <View style={[styles.section, SHADOWS.light]}>
        <Text style={styles.sectionTitle}>Bank Details</Text>

        {!hasBankDetails ? (
          // Not submitted - show submit option
          <View style={styles.notSubmittedContainer}>
            <MaterialCommunityIcons name="bank-off" size={40} color={COLORS.mediumGray} />
            <Text style={styles.notSubmittedText}>Bank details not submitted yet</Text>
            <Button
              mode="contained"
              onPress={handleBankDetailsTap}
              style={styles.submitButton}
              labelStyle={styles.submitButtonLabel}
            >
              Submit Bank Details
            </Button>
          </View>
        ) : bankDetailsMethod === 'DOCUMENT_UPLOAD' ? (
          // Document upload method
          <View>
            <View style={styles.documentRow}>
              <View style={styles.documentInfo}>
                <MaterialCommunityIcons name="file-document" size={24} color={COLORS.primary} />
                <Text style={styles.documentLabel}>Bank Document</Text>
              </View>
              <View style={styles.documentStatus}>
                {renderVerificationBadge(bankDetailsVerified)}
                {bankDetailsVerified && (
                  <MaterialCommunityIcons name="lock" size={16} color={COLORS.mediumGray} style={{ marginLeft: 8 }} />
                )}
              </View>
            </View>
            {bankDetailsRejected && !bankDetailsVerified && (
              <View style={styles.rejectionContainer}>
                <Text style={styles.rejectionText}>Rejected: {verificationStatus?.bankDetails?.comment}</Text>
                <Button
                  mode="outlined"
                  onPress={handleBankDetailsTap}
                  style={styles.updateButton}
                  labelStyle={styles.updateButtonLabel}
                >
                  Update Document
                </Button>
              </View>
            )}
          </View>
        ) : (
          // Account details method - show the details (read-only)
          <View style={styles.bankDetailsContainer}>
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>Account Holder</Text>
              <Text style={styles.bankDetailValue}>{bankDetails.accountHolderName || '-'}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>Account Number</Text>
              <Text style={styles.bankDetailValue}>
                {'*'.repeat(Math.max(0, (bankDetails.accountNumber?.length || 4) - 4))}
                {bankDetails.accountNumber?.slice(-4) || '-'}
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>IFSC Code</Text>
              <Text style={styles.bankDetailValue}>{bankDetails.ifscCode || '-'}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>Bank Name</Text>
              <Text style={styles.bankDetailValue}>{bankDetails.bankName || '-'}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>Status</Text>
              {renderVerificationBadge(bankDetailsVerified)}
            </View>
            {bankDetailsVerified ? (
              <View style={styles.lockNotice}>
                <MaterialCommunityIcons name="lock" size={14} color={COLORS.mediumGray} />
                <Text style={styles.lockNoticeText}>Bank details cannot be changed</Text>
              </View>
            ) : bankDetailsRejected ? (
              <View style={styles.rejectionContainer}>
                <Text style={styles.rejectionText}>Rejected: {verificationStatus?.bankDetails?.comment}</Text>
                <Button
                  mode="outlined"
                  onPress={handleBankDetailsTap}
                  style={styles.updateButton}
                  labelStyle={styles.updateButtonLabel}
                >
                  Update Bank Details
                </Button>
              </View>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.offWhite }} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Avatar.Image
            size={80}
            source={{ uri: buddyImage }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{buddyName}</Text>
          <Text style={styles.phone}>{buddyPhone}</Text>

          <View style={[styles.badge, isVerified ? styles.verified : styles.pending]}>
            <MaterialCommunityIcons
              name={isVerified ? "check-decagram" : "clock-outline"}
              size={16}
              color={COLORS.white}
            />
            <Text style={styles.badgeText}>
              {isVerified ? "Verified Partner" : "Verification Pending"}
            </Text>
          </View>
        </View>

        {/* Personal Information */}
        <View style={[styles.section, SHADOWS.light]}>
          <List.Section>
            {/* <List.Subheader>Account Settings</List.Subheader> */}

            <List.Item
              title="Personal Information"
              left={props => <List.Icon {...props} icon="account-edit-outline" color={COLORS.primary} />}
              onPress={() => navigation.navigate('EditProfile')}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </List.Section>
        </View>

        {/* Identification Details */}
        {renderIdentificationSection()}

        {/* Bank Details */}
        {renderBankDetailsSection()}

        {/* Service Area & Skills */}
        <View style={[styles.section, SHADOWS.light]}>
          <List.Section>
            <List.Item
              title="Service Area"
              left={props => <List.Icon {...props} icon="map-marker-radius-outline" color={COLORS.primary} />}
              onPress={() => navigation.navigate('ServiceSelection')}
              right={props => <List.Icon {...props} icon="chevron-right" />}
            />
          </List.Section>
        </View>

        <Button
          mode="outlined"
          onPress={handleLogout}
          style={styles.logoutBtn}
          textColor={COLORS.error}
          icon="logout"
        >
          Logout
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    alignItems: 'center', paddingVertical: 30, backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24, ...SHADOWS.medium
  },
  avatar: { marginBottom: 10, backgroundColor: COLORS.lightGray },
  name: { fontSize: 22, fontWeight: 'bold', color: COLORS.charcoal },
  phone: { fontSize: 14, color: COLORS.mediumGray, marginBottom: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  verified: { backgroundColor: COLORS.primary },
  pending: { backgroundColor: COLORS.warning },
  badgeText: { color: COLORS.white, fontWeight: 'bold', fontSize: 12, marginLeft: 5 },
  section: { marginTop: 16, marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.charcoal, padding: 16, paddingBottom: 8 },
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  documentInfo: { flexDirection: 'row', alignItems: 'center' },
  documentLabel: { marginLeft: 12, fontSize: 15, color: COLORS.charcoal },
  documentStatus: { flexDirection: 'row', alignItems: 'center' },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  verifiedTagText: { fontSize: 12, color: COLORS.primary, marginLeft: 4, fontWeight: '500' },
  pendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  pendingTagText: { fontSize: 12, color: COLORS.warning, marginLeft: 4, fontWeight: '500' },
  notSubmittedContainer: { alignItems: 'center', padding: 20 },
  notSubmittedText: { color: COLORS.mediumGray, marginTop: 8 },
  bankDetailsContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12
  },
  bankDetailLabel: { fontSize: 14, color: COLORS.mediumGray },
  bankDetailValue: { fontSize: 14, color: COLORS.charcoal, fontWeight: '500' },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8
  },
  lockNoticeText: { fontSize: 12, color: COLORS.mediumGray, marginLeft: 6 },
  divider: { marginHorizontal: 16 },
  logoutBtn: { margin: 20, borderColor: COLORS.error },
  submitButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  submitButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  updateButton: {
    marginTop: 12,
    borderColor: COLORS.primary,
    borderRadius: 8,
  },
  updateButtonLabel: {
    fontSize: 14,
    color: COLORS.primary,
  },
  rejectionContainer: {
    padding: 16,
    backgroundColor: '#FFF3F3',
    borderTopWidth: 1,
    borderTopColor: '#FFE0E0',
  },
  rejectionText: {
    fontSize: 13,
    color: '#D32F2F',
    marginBottom: 8,
  },
});