import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useChat } from '../context/ChatContext';

const { width } = Dimensions.get('window');

const IncomingCallOverlay = () => {
    const navigation = useNavigation<any>();
    const { incomingCall, rejectCall, callState } = useChat();
    const translateY = new Animated.Value(-200);

    useEffect(() => {
        if (incomingCall && callState === 'ringing') {
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 12,
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: -200,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [incomingCall, callState, translateY]);

    if (!incomingCall || callState !== 'ringing') return null;

    const handleAccept = () => {
        navigation.navigate('VoiceCall', {
            bookingId: incomingCall.bookingId,
            customerName: incomingCall.caller.name,
            isIncoming: true,
        });
        // We let the VoiceCall screen handle the actual answering
    };

    const handleReject = () => {
        rejectCall();
    };

    return (
        <Modal transparent visible={!!incomingCall} animationType="none">
            <View style={styles.container}>
                <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>
                    <View style={styles.callerInfo}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {incomingCall.caller.name.charAt(0) || 'C'}
                            </Text>
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={styles.title}>Incoming Call</Text>
                            <Text style={styles.name}>{incomingCall.caller.name}</Text>
                        </View>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity 
                            style={[styles.button, styles.rejectButton]} 
                            onPress={handleReject}
                        >
                            <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.button, styles.acceptButton]} 
                            onPress={handleAccept}
                        >
                            <Ionicons name="call" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingTop: 60,
        alignItems: 'center',
    },
    card: {
        width: width * 0.9,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    callerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#4B5563',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    avatarText: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 2,
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    actions: {
        flexDirection: 'row',
        gap: 15,
    },
    button: {
        width: 46,
        height: 46,
        borderRadius: 23,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    rejectButton: {
        backgroundColor: '#EF4444',
    },
    acceptButton: {
        backgroundColor: '#10B981',
    },
});

export default IncomingCallOverlay;
