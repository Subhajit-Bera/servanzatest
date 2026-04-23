import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../../config/theme';
import { fetchEarningsSummary } from '../../store/slices/buddySlice';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootState } from '../../store';

export default function EarningsScreen() {
  const dispatch = useDispatch<any>();

  const { earnings, loading } = useSelector((state: RootState) => state.buddy);

  const onRefresh = () => {
    dispatch(fetchEarningsSummary());
  };

  useEffect(() => {
    if (!earnings) {
      dispatch(fetchEarningsSummary());
    }
  }, [dispatch, earnings]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.offWhite }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        <Text style={styles.headerTitle}>My Earnings</Text>

        {/* Total Balance Card */}
        <View style={[styles.balanceCard, SHADOWS.green]}>
          <Text style={styles.balanceLabel}>Total Lifetime Earnings</Text>
          <Text style={styles.balanceValue}>₹{earnings?.totalEarnings || '0.00'}</Text>
          <Text style={styles.balanceSub}>Total Jobs: {earnings?.totalJobs || 0}</Text>
        </View>

        <Text style={styles.sectionTitle}>Overview</Text>

        <View style={styles.grid}>
          {/* Today */}
          <Card style={[styles.statCard, SHADOWS.light]}>
            <Card.Content style={styles.cardContent}>
              <View style={[styles.iconBox, { backgroundColor: '#E8F8F5' }]}>
                <MaterialCommunityIcons name="calendar-today" size={24} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.statValue}>₹{earnings?.today?.amount || '0'}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
            </Card.Content>
          </Card>

          {/* This Week */}
          <Card style={[styles.statCard, SHADOWS.light]}>
            <Card.Content style={styles.cardContent}>
              <View style={[styles.iconBox, { backgroundColor: '#FEF9E7' }]}>
                <MaterialCommunityIcons name="calendar-week" size={24} color={COLORS.warning} />
              </View>
              <View>
                <Text style={styles.statValue}>₹{earnings?.thisWeek?.amount || '0'}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
            </Card.Content>
          </Card>

          {/* This Month */}
          <Card style={[styles.statCard, SHADOWS.light, { width: '100%', marginTop: 10 }]}>
            <Card.Content style={styles.cardContent}>
              <View style={[styles.iconBox, { backgroundColor: '#EBF5FB' }]}>
                <MaterialCommunityIcons name="calendar-month" size={24} color={COLORS.info} />
              </View>
              <View>
                <Text style={styles.statValue}>₹{earnings?.thisMonth?.amount || '0'}</Text>
                <Text style={styles.statLabel}>This Month ({earnings?.thisMonth?.count || 0} jobs)</Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.mediumGray} />
          <Text style={styles.infoText}>Earnings are updated instantly after job completion. Payments are settled weekly.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite, padding: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.charcoal, marginBottom: 20 },

  balanceCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 30,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 5 },
  balanceValue: { color: COLORS.white, fontSize: 32, fontWeight: 'bold' },
  balanceSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 5 },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.charcoal, marginBottom: 15 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', backgroundColor: COLORS.white, borderRadius: 12, marginBottom: 10 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.charcoal },
  statLabel: { fontSize: 12, color: COLORS.mediumGray },

  infoBox: { flexDirection: 'row', marginTop: 20, padding: 15, backgroundColor: '#F2F3F4', borderRadius: 8 },
  infoText: { marginLeft: 10, color: COLORS.mediumGray, fontSize: 12, flex: 1 },
});