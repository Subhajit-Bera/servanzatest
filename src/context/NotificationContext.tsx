import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationEvents } from '../utils/notification';

// Notification Types
export type NotificationType = 'job-assignment' | 'booking-cancelled' | 'chat-message';

export interface StoredNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    data: any; // Contains assignmentId, bookingId, etc.
    timestamp: number;
    read: boolean;
}

interface NotificationContextType {
    notifications: StoredNotification[];
    unreadCount: number;
    addNotification: (notification: Omit<StoredNotification, 'id' | 'timestamp' | 'read'>) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAllNotifications: () => Promise<void>;
    removeNotification: (id: string) => Promise<void>;
    refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const NOTIFICATIONS_STORAGE_KEY = 'stored_notifications';
const UNREAD_COUNT_KEY = 'unread_notifications';
const MAX_NOTIFICATION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<StoredNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Load notifications from storage on mount (with 7-day pruning)
    const loadNotifications = useCallback(async () => {
        try {
            const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as StoredNotification[];
                // Prune notifications older than 7 days
                const cutoff = Date.now() - MAX_NOTIFICATION_AGE_MS;
                const pruned = parsed.filter(n => n.timestamp >= cutoff);
                // Sort by timestamp descending (newest first)
                pruned.sort((a, b) => b.timestamp - a.timestamp);
                setNotifications(pruned);
                // Save pruned list back if we removed anything
                if (pruned.length !== parsed.length) {
                    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(pruned));
                    console.log(`[NotificationContext] Pruned ${parsed.length - pruned.length} old notifications`);
                }
            }

            const countStr = await AsyncStorage.getItem(UNREAD_COUNT_KEY);
            setUnreadCount(countStr ? parseInt(countStr, 10) : 0);
        } catch (error) {
            console.error('[NotificationContext] Error loading notifications:', error);
        }
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    // Listen for new job requests from FCM/Socket
    useEffect(() => {
        const handleNewJobRequest = async (data: any) => {
            await addNotification({
                type: 'job-assignment',
                title: 'New Job Available',
                message: `${data.serviceTitle} at ${data.address}`,
                data,
            });
        };

        const handleBookingCancelled = async (data: any) => {
            await addNotification({
                type: 'booking-cancelled',
                title: 'Booking Cancelled',
                message: data.message || `${data.serviceTitle} has been cancelled by the customer.`,
                data,
            });
        };

        notificationEvents.on('newJobRequest', handleNewJobRequest);
        notificationEvents.on('bookingCancelled', handleBookingCancelled);

        return () => {
            notificationEvents.off('newJobRequest', handleNewJobRequest);
            notificationEvents.off('bookingCancelled', handleBookingCancelled);
        };
    }, []);

    // Add a new notification (reads from AsyncStorage to avoid stale closure)
    const addNotification = async (notification: Omit<StoredNotification, 'id' | 'timestamp' | 'read'>) => {
        try {
            const newNotification: StoredNotification = {
                ...notification,
                id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                read: false,
            };

            // Read current from storage to avoid stale closure
            const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
            console.log('Stored Notifications:', stored)
            const currentNotifications = stored ? JSON.parse(stored) : [];
            const updatedNotifications = [newNotification, ...currentNotifications];
            console.log('Updated Notifications:', updatedNotifications);

            await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
            setNotifications(updatedNotifications);

            // Read current unread count from storage
            const countStr = await AsyncStorage.getItem(UNREAD_COUNT_KEY);
            const currentCount = countStr ? parseInt(countStr, 10) : 0;
            const newCount = currentCount + 1;

            await AsyncStorage.setItem(UNREAD_COUNT_KEY, newCount.toString());
            setUnreadCount(newCount);

            console.log('[NotificationContext] Added notification:', notification.type, 'Total:', updatedNotifications.length);
        } catch (error) {
            console.error('[NotificationContext] Error adding notification:', error);
        }
    };

    // Mark all as read (clears badge but keeps notifications)
    // IMPORTANT: Reads from AsyncStorage directly to avoid race condition
    // where React state may still be empty when this runs on screen focus.
    const markAllAsRead = async () => {
        try {
            const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
            const current = stored ? JSON.parse(stored) as StoredNotification[] : [];
            const updated = current.map(n => ({ ...n, read: true }));

            await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
            setNotifications(updated);

            setUnreadCount(0);
            await AsyncStorage.setItem(UNREAD_COUNT_KEY, '0');

            console.log('[NotificationContext] Marked all as read');
        } catch (error) {
            console.error('[NotificationContext] Error marking as read:', error);
        }
    };

    // Clear all notifications
    const clearAllNotifications = async () => {
        try {
            setNotifications([]);
            await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);

            setUnreadCount(0);
            await AsyncStorage.setItem(UNREAD_COUNT_KEY, '0');

            console.log('[NotificationContext] Cleared all notifications');
        } catch (error) {
            console.error('[NotificationContext] Error clearing notifications:', error);
        }
    };

    // Remove single notification
    const removeNotification = async (id: string) => {
        try {
            const updated = notifications.filter(n => n.id !== id);
            setNotifications(updated);
            await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));

            console.log('[NotificationContext] Removed notification:', id);
        } catch (error) {
            console.error('[NotificationContext] Error removing notification:', error);
        }
    };

    // Refresh from storage
    const refreshNotifications = async () => {
        await loadNotifications();
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                addNotification,
                markAllAsRead,
                clearAllNotifications,
                removeNotification,
                refreshNotifications,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
