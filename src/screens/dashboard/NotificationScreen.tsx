import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Surface, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, SHADOWS } from '../../config/theme';
import { useNotifications, StoredNotification } from '../../context/NotificationContext';
import { useSocket } from '../../context/SocketContext';
import { buddyApi } from '../../api/client';

export default function NotificationScreen() {
    const navigation = useNavigation<any>();
    const { socket } = useSocket();
    const {
        notifications,
        markAllAsRead,
        markAsRead,
        refreshNotifications,
        isLoading,
        hasMore,
        loadMore
    } = useNotifications();

    const isFocused = useIsFocused();

    // Refresh notifications when screen is focused
    useEffect(() => {
        if (isFocused) {
            refreshNotifications();
            markAllAsRead();
        }
    }, [isFocused]);

    const handleAccept = async (notification: StoredNotification) => {
        if (notification.type !== 'buddy-assignment') return;

        const assignmentId = notification.data?.assignmentId;
        if (!assignmentId) {
            Alert.alert('Error', 'Invalid assignment data');
            return;
        }

        try {
            // Use API for reliable transactional acceptance (catches 409 conflicts)
            await buddyApi.acceptJob(assignmentId);

            // Mark as read instead of removing
            await markAsRead(notification.id);

            Alert.alert('Success', 'Job accepted! Check your Active Jobs.');
        } catch (error: any) {
            if (error.response?.status === 409) {
                Alert.alert('Too Late', error.response?.data?.message || 'This job was accepted by another buddy.');
                await markAsRead(notification.id);
            } else if (error.response?.status === 400) {
                Alert.alert('Expired', 'This job offer has expired or was already processed.');
                await markAsRead(notification.id);
            } else {
                Alert.alert('Error', error.response?.data?.message || 'Failed to accept job');
            }
        }
    };

    const handleIgnore = async (notification: StoredNotification) => {
        await markAsRead(notification.id);
    };

    const handleOpenChat = async (notification: StoredNotification) => {
        if (notification.type !== 'chat-message') return;

        const bookingId = notification.data?.bookingId;
        const customerName = notification.data?.customerName || 'Customer';

        if (bookingId) {
            navigation.navigate('Chat', { bookingId, customerName });
            await markAsRead(notification.id);
        }
    };

    const handleNotificationPress = async (item: StoredNotification) => {
        if (!item.isRead) {
            await markAsRead(item.id);
        }

        if (item.type === 'BOOKING_ASSIGNED') {
            const assignmentId = item.data?.assignmentId;
            if (assignmentId) {
                navigation.navigate('Home', {
                    screen: 'JobDetailView',
                    params: { assignmentId }
                });
            }
        } else if (item.type === 'chat-message') {
            handleOpenChat(item);
        }
    };

    const handleClearAll = () => {
        Alert.alert(
            'Mark All as Read',
            'Are you sure you want to mark all notifications as read?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark All Read',
                    onPress: () => markAllAsRead(),
                },
            ]
        );
    };



    // Format time (uses device locale)
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    // Format date/time (uses device locale)
    const formatDateTimeIST = (dateStr: string | undefined): string => {
        if (!dateStr) return 'Scheduled';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Scheduled';
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    // Format relative time
    const formatRelativeTime = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    // Truncate address
    const truncateAddress = (address: string, maxLength: number = 40) => {
        if (!address) return '';
        return address.length > maxLength ? address.substring(0, maxLength) + '...' : address;
    };

    const renderJobNotification = (item: StoredNotification) => {
        const data = item.data || {};
        const serviceTitle = data.serviceTitle || 'Service';
        const address = data.address || '';
        const price = data.price ? `₹${data.price}` : '';
        const distance = data.distance ? `${data.distance} km` : '';
        const isImmediate = data.isImmediate;
        const scheduledStart = data.scheduledStart; // Use scheduledStart from booking


        return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleNotificationPress(item)}>
            <Surface style={[styles.card, SHADOWS.light, item.isRead && styles.readCard]}>
                {/* Header with bell icon and time */}
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <MaterialCommunityIcons name="bell-ring" size={20} color={COLORS.primary} />
                        <Text style={styles.headerTitle}>New Job Request</Text>
                    </View>
                    <Text style={styles.headerTime}>{formatRelativeTime(new Date(item.createdAt).getTime())}</Text>
                </View>

                <Divider style={styles.divider} />

                {/* Service Title */}
                <Text style={styles.serviceTitle}>{serviceTitle}</Text>

                {/* Address (truncated) */}
                <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="map-marker" size={16} color={COLORS.mediumGray} />
                    <Text style={styles.addressText} numberOfLines={1}>
                        {truncateAddress(address)}
                    </Text>
                </View>

                {/* Meta Info: Price, Distance, Time */}
                <View style={styles.metaContainer}>
                    {price ? (
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Price</Text>
                            <Text style={styles.metaValue}>{price}</Text>
                        </View>
                    ) : null}
                    {distance ? (
                        <View style={styles.metaItem}>
                            <Text style={styles.metaLabel}>Distance</Text>
                            <Text style={styles.metaValue}>{distance}</Text>
                        </View>
                    ) : null}
                    <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="calendar-clock" size={14} color={COLORS.mediumGray} />
                        <Text style={styles.metaValue}>{formatDateTimeIST(scheduledStart)}</Text>
                    </View>
                </View>

                {/* Immediate Badge */}
                {isImmediate && (
                    <View style={styles.urgentBadge}>
                        <MaterialCommunityIcons name="alert-circle" size={16} color="#B00020" />
                        <Text style={styles.urgentText}>Immediate Service Required</Text>
                    </View>
                )}

                {/* Action Buttons */}
                {!item.isRead && (
                    <View style={styles.actionRow}>
                        <Button
                            mode="outlined"
                            onPress={() => handleIgnore(item)}
                            style={styles.ignoreBtn}
                            labelStyle={styles.ignoreBtnLabel}
                        >
                            Ignore
                        </Button>
                        <Button
                            mode="contained"
                            onPress={() => handleAccept(item)}
                            style={styles.acceptBtn}
                            labelStyle={styles.acceptBtnLabel}
                        >
                            Accept
                        </Button>
                    </View>
                )}
            </Surface>
            </TouchableOpacity>
        );
    };

    const renderCancellationNotification = (item: StoredNotification) => {
        const data = item.data || {};
        const message = data.message || 'A booking has been cancelled.';

        return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleNotificationPress(item)}>
            <Surface style={[styles.card, styles.cancelCard, SHADOWS.light, item.isRead && styles.readCard]}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <MaterialCommunityIcons name="briefcase-remove" size={20} color={COLORS.error} />
                        <Text style={[styles.headerTitle, { color: COLORS.error }]}>Booking Cancelled</Text>
                    </View>
                    <Text style={styles.headerTime}>{formatRelativeTime(new Date(item.createdAt).getTime())}</Text>
                </View>

                <Divider style={styles.divider} />

                <Text style={styles.cancelMessage}>{message}</Text>
                <Text style={styles.cancelTime}>{formatDateTimeIST(item.data.cancelledAt)}</Text>

                <View style={styles.actionRow}>
                    <Button
                        mode="outlined"
                        onPress={() => handleIgnore(item)}
                        style={styles.dismissBtn}
                    >
                        Dismiss
                    </Button>
                </View>
            </Surface>
            </TouchableOpacity>
        );
    };

    const renderChatNotification = (item: StoredNotification) => {
        const data = item.data || {};
        const customerName = data.customerName || 'Customer';
        const content = data.content || 'Sent a message';

        return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleNotificationPress(item)}>
            <Surface style={[styles.card, SHADOWS.light, item.isRead && styles.readCard]}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <MaterialCommunityIcons name="chat-processing-outline" size={20} color={COLORS.accent} />
                        <Text style={[styles.headerTitle, { color: COLORS.accent }]}>New Message</Text>
                    </View>
                    <Text style={styles.headerTime}>{formatRelativeTime(new Date(item.createdAt).getTime())}</Text>
                </View>

                <Divider style={styles.divider} />

                <Text style={styles.serviceTitle}>{customerName}</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.addressText} numberOfLines={2}>
                        {content}
                    </Text>
                </View>

                <View style={styles.actionRow}>
                    <Button
                        mode="outlined"
                        onPress={() => handleIgnore(item)}
                        style={styles.ignoreBtn}
                        labelStyle={styles.ignoreBtnLabel}
                    >
                        Dismiss
                    </Button>
                    <Button
                        mode="contained"
                        onPress={() => handleOpenChat(item)}
                        style={[styles.acceptBtn, { backgroundColor: COLORS.accent }]}
                        labelStyle={styles.acceptBtnLabel}
                    >
                        Open Chat
                    </Button>
                </View>
            </Surface>
            </TouchableOpacity>
        );
    };

    const renderNotification = ({ item }: { item: StoredNotification }) => {
        if (item.type === 'buddy-assignment') {
            return renderJobNotification(item);
        } else if (item.type === 'booking-cancelled') {
            return renderCancellationNotification(item);
        } else if (item.type === 'chat-message') {
            return renderChatNotification(item);
        }
        
        // General Notification Fallback
        return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleNotificationPress(item)}>
            <Surface style={[styles.card, SHADOWS.light, item.isRead && styles.readCard]}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <MaterialCommunityIcons name="bell" size={20} color={COLORS.primary} />
                        <Text style={styles.headerTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.headerTime}>{formatRelativeTime(new Date(item.createdAt).getTime())}</Text>
                </View>
                <Divider style={styles.divider} />
                <Text style={styles.serviceTitle}>{item.body}</Text>
                {!item.isRead && (
                    <View style={styles.actionRow}>
                        <Button mode="outlined" onPress={() => handleIgnore(item)} style={styles.dismissBtn}>
                            Mark as Read
                        </Button>
                    </View>
                )}
            </Surface>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <MaterialCommunityIcons name="close" size={24} color={COLORS.charcoal} />
                </TouchableOpacity>
                <Text style={styles.screenTitle}>Notifications</Text>
                <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
                    <Text style={[styles.clearBtnText, { color: COLORS.primary }]}>Mark All Read</Text>
                </TouchableOpacity>
            </View>

            {/* Notification List */}
            {notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconCircle}>
                        <MaterialCommunityIcons name="bell-off-outline" size={48} color={COLORS.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>No notifications yet</Text>
                    <Text style={styles.emptySub}>
                        When you have new messages, job updates, or alerts, they'll appear here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNotification}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    refreshing={isLoading}
                    onRefresh={() => refreshNotifications(1)}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    closeBtn: {
        padding: 4,
    },
    screenTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.charcoal,
    },
    clearBtn: {
        padding: 4,
    },
    clearBtnText: {
        color: '#E17A5E', // Match the light red/pink from the mockup
        fontWeight: '500',
        fontSize: 15,
    },

    // Empty State
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F0F7F4', // Light green background
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.charcoal,
        marginBottom: 12,
    },
    emptySub: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
    },

    // List Styles
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    readCard: {
        opacity: 0.7,
        backgroundColor: '#F9FAFB',
    },
    cancelCard: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.error,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
        marginLeft: 8,
    },
    headerTime: {
        fontSize: 12,
        color: '#6B7280',
    },
    divider: {
        backgroundColor: '#E8E8E8',
        marginVertical: 12,
    },
    serviceTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.charcoal,
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    addressText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 6,
        flex: 1,
    },
    metaContainer: {
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
    },
    metaItem: {
        flex: 1,
        alignItems: 'center',
    },
    metaLabel: {
        fontSize: 11,
        color: '#6B7280',
        marginBottom: 2,
    },
    metaValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.charcoal,
    },
    urgentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        padding: 10,
        borderRadius: 8,
        justifyContent: 'center',
        marginBottom: 12,
    },
    urgentText: {
        color: '#B00020',
        fontWeight: '600',
        marginLeft: 6,
        fontSize: 13,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
    },
    ignoreBtn: {
        flex: 1,
        borderColor: '#D0D0D0',
        borderWidth: 1.5,
        borderRadius: 10,
    },
    ignoreBtnLabel: {
        color: '#6B7280',
        fontWeight: '600',
    },
    acceptBtn: {
        flex: 1,
        backgroundColor: COLORS.primary,
        borderRadius: 10,
    },
    acceptBtnLabel: {
        color: COLORS.white,
        fontWeight: '700',
    },
    dismissBtn: {
        borderColor: '#D0D0D0',
        borderWidth: 1.5,
        borderRadius: 10,
        flex: 1,
    },
    cancelMessage: {
        fontSize: 14,
        color: COLORS.charcoal,
        marginBottom: 8,
    },
    cancelTime: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 12,
    },
});
