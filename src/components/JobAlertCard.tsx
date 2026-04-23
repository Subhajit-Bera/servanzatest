import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface JobAlertData {
    assignmentId: string;
    bookingId: string;
    serviceTitle: string;
    address: string;
    price: number | string;
    scheduledDate?: string;
    isImmediate?: boolean;
}

interface JobAlertCardProps {
    job: JobAlertData;
    onAccept: (assignmentId: string) => void;
    onIgnore: (assignmentId: string) => void;
    isLoading?: boolean;
    isTaken?: boolean;
}

// Format date (uses device locale)
const formatDate = (dateString?: string): string => {
    if (!dateString) {
        // Use current date if not provided
        const now = new Date();
        return now.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    }

    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const JobAlertCard: React.FC<JobAlertCardProps> = ({
    job,
    onAccept,
    onIgnore,
    isLoading = false,
    isTaken = false,
}) => {
    const price = typeof job.price === 'string' ? parseFloat(job.price) : job.price;

    if (isTaken) {
        return (
            <View style={[styles.card, styles.takenCard]}>
                <View style={styles.takenContent}>
                    <MaterialCommunityIcons name="close-circle" size={20} color="#F44336" />
                    <Text style={styles.takenText}>Job taken by another buddy</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            {/* Header Row */}
            <View style={styles.headerRow}>
                <View style={styles.titleRow}>
                    <MaterialCommunityIcons name="bell-ring" size={16} color="#4CAF50" />
                    <Text style={styles.serviceTitle} numberOfLines={1}>
                        {job.serviceTitle}
                    </Text>
                </View>
                <Text style={styles.price}>₹{price}</Text>
            </View>

            {/* Address */}
            <View style={styles.infoRow}>
                <MaterialCommunityIcons name="map-marker" size={14} color="#666" />
                <Text style={styles.address} numberOfLines={1}>
                    {job.address}
                </Text>
            </View>

            {/* Date/Time */}
            <View style={styles.infoRow}>
                <MaterialCommunityIcons name="calendar-clock" size={14} color="#666" />
                <Text style={styles.dateTime}>
                    {formatDate(job.scheduledDate)}
                    {job.isImmediate && (
                        <Text style={styles.immediate}> • Immediate</Text>
                    )}
                </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={styles.ignoreButton}
                    onPress={() => onIgnore(job.assignmentId)}
                    disabled={isLoading}
                >
                    <Text style={styles.ignoreText}>Ignore</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.acceptButton, isLoading && styles.disabledButton]}
                    onPress={() => onAccept(job.assignmentId)}
                    disabled={isLoading}
                >
                    <Text style={styles.acceptText}>
                        {isLoading ? 'Accepting...' : 'Accept'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginHorizontal: 12,
        marginVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50',
    },
    takenCard: {
        borderLeftColor: '#F44336',
        opacity: 0.7,
    },
    takenContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    takenText: {
        marginLeft: 8,
        fontSize: 13,
        color: '#F44336',
        fontWeight: '500',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    serviceTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginLeft: 6,
        flex: 1,
    },
    price: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4CAF50',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    address: {
        fontSize: 12,
        color: '#666',
        marginLeft: 6,
        flex: 1,
    },
    dateTime: {
        fontSize: 12,
        color: '#666',
        marginLeft: 6,
    },
    immediate: {
        color: '#F44336',
        fontWeight: '600',
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    ignoreButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        alignItems: 'center',
    },
    ignoreText: {
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
    },
    acceptButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#4CAF50',
        alignItems: 'center',
    },
    acceptText: {
        fontSize: 13,
        color: '#fff',
        fontWeight: '600',
    },
    disabledButton: {
        backgroundColor: '#a5d6a7',
    },
});

export default JobAlertCard;
