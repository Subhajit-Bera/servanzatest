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
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../store/hooks';
import { Button, Avatar, Badge, Surface } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMessaging, onMessage, onNotificationOpenedApp, getInitialNotification } from '@react-native-firebase/messaging';

import { COLORS, SHADOWS } from '../../config/theme';
import { fetchProfile, fetchEarningsSummary, toggleAvailability } from '../../store/slices/buddySlice';
import { CommonActions } from '@react-navigation/native';

import { requestUserPermission } from '../../utils/notification';
import { buddyApi } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';
import { getDisplayTitle } from '../../utils/bookingHelpers';

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
  const { profile, earnings, isAvailable, activeJob, loading } = useAppSelector((state) => state.buddy);
  const { user } = useAppSelector((state) => state.auth);

  // --- Local State ---
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateSelectionLoading, setDateSelectionLoading] = useState(false);

  // JOB QUEUE: Stores incoming broadcasted jobs (Offers)
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);

  const buddyName = user?.name || profile?.user?.name || profile?.name || 'Buddy';
  const rawImage = user?.profileImage || profile?.user?.profileImage || profile?.profileImage;
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
          serviceTitle: getDisplayTitle(job.booking) || 'Service Request',
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

    const unsubscribeFCM = onMessage(getMessaging(), handleRemoteMessage);
    onNotificationOpenedApp(getMessaging(), handleRemoteMessage);
    getInitialNotification(getMessaging()).then(msg => {
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {buddyImage ? (
            <Avatar.Image size={48} source={buddyImage} style={{ backgroundColor: COLORS.offWhite }} />
          ) : (
            <Avatar.Text size={48} label={buddyName.substring(0, 2).toUpperCase()} style={{ backgroundColor: COLORS.primary }} />
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Hello, {buddyName}</Text>
            <View style={styles.badgeContainer}>
              {isVerified ? (
                <View style={styles.verifiedPill}>
                  <Text style={styles.verifiedPillText}>Verified Partner</Text>
                </View>
              ) : (
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>Verification Pending</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.dispatch(CommonActions.navigate({ name: 'Notifications' }))}
          style={styles.bellContainer}
        >
          <MaterialCommunityIcons name="bell-outline" size={26} color={COLORS.charcoal} />
          {unreadCount > 0 && (
            <View style={styles.notificationDot} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {/* Training / Ready to Work card */}
        {renderTrainingCard()}

        {/* Verification pending banner */}
        {!isVerified && (
          <View style={styles.pendingCard}>
            <MaterialCommunityIcons name="file-clock" size={24} color={COLORS.warning} />
            <Text style={styles.pendingText}>Your documents are under review.</Text>
          </View>
        )}

        {/* Online/Offline Toggle */}
        <View style={[styles.statusCard, isAvailable ? styles.statusActive : styles.statusInactive]}>
          <View>
            <Text style={styles.statusTitle}>{isAvailable ? "You are Online" : "You are Offline"}</Text>
            <Text style={styles.statusSub}>{isAvailable ? "Receiving new jobs" : "Not visible to customers"}</Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={handleToggle}
            trackColor={{ false: '#D0D0D0', true: '#A8D5BA' }}
            thumbColor={isAvailable ? COLORS.primary : '#f4f3f4'}
            disabled={!isVerified || !isTrainingCompleted || !jobStartDate}
          />
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumberRed}>{earnings?.today?.count || 0}</Text>
            <Text style={styles.statLabel}>Jobs Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumberDark}>₹{earnings?.thisMonth?.amount || 0}</Text>
            <Text style={styles.statLabel}>Month Earned</Text>
          </View>
        </View>

        {/* Active Job Card */}
        {activeJob && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Job</Text>
            <TouchableOpacity
              style={styles.activeJobCard}
              onPress={() => navigation.navigate('JobDetails', { jobId: activeJob.id })}
              activeOpacity={0.7}
            >
              <View style={styles.jobHeader}>
                <Text style={styles.serviceType}>{getDisplayTitle(activeJob)}</Text>
                <View style={styles.inProgressBadge}>
                  <Text style={styles.inProgressBadgeText}>In Progress</Text>
                </View>
              </View>
              <Text style={styles.address}>{activeJob.address.formattedAddress}</Text>
              <TouchableOpacity
                style={styles.viewDetailsBtn}
                onPress={() => navigation.navigate('JobDetails', { jobId: activeJob.id })}
              >
                <Text style={styles.viewDetailsBtnText}>View Details</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {renderDateModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  verifiedPill: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  pendingPill: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  bellContainer: {
    position: 'relative',
    padding: 4,
  },
  notificationDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },

  // Training / Info cards
  alertCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
  },
  alertBody: {
    color: COLORS.white,
    fontSize: 14,
    marginBottom: 14,
    lineHeight: 20,
  },
  dateBtn: {
    flex: 1,
    marginHorizontal: 5,
  },

  // Pending verification
  pendingCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  pendingText: {
    marginLeft: 10,
    color: '#E65100',
    flex: 1,
    fontSize: 14,
  },

  // Online/Offline toggle
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 14,
    marginBottom: 24,
  },
  statusActive: {
    backgroundColor: '#E8F8F0',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  statusInactive: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 4,
    borderLeftColor: '#BDBDBD',
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  statusSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Stats cards
  statsContainer: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: 22,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  statNumberRed: {
    fontSize: 28,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 4,
  },
  statNumberDark: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
  },

  // Active job
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: COLORS.charcoal,
  },
  activeJobCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    ...SHADOWS.light,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  serviceType: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.charcoal,
    flex: 1,
  },
  inProgressBadge: {
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  inProgressBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  address: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 14,
  },
  viewDetailsBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewDetailsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: COLORS.white,
    padding: 24,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: COLORS.charcoal,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    color: COLORS.charcoal,
  },
});