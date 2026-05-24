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
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../store/hooks';
import { Button, Avatar, Surface } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

import { COLORS, SHADOWS } from '../../config/theme';
import { fetchProfile, fetchEarningsSummary, toggleAvailability } from '../../store/slices/buddySlice';
import { CommonActions } from '@react-navigation/native';

import { buddyApi } from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { useNotifications } from '../../context/NotificationContext';
import { getDisplayTitle } from '../../utils/bookingHelpers';
import HomeScreenSkeleton from '../../components/skeletons/HomeScreenSkeleton';

export default function HomeScreen() {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const { socket } = useSocket();

  const { profile, earnings, isAvailable, activeJob, loading } = useAppSelector((state) => state.buddy);
  const { user } = useAppSelector((state) => state.auth);

  const [showDateModal, setShowDateModal] = useState(false);
  const [dateSelectionLoading, setDateSelectionLoading] = useState(false);

  const buddyName = user?.name || profile?.user?.name || profile?.name || 'Buddy';
  const rawImage = user?.profileImage || profile?.user?.profileImage || profile?.profileImage;
  const buddyImage = (rawImage && rawImage.startsWith('http')) ? { uri: rawImage } : null;
  const isVerified = profile?.isVerified;
  const jobStartDate = profile?.jobStartDate;
  const trainingStartDate = profile?.trainingStartDate;
  const isTrainingCompleted = profile?.isTrainingCompleted;
  const verifiedAt = profile?.verifiedAt;

  const { unreadCount } = useNotifications();

  const loadData = useCallback(() => {
    dispatch(fetchProfile());
    dispatch(fetchEarningsSummary());
  }, [dispatch]);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      await Location.requestForegroundPermissionsAsync();
    }
  };

  useEffect(() => {
    loadData();
    checkLocationPermission();
  }, [loadData]);

  // --- Action Handlers ---
  const handleToggle = async () => {
    if (!isVerified) return Alert.alert("Verification Pending", "Wait for verification.");
    if (!isTrainingCompleted) {
      return Alert.alert("Training Required", "Please complete your training first.");
    }
    if (!jobStartDate) {
      return Alert.alert("Not Ready", "Your job start date has not been assigned yet. Please wait for admin to assign it after training.");
    }
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

  // --- Training Card (preserves all logic) ---
  const renderTrainingCard = () => {
    if (!isVerified) return null;
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
          <Button mode="contained" onPress={() => navigation.navigate('TrainingSelection')}
            style={styles.dateBtn} buttonColor={COLORS.white} textColor={COLORS.primary}>
            Start Training
          </Button>
        </Surface>
      );
    }
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
    if (!jobStartDate) {
      return (
        <View style={styles.statusInfoCard}>
          <View style={styles.statusInfoIcon}>
            <MaterialCommunityIcons name="clock-outline" size={28} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusInfoTitle}>Waiting for Job Start Date</Text>
            <Text style={styles.statusInfoSub}>Training completed! Waiting for admin to assign your job start date.</Text>
          </View>
        </View>
      );
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(jobStartDate);
    startDate.setHours(0, 0, 0, 0);
    if (today < startDate) {
      return (
        <View style={styles.statusInfoCard}>
          <View style={styles.statusInfoIcon}>
            <MaterialCommunityIcons name="calendar-clock" size={28} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusInfoTitle}>Ready to Start</Text>
            <Text style={styles.statusInfoSub}>You can start working on {startDate.toLocaleDateString()}. Get ready!</Text>
          </View>
        </View>
      );
    }
    return null; // Ready to work — shown via Current Status section
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

  // Check if buddy can work (all gates passed)
  const canWork = isVerified && isTrainingCompleted && jobStartDate && (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sd = new Date(jobStartDate); sd.setHours(0, 0, 0, 0);
    return today >= sd;
  })();

  if (loading && !profile) {
    return <HomeScreenSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {buddyImage ? (
            <Image source={buddyImage} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{buddyName.substring(0, 2).toUpperCase()}</Text>
            </View>
          )}
          {isVerified && (
            <View style={styles.avatarBadge}>
              <Ionicons name="checkmark" size={10} color={COLORS.white} />
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.buddyNameText}>{buddyName}</Text>
            {isVerified ? (
              <View style={styles.verifiedRow}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
                <Text style={styles.verifiedLabel}>VERIFIED PARTNER</Text>
              </View>
            ) : (
              <View style={styles.pendingRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.warning} />
                <Text style={styles.pendingLabel}>VERIFICATION PENDING</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.dispatch(CommonActions.navigate({ name: 'Notifications' }))}
          style={styles.bellContainer}
        >
          <Ionicons name="notifications-outline" size={24} color={COLORS.charcoal} />
          {unreadCount > 0 && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        overScrollMode="never"
        bounces={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {/* Training / onboarding cards */}
        {renderTrainingCard()}

        {/* Verification pending banner */}
        {!isVerified && (
          <View style={styles.pendingCard}>
            <MaterialCommunityIcons name="file-clock" size={24} color={COLORS.warning} />
            <Text style={styles.pendingText}>Your documents are under review.</Text>
          </View>
        )}

        {/* ─── Current Status ─── */}
        <Text style={styles.sectionHeader}>Current Status</Text>
        <View style={styles.currentStatusCard}>
          {/* Ready for Jobs info */}
          <View style={styles.readyRow}>
            <View style={styles.readyIcon}>
              <MaterialCommunityIcons name="briefcase-check-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.readyTitle}>
                {canWork ? 'Ready for Jobs' : 'Setup Required'}
              </Text>
              <Text style={styles.readySub}>
                {canWork
                  ? 'Stay online to receive instant job notifications in your area.'
                  : 'Complete verification and training to start receiving jobs.'}
              </Text>
            </View>
          </View>

          <View style={styles.statusDivider} />

          {/* Online toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <View style={[styles.onlineDot, { backgroundColor: isAvailable ? COLORS.primary : '#BDBDBD' }]} />
              <View>
                <Text style={styles.toggleTitle}>{isAvailable ? 'You are Online' : 'You are Offline'}</Text>
                <Text style={styles.toggleSub}>{isAvailable ? 'Actively receiving jobs' : 'Not visible to customers'}</Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={handleToggle}
              trackColor={{ false: '#E0E0E0', true: '#2D6A4F' }}
              thumbColor={COLORS.white}
              ios_backgroundColor="#E0E0E0"
              disabled={!canWork}
            />
          </View>
        </View>

        {/* ─── Performance ─── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>Performance</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Earnings')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.perfRow}>
          {/* Jobs Today */}
          <View style={styles.perfCardLight}>
            <View style={styles.perfIconRed}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={22} color="#C0392B" />
            </View>
            <Text style={styles.perfNumberDark}>{earnings?.today?.count || 0}</Text>
            <Text style={styles.perfLabel}>Jobs Today</Text>
          </View>

          {/* Month Earned */}
          <View style={styles.perfCardGreen}>
            <View style={styles.perfIconGreen}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color={COLORS.white} />
            </View>
            <Text style={styles.perfNumberWhite}>₹{earnings?.thisMonth?.amount || 0}</Text>
            <Text style={styles.perfLabelWhite}>Month Earned</Text>
          </View>
        </View>

        {/* ─── Active Job ─── */}
        {activeJob && (
          <>
            <Text style={styles.sectionHeader}>Active Job</Text>
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
          </>
        )}

        {/* ─── Recent Activity ─── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Jobs')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {earnings?.recentJobs && earnings.recentJobs.length > 0 ? (
          earnings.recentJobs.slice(0, 3).map((job: any, index: number) => (
            <View key={job.id || index} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <MaterialCommunityIcons
                  name={index % 3 === 0 ? 'home-city-outline' : index % 3 === 1 ? 'wrench-outline' : 'flash-outline'}
                  size={20} color={COLORS.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>{job.serviceTitle || job.booking?.service?.title || 'Service'}</Text>
                <View style={styles.activityMeta}>
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>COMPLETED</Text>
                  </View>
                  <Text style={styles.activityDate}>
                    {job.completedAt ? new Date(job.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.activityAmount}>₹{job.payout || job.booking?.employeePayout || 0}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyActivity}>
            <MaterialCommunityIcons name="briefcase-off-outline" size={40} color={COLORS.mediumGray} />
            <Text style={styles.emptyText}>No recent activity yet</Text>
          </View>
        )}
      </ScrollView>

      {renderDateModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white, paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, position: 'relative' },
  avatarImg: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.offWhite },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarFallbackText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  avatarBadge: {
    position: 'absolute', left: 40, bottom: 0, width: 18, height: 18,
    borderRadius: 9, backgroundColor: COLORS.primary, justifyContent: 'center',
    alignItems: 'center', borderWidth: 2, borderColor: COLORS.white, zIndex: 2,
  },
  headerTextContainer: { marginLeft: 14, flex: 1 },
  welcomeText: { fontSize: 13, color: '#6B7280', fontWeight: '400' },
  buddyNameText: { fontSize: 20, fontWeight: '800', color: COLORS.charcoal, marginTop: 1 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  verifiedLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
  pendingLabel: { fontSize: 11, fontWeight: '700', color: COLORS.warning, letterSpacing: 0.5 },
  bellContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  notificationDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error },
  divider: { height: 1, backgroundColor: '#F0F0F0', },

  // Training cards
  alertCard: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 18, marginBottom: 20 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  alertTitle: { color: COLORS.white, fontSize: 17, fontWeight: '700', marginLeft: 10 },
  alertBody: { color: COLORS.white, fontSize: 14, marginBottom: 14, lineHeight: 20 },
  dateBtn: { flex: 1, marginHorizontal: 5 },

  statusInfoCard: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: '#E8E8E8', alignItems: 'center', gap: 14,
  },
  statusInfoIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  statusInfoTitle: { fontSize: 16, fontWeight: '700', color: COLORS.charcoal },
  statusInfoSub: { fontSize: 13, color: '#6B7280', marginTop: 3, lineHeight: 18 },

  // Pending verification
  pendingCard: { flexDirection: 'row', backgroundColor: '#FFF3E0', padding: 16, borderRadius: 14, marginBottom: 20, alignItems: 'center' },
  pendingText: { marginLeft: 10, color: '#E65100', flex: 1, fontSize: 14 },

  // Section headers
  sectionHeader: { fontSize: 18, fontWeight: '800', color: COLORS.charcoal, marginBottom: 14 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  viewAllText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  // Current Status
  currentStatusCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#E8E8E8', ...SHADOWS.light,
  },
  readyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  readyIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  readyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.charcoal },
  readySub: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 19 },
  statusDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 16 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal },
  toggleSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },

  // Performance cards
  perfRow: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  perfCardLight: {
    flex: 1, backgroundColor: '#FEF2F0', borderRadius: 16, padding: 18, paddingTop: 16, paddingBottom: 20,
  },
  perfIconRed: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#FDDDD6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  perfNumberDark: { fontSize: 34, fontWeight: '800', color: COLORS.charcoal, marginBottom: 4 },
  perfLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280' },

  perfCardGreen: {
    flex: 1.2, backgroundColor: '#2D6A4F', borderRadius: 16, padding: 18, paddingTop: 16, paddingBottom: 20,
  },
  perfIconGreen: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  perfNumberWhite: { fontSize: 34, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  perfLabelWhite: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },

  // Active job
  activeJobCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 18,
    borderWidth: 1.5, borderColor: COLORS.primary, marginBottom: 24, ...SHADOWS.light,
  },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  serviceType: { fontSize: 16, fontWeight: '700', color: COLORS.charcoal, flex: 1 },
  inProgressBadge: { backgroundColor: '#2D6A4F', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  inProgressBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  address: { color: '#6B7280', fontSize: 14, marginBottom: 14 },
  viewDetailsBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  viewDetailsBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Recent Activity
  activityItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderRadius: 14, padding: 16, marginBottom: 10, gap: 14,
  },
  activityIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8E8E8',
    justifyContent: 'center', alignItems: 'center',
  },
  activityTitle: { fontSize: 15, fontWeight: '700', color: COLORS.charcoal },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  completedBadge: { backgroundColor: '#DEF7EC', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  completedBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  activityDate: { fontSize: 12, color: '#6B7280' },
  activityAmount: { fontSize: 16, fontWeight: '800', color: COLORS.primary },

  emptyActivity: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: COLORS.white, padding: 24, borderRadius: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: COLORS.charcoal },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  optionText: { fontSize: 16, color: COLORS.charcoal },
});