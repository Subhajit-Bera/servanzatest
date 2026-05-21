import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonText, SkeletonCircle } from '../Skeleton';
import { COLORS } from '../../config/theme';

/** Skeleton placeholder for EarningsScreen */
const EarningsSkeleton: React.FC = () => (
  <View style={styles.container}>
    {/* Page title */}
    <SkeletonText width={130} height={22} style={{ marginBottom: 16 }} />

    {/* Hero card */}
    <View style={styles.heroCard}>
      <SkeletonText width={110} height={14} />
      <SkeletonText width={120} height={32} style={{ marginTop: 8 }} />
      <View style={styles.pillsRow}>
        <SkeletonBox width={140} height={28} borderRadius={14} />
        <SkeletonBox width={120} height={28} borderRadius={14} />
      </View>
    </View>

    {/* Overview title */}
    <SkeletonText width={80} height={18} style={{ marginTop: 20, marginBottom: 12 }} />

    {/* Overview grid (2x2) */}
    <View style={styles.grid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.overviewCard}>
          <SkeletonBox width={40} height={40} borderRadius={10} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <SkeletonText width={60} height={20} />
            <SkeletonText width={50} height={12} style={{ marginTop: 4 }} />
          </View>
        </View>
      ))}
    </View>

    {/* Recent transactions */}
    <SkeletonText width={150} height={18} style={{ marginTop: 20, marginBottom: 12 }} />
    {[1, 2, 3].map((i) => (
      <View key={i} style={styles.txRow}>
        <SkeletonCircle size={36} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonText width={'60%'} height={14} />
          <SkeletonText width={'35%'} height={10} style={{ marginTop: 4 }} />
        </View>
        <SkeletonText width={60} height={16} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
});

export default EarningsSkeleton;
