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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }} edges={['left', 'right', 'bottom']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <Avatar.Image
            size={90}
            source={{ uri: buddyImage }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{buddyName}</Text>
          <Text style={styles.phone}>{buddyPhone}</Text>

          <View style={[styles.badge, isVerified ? styles.verified : styles.pending]}>
            <MaterialCommunityIcons
              name={isVerified ? "check-decagram" : "clock-outline"}
              size={16}
              color={isVerified ? "#fff" : "#fff"}
            />
            <Text style={styles.badgeText}>
              {isVerified ? "Verified Partner" : "Verification Pending"}
            </Text>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          {/* Personal Information */}
          <View style={styles.section}>
            <List.Section>
              <List.Item
                title="Personal Information"
                titleStyle={styles.listItemTitle}
                left={props => <List.Icon {...props} icon="account-edit-outline" color="#2D6A4F" />}
                onPress={() => navigation.navigate('EditProfile')}
                right={props => <List.Icon {...props} icon="chevron-right" color="#D0D0D0" />}
                style={styles.listItem}
              />
            </List.Section>
          </View>

          {/* Identification Details */}
          {renderIdentificationSection()}

          {/* Bank Details */}
          {renderBankDetailsSection()}

          {/* Logout Button */}
          <Button
            mode="outlined"
            onPress={handleLogout}
            style={styles.logoutBtn}
            labelStyle={styles.logoutBtnLabel}
            icon="logout"
          >
            Logout
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  avatar: {
    marginBottom: 16,
    backgroundColor: '#E8E8E8',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  phone: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  verified: {
    backgroundColor: '#2D6A4F',
  },
  pending: {
    backgroundColor: '#F59E0B',
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.charcoal,
    padding: 16,
    paddingBottom: 8,
  },
  listItem: {
    paddingVertical: 4,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentLabel: {
    marginLeft: 12,
    fontSize: 15,
    color: COLORS.charcoal,
    fontWeight: '500',
  },
  documentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verifiedTagText: {
    fontSize: 12,
    color: '#2D6A4F',
    marginLeft: 4,
    fontWeight: '600',
  },
  pendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingTagText: {
    fontSize: 12,
    color: '#F59E0B',
    marginLeft: 4,
    fontWeight: '600',
  },
  notSubmittedContainer: {
    alignItems: 'center',
    padding: 24,
  },
  notSubmittedText: {
    color: '#6B7280',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  bankDetailsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  bankDetailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  bankDetailValue: {
    fontSize: 14,
    color: COLORS.charcoal,
    fontWeight: '600',
  },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  lockNoticeText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  divider: {
    backgroundColor: '#E8E8E8',
    height: 1,
  },
  logoutBtn: {
    marginTop: 10,
    borderColor: '#E17A5E',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 6,
  },
  logoutBtnLabel: {
    color: '#E17A5E',
    fontWeight: '700',
    fontSize: 15,
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#2D6A4F',
    borderRadius: 10,
    paddingHorizontal: 16,
  },
  submitButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  updateButton: {
    marginTop: 12,
    borderColor: '#2D6A4F',
    borderWidth: 1.5,
    borderRadius: 10,
  },
  updateButtonLabel: {
    fontSize: 14,
    color: '#2D6A4F',
    fontWeight: '700',
  },
  rejectionContainer: {
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderTopWidth: 1,
    borderTopColor: '#FFCDD2',
  },
  rejectionText: {
    fontSize: 14,
    color: '#B71C1C',
    marginBottom: 12,
    fontWeight: '500',
  },
});