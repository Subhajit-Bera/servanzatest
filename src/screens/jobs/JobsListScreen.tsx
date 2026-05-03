import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Searchbar, Card, Badge, ActivityIndicator, Chip } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buddyApi } from '../../api/client';
import { COLORS, SHADOWS } from '../../config/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type FilterType = 'ACTIVE' | 'PENDING' | 'HISTORY';

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

  if (filter === 'ACTIVE') {
    // ACTIVE = Today's jobs with active statuses
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

  } else if (filter === 'PENDING') {
    // PENDING = Future jobs (after today) with ACCEPTED status ONLY
    const response = await buddyApi.getJobs();
    const allJobs = response.data?.data?.jobs || [];

    filteredJobs = allJobs.filter((j: any) => {
      const booking = j.booking || j;
      const scheduledStart = booking.scheduledStart;
      const isFutureDate = scheduledStart && isFuture(scheduledStart);
      const isAccepted = j.status === 'ACCEPTED';
      return isAccepted && isFutureDate;
    });

  } else {
    // HISTORY = completed/rejected jobs
    const response = await buddyApi.getJobHistory({ page: 1, limit: 50 });
    filteredJobs = response.data?.data?.history || [];
  }

  return filteredJobs;
};

export default function JobsListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  // Get initial filter from route params (defaults to 'ACTIVE')
  const initialFilter = route.params?.initialFilter || 'ACTIVE';
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

  const handleTrackLocation = (assignmentId: string, status: string, scheduledStart?: string) => {
    if (status === 'ACCEPTED' && scheduledStart && !canTrackLocation(scheduledStart)) {
      return;
    }
    if (status === 'IN_PROGRESS') {
      navigation.navigate('Home', { screen: 'JobInProgress', params: { assignmentId } });
    } else if (status === 'COMPLETED') {
      navigation.navigate('Home', { screen: 'JobDetails', params: { assignmentId } });
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

  const getShortAddress = (address: string) => {
    if (!address) return 'Address';
    const parts = address.split(',');
    return parts.slice(0, 2).join(', ').substring(0, 40) + (address.length > 40 ? '...' : '');
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
    const title = booking.service?.title || '';
    const addr = booking.address?.formattedAddress || '';
    const q = searchQuery.toLowerCase();
    return title.toLowerCase().includes(q) || addr.toLowerCase().includes(q);
  });

  const renderJobItem = ({ item }: { item: any }) => {
    const booking = item.booking || item;
    const status = item.status || booking.status;
    const scheduledStart = booking.scheduledStart;
    const inProgress = isJobInProgress(status);

    return (
      <Card
        style={[styles.card, SHADOWS.light, inProgress && styles.glowingCard]}
        onPress={() => {
          if (filter === 'ACTIVE' && status !== 'COMPLETED') {
            if (status === 'ACCEPTED' && !canTrackLocation(scheduledStart)) return;
            handleTrackLocation(item.id, status, scheduledStart);
          }
        }}
      >
        <Card.Content>
          <View style={styles.row}>
            <Text style={styles.serviceTitle}>{booking.service?.title || 'Service'}</Text>
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
              {getShortAddress(booking.address?.formattedAddress)}
            </Text>
          </View>

          {filter === 'ACTIVE' && status !== 'COMPLETED' && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.trackButton,
                  inProgress && styles.inProgressButton,
                  (!inProgress && !canTrackLocation(scheduledStart)) && styles.disabledButton
                ]}
                onPress={() => handleTrackLocation(item.id, status)}
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

          {filter === 'ACTIVE' && status === 'COMPLETED' && (
            <View style={styles.completedRow}>
              <MaterialCommunityIcons name="check-decagram" size={18} color="#4CAF50" />
              <Text style={styles.completedText}>Completed Today</Text>
            </View>
          )}

          {(filter === 'PENDING' || (filter === 'HISTORY' && status !== 'COMPLETED')) && filter !== 'HISTORY' && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.rejectButton} onPress={() => handleRejectJob(item.id)}>
                <MaterialCommunityIcons name="close-circle" size={16} color="#F44336" />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}

          {filter === 'HISTORY' && (
            <View style={styles.completedRow}>
              <MaterialCommunityIcons
                name={status === 'COMPLETED' ? 'check-decagram' : 'close-circle'}
                size={18}
                color={status === 'COMPLETED' ? '#4CAF50' : '#F44336'}
              />
              <Text style={{
                color: status === 'COMPLETED' ? '#4CAF50' : '#F44336',
                fontWeight: '600',
                fontSize: 14
              }}>
                {status === 'COMPLETED' ? 'Completed' : 'Rejected'}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>My Jobs</Text>

      <Searchbar
        placeholder="Search jobs..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        elevation={0}
      />

      <View style={styles.filterContainer}>
        {['ACTIVE', 'PENDING', 'HISTORY'].map((f) => (
          <Chip
            key={f}
            selected={filter === f}
            onPress={() => setFilter(f as FilterType)}
            style={[styles.chip, filter === f && styles.activeChip]}
            textStyle={filter === f && styles.activeChipText}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </Chip>
        ))}
      </View>

      {isLoading && !isRefetching && !jobs.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayJobs}
          renderItem={renderJobItem}
          keyExtractor={(item) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-off-outline" size={60} color={COLORS.lightGray} />
              <Text style={styles.emptyText}>No {filter.toLowerCase()} jobs found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite, paddingTop: 50 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.charcoal, paddingHorizontal: 16, marginBottom: 16 },
  searchBar: { marginHorizontal: 16, marginBottom: 16, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  chip: { marginRight: 8, backgroundColor: COLORS.white, borderColor: COLORS.lightGray, borderWidth: 1 },
  activeChip: { backgroundColor: '#E8F8F5', borderColor: COLORS.primary },
  activeChipText: { color: COLORS.primary, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.charcoal, flex: 1 },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  infoText: { fontSize: 12, color: COLORS.mediumGray, marginLeft: 4 },
  address: { fontSize: 12, color: COLORS.darkGray, marginLeft: 4, flex: 1 },
  price: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  trackButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2196F3', paddingVertical: 10, borderRadius: 8, gap: 6,
  },
  rejectButton: {
    flex: 0.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#F44336',
    paddingVertical: 10, borderRadius: 8, gap: 4,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  rejectButtonText: { color: '#F44336', fontWeight: '600', fontSize: 13 },
  disabledButton: { backgroundColor: '#f5f5f5', borderColor: '#ddd' },
  disabledButtonText: { color: '#aaa' },
  glowingCard: {
    borderWidth: 2, borderColor: '#2196F3', shadowColor: '#2196F3', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  inProgressButton: { backgroundColor: '#FF9800' },
  completedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  completedText: { color: '#4CAF50', fontWeight: '600', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: COLORS.mediumGray, marginTop: 10 },
});