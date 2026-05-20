import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationEvents } from '../utils/notification';
import { buddyApi } from '../api/client';
import { useAppSelector } from '../store/hooks';

// Notification Types matching Backend FCM Payload
export type NotificationType = 'buddy-assignment' | 'booking-cancelled' | 'chat-message' | 'general';

export interface StoredNotification {
    id: string;
    type: NotificationType;
    title: string;
    body: string; // The backend uses 'body' for the message text
    data: any; // Contains assignmentId, bookingId, etc.
    createdAt: string;
    isRead: boolean;
}

interface NotificationContextType {
    notifications: StoredNotification[];
    unreadCount: number;
    markAllAsRead: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    refreshNotifications: (page?: number, limit?: number) => Promise<void>;
    isLoading: boolean;
    hasMore: boolean;
    loadMore: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAppSelector((state) => state.auth);
    const [notifications, setNotifications] = useState<StoredNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    // Load notifications from server
    const loadNotifications = useCallback(async (pageNum = 1, limit = 20) => {
        if (!isAuthenticated) return;
        
        try {
            if (pageNum === 1) {
                setIsLoading(true);
            }
            
            const response = await buddyApi.getNotifications(pageNum, limit);
            const { notifications: fetchedNotifications, meta } = response.data.data;
            
            // Map backend 'body' to frontend needs if necessary, though we use 'body' now
            const formattedNotifications = fetchedNotifications.map((n: any) => ({
                id: n.id,
                type: n.type || (n.data && n.data.type) || 'general',
                title: n.title,
                body: n.body,
                data: n.data || {},
                createdAt: n.createdAt,
                isRead: n.isRead,
            }));

            if (pageNum === 1) {
                setNotifications(formattedNotifications);
            } else {
                setNotifications(prev => [...prev, ...formattedNotifications]);
            }
            
            setUnreadCount(meta.unreadCount || 0);
            setHasMore(pageNum < meta.totalPages);
            setPage(pageNum);
        } catch (error) {
            console.error('[NotificationContext] Error loading notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Initial load
    useEffect(() => {
        if (isAuthenticated) {
            loadNotifications(1);
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [isAuthenticated, loadNotifications]);

    // Listen for new job requests from FCM/Socket to refresh inbox
    useEffect(() => {
        if (!isAuthenticated) return;

        const handleNewNotification = async () => {
            // Simply refresh the first page to get the latest state from server
            await loadNotifications(1);
        };

        notificationEvents.on('newJobRequest', handleNewNotification);
        notificationEvents.on('bookingCancelled', handleNewNotification);

        return () => {
            notificationEvents.off('newJobRequest', handleNewNotification);
            notificationEvents.off('bookingCancelled', handleNewNotification);
        };
    }, [isAuthenticated, loadNotifications]);

    const markAllAsRead = async () => {
        try {
            await buddyApi.markAllNotificationsRead();
            
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            
            console.log('[NotificationContext] Marked all as read');
        } catch (error) {
            console.error('[NotificationContext] Error marking all as read:', error);
            // Refresh to ensure sync on error
            await loadNotifications(1);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            await buddyApi.markNotificationRead(id);
            
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            
            console.log('[NotificationContext] Marked notification as read:', id);
        } catch (error) {
            console.error('[NotificationContext] Error marking notification as read:', error);
            await loadNotifications(1);
        }
    };

    const refreshNotifications = async (pageNum = 1, limit = 20) => {
        await loadNotifications(pageNum, limit);
    };

    const loadMore = async () => {
        if (!isLoading && hasMore) {
            await loadNotifications(page + 1);
        }
    };

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                markAllAsRead,
                markAsRead,
                refreshNotifications,
                isLoading,
                hasMore,
                loadMore
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
