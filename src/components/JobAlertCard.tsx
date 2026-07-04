import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Legacy Android LayoutAnimation enabler removed (no-op in New Architecture)
export interface JobAlertData {
    assignmentId: string;
    bookingId: string;
    serviceTitle: string;
    address: string;
    price: number | string;
    scheduledDate?: string;
    scheduledEnd?: string;
    metadata?: any; // { items: [{ title, quantity, serviceId }] }
    isImmediate?: boolean;
    offerExpiresAt?: string; // ISO date — when this offer expires (server-enforced)
}

interface JobAlertCardProps {
    job: JobAlertData;
    onAccept: (assignmentId: string) => void;
    onIgnore: (assignmentId: string) => void;
    isLoading?: boolean;
    isTaken?: boolean;
}

const DARK_GREEN = '#2D6A4F';
const MEDIUM_GREEN = '#40916C';
const LIGHT_GREEN_BG = '#F0F7F4';
const BODY_TEXT = '#4A4A4A';
const DIVIDER_COLOR = '#E8E8E8';

// Parse metadata items
const getItems = (metadata: any): { title: string; quantity: number }[] => {
    try {
        const raw = metadata;
        if (!raw) return [];
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed?.items || [];
    } catch {
        return [];
    }
};

// Format time from ISO date
const formatTime = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

// Format date + time range
const formatDateTimeRange = (startStr?: string, endStr?: string): string => {
    if (!startStr) return '';
    const start = new Date(startStr);
    const dateStr = start.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
    const startTime = formatTime(startStr);
    const endTime = endStr ? formatTime(endStr) : '';
    return endTime ? `${dateStr}, ${startTime} - ${endTime}` : `${dateStr}, ${startTime}`;
};

// Format duration
const formatDuration = (startStr?: string, endStr?: string): string => {
    if (!startStr || !endStr) return '';
    const diffMs = new Date(endStr).getTime() - new Date(startStr).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return `${mins} min (Approx.)`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (remMins === 0) return `${hrs} hr (Approx.)`;
    return `${hrs} hr ${remMins} min (Approx.)`;
};

const JobAlertCard: React.FC<JobAlertCardProps> = ({
    job,
    onAccept,
    onIgnore,
    isLoading = false,
    isTaken = false,
}) => {
    const [expanded, setExpanded] = useState(false);
    const price = typeof job.price === 'string' ? parseFloat(job.price) : job.price;
    const items = getItems(job.metadata);
    const hasMultipleItems = items.length > 1;

    const toggleAccordion = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

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
            {/* Green top bar */}
            <View style={styles.topBar} />

            {/* Header Row: Bell + Title + Chevron + Price */}
            <TouchableOpacity
                style={styles.headerRow}
                onPress={hasMultipleItems ? toggleAccordion : undefined}
                activeOpacity={hasMultipleItems ? 0.7 : 1}
            >
                <View style={styles.bellContainer}>
                    <MaterialCommunityIcons name="bell-ring" size={24} color={DARK_GREEN} />
                </View>
                <Text style={styles.serviceTitle} numberOfLines={2}>
                    {job.serviceTitle}
                </Text>
                <View style={styles.priceContainer}>
                    {hasMultipleItems && (
                        <MaterialCommunityIcons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={22}
                            color={BODY_TEXT}
                        />
                    )}
                    <Text style={styles.price}>₹{price}</Text>
                </View>
            </TouchableOpacity>

            {/* Accordion: Service breakdown */}
            {expanded && items.length > 0 && (
                <View style={styles.accordionBody}>
                    {items.map((item, index) => (
                        <View key={item.title + index}>
                            <View style={styles.accordionRow}>
                                <Text style={styles.accordionItemTitle}>{item.title}</Text>
                                <Text style={styles.accordionItemQty}>{item.quantity || 1}</Text>
                            </View>
                            {index < items.length - 1 && <View style={styles.accordionDivider} />}
                        </View>
                    ))}
                </View>
            )}

            {/* Info Rows */}
            <View style={styles.infoSection}>
                {/* Address */}
                <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="map-marker" size={16} color={BODY_TEXT} />
                    <Text style={styles.infoText} numberOfLines={1}>
                        {job.address}
                    </Text>
                </View>

                {/* Date + Time Range */}
                <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="calendar-blank" size={16} color={BODY_TEXT} />
                    <Text style={styles.infoText}>
                        {formatDateTimeRange(job.scheduledDate, job.scheduledEnd)}
                    </Text>
                </View>

                {/* Duration */}
                {job.scheduledDate && job.scheduledEnd && (
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="clock-outline" size={16} color={BODY_TEXT} />
                        <Text style={styles.infoText}>
                            {formatDuration(job.scheduledDate, job.scheduledEnd)}
                        </Text>
                    </View>
                )}
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
        borderRadius: 16,
        marginHorizontal: 16,
        marginVertical: 6,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    topBar: {
        height: 4,
        backgroundColor: DARK_GREEN,
    },
    takenCard: {
        opacity: 0.7,
    },
    takenContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    takenText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#F44336',
        fontWeight: '500',
    },

    // Header
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    bellContainer: {
        marginRight: 10,
    },
    serviceTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: '#1a1a1a',
        lineHeight: 22,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    price: {
        fontSize: 18,
        fontWeight: '700',
        color: DARK_GREEN,
    },

    // Accordion
    accordionBody: {
        marginHorizontal: 16,
        marginLeft: 50, // aligned under the title
        marginRight: 80,
        marginTop: 4,
        marginBottom: 4,
    },
    accordionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    accordionItemTitle: {
        fontSize: 15,
        color: BODY_TEXT,
    },
    accordionItemQty: {
        fontSize: 15,
        color: BODY_TEXT,
        fontWeight: '500',
    },
    accordionDivider: {
        height: 1,
        backgroundColor: DIVIDER_COLOR,
    },

    // Info Section
    infoSection: {
        paddingHorizontal: 16,
        paddingTop: 8,
        gap: 10,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    infoText: {
        fontSize: 14,
        color: BODY_TEXT,
        flex: 1,
    },

    // Buttons
    buttonRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 16,
        gap: 12,
    },
    ignoreButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#D0D0D0',
        alignItems: 'center',
    },
    ignoreText: {
        fontSize: 15,
        color: BODY_TEXT,
        fontWeight: '600',
    },
    acceptButton: {
        flex: 1.2,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: DARK_GREEN,
        alignItems: 'center',
    },
    acceptText: {
        fontSize: 15,
        color: '#fff',
        fontWeight: '700',
    },
    disabledButton: {
        backgroundColor: '#93C5A8',
    },
});

export default JobAlertCard;
