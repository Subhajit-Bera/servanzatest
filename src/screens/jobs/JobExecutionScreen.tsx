import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Linking, Modal, Platform } from 'react-native';
import { Button, TextInput, ActivityIndicator, IconButton, Divider } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking
} from '../../utils/backgroundLocation';
import { COLORS, SHADOWS } from '../../config/theme';
import { buddyApi } from '../../api/client';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getDisplayTitle, getBuddyAddress } from '../../utils/bookingHelpers';

export default function JobExecutionScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { jobId } = route.params;

  // State
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [status, setStatus] = useState<string>('ACCEPTED');

  // Timer State
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Location Tracking Ref
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');

  // Check if job is completed
  const isCompleted = status === 'COMPLETED';

  // 1. Fetch Job Details
  // 1. Fetch Job Details
  const fetchJobDetails = async () => {
    try {
      // 1a. Try Cache First (Offline First)
      try {
        const cached = await AsyncStorage.getItem(`job_cache_${jobId}`);
        if (cached) {
          const { job: cJob, status: cStatus } = JSON.parse(cached);
          console.log('[Job] Loaded from cache');
          setJob(cJob);
          setStatus(cStatus);
          setLoading(false); // Show cached data immediately
        }
      } catch (err) {
        console.log('[Job] Cache read failed', err);
      }

      // 1b. Fetch Fresh Data
      const response = await buddyApi.getActiveJob();
      let foundJob = null;
      let foundStatus = null;

      // Check if the active job matches the ID passed, otherwise fetch from list
      if (response.data && response.data.bookingId === jobId) {
        foundJob = response.data.booking;
        foundStatus = response.data.status;
      } else {
        // Fallback: If not currently the 'active' job endpoint, find it
        const allJobs = await buddyApi.getJobs();
        const found = allJobs.data.jobs.find((j: any) => j.booking.id === jobId);
        if (found) {
          foundJob = found.booking;
          foundStatus = found.status;
        }
      }

      if (foundJob) {
        setJob(foundJob);
        setStatus(foundStatus);

        // Cache the fresh data
        AsyncStorage.setItem(`job_cache_${jobId}`, JSON.stringify({
          job: foundJob,
          status: foundStatus,
          timestamp: Date.now()
        })).catch(e => console.log('Cache write error', e));
      }
    } catch (error) {
      console.error('Error fetching job:', error);
      // Only alert if we don't have cached data
      if (!job) {
        Alert.alert('Error', 'Could not load job details');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetails();
  }, [jobId]);

  // 2. LIVE TRACKING LOGIC - Unified Background Tracking
  useEffect(() => {
    const shouldTrack = ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(status) && !isCompleted;

    const manageTracking = async () => {
      if (shouldTrack && job) {
        // Extract IDs needed for tracking
        const assignmentId = job.assignments?.[0]?.id || job.assignmentId;
        const buddyId = job.assignments?.[0]?.buddyId;
        const bookingId = job.id;

        if (assignmentId && buddyId) {
          console.log("[Tracking] Starting background tracking for:", assignmentId);
          await startBackgroundLocationTracking({
            assignmentId,
            bookingId,
            userId: buddyId
          });
        }
      } else {
        // Stop tracking if status changes or job completed
        console.log("[Tracking] Stopping background tracking");
        await stopBackgroundLocationTracking();
      }
    };

    manageTracking();

    // No cleanup function here because background tracking should persist 
    // even if this component unmounts (until job is done)
  }, [status, isCompleted, job]);

  // 3. Timer Logic - Only for active jobs
  useEffect(() => {
    if (isTimerRunning && !isCompleted) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, isCompleted]);

  // Resume timer if job is in progress
  useEffect(() => {
    if (status === 'IN_PROGRESS' && job?.assignments?.[0]?.startedAt && !isCompleted) {
      const start = new Date(job.assignments[0].startedAt).getTime();
      const now = new Date().getTime();
      const diffSeconds = Math.floor((now - start) / 1000);
      setTimer(diffSeconds > 0 ? diffSeconds : 0);
      setIsTimerRunning(true);
    }
  }, [status, job, isCompleted]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Actions
  const openMaps = () => {
    if (!job?.address) return;
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${job.address.latitude},${job.address.longitude}`;
    const label = 'Customer Location';
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    Linking.openURL(url as string);
  };

  const handleArrived = async () => {
    try {
      setActionLoading(true);
      const assignmentId = job.assignments?.[0]?.id || job.assignmentId;
      await buddyApi.markArrived(assignmentId);
      setStatus('ARRIVED');
      Alert.alert('Status Updated', 'Customer notified that you have arrived.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartJob = async () => {
    try {
      setActionLoading(true);
      const assignmentId = job.assignments?.[0]?.id || job.assignmentId;
      await buddyApi.startJob(assignmentId);
      setStatus('IN_PROGRESS');
      setIsTimerRunning(true);
    } catch (error) {
      Alert.alert('Error', 'Could not start job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRequest = () => {
    setShowOtpModal(true);
  };

  const verifyPaymentAndComplete = async () => {
    try {
      setActionLoading(true);
      const assignmentId = job.assignments?.[0]?.id || job.assignmentId;
      await buddyApi.completeJob(assignmentId);

      setIsTimerRunning(false);
      setShowOtpModal(false);

      Alert.alert('Success', 'Job Completed Successfully!', [
        { text: 'Great!', onPress: () => navigation.navigate('Home') }
      ]);
    } catch (error: any) {
      Alert.alert('Verification Failed', error.response?.data?.message || 'Invalid OTP');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle" size={60} color={COLORS.mediumGray} />
        <Text style={{ marginTop: 20, color: COLORS.mediumGray }}>Job not found</Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          Go Back
        </Button>
      </View>
    );
  }

  // COMPLETED JOB VIEW - Show read-only summary
  if (isCompleted) {
    return (
      <View style={styles.container}>
        {/* Map Header */}
        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: job.address?.latitude || 37.78825,
              longitude: job.address?.longitude || -122.4324,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Marker coordinate={{
              latitude: job.address?.latitude || 37.78825,
              longitude: job.address?.longitude || -122.4324
            }} />
          </MapView>

          <IconButton
            icon="arrow-left"
            mode="contained"
            containerColor={COLORS.white}
            iconColor={COLORS.charcoal}
            size={20}
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          />
        </View>

        {/* Completed Job Summary */}
        <View style={[styles.bottomSheet, SHADOWS.medium]}>
          <View style={styles.handle} />

          <View style={styles.completedHeader}>
            <MaterialCommunityIcons name="check-circle" size={40} color={COLORS.primary} />
            <Text style={styles.completedTitle}>Job Completed</Text>
          </View>

          <View style={styles.jobHeader}>
            <View>
              <Text style={styles.customerName}>{job.user?.name || 'Customer'}</Text>
              <Text style={styles.serviceTitle}>{getDisplayTitle(job)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#E8F8F5' }]}>
              <Text style={[styles.statusText, { color: COLORS.primary }]}>COMPLETED</Text>
            </View>
          </View>

          <Text style={styles.address} numberOfLines={2}>
            <MaterialCommunityIcons name="map-marker" size={16} color={COLORS.primary} />
            {' '}{getBuddyAddress(job.address)}
          </Text>

          <Divider style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Completed On</Text>
            <Text style={styles.summaryValue}>
              {job.assignments?.[0]?.completedAt
                ? new Date(job.assignments[0].completedAt).toLocaleDateString()
                : 'N/A'}
            </Text>
          </View>

          {job.totalAmount && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={[styles.summaryValue, { color: COLORS.primary, fontWeight: 'bold' }]}>
                ₹{job.totalAmount}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Header */}
      <View style={styles.mapContainer}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: job.address?.latitude || 37.78825,
            longitude: job.address?.longitude || -122.4324,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker coordinate={{
            latitude: job.address?.latitude || 37.78825,
            longitude: job.address?.longitude || -122.4324
          }} />
        </MapView>

        <IconButton
          icon="arrow-left"
          mode="contained"
          containerColor={COLORS.white}
          iconColor={COLORS.charcoal}
          size={20}
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        />
      </View>

      {/* Control Panel */}
      <View style={[styles.bottomSheet, SHADOWS.medium]}>
        <View style={styles.handle} />

        <View style={styles.jobHeader}>
          <View>
            <Text style={styles.customerName}>{job.user?.name || 'Customer'}</Text>
            <Text style={styles.serviceTitle}>{getDisplayTitle(job)}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{status.replace('_', ' ')}</Text>
          </View>
        </View>

        <Text style={styles.address} numberOfLines={2}>
          <MaterialCommunityIcons name="map-marker" size={16} color={COLORS.primary} />
          {' '}{getBuddyAddress(job.address)}
        </Text>

        {/* Communication Actions */}
        {!isCompleted && (
          <View style={styles.commActionContainer}>
            <Button
              mode="contained-tonal"
              icon="chat"
              onPress={() => navigation.navigate('Chat', { bookingId: job.id, customerName: job.user?.name || 'Customer' })}
              style={styles.commBtn}
            >
              Chat
            </Button>
            <Button
              mode="contained-tonal"
              icon="phone"
              onPress={() => navigation.navigate('VoiceCall', { bookingId: job.id, customerName: job.user?.name || 'Customer' })}
              style={styles.commBtn}
            >
              Call
            </Button>
          </View>
        )}

        <Divider style={styles.divider} />

        <View style={styles.actionContainer}>

          {/* STEP 1: Navigate & Arrive */}
          {status === 'ACCEPTED' && (
            <>
              <Button
                mode="outlined"
                icon="navigation"
                onPress={openMaps}
                style={styles.btnSpacing}
                textColor={COLORS.info}
              >
                Navigate to Location
              </Button>
              <Button
                mode="contained"
                onPress={handleArrived}
                loading={actionLoading}
                style={[styles.mainBtn, SHADOWS.green]}
              >
                I've Arrived
              </Button>
            </>
          )}

          {/* STEP 2: Arrived -> Start */}
          {status === 'ARRIVED' && (
            <>
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="information" size={20} color={COLORS.charcoal} />
                <Text style={{ marginLeft: 8, color: COLORS.charcoal, flex: 1 }}>
                  You are at the location. Start the job when ready.
                </Text>
              </View>
              <Button
                mode="contained"
                icon="play-circle-outline"
                onPress={handleStartJob}
                loading={actionLoading}
                style={[styles.mainBtn, SHADOWS.green]}
                contentStyle={{ height: 50 }}
              >
                Start Job
              </Button>
            </>
          )}

          {/* STEP 3: In Progress -> Complete */}
          {(status === 'IN_PROGRESS' || status === 'STARTED') && (
            <View style={styles.timerWrapper}>
              <Text style={styles.timerLabel}>Duration</Text>
              <Text style={styles.timerValue}>{formatTime(timer)}</Text>
              <Button
                mode="contained"
                color={COLORS.accent}
                onPress={handleCompleteRequest}
                style={[styles.finishBtn, SHADOWS.heavy]}
                labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
              >
                Complete & Collect Payment
              </Button>
            </View>
          )}
        </View>
      </View>

      {/* Payment OTP Modal */}
      <Modal visible={showOtpModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialCommunityIcons name="shield-check" size={50} color={COLORS.primary} style={{ alignSelf: 'center' }} />
            <Text style={styles.modalTitle}>Verify Completion</Text>
            <Text style={styles.modalSub}>Ask customer for the OTP to finish.</Text>

            <TextInput
              mode="outlined"
              label="Enter 6-digit OTP"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInput}
              activeOutlineColor={COLORS.primary}
            />

            <Button
              mode="contained"
              onPress={verifyPaymentAndComplete}
              loading={actionLoading}
              disabled={otp.length !== 6 || actionLoading}
              style={[styles.verifyBtn, otp.length === 6 && SHADOWS.green]}
            >
              Verify & Finish
            </Button>

            <Button
              mode="text"
              textColor={COLORS.mediumGray}
              onPress={() => setShowOtpModal(false)}
            >
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapContainer: { flex: 0.55, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  backBtn: { position: 'absolute', top: 40, left: 16 },

  bottomSheet: {
    flex: 0.45,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    marginTop: -20,
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.lightGray, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  customerName: { fontSize: 20, fontWeight: 'bold', color: COLORS.charcoal },
  serviceTitle: { fontSize: 14, color: COLORS.mediumGray },
  statusBadge: { backgroundColor: '#E8F8F5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' },

  address: { color: COLORS.charcoal, fontSize: 14, marginVertical: 8, lineHeight: 20 },
  
  commActionContainer: { flexDirection: 'row', gap: 10, marginTop: 5 },
  commBtn: { flex: 1, borderRadius: 8 },

  divider: { marginVertical: 16 },

  actionContainer: { flex: 1, justifyContent: 'flex-start' },
  btnSpacing: { marginBottom: 12, borderColor: COLORS.info },
  mainBtn: { backgroundColor: COLORS.primary, borderRadius: 12 },

  infoBox: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },

  timerWrapper: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  timerLabel: { fontSize: 14, color: COLORS.mediumGray, textTransform: 'uppercase' },
  timerValue: { fontSize: 48, fontWeight: 'bold', color: COLORS.charcoal, marginVertical: 10, letterSpacing: 2 },
  finishBtn: { backgroundColor: COLORS.accent, borderRadius: 12, width: '100%', marginTop: 20, paddingVertical: 6 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', padding: 24, borderRadius: 16, ...SHADOWS.heavy },
  modalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 10 },
  modalSub: { textAlign: 'center', color: COLORS.mediumGray, marginBottom: 24 },
  otpInput: { marginBottom: 24, backgroundColor: 'white', fontSize: 18 },
  verifyBtn: { backgroundColor: COLORS.primary, borderRadius: 12, marginBottom: 12 },

  // Completed Job Styles
  completedHeader: {
    alignItems: 'center',
    marginBottom: 20
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 10
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.mediumGray
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.charcoal,
    fontWeight: '500'
  },
});