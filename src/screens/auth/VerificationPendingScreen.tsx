import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { Button, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../config/theme';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../store/hooks';
import { restoreSession } from '../../store/slices/authSlice';
import { buddyApi } from '../../api/client';

import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BuddyVerificationStatus } from '../../types';

export default function VerificationPendingScreen() {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const { user } = useAppSelector((state) => state.auth);
  const [verificationStatus, setVerificationStatus] = useState<BuddyVerificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const isMounted = useRef(true);

  // Check if bank details are submitted
  const hasBankDetails = user?.bankDetails &&
    (user.bankDetails.accountNumber || user.bankDetails.bankDocument);

  const fetchVerificationStatus = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);

      const response = await buddyApi.getVerificationStatus();

      if (isMounted.current) {
        setVerificationStatus(response.data.data);
        setInitialLoading(false);

        // Only restore session if verification status changed to all verified
        if (response.data.data?.allVerified) {
          await dispatch(restoreSession());
        }
      }
    } catch (error: any) {
      if (error.response?.status !== 429) {
        console.error('Failed to fetch verification status:', error);
      }
      setInitialLoading(false);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [loading, dispatch]);

  useEffect(() => {
    isMounted.current = true;
    // Fetch once on mount - NO AUTO-POLLING
    fetchVerificationStatus();

    return () => {
      isMounted.current = false;
    };
  }, []);

  const checkStatus = () => {
    fetchVerificationStatus();
  };

  const getFieldStatus = (field: keyof BuddyVerificationStatus) => {
    if (!verificationStatus) return { verified: false, comment: null };
    const fieldData = verificationStatus[field];
    if (typeof fieldData === 'object' && 'verified' in fieldData) {
      return fieldData;
    }
    return { verified: false, comment: null };
  };

  // Check if bank details are not submitted
  const isBankDetailsNotSubmitted = !hasBankDetails;

  // Navigate to update ONLY the rejected field
  const navigateToUpdate = (field: string) => {
    if (field === 'aadhaarFront' || field === 'aadhaarBack' || field === 'pan') {
      navigation.navigate('Identification', { rejectedField: field, mode: 'update' });
    } else if (field === 'bankDetails') {
      navigation.navigate('BankDetails', { mode: 'update' });
    } else if (field === 'emergencyContact') {
      navigation.navigate('EmergencyContact', { mode: 'update' });
    }
  };

  // Navigate to submit bank details (first time submission)
  const navigateToSubmitBankDetails = () => {
    navigation.navigate('BankDetails', { mode: 'submit' });
  };

  const allVerified = verificationStatus?.allVerified || false;
  const hasRejections = verificationStatus && Object.values(verificationStatus).some(
    (field) => typeof field === 'object' && 'verified' in field && !field.verified && field.comment
  );

  if (initialLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="clock-time-four-outline" size={60} color={COLORS.mediumGray} />
        <Text style={[styles.sub, { marginTop: 20 }]}>Loading verification status...</Text>
      </View>
    );
  }

  if (allVerified) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="check-circle" size={80} color={COLORS.primary} />
        <Text style={styles.title}>Verification Complete!</Text>
        <Text style={styles.sub}>
          All your documents have been verified. You can now proceed.
        </Text>
        <Button
          mode="contained"
          onPress={async () => {
            await dispatch(restoreSession());
          }}
          style={{ marginTop: 30 }}
        >
          Continue
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.offWhite }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/7518/7518748.png' }} style={styles.img} />
        <Text style={styles.title}>Verification Pending</Text>
        <Text style={styles.sub}>
          {hasRejections
            ? 'Some of your documents need to be updated. Please review and re-upload the rejected items.'
            : 'It will take 24 hrs to verify your profile. We will notify you once your profile gets verified.'}
        </Text>

        {verificationStatus && (
          <View style={styles.statusContainer}>
            <VerificationField
              label="Aadhaar Front"
              status={getFieldStatus('aadhaarFront')}
              onUpdate={() => navigateToUpdate('aadhaarFront')}
            />
            <VerificationField
              label="Aadhaar Back"
              status={getFieldStatus('aadhaarBack')}
              onUpdate={() => navigateToUpdate('aadhaarBack')}
            />
            <VerificationField
              label="PAN Card"
              status={getFieldStatus('pan')}
              onUpdate={() => navigateToUpdate('pan')}
            />

            {/* Bank Details - special handling for not submitted */}
            {isBankDetailsNotSubmitted ? (
              <BankDetailsNotSubmittedCard onSubmit={navigateToSubmitBankDetails} />
            ) : (
              <VerificationField
                label="Bank Details"
                status={getFieldStatus('bankDetails')}
                onUpdate={() => navigateToUpdate('bankDetails')}
              />
            )}

            <VerificationField
              label="Emergency Contact"
              status={getFieldStatus('emergencyContact')}
              onUpdate={() => navigateToUpdate('emergencyContact')}
            />
          </View>
        )}

        <Button
          mode="outlined"
          onPress={checkStatus}
          loading={loading}
          disabled={loading}
          style={{ marginTop: 30, marginBottom: 20 }}
        >
          Refresh Status
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

// Special card for bank details not submitted
function BankDetailsNotSubmittedCard({ onSubmit }: { onSubmit: () => void }) {
  return (
    <Card style={styles.fieldCard}>
      <Card.Content>
        <View style={styles.fieldRow}>
          <View style={styles.fieldInfo}>
            <Text style={styles.fieldLabel}>Bank Details</Text>
            <View style={styles.notSubmittedBadge}>
              <MaterialCommunityIcons name="alert-outline" size={16} color={COLORS.mediumGray} />
              <Text style={styles.notSubmittedText}>Not Submitted</Text>
            </View>
          </View>
          <Button mode="contained" compact onPress={onSubmit} buttonColor={COLORS.primary}>
            Submit
          </Button>
        </View>
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            You can submit bank details via account number or upload cancelled check/passbook.
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function VerificationField({
  label,
  status,
  onUpdate
}: {
  label: string;
  status: { verified: boolean; comment: string | null };
  onUpdate: () => void;
}) {
  const isRejected = !status.verified && status.comment;
  const showUpdateButton = isRejected;

  return (
    <Card style={styles.fieldCard}>
      <Card.Content>
        <View style={styles.fieldRow}>
          <View style={styles.fieldInfo}>
            <Text style={styles.fieldLabel}>{label}</Text>
            {status.verified ? (
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.primary} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : isRejected ? (
              <View style={styles.rejectedBadge}>
                <MaterialCommunityIcons name="alert-circle" size={16} color={COLORS.warning || '#FF9800'} />
                <Text style={styles.rejectedText}>Rejected</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.mediumGray} />
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
          </View>
          {showUpdateButton && (
            <Button mode="outlined" compact onPress={onUpdate}>
              Update
            </Button>
          )}
        </View>
        {status.comment && (
          <View style={styles.commentContainer}>
            {/* <Text style={styles.commentLabel}>Admin Comment:</Text> */}
            <Text style={styles.commentText}>{status.comment}</Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: COLORS.offWhite || '#fff'
  },
  img: {
    width: 150,
    height: 150,
    marginBottom: 20,
    alignSelf: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
    textAlign: 'center'
  },
  sub: {
    textAlign: 'center',
    color: COLORS.mediumGray,
    fontSize: 16,
    marginBottom: 20
  },
  statusContainer: {
    width: '100%',
    marginTop: 20
  },
  fieldCard: {
    marginBottom: 12,
    backgroundColor: COLORS.white || '#fff'
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  fieldInfo: {
    flex: 1
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: COLORS.charcoal
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  verifiedText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500'
  },
  rejectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  rejectedText: {
    color: COLORS.warning || '#FF9800',
    fontSize: 14,
    fontWeight: '500'
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  pendingText: {
    color: COLORS.mediumGray,
    fontSize: 14
  },
  notSubmittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  notSubmittedText: {
    color: COLORS.mediumGray,
    fontSize: 14,
    fontStyle: 'italic'
  },
  hintContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8
  },
  hintText: {
    fontSize: 12,
    color: COLORS.mediumGray,
    lineHeight: 18
  },
  commentContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 4
  },
  commentText: {
    fontSize: 14,
    color: COLORS.charcoal,
    lineHeight: 20
  },
});