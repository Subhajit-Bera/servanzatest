import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buddyApi } from '../../api/client';
import { COLORS, SHADOWS } from '../../config/theme';
import { getBookingItems, getDisplayTitle, getBuddyAddress } from '../../utils/bookingHelpers';

export default function JobDetailsScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { assignmentId } = route.params || {};

    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchJobDetails = useCallback(async () => {
        try {
            const response = await buddyApi.getJobDetails(assignmentId);
            const jobData = response.data?.data || response.data;
            setJob(jobData);
        } catch (error) {
            console.error('[JobDetails] Error fetching:', error);
            Alert.alert('Error', 'Could not load job details');
        } finally {
            setLoading(false);
        }
    }, [assignmentId]);

    useEffect(() => {
        fetchJobDetails();
    }, [fetchJobDetails]);

    // --- Time-gate helpers ---
    const canTakeAction = (scheduledStart: string, status: string, completedAt?: string): boolean => {
        if (status === 'CANCELLED') return false;
        
        const now = new Date().getTime();

        // If completed, allow actions for up to 12 hours after completion
        if (status === 'COMPLETED') {
            if (!completedAt) return false;
            const completed = new Date(completedAt).getTime();
            const twelveHoursMs = 12 * 60 * 60 * 1000;
            return now <= (completed + twelveHoursMs);
        }

        // Otherwise, allow starting 20 mins before scheduled start
        if (!scheduledStart) return false;
        const scheduled = new Date(scheduledStart).getTime();
        const minActionTime = scheduled - (20 * 60 * 1000); // 20 mins before
        return now >= minActionTime;
    };

    const getTimeUntilAction = (scheduledStart: string): string => {
        if (!scheduledStart) return '';
        const scheduled = new Date(scheduledStart).getTime();
        const now = new Date().getTime();
        const minActionTime = scheduled - (20 * 60 * 1000);
        const diffMs = minActionTime - now;
        
        if (diffMs <= 0) return '';
        
        const diffMins = Math.ceil(diffMs / (1000 * 60));
        if (diffMins > 60) {
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            return `Unlocks in ${hours}h ${mins}m`;
        }
        return `Unlocks in ${diffMins} min`;
    };

    // --- Navigation handlers ---
    const handleStartNavigation = () => {
        const status = job?.status;
        if (status === 'IN_PROGRESS') {
            navigation.navigate('JobInProgress', { assignmentId });
        } else {
            navigation.navigate('JobTracking', { assignmentId });
        }
    };

    const handleChat = () => {
        const booking = job?.booking;
        if (booking) {
            navigation.navigate('Chat', {
                bookingId: booking.id,
                customerName: booking.user?.name || 'Customer',
            });
        }
    };

    const handleCall = () => {
        const booking = job?.booking;
        if (booking) {
            navigation.navigate('VoiceCall', {
                bookingId: booking.id,
                customerName: booking.user?.name || 'Customer',
            });
        }
    };

    // --- Format helpers ---
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const formatTimeRange = (startStr: string, durationMins: number) => {
        if (!startStr) return '';
        const start = new Date(startStr);
        const end = new Date(start.getTime() + (durationMins || 60) * 60 * 1000);
        return `${formatTime(startStr)} - ${formatTime(end.toISOString())}`;
    };

    const formatDuration = (mins: number) => {
        if (!mins) return '1 hr';
        if (mins < 60) return `${mins} min`;
        const hours = Math.floor(mins / 60);
        const remaining = mins % 60;
        if (remaining === 0) return `${hours} hr `;
        return `${hours} hr ${remaining} min `;
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'ACCEPTED': return 'Accepted';
            case 'ON_WAY': return 'On Way';
            case 'ARRIVED': return 'Arrived';
            case 'IN_PROGRESS': return 'In Progress';
            case 'COMPLETED': return 'Completed';
            case 'CANCELLED': return 'Cancelled';
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return '#4CAF50';
            case 'IN_PROGRESS': return '#FF9800';
            case 'ACCEPTED': return '#4CAF50';
            case 'CANCELLED': return COLORS.error;
            case 'ON_WAY': return '#2196F3';
            case 'ARRIVED': return '#9C27B0';
            default: return COLORS.mediumGray;
        }
    };

    const getCustomerInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const getServiceIcon = (title: string): string => {
        const lower = (title || '').toLowerCase();
        if (lower.includes('floor')) return 'broom';
        if (lower.includes('kitchen')) return 'stove';
        if (lower.includes('sofa')) return 'sofa';
        if (lower.includes('bathroom') || lower.includes('toilet')) return 'shower';
        if (lower.includes('table')) return 'table-furniture';
        if (lower.includes('window')) return 'window-open';
        if (lower.includes('carpet')) return 'rug';
        if (lower.includes('garden') || lower.includes('lawn')) return 'tree';
        return 'hammer-wrench';
    };

    // --- Loading state ---
    if (loading || !job) {
        return (
            <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    const booking = job.booking || {};
    const status = job.status || 'ACCEPTED';
    const scheduledStart = booking.scheduledStart;
    const scheduledEnd = booking.scheduledEnd;
    
    let durationMins = 60;
    if (scheduledStart && scheduledEnd) {
        durationMins = Math.round((new Date(scheduledEnd).getTime() - new Date(scheduledStart).getTime()) / 60000);
    } else {
        durationMins = booking.service?.durationMins || booking.durationMins || 60;
    }
    
    const items = getBookingItems(booking);
    // Fallback for single-service bookings with no metadata items
    const displayItems = items.length > 0 ? items : booking.service ? [{
        serviceId: booking.service.id || 'single',
        title: booking.service.title || 'Service',
        price: booking.totalAmount || 0,
        quantity: 1,
    }] : [];
    const customerName = booking.user?.name || 'Customer';
    const isActive = ['ACCEPTED', 'ON_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(status);
    const actionsEnabled = canTakeAction(scheduledStart, status, booking.completedAt);
    const timeUntilAction = getTimeUntilAction(scheduledStart);

    // Bottom button label based on status
    const getBottomButtonLabel = () => {
        switch (status) {
            case 'IN_PROGRESS': return 'Continue Job';
            case 'ON_WAY': return 'View Tracking';
            case 'ARRIVED': return 'View Job';
            default: return 'Start Navigation';
        }
    };

    const getBottomButtonIcon = () => {
        switch (status) {
            case 'IN_PROGRESS': return 'play-circle';
            case 'ON_WAY': return 'map-marker-radius';
            default: return 'navigation-variant';
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.charcoal} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Job Details</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Status Card */}
                <View style={[styles.card, SHADOWS.light]}>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                            <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                                {getStatusLabel(status)}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.serviceTitleLarge}>{getDisplayTitle(booking)}</Text>
                    {displayItems.length > 1 && (
                        <Text style={styles.moreServicesHint}>+ {displayItems.length - 1} more</Text>
                    )}

                    <View style={styles.divider} />

                    <View style={styles.payoutRow}>
                        <View>
                            <Text style={styles.payoutLabel}>Estimated Payout</Text>
                            <Text style={styles.payoutValue}>₹{booking.employeePayout || 0}</Text>
                        </View>
                        <View style={styles.paymentMethodBadge}>
                            <MaterialCommunityIcons name="cash-multiple" size={16} color={COLORS.primary} />
                            <Text style={styles.paymentMethodText}>Cash on Delivery</Text>
                        </View>
                    </View>
                </View>

                {/* Schedule Card */}
                <View style={[styles.card, SHADOWS.light]}>
                    <View style={styles.scheduleRow}>
                        <View style={[styles.scheduleItem, { flex: 1.5, paddingRight: 8 }]}>
                            <View style={styles.iconContainer}>
                                <MaterialCommunityIcons name="calendar-blank" size={20} color={COLORS.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.scheduleDate} numberOfLines={1}>{formatDate(scheduledStart)}</Text>
                                <Text style={styles.scheduleTime} numberOfLines={1}>{formatTimeRange(scheduledStart, durationMins)}</Text>
                            </View>
                        </View>
                        <View style={[styles.scheduleItem, { flex: 1 }]}>
                            <View style={styles.iconContainer}>
                                <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.scheduleDurationLabel}>Duration</Text>
                                <Text style={styles.scheduleDuration} numberOfLines={1}>{formatDuration(durationMins)}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Customer Card */}
                <View style={[styles.card, SHADOWS.light]}>
                    <View style={styles.customerRow}>
                        <View style={styles.customerInfo}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{getCustomerInitials(customerName)}</Text>
                            </View>
                            <View>
                                <Text style={styles.customerName}>{customerName}</Text>
                                <Text style={styles.customerLabel}>Customer</Text>
                            </View>
                        </View>
                        <View style={styles.commButtons}>
                            <TouchableOpacity
                                style={[styles.commButton, !actionsEnabled && styles.commButtonDisabled]}
                                onPress={handleChat}
                                disabled={!actionsEnabled}
                            >
                                <MaterialCommunityIcons
                                    name="message-text-outline"
                                    size={20}
                                    color={actionsEnabled ? COLORS.primary : COLORS.mediumGray}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.commButton, !actionsEnabled && styles.commButtonDisabled]}
                                onPress={handleCall}
                                disabled={!actionsEnabled}
                            >
                                <MaterialCommunityIcons
                                    name="phone-outline"
                                    size={20}
                                    color={actionsEnabled ? COLORS.primary : COLORS.mediumGray}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Address Line 1 only (privacy) */}
                    <View style={styles.addressRow}>
                        <View style={styles.addressIconContainer}>
                            <MaterialCommunityIcons name="map-marker-outline" size={18} color={COLORS.primary} />
                        </View>
                        <Text style={styles.addressText} numberOfLines={2}>
                            {getBuddyAddress(booking.address)}
                        </Text>
                    </View>

                    {!['CANCELLED', 'REJECTED', 'COMPLETED'].includes(status) && !actionsEnabled && timeUntilAction ? (
                        <Text style={styles.timeGateHint}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={12} color={COLORS.mediumGray} />
                            {' '}{timeUntilAction}
                        </Text>
                    ) : null}
                </View>

                {/* Service Breakdown Card */}
                {displayItems.length > 0 && (
                    <View style={[styles.card, SHADOWS.light]}>
                        <View style={styles.breakdownHeader}>
                            <Text style={styles.breakdownTitle}>Service Breakdown</Text>
                            <View style={styles.itemCountBadge}>
                                <Text style={styles.itemCountText}>{displayItems.length} {displayItems.length === 1 ? 'Item' : 'Items'}</Text>
                            </View>
                        </View>

                        {displayItems.map((item, index) => (
                            <View key={item.serviceId || index}>
                                {index > 0 && <View style={styles.itemDivider} />}
                                <View style={styles.breakdownItem}>
                                    <View style={styles.breakdownIconContainer}>
                                        <MaterialCommunityIcons
                                            name={getServiceIcon(item.title) as any}
                                            size={20}
                                            color={COLORS.primary}
                                        />
                                    </View>
                                    <Text style={styles.breakdownItemTitle}>{item.title}</Text>
                                    <Text style={styles.breakdownItemQty}>{item.quantity}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Spacer for bottom button */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Action Button */}
            {isActive && (
                <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
                    <TouchableOpacity
                        style={[
                            styles.bottomButton,
                            SHADOWS.green,
                            !actionsEnabled && styles.bottomButtonDisabled,
                        ]}
                        onPress={handleStartNavigation}
                        disabled={!actionsEnabled}
                    >
                        <MaterialCommunityIcons
                            name={getBottomButtonIcon() as any}
                            size={22}
                            color={actionsEnabled ? '#fff' : '#aaa'}
                        />
                        <Text style={[
                            styles.bottomButtonText,
                            !actionsEnabled && styles.bottomButtonTextDisabled,
                        ]}>
                            {actionsEnabled ? getBottomButtonLabel() : timeUntilAction || 'Not yet available'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.offWhite,
    },
    loadingContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.white,
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

    // Scroll
    scrollView: { flex: 1 },
    scrollContent: { padding: 16 },

    // Card
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
    },

    // Status Card
    statusRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '600',
    },
    serviceTitleLarge: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.charcoal,
    },
    moreServicesHint: {
        fontSize: 14,
        color: COLORS.primary,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 14,
    },
    payoutRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    payoutLabel: {
        fontSize: 13,
        color: COLORS.mediumGray,
    },
    payoutValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginTop: 2,
    },
    paymentMethodBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    paymentMethodText: {
        fontSize: 12,
        color: COLORS.primary,
        fontWeight: '500',
    },

    // Schedule Card
    scheduleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    scheduleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scheduleDate: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.charcoal,
    },
    scheduleTime: {
        fontSize: 13,
        color: COLORS.mediumGray,
        marginTop: 2,
    },
    scheduleDurationLabel: {
        fontSize: 12,
        color: COLORS.mediumGray,
    },
    scheduleDuration: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.charcoal,
        marginTop: 2,
    },

    // Customer Card
    customerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    customerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.primary,
    },
    customerName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.charcoal,
    },
    customerLabel: {
        fontSize: 12,
        color: COLORS.mediumGray,
        marginTop: 1,
    },
    commButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    commButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    commButtonDisabled: {
        backgroundColor: '#f0f0f0',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 10,
        gap: 10,
    },
    addressIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addressText: {
        fontSize: 14,
        color: COLORS.charcoal,
        flex: 1,
        lineHeight: 20,
    },
    timeGateHint: {
        fontSize: 12,
        color: COLORS.mediumGray,
        marginTop: 8,
        textAlign: 'center',
    },

    // Service Breakdown
    breakdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    breakdownTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: COLORS.charcoal,
    },
    itemCountBadge: {
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    itemCountText: {
        fontSize: 12,
        color: COLORS.mediumGray,
        fontWeight: '500',
    },
    breakdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    breakdownIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    breakdownItemTitle: {
        flex: 1,
        fontSize: 15,
        color: COLORS.charcoal,
    },
    breakdownItemQty: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.charcoal,
    },
    itemDivider: {
        height: 1,
        backgroundColor: '#f0f0f0',
    },

    // Bottom Button
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: COLORS.offWhite,
    },
    bottomButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 14,
        gap: 10,
    },
    bottomButtonDisabled: {
        backgroundColor: '#e0e0e0',
        shadowColor: 'transparent',
    },
    bottomButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
    },
    bottomButtonTextDisabled: {
        color: '#999',
    },
});
