import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { socket } from './socket';

// Task name for background location
export const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Store active job info for background updates
let activeJobInfo: {
    assignmentId: string;
    bookingId: string;
    userId: string;
} | null = null;

// Define the background task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error) {
        console.error('[BackgroundLocation] Error:', error);
        return;
    }

    if (data) {
        const { locations } = data;
        const location = locations[0];

        if (location && activeJobInfo) {
            console.log('[BackgroundLocation] Got location:', location.coords.latitude, location.coords.longitude);

            // Send location to backend via Socket.IO
            if (socket.connected) {
                socket.emit('buddy:location', {
                    assignmentId: activeJobInfo.assignmentId,
                    bookingId: activeJobInfo.bookingId,
                    userId: activeJobInfo.userId,
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    heading: location.coords.heading || 0,
                    timestamp: new Date().toISOString(),
                    isBackground: true,
                });
            } else {
                // HTTP BACKUP: Socket disconnected, use API
                // This ensures we track even on 2G/3G where socket might drop
                try {
                    console.log('[BackgroundLocation] Socket disconnected, using HTTP fallback');
                    const { buddyApi } = require('../api/client'); // Dynamic import to avoid cycles
                    await buddyApi.updateLocation(location.coords.latitude, location.coords.longitude);
                } catch (err) {
                    console.error('[BackgroundLocation] HTTP fallback error:', err);
                }
            }
        }
    }
});

/**
 * Start background location tracking for a job
 */
export const startBackgroundLocationTracking = async (jobInfo: {
    assignmentId: string;
    bookingId: string;
    userId: string;
}) => {
    // Store job info for use in background task
    activeJobInfo = jobInfo;

    // Request background permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
        console.error('[BackgroundLocation] Foreground permission denied');
        return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
        console.error('[BackgroundLocation] Background permission denied');
        return false;
    }

    // Check if task is already running
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
        console.log('[BackgroundLocation] Task already running');
        return true;
    }

    // Start background location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Or every 10 meters
        foregroundService: {
            notificationTitle: 'Tracking Active',
            notificationBody: 'Servanza is tracking your location for the active job',
            notificationColor: '#2196F3',
        },
        // Android specific
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
    });

    console.log('[BackgroundLocation] Started background tracking');
    return true;
};

/**
 * Stop background location tracking
 */
export const stopBackgroundLocationTracking = async () => {
    activeJobInfo = null;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log('[BackgroundLocation] Stopped background tracking');
    }
};

/**
 * Check if background tracking is active
 */
export const isBackgroundTrackingActive = async () => {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
};
