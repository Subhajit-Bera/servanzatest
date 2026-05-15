import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    ScrollView,
    Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buddyApi } from '../../api/client';
import { COLORS } from '../../config/theme';
import { useActiveJob } from '../../context/ActiveJobContext';
import { getDisplayTitle, getBuddyAddress } from '../../utils/bookingHelpers';

export default function JobInProgressScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { activeJob, remainingSeconds, elapsedSeconds, startJob, clearJob } = useActiveJob();

    const { assignmentId, durationMinutes } = route.params || {};

    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch job details on mount
    useEffect(() => {
        fetchJobDetails();
    }, []);

    const fetchJobDetails = async () => {
        try {
            const response = await buddyApi.getJobDetails(assignmentId);
            const jobData = response.data?.data || response.data;
            setJob(jobData);

            // Check if we need to start/update the job in context
            // Start new if: no active job OR active job is for a different assignment
            if (!activeJob || activeJob.assignmentId !== assignmentId) {
                // Clear any old job first
                if (activeJob && activeJob.assignmentId !== assignmentId) {
                    console.log('[JobInProgress] Clearing old job context, starting new one');
                    await clearJob();
                }

                // Start the job timer with fresh data
                const jobStartedAt = jobData.startedAt || new Date().toISOString();
                console.log('[JobInProgress] Starting job timer with startedAt:', jobStartedAt);

                await startJob({
                    assignmentId,
                    bookingId: jobData.booking.id,
                    startedAt: jobStartedAt,
                    durationMinutes: durationMinutes || jobData.booking.service.durationMins || 60,
                    serviceName: getDisplayTitle(jobData.booking),
                    customerName: jobData.booking.user.name,
                    customerPhone: jobData.booking.user.phone,
                    address: getBuddyAddress(jobData.booking.address),
                    totalAmount: jobData.booking.employeePayout,
                });
            }
        } catch (error) {
            console.error('Error fetching job details:', error);
            Alert.alert('Error', 'Failed to load job details');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimerColor = (): string => {
        if (remainingSeconds <= 0) return '#4CAF50'; // Green when done
        if (remainingSeconds <= 300) return '#FF9800'; // Orange when < 5 min
        return COLORS.primary;
    };

    // Can complete when < 5 min remaining OR time is up
    const canComplete = remainingSeconds <= 300;

    const handleCompleteJob = () => {
        if (!canComplete) {
            const minsRemaining = Math.ceil((remainingSeconds - 300) / 60);
            Alert.alert(
                'Cannot Complete Yet',
                `Please wait ${minsRemaining} more minute${minsRemaining > 1 ? 's' : ''} before completing the job.`
            );
            return;
        }

        // Navigate to OTP verification flow
        navigation.navigate('JobCompletion', {
            assignmentId,
            jobData: job || activeJob,
        });
    };

    const handleCallCustomer = () => {
        const phone = job?.booking?.user?.phone || activeJob?.customerPhone;
        if (phone) {
            Linking.openURL(`tel:${phone}`);
        }
    };

    // Use active job data from context if job hasn't loaded yet
    const displayData = job ? {
        serviceName: getDisplayTitle(job.booking),
        customerName: job.booking?.user?.name,
        customerPhone: job.booking?.user?.phone,
        address: getBuddyAddress(job.booking?.address),
        totalAmount: job.booking?.employeePayout,
        durationMins: job.booking?.service?.durationMins,
    } : activeJob ? {
        serviceName: activeJob.serviceName,
        customerName: activeJob.customerName,
        customerPhone: activeJob.customerPhone,
        address: activeJob.address,
        totalAmount: activeJob.totalAmount,
        durationMins: activeJob.durationMinutes,
    } : null;

    const totalDurationMins = displayData?.durationMins || durationMinutes || 60;
    const progressPercentage = Math.min(100, (elapsedSeconds / (totalDurationMins * 60)) * 100);

    if (loading && !activeJob) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading job...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            navigation.navigate('Jobs');
                        }
                    }}
                >
                    <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.charcoal} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Job In Progress</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Timer Card */}
                <View style={styles.timerCard}>
                    <View style={[styles.timerCircle, { borderColor: getTimerColor() }]}>
                        <Text style={[styles.timerText, { color: getTimerColor() }]}>
                            {formatTime(remainingSeconds)}
                        </Text>
                        <Text style={styles.timerLabel}>
                            {remainingSeconds <= 0 ? 'Time Complete' : 'Remaining'}
                        </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${progressPercentage}%`, backgroundColor: getTimerColor() }
                                ]}
                            />
                        </View>
                        <Text style={styles.progressText}>
                            {Math.floor(elapsedSeconds / 60)} / {totalDurationMins} mins
                        </Text>
                    </View>
                </View>

                {/* Job Details Card */}
                {displayData && (
                    <View style={styles.detailsCard}>
                        <Text style={styles.sectionTitle}>Job Details</Text>

                        {/* Service Name */}
                        <View style={styles.detailRow}>
                            <View style={styles.detailIcon}>
                                <MaterialCommunityIcons name="briefcase-outline" size={20} color={COLORS.primary} />
                            </View>
                            <View style={styles.detailContent}>
                                <Text style={styles.detailLabel}>Service</Text>
                                <Text style={styles.detailValue}>{displayData.serviceName}</Text>
                            </View>
                        </View>

                        {/* Estimated Duration */}
                        <View style={styles.detailRow}>
                            <View style={styles.detailIcon}>
                                <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                            </View>
                            <View style={styles.detailContent}>
                                <Text style={styles.detailLabel}>Estimated Duration</Text>
                                <Text style={styles.detailValue}>{totalDurationMins} minutes</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Customer Name */}
                        <View style={styles.detailRow}>
                            <View style={styles.detailIcon}>
                                <MaterialCommunityIcons name="account" size={20} color="#2196F3" />
                            </View>
                            <View style={styles.detailContent}>
                                <Text style={styles.detailLabel}>Customer</Text>
                                <Text style={styles.detailValue}>{displayData.customerName}</Text>
                            </View>
                            <TouchableOpacity style={styles.callButton} onPress={handleCallCustomer}>
                                <MaterialCommunityIcons name="phone" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Address */}
                        <View style={styles.detailRow}>
                            <View style={styles.detailIcon}>
                                <MaterialCommunityIcons name="map-marker" size={20} color="#F44336" />
                            </View>
                            <View style={styles.detailContent}>
                                <Text style={styles.detailLabel}>Location</Text>
                                <Text style={styles.detailValue} numberOfLines={2}>{displayData.address}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Status Message */}
                <View style={styles.statusCard}>
                    {canComplete ? (
                        <View style={styles.statusContent}>
                            <MaterialCommunityIcons name="check-circle" size={28} color="#4CAF50" />
                            <View style={styles.statusTextContainer}>
                                <Text style={styles.statusTitle}>Ready to Complete!</Text>
                                <Text style={styles.statusDescription}>
                                    You can now complete the job and collect payment.
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.statusContent}>
                            <MaterialCommunityIcons name="timer-sand" size={28} color="#FF9800" />
                            <View style={styles.statusTextContainer}>
                                <Text style={styles.statusTitle}>Service in Progress</Text>
                                <Text style={styles.statusDescription}>
                                    Complete button will be available when less than 5 minutes remain.
                                </Text>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Action */}
            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity
                    style={[
                        styles.completeButton,
                        !canComplete && styles.disabledButton,
                    ]}
                    onPress={handleCompleteJob}
                    disabled={actionLoading}
                >
                    {actionLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <MaterialCommunityIcons
                                name={canComplete ? "check-decagram" : "clock-check-outline"}
                                size={24}
                                color={canComplete ? '#fff' : 'rgba(255,255,255,0.6)'}
                            />
                            <Text style={[
                                styles.completeButtonText,
                                !canComplete && styles.disabledButtonText,
                            ]}>
                                {canComplete ? 'Complete Job' : `Wait ${Math.ceil((remainingSeconds - 300) / 60)} min`}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: COLORS.mediumGray },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.charcoal,
        textAlign: 'center',
    },
    headerSpacer: { width: 40 },

    content: {
        flex: 1,
        padding: 16,
    },

    // Timer Card
    timerCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    timerCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 6,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    timerText: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    timerLabel: {
        fontSize: 12,
        color: COLORS.mediumGray,
        marginTop: 4,
    },
    progressContainer: {
        width: '100%',
    },
    progressBar: {
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressText: {
        textAlign: 'center',
        marginTop: 8,
        color: COLORS.mediumGray,
        fontSize: 13,
    },

    // Details Card
    detailsCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.charcoal,
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    detailIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailContent: {
        flex: 1,
        marginLeft: 12,
    },
    detailLabel: {
        fontSize: 12,
        color: COLORS.mediumGray,
    },
    detailValue: {
        fontSize: 15,
        fontWeight: '500',
        color: COLORS.charcoal,
        marginTop: 2,
    },
    priceText: {
        color: COLORS.primary,
        fontSize: 18,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 12,
    },
    callButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Status Card
    statusCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    statusContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusTextContainer: {
        flex: 1,
        marginLeft: 16,
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.charcoal,
    },
    statusDescription: {
        fontSize: 13,
        color: COLORS.mediumGray,
        marginTop: 4,
    },

    // Bottom Container
    bottomContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    completeButton: {
        flexDirection: 'row',
        backgroundColor: '#4CAF50',
        paddingVertical: 16,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    completeButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    disabledButton: {
        backgroundColor: '#9E9E9E',
        shadowColor: '#9E9E9E',
    },
    disabledButtonText: {
        color: 'rgba(255,255,255,0.7)',
    },
});
