import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { COLORS, SHADOWS } from '../../config/theme';

const { width } = Dimensions.get('window');

export interface JobRequestData {
    assignmentId: string;
    bookingId: string;
    serviceTitle: string;
    address: string;
    distance: string;
    price: number;
    isImmediate?: boolean;
}

interface JobRequestModalProps {
    visible: boolean;
    jobData: JobRequestData | null;
    onAccept: () => void;
    onIgnore: () => void;
    isLoading?: boolean;
    isTaken?: boolean; // If another buddy took it
}

const JobRequestModal: React.FC<JobRequestModalProps> = ({
    visible,
    jobData,
    onAccept,
    onIgnore,
    isLoading = false,
    isTaken = false,
}) => {
    if (!jobData) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerIcon}>🔔</Text>
                        <Text style={styles.headerTitle}>
                            {isTaken ? 'Job Taken' : 'New Job Request!'}
                        </Text>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Content */}
                    <View style={styles.content}>
                        {/* Service Title */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Service:</Text>
                            <Text style={styles.value}>{jobData.serviceTitle}</Text>
                        </View>

                        {/* Address */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Location:</Text>
                            <Text style={styles.value} numberOfLines={2}>
                                {jobData.address}
                            </Text>
                        </View>

                        {/* Distance */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Distance:</Text>
                            <Text style={styles.valueHighlight}>{jobData.distance} km</Text>
                        </View>

                        {/* Price */}
                        <View style={styles.row}>
                            <Text style={styles.label}>Earnings:</Text>
                            <Text style={styles.priceValue}>₹{jobData.price}</Text>
                        </View>

                        {/* Immediate Tag */}
                        {jobData.isImmediate && (
                            <View style={styles.immediateTag}>
                                <Text style={styles.immediateText}>⚡ IMMEDIATE</Text>
                            </View>
                        )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actions}>
                        {isTaken ? (
                            <TouchableOpacity
                                style={[styles.button, styles.ignoreButton]}
                                onPress={onIgnore}
                            >
                                <Text style={styles.ignoreButtonText}>Got It</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.button, styles.ignoreButton]}
                                    onPress={onIgnore}
                                    disabled={isLoading}
                                >
                                    <Text style={styles.ignoreButtonText}>Ignore</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, styles.acceptButton]}
                                    onPress={onAccept}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color={COLORS.white} size="small" />
                                    ) : (
                                        <Text style={styles.acceptButtonText}>Accept</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    {/* Job Taken Message */}
                    {isTaken && (
                        <Text style={styles.takenMessage}>
                            This job has been accepted by another buddy. You'll receive more opportunities soon!
                        </Text>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainer: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        width: width - 40,
        maxWidth: 400,
        overflow: 'hidden',
        ...SHADOWS.heavy,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        backgroundColor: COLORS.primary,
    },
    headerIcon: {
        fontSize: 28,
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.lightGray,
    },
    content: {
        padding: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    label: {
        fontSize: 15,
        color: COLORS.darkGray,
        flex: 1,
    },
    value: {
        fontSize: 15,
        color: COLORS.charcoal,
        fontWeight: '600',
        flex: 2,
        textAlign: 'right',
    },
    valueHighlight: {
        fontSize: 15,
        color: COLORS.info,
        fontWeight: '600',
        flex: 2,
        textAlign: 'right',
    },
    priceValue: {
        fontSize: 20,
        color: COLORS.primary,
        fontWeight: 'bold',
        flex: 2,
        textAlign: 'right',
    },
    immediateTag: {
        backgroundColor: COLORS.warning,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignSelf: 'center',
        marginTop: 8,
    },
    immediateText: {
        color: COLORS.white,
        fontWeight: 'bold',
        fontSize: 13,
    },
    actions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: COLORS.lightGray,
    },
    button: {
        flex: 1,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ignoreButton: {
        backgroundColor: COLORS.lightGray,
        borderBottomLeftRadius: 20,
    },
    acceptButton: {
        backgroundColor: COLORS.primary,
        borderBottomRightRadius: 20,
    },
    ignoreButtonText: {
        fontSize: 16,
        color: COLORS.darkGray,
        fontWeight: '600',
    },
    acceptButtonText: {
        fontSize: 16,
        color: COLORS.white,
        fontWeight: 'bold',
    },
    takenMessage: {
        padding: 16,
        textAlign: 'center',
        color: COLORS.darkGray,
        fontSize: 14,
        backgroundColor: COLORS.offWhite,
    },
});

export default JobRequestModal;
