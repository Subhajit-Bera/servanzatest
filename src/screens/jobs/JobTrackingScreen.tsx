import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buddyApi } from '../../api/client';
import { COLORS } from '../../config/theme';
import { useSocket } from '../../context/SocketContext';
import {
    startBackgroundLocationTracking,
    stopBackgroundLocationTracking
} from '../../utils/backgroundLocation';

import { CONFIG } from '../../config/constants';

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = CONFIG.GOOGLE_MAPS_API_KEY;

// Config
const GPS_UPDATE_INTERVAL = 3000; // Send GPS every 3 seconds
const GEOFENCE_RADIUS_KM = 0.5; // 500 meters - distance to enable "I've Arrived" button

interface JobDetails {
    id: string;
    status: string;
    booking: {
        id: string;
        scheduledStart: string;
        totalAmount: number;
        service: { title: string; durationMins: number };
        address: {
            formattedAddress: string;
            latitude: number;
            longitude: number;
        };
        user: {
            id: string;
            name: string;
            phone: string;
        };
    };
}

// Calculate Haversine distance (for quick distance checks without API)
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export default function JobTrackingScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const { socket } = useSocket();
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);

    const { assignmentId } = route.params;

    // State
    const [loading, setLoading] = useState(true);
    const [job, setJob] = useState<JobDetails | null>(null);
    const [buddyLocation, setBuddyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
    const [heading, setHeading] = useState(0);
    const [isBackgroundTrackingEnabled, setIsBackgroundTrackingEnabled] = useState(false);

    // Helper: Check if current time is within 30 minutes of scheduled start
    // This prevents buddies from starting tracking/job too early
    const canStartJobActions = (): boolean => {
        if (!job?.booking?.scheduledStart) return true; // Allow if no schedule
        const scheduledTime = new Date(job.booking.scheduledStart).getTime();
        const now = Date.now();
        const thirtyMinutesInMs = 30 * 60 * 1000;
        const timeUntilScheduled = scheduledTime - now;
        // Can start if within 30 mins before scheduled time or already past scheduled time
        return timeUntilScheduled <= thirtyMinutesInMs;
    };

    // Helper: Get time remaining until can start (for display)
    const getTimeUntilCanStart = (): string => {
        if (!job?.booking?.scheduledStart) return '';
        const scheduledTime = new Date(job.booking.scheduledStart).getTime();
        const now = Date.now();
        const thirtyMinutesInMs = 30 * 60 * 1000;
        const canStartAt = scheduledTime - thirtyMinutesInMs;
        const timeRemaining = canStartAt - now;

        if (timeRemaining <= 0) return '';

        const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
        const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    // Fetch job details
    useEffect(() => {
        fetchJobDetails();
        return () => {
            // Cleanup foreground tracking
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
            // Note: Background tracking continues until job is completed
        };
    }, []);

    // Start tracking when job is loaded and status is ON_WAY
    useEffect(() => {
        if (job && job.status === 'ON_WAY') {
            startLocationTracking();
            // Start background tracking for when app is minimized
            startBackgroundTracking();
        } else if (job && job.status === 'ACCEPTED') {
            startLocationTracking();
        }
    }, [job?.status]);

    // Fit map to show route
    useEffect(() => {
        if (buddyLocation && job?.booking.address && mapRef.current) {
            const destination = {
                latitude: job.booking.address.latitude,
                longitude: job.booking.address.longitude,
            };

            mapRef.current.fitToCoordinates([buddyLocation, destination], {
                edgePadding: { top: 150, right: 50, bottom: 350, left: 50 },
                animated: true,
            });
        }
    }, [buddyLocation, job]);

    const fetchJobDetails = async () => {
        try {
            const response = await buddyApi.getJobDetails(assignmentId);
            const jobData = response.data?.data || response.data;
            setJob(jobData);
        } catch (error) {
            console.error('Error fetching job details:', error);
            Alert.alert('Error', 'Failed to load job details');
        } finally {
            setLoading(false);
        }
    };

    const startBackgroundTracking = async () => {
        if (!job) return;

        try {
            const success = await startBackgroundLocationTracking({
                assignmentId,
                bookingId: job.booking.id,
                userId: job.booking.user.id,
            });

            if (success) {
                setIsBackgroundTrackingEnabled(true);
                console.log('[JobTracking] Background tracking enabled');
            }
        } catch (error) {
            console.error('[JobTracking] Failed to start background tracking:', error);
        }
    };

    const startLocationTracking = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Location permission is required for tracking');
            return;
        }

        // Get initial location
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });

        const initialLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };

        setBuddyLocation(initialLocation);
        setHeading(location.coords.heading || 0);

        // Send initial location to backend via Socket.IO
        sendLocationToBackend(initialLocation.latitude, initialLocation.longitude);

        // Watch location updates with high accuracy (foreground)
        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: GPS_UPDATE_INTERVAL,
                distanceInterval: 5, // Update every 5 meters minimum
            },
            (newLocation) => {
                const newCoords = {
                    latitude: newLocation.coords.latitude,
                    longitude: newLocation.coords.longitude,
                };

                setBuddyLocation(newCoords);
                setHeading(newLocation.coords.heading || heading);

                // Send to backend via Socket.IO for real-time tracking
                sendLocationToBackend(newCoords.latitude, newCoords.longitude);
            }
        );
    };

    // Send GPS to backend via Socket.IO (for user to see buddy moving)
    const sendLocationToBackend = useCallback((latitude: number, longitude: number) => {
        if (socket && job) {
            socket.emit('buddy:location', {
                assignmentId,
                bookingId: job.booking.id,
                userId: job.booking.user.id,
                latitude,
                longitude,
                heading,
                timestamp: new Date().toISOString(),
            });

            // Also update via API (for persistence)
            buddyApi.updateLocation(latitude, longitude).catch(console.error);
        }
    }, [socket, job, assignmentId, heading]);

    // Handle route ready from Directions API
    const handleRouteReady = useCallback((result: any) => {
        setRouteInfo({
            distance: result.distance,
            duration: result.duration,
        });
    }, []);

    const handleStartTracking = async () => {
        // Check 30-minute rule
        if (!canStartJobActions()) {
            const timeUntil = getTimeUntilCanStart();
            Alert.alert(
                'Too Early',
                `You can start tracking 30 minutes before the scheduled time. Please wait ${timeUntil}.`
            );
            return;
        }

        setActionLoading(true);
        try {
            await buddyApi.startTracking(assignmentId);
            Alert.alert('Started', 'User has been notified that you are on your way!');
            fetchJobDetails();
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to start tracking');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReachedDestination = async () => {
        // Check 30-minute rule (should not happen normally after ON_WAY, but just in case)
        if (!canStartJobActions()) {
            const timeUntil = getTimeUntilCanStart();
            Alert.alert(
                'Too Early',
                `Please wait ${timeUntil} before marking arrived.`
            );
            return;
        }

        setActionLoading(true);
        try {
            await buddyApi.markArrived(assignmentId);
            // Stop background tracking when arrived
            await stopBackgroundLocationTracking();
            setIsBackgroundTrackingEnabled(false);
            Alert.alert('Arrived', 'User has been notified that you have arrived!');
            fetchJobDetails();
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to mark arrived');
        } finally {
            setActionLoading(false);
        }
    };

    const handleStartJob = async () => {
        setActionLoading(true);
        try {
            await buddyApi.startJob(assignmentId);
            navigation.replace('JobInProgress', {
                assignmentId,
                durationMinutes: job?.booking.service.durationMins || 60
            });
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to start job');
            setActionLoading(false);
        }
    };

    const handleCallUser = () => {
        if (job?.booking.user.phone) {
            Linking.openURL(`tel:${job.booking.user.phone}`);
        }
    };

    const openGoogleMapsNavigation = () => {
        if (job?.booking.address) {
            const { latitude, longitude } = job.booking.address;
            const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
            Linking.openURL(url);
        }
    };

    // Calculate straight-line distance (Haversine) for quick display
    const getQuickDistance = () => {
        if (!buddyLocation || !job?.booking.address) return null;
        const dist = haversineDistance(
            buddyLocation.latitude,
            buddyLocation.longitude,
            job.booking.address.latitude,
            job.booking.address.longitude
        );
        return dist;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading job details...</Text>
            </View>
        );
    }

    if (!job) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Job not found</Text>
            </View>
        );
    }

    const destination = {
        latitude: job.booking.address.latitude,
        longitude: job.booking.address.longitude,
    };

    const quickDistance = getQuickDistance();

    return (
        <View style={styles.container}>
            {/* Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
                showsUserLocation={false}
                showsMyLocationButton={true}
                showsCompass={true}
                showsTraffic={job.status === 'ON_WAY'}
                rotateEnabled={true}
            >
                {/* Route Polyline from Directions API */}
                {buddyLocation && job.status === 'ON_WAY' && (
                    <MapViewDirections
                        origin={buddyLocation}
                        destination={destination}
                        apikey={GOOGLE_MAPS_API_KEY}
                        strokeWidth={5}
                        strokeColor="#2196F3"
                        optimizeWaypoints={true}
                        mode="DRIVING"
                        onReady={handleRouteReady}
                        onError={(error) => console.log('Directions error:', error)}
                    />
                )}

                {/* Buddy Marker */}
                {buddyLocation && (
                    <Marker
                        coordinate={buddyLocation}
                        title="Your Location"
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat={true}
                        rotation={heading}
                    >
                        <View style={styles.buddyMarkerContainer}>
                            <View style={styles.buddyMarker}>
                                <MaterialCommunityIcons
                                    name="motorbike"
                                    size={22}
                                    color="#fff"
                                />
                            </View>
                            <View style={styles.markerPulse} />
                        </View>
                    </Marker>
                )}

                {/* Destination Marker */}
                <Marker
                    coordinate={destination}
                    title={job.booking.user.name}
                    description={job.booking.address.formattedAddress}
                    anchor={{ x: 0.5, y: 1 }}
                >
                    <View style={styles.destinationMarkerContainer}>
                        <View style={styles.destinationMarker}>
                            <MaterialCommunityIcons name="home" size={20} color="#fff" />
                        </View>
                        <View style={styles.destinationMarkerTail} />
                    </View>
                </Marker>
            </MapView>

            {/* Top Controls Row - Route info only */}
            <View style={[styles.topControlsRow, { top: insets.top + 10 }]}>
                {/* Spacer */}
                <View style={styles.topControlsSpacer} />

                {/* Route Info Badge - Right */}
                {routeInfo && job.status === 'ON_WAY' && (
                    <View style={styles.routeInfoBadge}>
                        <View style={styles.routeInfoItem}>
                            <MaterialCommunityIcons name="map-marker-distance" size={16} color="#fff" />
                            <Text style={styles.routeInfoText}>{routeInfo.distance.toFixed(1)} km</Text>
                        </View>
                        <View style={styles.routeInfoDivider} />
                        <View style={styles.routeInfoItem}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color="#fff" />
                            <Text style={styles.routeInfoText}>{Math.round(routeInfo.duration)} min</Text>
                        </View>
                    </View>
                )}

                {/* Quick Distance when route not loaded */}
                {!routeInfo && quickDistance && job.status === 'ON_WAY' && (
                    <View style={styles.routeInfoBadge}>
                        <Text style={styles.routeInfoText}>~{quickDistance.toFixed(1)} km</Text>
                    </View>
                )}
            </View>

            {/* Background Tracking Indicator */}
            {isBackgroundTrackingEnabled && (
                <View style={styles.backgroundIndicator}>
                    <View style={styles.backgroundDot} />
                    <Text style={styles.backgroundText}>Live Tracking</Text>
                </View>
            )}

            {/* Bottom Panel */}
            <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
                {/* Status Badge */}
                <View style={styles.statusRow}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
                        <Text style={styles.statusText}>{getStatusLabel(job.status)}</Text>
                    </View>
                </View>

                {/* User Info */}
                <View style={styles.userInfoRow}>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{job.booking.user.name}</Text>
                        <Text style={styles.serviceName}>{job.booking.service.title}</Text>
                    </View>
                    <TouchableOpacity style={styles.callButton} onPress={handleCallUser}>
                        <MaterialCommunityIcons name="phone" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Address with Open in Maps link */}
                <View style={styles.addressRow}>
                    <MaterialCommunityIcons name="map-marker" size={18} color="#F44336" />
                    <View style={styles.addressContent}>
                        <Text style={styles.addressText} numberOfLines={2}>
                            {job.booking.address.formattedAddress}
                        </Text>
                        {job.status === 'ON_WAY' && (
                            <TouchableOpacity
                                style={styles.openMapsLink}
                                onPress={openGoogleMapsNavigation}
                            >
                                <MaterialCommunityIcons name="google-maps" size={14} color="#2196F3" />
                                <Text style={styles.openMapsText}>Open in Maps</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                    {/* Too Early Warning */}
                    {job.status === 'ACCEPTED' && !canStartJobActions() && (
                        <View style={styles.tooEarlyWarning}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#FF9800" />
                            <Text style={styles.tooEarlyText}>
                                You can start tracking in {getTimeUntilCanStart()}
                            </Text>
                        </View>
                    )}

                    {job.status === 'ACCEPTED' && (
                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                !canStartJobActions() && styles.disabledPrimaryButton
                            ]}
                            onPress={handleStartTracking}
                            disabled={actionLoading || !canStartJobActions()}
                        >
                            {actionLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="navigation" size={22} color="#fff" />
                                    <Text style={styles.primaryButtonText}>Start Navigation</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {job.status === 'ON_WAY' && (
                        <>
                            {/* Check if within geofence */}
                            {quickDistance !== null && quickDistance <= GEOFENCE_RADIUS_KM ? (
                                <TouchableOpacity
                                    style={[styles.primaryButton, styles.arrivedButton]}
                                    onPress={handleReachedDestination}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
                                            <Text style={styles.primaryButtonText}>I've Arrived</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.disabledButtonContainer}>
                                    <View style={[styles.primaryButton, styles.disabledButton]}>
                                        <MaterialCommunityIcons name="map-marker-distance" size={22} color="rgba(255,255,255,0.7)" />
                                        <Text style={styles.disabledButtonText}>
                                            {quickDistance ? `${(quickDistance * 1000).toFixed(0)}m away` : 'Calculating...'}
                                        </Text>
                                    </View>
                                    <Text style={styles.geofenceHint}>Get within 500m to mark arrived</Text>
                                </View>
                            )}
                        </>
                    )}

                    {job.status === 'ARRIVED' && (
                        <TouchableOpacity
                            style={[styles.primaryButton, styles.startButton]}
                            onPress={handleStartJob}
                            disabled={actionLoading}
                        >
                            {actionLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="play-circle" size={22} color="#fff" />
                                    <Text style={styles.primaryButtonText}>Start Job</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

// Helper functions
const getStatusColor = (status: string) => {
    switch (status) {
        case 'ACCEPTED': return '#FF9800';
        case 'ON_WAY': return '#2196F3';
        case 'ARRIVED': return '#4CAF50';
        default: return '#757575';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'ACCEPTED': return 'Ready to Go';
        case 'ON_WAY': return 'On the Way';
        case 'ARRIVED': return 'At Location';
        default: return status;
    }
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: COLORS.mediumGray },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: COLORS.error, fontSize: 16 },
    map: { flex: 1 },

    // Top Controls Row
    topControlsRow: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        zIndex: 100,
    },
    topControlsSpacer: {
        flex: 1,
    },

    // Route Info Badge - Right side
    routeInfoBadge: {
        flexDirection: 'row',
        backgroundColor: '#2196F3',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
        elevation: 6,
    },
    routeInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    routeInfoDivider: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(255,255,255,0.4)',
        marginHorizontal: 10,
    },
    routeInfoText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },

    // Background Tracking Indicator
    backgroundIndicator: {
        position: 'absolute',
        top: 70,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(76, 175, 80, 0.9)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    backgroundDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginRight: 6,
    },
    backgroundText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },

    // Buddy Marker
    buddyMarkerContainer: {
        alignItems: 'center',
    },
    buddyMarker: {
        backgroundColor: '#2196F3',
        padding: 10,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    markerPulse: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        zIndex: -1,
    },

    // Destination Marker
    destinationMarkerContainer: {
        alignItems: 'center',
    },
    destinationMarker: {
        backgroundColor: '#F44336',
        padding: 10,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    destinationMarkerTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 12,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#F44336',
        marginTop: -3,
    },

    // Bottom Panel
    bottomPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 15,
    },
    statusRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    statusBadge: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    userInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 20, fontWeight: 'bold', color: COLORS.charcoal },
    serviceName: { fontSize: 14, color: COLORS.mediumGray, marginTop: 2 },
    callButton: {
        backgroundColor: '#4CAF50',
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 12,
    },
    addressContent: {
        flex: 1,
        marginLeft: 8,
    },
    addressText: {
        fontSize: 14,
        color: COLORS.darkGray,
        lineHeight: 20,
    },
    openMapsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    openMapsText: {
        fontSize: 13,
        color: '#2196F3',
        fontWeight: '500',
    },
    actionButtons: { marginTop: 4 },
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#2196F3',
        paddingVertical: 16,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#2196F3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    arrivedButton: {
        backgroundColor: '#FF9800',
        shadowColor: '#FF9800',
    },
    startButton: {
        backgroundColor: '#4CAF50',
        shadowColor: '#4CAF50',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    disabledButtonContainer: {
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#9E9E9E',
        shadowColor: '#9E9E9E',
        opacity: 0.8,
    },
    disabledButtonText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        fontWeight: '600',
    },
    geofenceHint: {
        marginTop: 8,
        fontSize: 12,
        color: COLORS.mediumGray,
        textAlign: 'center',
    },
    tooEarlyWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        padding: 12,
        borderRadius: 10,
        marginBottom: 12,
        gap: 8,
    },
    tooEarlyText: {
        color: '#E65100',
        fontSize: 14,
        flex: 1,
    },
    disabledPrimaryButton: {
        backgroundColor: '#BDBDBD',
        shadowOpacity: 0,
        elevation: 0,
    },
});
