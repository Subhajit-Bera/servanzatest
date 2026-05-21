import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from '../Skeleton';
import { COLORS, SHADOWS } from '../../config/theme';

/** Skeleton placeholder for Buddy HomeScreen initial load */
const HomeScreenSkeleton: React.FC = () => (
  <View style={styles.container}>
    {/* Header */}
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <SkeletonCircle size={48} />
        <View style={{ marginLeft: 12 }}>
          <SkeletonText width={140} height={18} />
          <SkeletonBox width={100} height={20} borderRadius={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonCircle size={30} />
    </View>

    {/* Status toggle */}
    <View style={styles.statusCard}>
      <View>
        <SkeletonText width={130} height={16} />
        <SkeletonText width={160} height={12} style={{ marginTop: 4 }} />
      </View>
      <SkeletonBox width={50} height={28} borderRadius={14} />
    </View>

    {/* Stats cards */}
    <View style={styles.statsRow}>
      <View style={styles.statBox}>
        <SkeletonText width={50} height={28} />
        <SkeletonText width={70} height={12} style={{ marginTop: 6 }} />
      </View>
      <View style={styles.statBox}>
        <SkeletonText width={70} height={28} />
        <SkeletonText width={80} height={12} style={{ marginTop: 6 }} />
      </View>
    </View>

    {/* Active job card placeholder */}
    <View style={styles.activeJobCard}>
      <SkeletonText width={100} height={16} style={{ marginBottom: 12 }} />
      <View style={styles.jobHeader}>
        <SkeletonText width={'60%'} height={16} />
        <SkeletonBox width={80} height={24} borderRadius={10} />
      </View>
      <SkeletonText width={'80%'} height={13} style={{ marginTop: 10 }} />
      <SkeletonBox width={'100%'} height={40} borderRadius={10} style={{ marginTop: 14 }} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
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
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 14,
    marginBottom: 24,
    backgroundColor: '#F5F5F5',
  },
  statsRow: {
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
  activeJobCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    ...SHADOWS.light,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default HomeScreenSkeleton;
