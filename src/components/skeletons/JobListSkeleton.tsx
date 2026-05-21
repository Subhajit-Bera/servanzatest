import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonText, SkeletonCircle } from '../Skeleton';
import { COLORS } from '../../config/theme';

/** Single job card skeleton */
const JobCardSkeleton: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <SkeletonText width={'55%'} height={16} />
      <SkeletonBox width={80} height={24} borderRadius={10} />
    </View>
    <View style={styles.row}>
      <SkeletonCircle size={16} />
      <SkeletonText width={'65%'} height={13} />
    </View>
    <View style={styles.row}>
      <SkeletonCircle size={16} />
      <SkeletonText width={'40%'} height={13} />
    </View>
    <View style={styles.footer}>
      <SkeletonText width={70} height={18} />
      <SkeletonBox width={100} height={32} borderRadius={8} />
    </View>
  </View>
);

/** Skeleton for the jobs list screen — 3 placeholder cards */
const JobListSkeleton: React.FC = () => (
  <View style={styles.container}>
    {/* Tabs placeholder */}
    <View style={styles.tabsRow}>
      {[1, 2, 3].map((i) => (
        <SkeletonBox key={i} width={90} height={32} borderRadius={16} />
      ))}
    </View>
    {[1, 2, 3].map((i) => (
      <JobCardSkeleton key={i} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
});

export default JobListSkeleton;
