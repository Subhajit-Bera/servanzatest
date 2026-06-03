import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useChat } from '../context/ChatContext';
import { RTCView } from 'react-native-webrtc';

type RouteParams = {
    params: {
        bookingId: string;
        customerName: string;
        isIncoming?: boolean;
    };
};

const VoiceCallScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RouteParams, 'params'>>();
    const { bookingId, customerName, isIncoming } = route.params;

    const {
        callState,
        callDuration,
        isMuted,
        isSpeaker,
        initiateCall,
        answerCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        remoteStream,
    } = useChat();

    const hasAnsweredRef = useRef(false);

    // Initiate call on mount if it's an outgoing call
    useEffect(() => {
        if (!isIncoming && callState === 'idle') {
            initiateCall(bookingId);
        }
    }, [isIncoming, callState, bookingId, initiateCall]);

    // Answer call on mount if it's an incoming call
    useEffect(() => {
        if (isIncoming && callState === 'ringing' && !hasAnsweredRef.current) {
            hasAnsweredRef.current = true;
            answerCall();
        }
    }, [isIncoming, callState, answerCall]);

    // Handle end/disconnect
    useEffect(() => {
        if (callState === 'ended' || callState === 'idle') {
            if (!isIncoming && callState === 'ended') {
                if (navigation?.canGoBack?.()) {
                    navigation.goBack();
                }
            }
        }
    }, [callState, isIncoming, navigation]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEndCall = () => {
        endCall();
        if (navigation?.canGoBack?.()) {
            navigation.goBack();
        }
    };

    const getStatusText = () => {
        switch (callState) {
            case 'calling':
                return 'Calling...';
            case 'ringing':
                return 'Ringing...';
            case 'connected':
                return formatDuration(callDuration);
            case 'ended':
                return 'Call Ended';
            default:
                return 'Connecting...';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#1F2937', '#111827']}
                style={styles.gradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleEndCall} style={styles.backButton}>
                        <Ionicons name="chevron-down" size={32} color="white" />
                    </TouchableOpacity>
                </View>

                <View style={styles.mainContent}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>{customerName.charAt(0) || 'C'}</Text>
                    </View>
                    
                    <Text style={styles.nameText}>{customerName}</Text>
                    <Text style={styles.statusText}>{getStatusText()}</Text>

                    {remoteStream && (
                        <RTCView 
                            streamURL={remoteStream.toURL()} 
                            style={styles.hiddenRtcView} 
                        />
                    )}
                </View>

                <View style={styles.controlsContainer}>
                    <View style={styles.controlRow}>
                        <TouchableOpacity 
                            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                            onPress={toggleMute}
                        >
                            <Ionicons 
                                name={isMuted ? "mic-off" : "mic"} 
                                size={28} 
                                color={isMuted ? "#1F2937" : "white"} 
                            />
                            <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>
                                Mute
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.controlButton, isSpeaker && styles.controlButtonActive]}
                            onPress={toggleSpeaker}
                        >
                            <Ionicons 
                                name={isSpeaker ? "volume-high" : "volume-medium"} 
                                size={28} 
                                color={isSpeaker ? "#1F2937" : "white"} 
                            />
                            <Text style={[styles.controlLabel, isSpeaker && styles.controlLabelActive]}>
                                Speaker
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.endButton} onPress={handleEndCall}>
                        <Ionicons name="call" size={32} color="white" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
    },
    gradient: {
        flex: 1,
        justifyContent: 'space-between',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    mainContent: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#4B5563',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    avatarText: {
        fontSize: 50,
        color: 'white',
        fontWeight: 'bold',
    },
    nameText: {
        fontSize: 28,
        fontWeight: '600',
        color: 'white',
        marginBottom: 10,
    },
    statusText: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.7)',
    },
    controlsContainer: {
        paddingBottom: 50,
        alignItems: 'center',
    },
    controlRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 40,
        marginBottom: 50,
    },
    controlButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    controlButtonActive: {
        backgroundColor: 'white',
    },
    controlLabel: {
        color: 'white',
        marginTop: 8,
        fontSize: 12,
        position: 'absolute',
        bottom: -25,
    },
    controlLabelActive: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    endButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '135deg' }],
        elevation: 8,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    hiddenRtcView: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
    },
});

export default VoiceCallScreen;
