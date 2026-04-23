import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TouchableOpacity,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Avatar, Badge, Surface } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import messaging from '@react-native-firebase/messaging';

import { COLORS, SHADOWS } from '../../config/theme';
import { fetchProfile, fetchEarningsSummary, toggleAvailability } from '../../store/slices/buddySlice';
import { RootState } from '../../store';
import { requestUserPermission } from '../../utils/notification';
import { buddyApi } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';

// Interface for the Job Offer
interface JobRequest {
  bookingId: string;
  assignmentId: string;
  serviceTitle: string;
  address: string;
  distance: string | number;
  price?: string | number;
  isImmediate?: boolean;
}

export default function HomeScreen() {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const { socket } = useSocket();

  // --- Redux State ---
  const { profile, earnings, isAvailable, activeJob, loading } = useSelector((state: RootState) => state.buddy);

  // --- Local State ---
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateSelectionLoading, setDateSelectionLoading] = useState(false);

  // JOB QUEUE: Stores incoming broadcasted jobs (Offers)
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);

  const buddyName = profile?.user?.name || profile?.name || 'Buddy';
  const rawImage = profile?.user?.profileImage || profile?.profileImage;
  const buddyImage = (rawImage && rawImage.startsWith('http')) ? { uri: rawImage } : null;
  const isVerified = profile?.isVerified;
  const jobStartDate = profile?.jobStartDate;
  const trainingStartDate = profile?.trainingStartDate;
  const isTrainingCompleted = profile?.isTrainingCompleted;
  const verifiedAt = profile?.verifiedAt;

  // Notification badge count
  const { unreadCount } = useNotifications();

  // --- Initialization & Data Loading ---
  const loadData = useCallback(() => {
    dispatch(fetchProfile());
    dispatch(fetchEarningsSummary());
  }, [dispatch]);

  // --- 1. Fetch Existing Offers (Missed Notifications) ---
  const fetchPendingOffers = async () => {
    try {
      // Fetch jobs that are in 'PENDING' state (Offers)
      const res = await buddyApi.getJobs();
      // Adjust based on your API response structure (likely res.data.data.jobs)
      const allJobs = res.data?.data?.jobs || [];
      // const pendingJobs = res.data?.data?.jobs || [];

      const pendingJobs = allJobs.filter((j: any) => j.status === 'PENDING');

      if (pendingJobs.length > 0) {
        const mappedRequests: JobRequest[] = pendingJobs.map((job: any) => ({
          bookingId: job.bookingId,
          assignmentId: job.id,
          serviceTitle: job.booking?.service?.title || 'Service Request',
          address: job.booking?.address?.formattedAddress || 'Location hidden',
          distance: job.distanceKm || 0,
          price: job.booking?.totalAmount,
          isImmediate: job.booking?.isImmediate
        }));

        setJobRequests(prev => {
          // Merge and avoid duplicates
          const existingIds = new Set(prev.map(p => p.assignmentId));
          const newOffers = mappedRequests.filter(m => !existingIds.has(m.assignmentId));
          return [...prev, ...newOffers];
        });
      }
    } catch (error: any) {
      // Handle 429 silently - the optimized getJobs will handle caching
      if (error.response?.status === 429) {
        console.log('[HomeScreen] Rate limited on pending offers, will use cached data');
      } else {
        console.log('Error fetching pending offers:', error);
      }
    }
  };

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      await Location.requestForegroundPermissionsAsync();
    }
  };

  useEffect(() => {
    loadData();
    fetchPendingOffers(); // <--- CRITICAL: Check for offers on app open
    requestUserPermission();
    checkLocationPermission();
  }, [loadData]);

  // --- 2. Notification Listeners (FCM) ---
  useEffect(() => {
    const handleRemoteMessage = (remoteMessage: any) => {
      console.log('FCM Message:', remoteMessage);
      if (remoteMessage.data?.type === 'buddy-assignment') {
        const newReq = remoteMessage.data as unknown as JobRequest;
        setJobRequests(prev => {
          const exists = prev.some(req => req.assignmentId === newReq.assignmentId);
          return exists ? prev : [...prev, newReq];
        });
      }
    };

    const unsubscribeFCM = messaging().onMessage(handleRemoteMessage);
    messaging().onNotificationOpenedApp(handleRemoteMessage);
    messaging().getInitialNotification().then(msg => {
      if (msg) handleRemoteMessage(msg);
    });

    return unsubscribeFCM;
  }, []);

  // --- 3. Socket Listeners (Real-time Race Condition) ---
  useEffect(() => {
    if (!socket) return;

    // A. Job Won (Accepted Successfully)
    const onAcceptSuccess = (data: any) => {
      setIsAccepting(false);
      setJobRequests([]); // Clear requests as we are now busy
      Alert.alert("Success!", "You have been assigned the job.");
      loadData(); // Refresh to show "Active Job" card
    };

    // B. Job Lost (Taken by another buddy)
    const onJobTaken = (data: { bookingId: string, message?: string }) => {
      setJobRequests(prev => {
        const isVisible = prev[0]?.bookingId === data.bookingId;
        if (isVisible) {
          Alert.alert("Missed", data.message || "This job was accepted by another buddy.");
        }
        return prev.filter(req => req.bookingId !== data.bookingId);
      });
      setIsAccepting(false);
    };

    // C. Error Handling
    const onError = (err: any) => {
      setIsAccepting(false);
      if (err.code === 'JOB_TAKEN') {
        Alert.alert("Too Late", err.message);
        setJobRequests(prev => prev.slice(1));
      } else if (err.type === 'RATE_LIMITED') {
        // Rate limited - silently reset, user can try again
        console.warn('[Home] Rate limited on job action');
      } else {
        Alert.alert("Error", err.message || "Something went wrong.");
      }
    };

    socket.on('job:accept:success', onAcceptSuccess);
    socket.on('job:taken', onJobTaken);
    socket.on('error', onError);

    return () => {
      socket.off('job:accept:success', onAcceptSuccess);
      socket.off('job:taken', onJobTaken);
      socket.off('error', onError);
    };
  }, [socket, loadData]);


  // --- 4. Action Handlers ---

  const handleToggle = async () => {
    if (!isVerified) return Alert.alert("Verification Pending", "Wait for verification.");

    // Check training completion
    if (!isTrainingCompleted) {
      return Alert.alert("Training Required", "Please complete your training first.");
    }

    // Check job start date
    if (!jobStartDate) {
      return Alert.alert("Not Ready", "Your job start date has not been assigned yet. Please wait for admin to assign it after training.");
    }

    // Check if current date >= job start date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(jobStartDate);
    startDate.setHours(0, 0, 0, 0);

    if (today < startDate) {
      return Alert.alert("Not Yet", `Your job start date is ${startDate.toLocaleDateString()}. Please wait until then.`);
    }

    if (!isAvailable) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert("Permission Denied", "Location needed.");
      try {
        const loc = await Location.getCurrentPositionAsync({});
        await buddyApi.updateLocation(loc.coords.latitude, loc.coords.longitude);
      } catch (e) { return; }
    }
    dispatch(toggleAvailability(!isAvailable));
  };

  const confirmStartDate = async (date: Date) => {
    try {
      setDateSelectionLoading(true);
      await buddyApi.updateProfile({ jobStartDate: date.toISOString() });
      await dispatch(fetchProfile());
      setShowDateModal(false);
    } catch (error) {
      Alert.alert("Error", "Failed to save date.");
    } finally {
      setDateSelectionLoading(false);
    }
  };

  const handleAcceptJob = () => {
    const currentRequest = jobRequests[0];
    if (!currentRequest) return;
    setIsAccepting(true);
    socket.emit('job:accept', { assignmentId: currentRequest.assignmentId });
  };

  const handleIgnoreJob = () => {
    const currentRequest = jobRequests[0];
    if (!currentRequest) return;

    // Optimistic Update
    setJobRequests(prev => prev.slice(1));

    if (socket && socket.connected) {
      socket.emit('job:reject', { assignmentId: currentRequest.assignmentId });
    }
  };

  // --- 5. Render Components ---

  // const renderJobRequestModal = () => { ... };

  const renderTrainingCard = () => {
    if (!isVerified) return null;

    // Not started training yet
    if (!trainingStartDate) {
      return (
        <Surface style={[styles.alertCard, SHADOWS.medium]}>
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons name="school" size={24} color={COLORS.white} />
            <Text style={styles.alertTitle}>Start Your Training</Text>
          </View>
          <Text style={styles.alertBody}>
            You are verified! Complete your 5-day training to start working.
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('TrainingSelection')}
            style={styles.dateBtn}
            buttonColor={COLORS.white}
            textColor={COLORS.primary}
          >
            Start Training
          </Button>
        </Surface>
      );
    }

    // Training started but not completed
    if (!isTrainingCompleted) {
      return (
        <Surface style={[styles.alertCard, { backgroundColor: COLORS.warning }]}>
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons name="school-outline" size={24} color={COLORS.white} />
            <Text style={styles.alertTitle}>Training In Progress</Text>
          </View>
          <Text style={styles.alertBody}>
            Complete your training to start accepting jobs. Training started on {new Date(trainingStartDate).toLocaleDateString()}.
          </Text>
        </Surface>
      );
    }

    // Training completed but no job start date assigned
    if (!jobStartDate) {
      return (
        <Surface style={[styles.infoCard, SHADOWS.light]}>
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={COLORS.primary} />
            <Text style={[styles.alertTitle, { color: COLORS.charcoal }]}>Waiting for Job Start Date</Text>
          </View>
          <Text style={{ color: COLORS.darkGray, marginTop: 5 }}>
            Training completed! Waiting for admin to assign your job start date.
          </Text>
        </Surface>
      );
    }

    // Check if job start date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(jobStartDate);
    startDate.setHours(0, 0, 0, 0);

    if (today < startDate) {
      return (
        <Surface style={[styles.infoCard, SHADOWS.light]}>
          <View style={styles.alertHeader}>
            <MaterialCommunityIcons name="calendar-clock" size={24} color={COLORS.primary} />
            <Text style={[styles.alertTitle, { color: COLORS.charcoal }]}>Ready to Start</Text>
          </View>
          <Text style={{ color: COLORS.darkGray, marginTop: 5 }}>
            You can start working on {startDate.toLocaleDateString()}. Get ready!
          </Text>
        </Surface>
      );
    }

    // All good - can work
    return (
      <Surface style={[styles.infoCard, SHADOWS.light]}>
        <View style={styles.alertHeader}>
          <MaterialCommunityIcons name="briefcase-check" size={24} color={COLORS.primary} />
          <Text style={[styles.alertTitle, { color: COLORS.charcoal }]}>Ready to Work</Text>
        </View>
        <Text style={{ color: COLORS.darkGray, marginTop: 5 }}>Good luck! Make sure you are Online to receive jobs.</Text>
      </Surface>
    );
  };

  const renderDateModal = () => (
    <Modal visible={showDateModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <Surface style={styles.modalContent}>
          <Text style={styles.modalTitle}>Choose Start Date</Text>
          {[0, 1, 2].map(i => {
            const d = new Date(); d.setDate(d.getDate() + i);
            return (
              <TouchableOpacity key={i} style={styles.modalOption} onPress={() => confirmStartDate(d)}>
                <Text style={styles.optionText}>{i === 0 ? "Today" : d.toDateString()}</Text>
                <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.mediumGray} />
              </TouchableOpacity>
            )
          })}
          <Button onPress={() => setShowDateModal(false)} textColor={COLORS.error}>Cancel</Button>
        </Surface>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {buddyImage ? (
            <Avatar.Image size={50} source={buddyImage} style={{ backgroundColor: COLORS.offWhite }} />
          ) : (
            <Avatar.Text size={50} label={buddyName.substring(0, 2).toUpperCase()} style={{ backgroundColor: COLORS.primary }} />
          )}

          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Hello, {buddyName}</Text>
            <View style={styles.badgeContainer}>
              {isVerified ? (
                <Badge style={styles.verifiedBadge}>Verified Partner</Badge>
              ) : (
                <Badge style={styles.pendingBadge}>Verification Pending</Badge>
              )}
            </View>
          </View>
        </View>
        {/* Notification Bell with Badge */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.bellContainer}
        >
          <Avatar.Icon size={40} icon="bell" style={{ backgroundColor: COLORS.offWhite }} color={COLORS.charcoal} />
          {unreadCount > 0 && (
            <Badge style={styles.notificationBadge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}>
        {renderTrainingCard()}
        {!isVerified && (
          <View style={styles.pendingCard}>
            <MaterialCommunityIcons name="file-clock" size={24} color={COLORS.warning} />
            <Text style={styles.pendingText}>Your documents are under review.</Text>
          </View>
        )}

        <View style={[styles.statusCard, isAvailable ? styles.statusActive : styles.statusInactive]}>
          <View>
            <Text style={styles.statusTitle}>{isAvailable ? "You are Online" : "You are Offline"}</Text>
            <Text style={styles.statusSub}>{isAvailable ? "Receiving new jobs" : "Not visible to customers"}</Text>
          </View>
          <Switch value={isAvailable} onValueChange={handleToggle} trackColor={{ false: COLORS.mediumGray, true: COLORS.lightGreen }} thumbColor={isAvailable ? COLORS.primary : '#f4f3f4'} disabled={!isVerified || !isTrainingCompleted || !jobStartDate} />
        </View>

        <View style={styles.statsContainer}>
          <View style={[styles.statBox, SHADOWS.light]}>
            <Text style={styles.statNumber}>{earnings?.today?.count || 0}</Text>
            <Text style={styles.statLabel}>Jobs Today</Text>
          </View>
          <View style={[styles.statBox, SHADOWS.light]}>
            <Text style={styles.statNumber}>₹{earnings?.thisMonth?.amount || 0}</Text>
            <Text style={styles.statLabel}>Month Earned</Text>
          </View>
        </View>

        {activeJob && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Job</Text>
            <Surface style={[styles.jobCard, SHADOWS.green]} onTouchEnd={() => navigation.navigate('JobDetails', { jobId: activeJob.id })}>
              <View style={styles.jobHeader}>
                <Text style={styles.serviceType}>{activeJob.service.title}</Text>
                <Badge style={{ backgroundColor: COLORS.accent }}>In Progress</Badge>
              </View>
              <Text style={styles.address}>{activeJob.address.formattedAddress}</Text>
              <Button mode="contained" onPress={() => navigation.navigate('JobDetails', { jobId: activeJob.id })}>View Details</Button>
            </Surface>
          </View>
        )}
      </ScrollView>

      {renderDateModal()}
      {/* {renderJobRequestModal()} */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerTextContainer: { marginLeft: 12 },
  greeting: { fontSize: 18, fontWeight: 'bold' },
  verifiedBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 10 },
  pendingBadge: { backgroundColor: COLORS.warning, paddingHorizontal: 10 },
  alertCard: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, marginBottom: 20 },
  infoCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#eee' },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  alertTitle: { color: COLORS.white, fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  alertBody: { color: COLORS.white, marginBottom: 12 },
  dateButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  dateBtn: { flex: 1, marginHorizontal: 5 },
  pendingCard: { flexDirection: 'row', backgroundColor: '#FFF3E0', padding: 16, borderRadius: 12, marginBottom: 20, alignItems: 'center' },
  pendingText: { marginLeft: 10, color: '#E65100', flex: 1 },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderRadius: 12, marginBottom: 20 },
  statusActive: { backgroundColor: '#E8F8F5', borderLeftWidth: 5, borderLeftColor: COLORS.primary },
  statusInactive: { backgroundColor: '#F2F3F4', borderLeftWidth: 5, borderLeftColor: COLORS.mediumGray },
  statusTitle: { fontSize: 16, fontWeight: 'bold' },
  statusSub: { fontSize: 12, color: COLORS.darkGray },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { width: '48%', backgroundColor: COLORS.white, padding: 15, borderRadius: 12, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: COLORS.accent },
  statLabel: { color: COLORS.mediumGray },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  jobCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  serviceType: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  address: { color: COLORS.darkGray, marginBottom: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: COLORS.white, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  optionText: { fontSize: 16 },
  requestCard: { width: '90%', backgroundColor: COLORS.white, borderRadius: 20, padding: 24, elevation: 10 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  requestTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary, marginLeft: 10 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
  requestBody: { marginBottom: 20 },
  serviceTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.charcoal, marginBottom: 10 },
  row: { flexDirection: 'row', marginBottom: 15 },
  addressText: { marginLeft: 8, color: COLORS.darkGray, flex: 1 },
  metaContainer: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, marginBottom: 15 },
  metaItem: { flex: 1, alignItems: 'center' },
  metaLabel: { fontSize: 12, color: COLORS.mediumGray },
  metaValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.charcoal },
  urgentBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', padding: 10, borderRadius: 8, justifyContent: 'center' },
  urgentText: { color: '#B00020', fontWeight: 'bold', marginLeft: 6 },
  actionContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  actionBtn: { flex: 1 },
  badgeContainer: { flexDirection: 'row' },
  bellContainer: { position: 'relative' },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.error,
    fontSize: 10,
    minWidth: 18,
    height: 18,
  },
});