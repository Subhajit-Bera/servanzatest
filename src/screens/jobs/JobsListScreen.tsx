import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Searchbar, Card, Badge, ActivityIndicator, Avatar } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { buddyApi } from '../../api/client';
import { COLORS, SHADOWS } from '../../config/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getBookingItems, getDisplayTitle, getBuddyAddress } from '../../utils/bookingHelpers';
import { RootState } from '../../store';
import { useNotifications } from '../../context/NotificationContext';
import { CommonActions } from '@react-navigation/native';

type FilterType = 'TODAY' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

// Tab display labels
const TAB_LABELS: Record<FilterType, string> = {
  TODAY: 'Today',
  UPCOMING: 'Upcoming',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled / Rejected',
};

// Helper to check if a date is today
const isToday = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const scheduledDate = new Date(dateStr);
  const today = new Date();
  return (
    scheduledDate.getFullYear() === today.getFullYear() &&
    scheduledDate.getMonth() === today.getMonth() &&
    scheduledDate.getDate() === today.getDate()
  );
};

// Helper to check if a date is in the future (not today)
const isFuture = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const scheduledDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  scheduledDate.setHours(0, 0, 0, 0);
  return scheduledDate > today;
};

// --- API Fetcher ---
const fetchJobsByFilter = async (filter: FilterType) => {
  let filteredJobs: any[] = [];

  if (filter === 'TODAY') {
    // TODAY = Today's jobs with active statuses
    const response = await buddyApi.getJobs();
    const allJobs = response.data?.data?.jobs || [];
    const activeStatuses = ['ACCEPTED', 'ON_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'];

    filteredJobs = allJobs.filter((j: any) => {
      const booking = j.booking || j;
      const scheduledStart = booking.scheduledStart;
      const isJobToday = isToday(scheduledStart);
      const hasActiveStatus = activeStatuses.includes(j.status);
      return hasActiveStatus && scheduledStart && isJobToday;
    });

  } else if (filter === 'UPCOMING') {
    // UPCOMING = Future jobs (after today) with ACCEPTED status ONLY
    const response = await buddyApi.getJobs();
    const allJobs = response.data?.data?.jobs || [];

    filteredJobs = allJobs.filter((j: any) => {
      const booking = j.booking || j;
      const scheduledStart = booking.scheduledStart;
      const isFutureDate = scheduledStart && isFuture(scheduledStart);
      const isAccepted = j.status === 'ACCEPTED';
      return isAccepted && isFutureDate;
    });

  } else if (filter === 'COMPLETED') {
    // COMPLETED = Only completed jobs from history
    const response = await buddyApi.getJobHistory({ page: 1, limit: 50 });
    const history = response.data?.data?.history || [];
    filteredJobs = history.filter((j: any) => j.status === 'COMPLETED');

  } else {
    // CANCELLED = Cancelled or Rejected jobs from history
    const response = await buddyApi.getJobHistory({ page: 1, limit: 50 });
    const history = response.data?.data?.history || [];
    filteredJobs = history.filter((j: any) => 
      j.booking?.status === 'CANCELLED' || j.status === 'REJECTED'
    );
  }

  return filteredJobs;
};

export default function JobsListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  const { profile } = useSelector((state: RootState) => state.buddy);
  const { user } = useSelector((state: RootState) => state.auth);
  const { unreadCount } = useNotifications();

  const buddyName = user?.name || profile?.user?.name || profile?.name || 'Buddy';
  const rawImage = user?.profileImage || profile?.user?.profileImage || profile?.profileImage;
  const buddyImage = (rawImage && rawImage.startsWith('http')) ? { uri: rawImage } : null;

  const handleNotificationPress = () => {
    navigation.dispatch(CommonActions.navigate({ name: 'Notifications' }));
  };

  // Get initial filter from route params (defaults to 'TODAY')
  const initialFilter = route.params?.initialFilter || 'TODAY';
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // --- React Query ---
  const { data: jobs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['jobs', filter],
    queryFn: () => fetchJobsByFilter(filter),
    staleTime: 1000 * 30, // 30 seconds
  });

  // Handle route params for filter change
  React.useEffect(() => {
    if (route.params?.initialFilter && route.params.initialFilter !== filter) {
      setFilter(route.params.initialFilter);
    }
  }, [route.params?.initialFilter]);

  // Handle auto-refresh triggers
  React.useEffect(() => {
    if (route.params?.refreshKey) {
      refetch();
    }
  }, [route.params?.refreshKey, refetch]);

  // Refresh on focus (soft refresh, respects staleTime unless forced)
  useFocusEffect(
    useCallback(() => {
      // We can invalidate to force a background refetch if stale
      queryClient.invalidateQueries({ queryKey: ['jobs', filter] });
    }, [queryClient, filter])
  );

  // --- Actions ---

  const handleViewDetails = (assignmentId: string) => {
    navigation.navigate('Home', { screen: 'JobDetailView', params: { assignmentId } });
  };

  const handleTrackLocation = (assignmentId: string, status: string, scheduledStart?: string) => {
    if (status === 'ACCEPTED' && scheduledStart && !canTrackLocation(scheduledStart)) {
      return;
    }
    if (status === 'IN_PROGRESS') {
      navigation.navigate('Home', { screen: 'JobInProgress', params: { assignmentId } });
    } else if (status === 'COMPLETED') {
      handleViewDetails(assignmentId);
    } else {
      navigation.navigate('Home', { screen: 'JobTracking', params: { assignmentId } });
    }
  };

  const handleRejectJob = async (assignmentId: string) => {
    Alert.alert(
      'Reject Job',
      'You can only reject 2 jobs per week. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            // Optimistic update or just refetch
            try {
              await buddyApi.rejectJob(assignmentId);
              Alert.alert('Success', 'Job rejected');
              refetch();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed');
            }
          },
        },
      ]
    );
  };

  // --- Helper Logic (kept same) ---

  const canTrackLocation = (scheduledStart: string): boolean => {
    const scheduled = new Date(scheduledStart);
    const now = new Date();
    const diffMs = scheduled.getTime() - now.getTime();
    const diffMins = diffMs / (1000 * 60);
    return diffMins <= 30 && diffMins > -60;
  };

  const canRejectJob = (scheduledStart: string): boolean => {
    const scheduled = new Date(scheduledStart);
    const now = new Date();
    const diffMs = scheduled.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 3;
  };

  const isJobInProgress = (status: string) => ['ON_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(status);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return COLORS.primary;
      case 'IN_PROGRESS': return '#FF9800';
      case 'ACCEPTED': return '#4CAF50';
      case 'PENDING': return COLORS.info;
      case 'CANCELLED': return COLORS.error;
      case 'ON_WAY': return '#2196F3';
      case 'ARRIVED': return '#9C27B0';
      default: return COLORS.mediumGray;
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  const getActionButtonLabel = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'Track Location';
      case 'ON_WAY': return 'View Tracking';
      case 'ARRIVED': return 'Start Job';
      case 'IN_PROGRESS': return 'Continue';
      case 'COMPLETED': return 'View Details';
      default: return 'View';
    }
  };

  // --- Render ---

  // Simple client-side search filtering
  const displayJobs = jobs.filter(item => {
    if (!searchQuery) return true;
    const booking = item.booking || item;
    const title = getDisplayTitle(booking);
    const addr = booking.address?.streetAddress || '';
    const q = searchQuery.toLowerCase();
    // Also search through individual metadata items
    const items = getBookingItems(booking);
    const itemMatch = items.some(i => i.title?.toLowerCase().includes(q));
    return title.toLowerCase().includes(q) || addr.toLowerCase().includes(q) || itemMatch;
  });

  const renderJobItem = ({ item }: { item: any }) => {
    const booking = item.booking || item;
    const status = item.status || booking.status;
    const scheduledStart = booking.scheduledStart;
    const inProgress = isJobInProgress(status);

    return (
      <Card
        style={[styles.card, SHADOWS.light, inProgress && styles.glowingCard]}
        onPress={() => handleViewDetails(item.id)}
      >
        <Card.Content>
          <View style={styles.row}>
            <Text style={styles.serviceTitle}>{getDisplayTitle(booking)}</Text>
            <Badge style={{ backgroundColor: getStatusColor(status) }}>
              {status === 'ON_WAY' ? 'On Way' : status === 'IN_PROGRESS' ? 'In Progress' : status}
            </Badge>
          </View>

          <View style={[styles.row, { marginTop: 8 }]}>
            <View style={styles.infoItem}>
              <MaterialCommunityIcons name="calendar-clock" size={14} color={COLORS.mediumGray} />
              <Text style={styles.infoText}>{formatDateTime(scheduledStart)}</Text>
            </View>
            <Text style={styles.price}>Payout: ₹{booking.employeePayout || 0}</Text>
          </View>

          <View style={[styles.row, { marginTop: 6 }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.mediumGray} />
            <Text style={styles.address} numberOfLines={1}>
              {getBuddyAddress(booking.address)}
            </Text>
          </View>

          {filter === 'TODAY' && status !== 'COMPLETED' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.trackButton,
                  inProgress && styles.inProgressButton,
                  (!inProgress && !canTrackLocation(scheduledStart)) && styles.disabledButton
                ]}
                onPress={() => handleTrackLocation(item.id, status, scheduledStart)}
                disabled={!inProgress && !canTrackLocation(scheduledStart)}
              >
                <MaterialCommunityIcons
                  name={inProgress ? "play-circle" : "map-marker-radius"}
                  size={16}
                  color={(inProgress || canTrackLocation(scheduledStart)) ? '#fff' : '#aaa'}
                />
                <Text style={[
                  styles.buttonText,
                  (!inProgress && !canTrackLocation(scheduledStart)) && styles.disabledButtonText
                ]}>
                  {getActionButtonLabel(status)}
                </Text>
              </TouchableOpacity>

              {status === 'ACCEPTED' && (
                <TouchableOpacity
                  style={[styles.rejectButton, !canRejectJob(scheduledStart) && styles.disabledButton]}
                  onPress={() => handleRejectJob(item.id)}
                  disabled={!canRejectJob(scheduledStart)}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={16}
                    color={canRejectJob(scheduledStart) ? '#F44336' : '#aaa'}
                  />
                  <Text style={[
                    styles.rejectButtonText,
                    !canRejectJob(scheduledStart) && styles.disabledButtonText
                  ]}>
                    Reject
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {filter === 'TODAY' && status === 'COMPLETED' && (
            <View style={styles.completedRow}>
              <MaterialCommunityIcons name="check-decagram" size={18} color="#4CAF50" />
              <Text style={styles.completedText}>Completed Today</Text>
            </View>
          )}

          {filter === 'UPCOMING' && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.rejectButton} onPress={() => handleRejectJob(item.id)}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#F44336" />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}

          {filter === 'COMPLETED' && (
            <View style={styles.completedRow}>
              <MaterialCommunityIcons name="check-decagram" size={18} color="#4CAF50" />
              <Text style={{ color: '#4CAF50', fontWeight: '600', fontSize: 14 }}>
                Completed
              </Text>
            </View>
          )}

          {filter === 'CANCELLED' && (
            <View style={styles.completedRow}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#F44336" />
              <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 14 }}>
                {item.status === 'REJECTED' ? 'Rejected' : 'Cancelled'}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {buddyImage ? (
            <Avatar.Image size={36} source={buddyImage} style={{ backgroundColor: COLORS.offWhite }} />
          ) : (
            <Avatar.Text size={36} label={buddyName.substring(0, 2).toUpperCase()} style={{ backgroundColor: COLORS.primary }} />
          )}
          <Text style={styles.headerBrand}>{buddyName}</Text>
        </View>
        <TouchableOpacity onPress={handleNotificationPress} style={styles.bellContainer}>
          <MaterialCommunityIcons name="bell-outline" size={26} color={COLORS.charcoal} />
          {unreadCount > 0 && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </View>

      <Text style={styles.pageTitle}>My Jobs</Text>

      <Searchbar
        placeholder="Search jobs..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
        iconColor={COLORS.mediumGray}
        elevation={0}
      />

      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {(['TODAY', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.activeChip]}
              activeOpacity={0.7}
            >
              {filter === f && (
                <MaterialCommunityIcons name="check" size={16} color="#fff" style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.chipText, filter === f && styles.activeChipText]}>
                {TAB_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading && !isRefetching && !jobs.length ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2D6A4F" size="large" />
        </View>
      ) : (
        <FlatList
          data={displayJobs}
          renderItem={renderJobItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color="#D0D0D0" />
              <Text style={styles.emptyText}>No {TAB_LABELS[filter].toLowerCase()} jobs found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    borderColor: '#F8F9FA', // matches container bg
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2D6A4F',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    height: 50,
  },
  searchInput: {
    fontSize: 15,
    color: COLORS.charcoal,
  },
  filterWrapper: {
    marginBottom: 20,
  },
  filterContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  activeChip: {
    backgroundColor: '#2D6A4F', // Solid dark green
    borderColor: '#2D6A4F',
  },
  chipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeChipText: {
    color: '#fff',
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden', // For the left border
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.charcoal,
    flex: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
  },
  address: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D6A4F',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  rejectButton: {
    flex: 0.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  rejectButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  disabledButtonText: {
    color: '#aaa',
  },
  glowingCard: {
    borderLeftWidth: 6,
    borderLeftColor: '#2D6A4F',
    borderColor: '#E8E8E8',
  },
  inProgressButton: {
    backgroundColor: '#F59E0B',
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  completedText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#6B7280',
    marginTop: 12,
    fontSize: 15,
  },
});