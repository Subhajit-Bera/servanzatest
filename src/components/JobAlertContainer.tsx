// import React from 'react';
// import {
//     View,
//     Text,
//     TouchableOpacity,
//     StyleSheet,
//     ScrollView,
//     Dimensions,
// } from 'react-native';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { MaterialCommunityIcons } from '@expo/vector-icons';
// import JobAlertCard, { JobAlertData } from './JobAlertCard';

// interface JobAlertContainerProps {
//     jobs: JobAlertData[];
//     takenJobIds: Set<string>;
//     loadingJobId: string | null;
//     onAccept: (assignmentId: string) => void;
//     onIgnore: (assignmentId: string) => void;
//     onDismissAll: () => void;
// }

// const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// const MAX_HEIGHT = SCREEN_HEIGHT * 0.6; // Max 60% of screen height

// const JobAlertContainer: React.FC<JobAlertContainerProps> = ({
//     jobs,
//     takenJobIds,
//     loadingJobId,
//     onAccept,
//     onIgnore,
//     onDismissAll,
// }) => {
//     const insets = useSafeAreaInsets();

//     if (jobs.length === 0) {
//         return null;
//     }

//     return (
//         <View style={[styles.container, { paddingTop: insets.top }]}>
//             <View style={styles.wrapper}>
//                 {/* Header */}
//                 <View style={styles.header}>
//                     <TouchableOpacity style={styles.dismissAllButton} onPress={onDismissAll}>
//                         <MaterialCommunityIcons name="close" size={18} color="#666" />
//                         <Text style={styles.dismissAllText}>Dismiss All</Text>
//                     </TouchableOpacity>
//                     <View style={styles.countBadge}>
//                         <Text style={styles.countText}>{jobs.length} Alert{jobs.length !== 1 ? 's' : ''}</Text>
//                     </View>
//                 </View>

//                 {/* Scrollable Job Cards */}
//                 <ScrollView
//                     style={styles.scrollView}
//                     contentContainerStyle={styles.scrollContent}
//                     showsVerticalScrollIndicator={true}
//                     bounces={false}
//                 >
//                     {jobs.map((job) => (
//                         <JobAlertCard
//                             key={job.assignmentId}
//                             job={job}
//                             onAccept={onAccept}
//                             onIgnore={onIgnore}
//                             isLoading={loadingJobId === job.assignmentId}
//                             isTaken={takenJobIds.has(job.bookingId)}
//                         />
//                     ))}
//                 </ScrollView>
//             </View>
//         </View>
//     );
// };

// const styles = StyleSheet.create({
//     container: {
//         position: 'absolute',
//         top: 0,
//         left: 0,
//         right: 0,
//         zIndex: 9999,
//         backgroundColor: 'rgba(0, 0, 0, 0.3)',
//         maxHeight: MAX_HEIGHT,
//     },
//     wrapper: {
//         backgroundColor: '#f5f5f5',
//         // borderBottomLeftRadius: 16,
//         // borderBottomRightRadius: 16,
//         shadowColor: '#000',
//         shadowOffset: { width: 0, height: 4 },
//         shadowOpacity: 0.2,
//         shadowRadius: 8,
//         elevation: 8,
//         overflow: 'hidden',
//     },
//     header: {
//         flexDirection: 'row',
//         justifyContent: 'space-between',
//         alignItems: 'center',
//         paddingHorizontal: 16,
//         paddingVertical: 10,
//         backgroundColor: '#fff',
//         borderBottomWidth: 1,
//         borderBottomColor: '#e0e0e0',
//     },
//     dismissAllButton: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         paddingVertical: 4,
//         paddingHorizontal: 8,
//     },
//     dismissAllText: {
//         marginLeft: 4,
//         fontSize: 13,
//         color: '#666',
//         fontWeight: '500',
//     },
//     countBadge: {
//         backgroundColor: '#4CAF50',
//         paddingHorizontal: 10,
//         paddingVertical: 4,
//         borderRadius: 12,
//     },
//     countText: {
//         fontSize: 12,
//         color: '#fff',
//         fontWeight: '600',
//     },
//     scrollView: {
//         maxHeight: MAX_HEIGHT - 60, // Subtract header height
//     },
//     scrollContent: {
//         paddingVertical: 8,
//         paddingBottom: 16,
//     },
// });

// export default JobAlertContainer;



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
import { BlurView } from 'expo-blur';
import JobAlertCard, { JobAlertData } from './JobAlertCard';

interface JobAlertContainerProps {
  jobs: JobAlertData[];
  takenJobIds: Set<string>;
  loadingJobId: string | null;
  onAccept: (assignmentId: string) => void;
  onIgnore: (assignmentId: string) => void;
  onDismissAll: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_HEIGHT = SCREEN_HEIGHT * 0.6;

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Glass Blur Wrapper */}
      <BlurView intensity={40} tint="light" style={styles.blurWrapper}>
        {/* Header */}
        <View style={styles.header}>
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
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,

    // Dim background behind glass
    backgroundColor: 'rgba(0,0,0,0.25)',
    maxHeight: MAX_HEIGHT,
  },

  blurWrapper: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',

    // Glass border
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',

    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    paddingHorizontal: 16,
    paddingVertical: 10,

    backgroundColor: 'rgba(255,255,255,0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.4)',
  },

  dismissAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },

  dismissAllText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },

  countBadge: {
    backgroundColor: 'rgba(76,175,80,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  countText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },

  scrollView: {
    maxHeight: MAX_HEIGHT - 60,
  },

  scrollContent: {
    paddingVertical: 8,
    paddingBottom: 16,
  },
});

export default JobAlertContainer;
