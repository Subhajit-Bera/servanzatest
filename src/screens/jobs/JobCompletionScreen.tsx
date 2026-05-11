import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buddyApi } from '../../api/client';
import { COLORS } from '../../config/theme';
import { useActiveJob } from '../../context/ActiveJobContext';
import { getDisplayTitle } from '../../utils/bookingHelpers';

type CompletionStep = 'payment' | 'otp' | 'success';

export default function JobCompletionScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { clearJob } = useActiveJob();

    const { assignmentId, jobData } = route.params || {};

    const [step, setStep] = useState<CompletionStep>('payment');
    const [loading, setLoading] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);

    // Service info from jobData
    const serviceName = getDisplayTitle(jobData?.booking) || jobData?.serviceName || 'Service';
    // Amount to collect from customer = actual booking total
    const amountToCollect = jobData?.booking?.totalAmount || jobData?.totalAmount || 0;
    // Buddy earnings = employee payout (their cut)
    const buddyEarnings = jobData?.booking?.employeePayout || jobData?.employeePayout || amountToCollect;
    const customerName = jobData?.booking?.user?.name || jobData?.customerName || 'Customer';

    const handlePaymentAccepted = async () => {
        setLoading(true);
        try {
            // Send OTP to user
            await buddyApi.sendCompletionOTP(assignmentId);
            setOtpSent(true);
            setStep('otp');
            Alert.alert(
                'OTP Sent',
                `A verification code has been sent to ${customerName}. Please ask them for the code.`
            );
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (otp.length < 4) {
            Alert.alert('Invalid OTP', 'Please enter the complete verification code');
            return;
        }

        setLoading(true);
        try {
            // Verify OTP and complete job
            await buddyApi.verifyCompletionOTP(assignmentId, otp);

            // Clear the active job from context
            await clearJob();

            setStep('success');
        } catch (error: any) {
            Alert.alert('Invalid OTP', error.response?.data?.message || 'The verification code is incorrect. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setLoading(true);
        try {
            await buddyApi.sendCompletionOTP(assignmentId);
            Alert.alert('OTP Resent', 'A new verification code has been sent to the customer.');
            setOtp('');
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleDone = () => {
        // Reset navigation state to clear the Home stack (removes JobCompletion, JobInProgress, etc.)
        // This prevents stale job screens from appearing when clicking Home tab
        navigation.reset({
            index: 0,
            routes: [
                {
                    name: 'Jobs',
                    params: { initialFilter: 'TODAY', refreshKey: Date.now() }
                }
            ],
        });
    };

    // Payment Accepted Step
    const renderPaymentStep = () => (
        <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="currency-inr" size={48} color="#4CAF50" />
            </View>

            <Text style={styles.title}>Collect Payment</Text>
            <Text style={styles.subtitle}>
                Service completed! Please collect the payment from the customer.
            </Text>

            <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>Amount to Collect</Text>
                <Text style={styles.amountValue}>₹{amountToCollect}</Text>
                <Text style={styles.amountService}>{serviceName}</Text>
            </View>

            <Text style={styles.instruction}>
                Once you've received the payment, tap the button below to send a verification code to the customer.
            </Text>

            <TouchableOpacity
                style={styles.primaryButton}
                onPress={handlePaymentAccepted}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <MaterialCommunityIcons name="check-circle" size={24} color="#fff" />
                        <Text style={styles.primaryButtonText}>Payment Received</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );

    // OTP Verification Step
    const renderOTPStep = () => (
        <KeyboardAvoidingView
            style={styles.stepContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="shield-check" size={48} color="#2196F3" />
            </View>

            <Text style={styles.title}>Verify Completion</Text>
            <Text style={styles.subtitle}>
                Ask {customerName} for the verification code sent to their phone.
            </Text>

            <View style={styles.otpContainer}>
                <TextInput
                    style={styles.otpInput}
                    value={otp}
                    onChangeText={setOtp}
                    placeholder="Enter OTP"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                />
            </View>

            <TouchableOpacity
                style={styles.resendButton}
                onPress={handleResendOTP}
                disabled={loading}
            >
                <Text style={styles.resendText}>
                    Didn't receive code? <Text style={styles.resendLink}>Resend OTP</Text>
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.primaryButton, styles.verifyButton]}
                onPress={handleVerifyOTP}
                disabled={loading || otp.length < 4}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <MaterialCommunityIcons name="check-decagram" size={24} color="#fff" />
                        <Text style={styles.primaryButtonText}>Verify & Complete</Text>
                    </>
                )}
            </TouchableOpacity>
        </KeyboardAvoidingView>
    );

    // Success Step
    const renderSuccessStep = () => (
        <View style={styles.stepContainer}>
            <View style={[styles.iconCircle, styles.successCircle]}>
                <MaterialCommunityIcons name="check-bold" size={56} color="#fff" />
            </View>

            <Text style={styles.successTitle}>Job Completed!</Text>
            <Text style={styles.successSubtitle}>
                Great work! The job has been marked as completed successfully.
            </Text>

            <View style={styles.earningsCard}>
                <Text style={styles.earningsLabel}>You Earned</Text>
                <Text style={styles.earningsValue}>₹{buddyEarnings}</Text>
            </View>

            <TouchableOpacity
                style={[styles.primaryButton, styles.doneButton]}
                onPress={handleDone}
            >
                <MaterialCommunityIcons name="home" size={24} color="#fff" />
                <Text style={styles.primaryButtonText}>Back to Jobs</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            {step !== 'success' && (
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => step === 'otp' ? setStep('payment') : navigation.goBack()}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.charcoal} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {step === 'payment' ? 'Collect Payment' : 'Verify OTP'}
                    </Text>
                    <View style={styles.headerSpacer} />
                </View>
            )}

            {/* Step Indicator */}
            {step !== 'success' && (
                <View style={styles.stepIndicator}>
                    <View style={[styles.stepDot, step === 'payment' && styles.activeStepDot]} />
                    <View style={styles.stepLine} />
                    <View style={[styles.stepDot, step === 'otp' && styles.activeStepDot]} />
                </View>
            )}

            {/* Content */}
            {step === 'payment' && renderPaymentStep()}
            {step === 'otp' && renderOTPStep()}
            {step === 'success' && renderSuccessStep()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },

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
    backButton: { padding: 8 },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.charcoal,
        textAlign: 'center',
    },
    headerSpacer: { width: 40 },

    // Step Indicator
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        backgroundColor: '#fff',
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#e0e0e0',
    },
    activeStepDot: {
        backgroundColor: COLORS.primary,
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    stepLine: {
        width: 60,
        height: 2,
        backgroundColor: '#e0e0e0',
        marginHorizontal: 8,
    },

    // Step Container
    stepContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.charcoal,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: COLORS.mediumGray,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 24,
        lineHeight: 22,
    },

    // Amount Card
    amountCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    amountLabel: {
        fontSize: 13,
        color: COLORS.mediumGray,
    },
    amountValue: {
        fontSize: 42,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginVertical: 8,
    },
    amountService: {
        fontSize: 14,
        color: COLORS.darkGray,
    },

    instruction: {
        fontSize: 13,
        color: COLORS.mediumGray,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },

    // OTP Input
    otpContainer: {
        width: '100%',
        marginBottom: 16,
    },
    otpInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: 8,
        borderWidth: 2,
        borderColor: '#2196F3',
    },
    resendButton: {
        marginBottom: 24,
    },
    resendText: {
        fontSize: 14,
        color: COLORS.mediumGray,
    },
    resendLink: {
        color: '#2196F3',
        fontWeight: '600',
    },

    // Success
    successCircle: {
        backgroundColor: '#4CAF50',
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 12,
    },
    successSubtitle: {
        fontSize: 15,
        color: COLORS.mediumGray,
        textAlign: 'center',
        marginBottom: 32,
    },
    earningsCard: {
        backgroundColor: '#E8F5E9',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        marginBottom: 32,
    },
    earningsLabel: {
        fontSize: 14,
        color: '#388E3C',
    },
    earningsValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#388E3C',
        marginTop: 8,
    },

    // Buttons
    primaryButton: {
        flexDirection: 'row',
        backgroundColor: '#4CAF50',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    verifyButton: {
        backgroundColor: '#2196F3',
        shadowColor: '#2196F3',
    },
    doneButton: {
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary,
    },
});
