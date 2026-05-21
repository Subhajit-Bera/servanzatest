import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox, SkeletonText, SkeletonCircle } from '../Skeleton';
import { COLORS } from '../../config/theme';

/** Skeleton placeholder for JobDetailsScreen */
const JobDetailsSkeleton: React.FC = () => (
  <View style={styles.container}>
    {/* Status badge */}
    <View style={styles.statusRow}>
      <SkeletonBox width={110} height={28} borderRadius={10} />
    </View>

    {/* Customer info */}
    <View style={styles.card}>
      <SkeletonText width={130} height={16} style={{ marginBottom: 14 }} />
      <View style={styles.customerRow}>
        <SkeletonCircle size={48} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonText width={'50%'} height={16} />
          <SkeletonText width={'35%'} height={12} style={{ marginTop: 4 }} />
        </View>
        <SkeletonCircle size={36} />
      </View>
    </View>

    {/* Service details */}
    <View style={styles.card}>
      <SkeletonText width={110} height={16} style={{ marginBottom: 12 }} />
      <SkeletonText width={'70%'} height={15} />
      <View style={styles.infoRow}>
        <SkeletonText width={'45%'} height={13} />
        <SkeletonText width={'30%'} height={13} />
      </View>
      <View style={styles.infoRow}>
        <SkeletonText width={'55%'} height={13} />
        <SkeletonText width={'25%'} height={13} />
      </View>
    </View>

    {/* Address / Map */}
    <View style={styles.card}>
      <SkeletonText width={80} height={16} style={{ marginBottom: 12 }} />
      <SkeletonBox width={'100%'} height={120} borderRadius={10} />
      <SkeletonText width={'75%'} height={13} style={{ marginTop: 10 }} />
    </View>

    {/* Action button */}
    <SkeletonBox
      width={'100%'}
      height={48}
      borderRadius={12}
      style={{ marginTop: 16 }}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  statusRow: {
    alignItems: 'flex-start',
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
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});

export default JobDetailsSkeleton;
