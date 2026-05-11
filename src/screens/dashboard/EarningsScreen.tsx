import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SHADOWS } from '../../config/theme';
import { fetchEarningsSummary } from '../../store/slices/buddySlice';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootState } from '../../store';
import { useNotifications } from '../../context/NotificationContext';
import { useAppSelector } from '../../store/hooks';
import { Avatar } from 'react-native-paper';

const DARK_GREEN = '#2D6A4F';

export default function EarningsScreen() {
  const dispatch = useDispatch<any>();
  const navigation = useNavigation<any>();
  const { earnings, loading, profile } = useSelector((state: RootState) => state.buddy);
  const { unreadCount } = useNotifications();

  const buddyName = profile?.user?.name || profile?.name || 'Buddy';
  const rawImage = profile?.user?.profileImage || profile?.profileImage;
  const buddyImage = (rawImage && rawImage.startsWith('http')) ? { uri: rawImage } : null;

  const onRefresh = () => {
    dispatch(fetchEarningsSummary());
  };

  useEffect(() => {
    if (!earnings) {
      dispatch(fetchEarningsSummary());
    }
  }, [dispatch, earnings]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {buddyImage ? (
              <Avatar.Image size={40} source={buddyImage} style={{ backgroundColor: COLORS.offWhite }} />
            ) : (
              <Avatar.Text size={40} label={buddyName.substring(0, 2).toUpperCase()} style={{ backgroundColor: COLORS.primary }} />
            )}
            <Text style={styles.headerBrand}>Servanza Buddy</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.bellContainer}>
            <MaterialCommunityIcons name="bell-outline" size={26} color={COLORS.charcoal} />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>My Earnings</Text>

        {/* Total Lifetime Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total Lifetime Earnings</Text>
          <Text style={styles.heroAmount}>₹{earnings?.totalEarnings || '0'}</Text>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>Total Jobs: {earnings?.totalJobs || 0}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Overview</Text>

        {/* Overview Grid */}
        <View style={styles.grid}>
          {/* Today */}
          <View style={styles.overviewCard}>
            <View style={[styles.iconBox, { backgroundColor: '#E8F8F0' }]}>
              <MaterialCommunityIcons name="calendar-today" size={22} color={DARK_GREEN} />
            </View>
            <View>
              <Text style={styles.overviewAmount}>₹{earnings?.today?.amount || '0'}</Text>
              <Text style={styles.overviewLabel}>Today</Text>
            </View>
          </View>

          {/* This Week */}
          <View style={styles.overviewCard}>
            <View style={[styles.iconBox, { backgroundColor: '#FEF3E2' }]}>
              <MaterialCommunityIcons name="calendar-week" size={22} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.overviewAmount}>₹{earnings?.thisWeek?.amount || '0'}</Text>
              <Text style={styles.overviewLabel}>This Week</Text>
            </View>
          </View>
        </View>

        {/* This Month (full-width) */}
        <View style={styles.monthCard}>
          <View style={[styles.iconBox, { backgroundColor: '#EBF5FB' }]}>
            <MaterialCommunityIcons name="calendar-month" size={22} color="#3B82F6" />
          </View>
          <View>
            <Text style={styles.overviewAmount}>₹{earnings?.thisMonth?.amount || '0'}</Text>
            <Text style={styles.overviewLabel}>This Month ({earnings?.thisMonth?.count || 0} jobs)</Text>
          </View>
        </View>

        {/* Info banner */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Earnings are updated instantly after job completion. Payments are settled weekly.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.offWhite,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Header
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
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginLeft: 10,
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
    borderColor: COLORS.offWhite,
  },

  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.charcoal,
    marginBottom: 20,
  },

  // Hero card
  heroCard: {
    backgroundColor: DARK_GREEN,
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 28,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    marginBottom: 8,
  },
  heroAmount: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 12,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  heroPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginBottom: 14,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  monthCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 20,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  overviewAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  overviewLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Info
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    marginBottom: 30,
  },
  infoText: {
    marginLeft: 10,
    color: '#6B7280',
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
});