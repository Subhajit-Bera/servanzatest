import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import JobAlertCard, { JobAlertData } from './JobAlertCard';

const DARK_GREEN = '#2D6A4F';

interface JobAlertContainerProps {
  jobs: JobAlertData[];
  takenJobIds: Set<string>;
  loadingJobId: string | null;
  onAccept: (assignmentId: string) => void;
  onIgnore: (assignmentId: string) => void;
  onDismissAll: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const JobAlertContainer: React.FC<JobAlertContainerProps> = ({
  jobs,
  takenJobIds,
  loadingJobId,
  onAccept,
  onIgnore,
  onDismissAll,
}) => {
  const insets = useSafeAreaInsets();

  if (jobs.length === 0) {
    return null;
  }

  return (
    <View style={[styles.overlay]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.dismissAllButton}
          onPress={onDismissAll}
        >
          <MaterialCommunityIcons name="close" size={18} color="#444" />
          <Text style={styles.dismissAllText}>Dismiss All</Text>
        </TouchableOpacity>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {jobs.length} Alert{jobs.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Scrollable Job Cards */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        bounces={false}
      >
        {jobs.map((job) => (
          <JobAlertCard
            key={job.assignmentId}
            job={job}
            onAccept={onAccept}
            onIgnore={onIgnore}
            isLoading={loadingJobId === job.assignmentId}
            isTaken={takenJobIds.has(job.bookingId)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: 'rgba(120, 120, 120, 0.65)',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  dismissAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },

  dismissAllText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

  countBadge: {
    backgroundColor: DARK_GREEN,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },

  countText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingVertical: 8,
    paddingBottom: 120,
  },
});

export default JobAlertContainer;
