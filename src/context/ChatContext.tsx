import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAppSelector } from '../store/hooks';
import { WEBRTC_CONFIG } from '../config/constants';
import { Alert, ToastAndroid, Platform } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import apiClient, { callApi } from '../api/client';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, MediaStream } from 'react-native-webrtc';
import { PermissionsAndroid } from 'react-native';

const generateCallId = () =>
    'call_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);

export interface ChatMessage {
    id: string;
    clientMessageId?: string;
    bookingId: string;
    senderId: string;
    sender: {
        id: string;
        name: string;
        profileImage?: string;
        role: string;
    };
    content: string;
    type: 'TEXT' | 'IMAGE' | 'SYSTEM';
    isRead: boolean;
    createdAt: string;
}

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface IncomingCallData {
    callId: string;
    bookingId: string;
    caller: {
        id: string;
        name: string;
        profileImage?: string;
    };
    offer?: RTCSessionDescriptionInit;
    iceServers?: RTCIceServer[];
}

interface ChatContextType {
    // Chat state & functions
    messages: Record<string, ChatMessage[]>; // bookingId -> messages
    activeChatBookingId: string | null;
    isTyping: boolean;
    typingUser: string | null;
    setActiveChat: (bookingId: string | null) => void;
    sendMessage: (bookingId: string, content: string) => void;
    sendTyping: (bookingId: string, isTyping: boolean) => void;
    markAsRead: (bookingId: string) => void;
    
    // Call state & functions
    callState: CallState;
    callId: string | null;
    activeCallBookingId: string | null;
    incomingCall: IncomingCallData | null;
    callDuration: number;
    isMuted: boolean;
    isSpeaker: boolean;
    initiateCall: (bookingId: string) => Promise<void>;
    answerCall: () => Promise<void>;
    rejectCall: () => void;
    endCall: () => void;
    toggleMute: () => void;
    toggleSpeaker: () => void;
    remoteStream: MediaStream | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const { socket } = useSocket();
    const { user } = useAppSelector((state) => state.auth);
    const currentUserId = user?.id || '';

    // --- Chat State ---
    const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
    const [activeChatBookingId, setActiveChatBookingId] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUser, setTypingUser] = useState<string | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // --- Call State ---
    const [callState, setCallState] = useState<CallState>('idle');
    const [callId, setCallId] = useState<string | null>(null);
    const [activeCallBookingId, setActiveCallBookingId] = useState<string | null>(null);
    const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(false);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    // --- WebRTC Refs ---
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const callIdRef = useRef<string | null>(null);
    const clientCallIdRef = useRef<string | null>(null);
    const iceServersRef = useRef<RTCIceServer[]>(WEBRTC_CONFIG.iceServers);
    const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
    const remoteStreamRef = useRef<MediaStream | null>(null);

    // ─────────────────────────────────────────────────────────────────────────────
    // Chat Methods
    // ─────────────────────────────────────────────────────────────────────────────
    
    const setActiveChat = useCallback((bookingId: string | null) => {
        if (activeChatBookingId === bookingId) return;

        // Leave previous
        if (activeChatBookingId && socket?.connected) {
            socket.emit('chat:leave', { bookingId: activeChatBookingId });
        }

        setActiveChatBookingId(bookingId);

        // Join new
        if (bookingId && socket?.connected) {
            socket.emit('chat:join', { bookingId });
            // Mark as read immediately when opening
            socket.emit('chat:read', { bookingId });
        }
    }, [activeChatBookingId, socket]);

    // Ensure we join the room if socket connects *after* the screen mounts
    useEffect(() => {
        if (activeChatBookingId && socket?.connected) {
            socket.emit('chat:join', { bookingId: activeChatBookingId });
            socket.emit('chat:read', { bookingId: activeChatBookingId });
        }
    }, [activeChatBookingId, socket?.connected]);

    const sendMessage = useCallback((bookingId: string, content: string) => {
        if (!socket.connected || !content.trim()) return;

        const clientMessageId = Date.now().toString() + Math.random().toString(36).substring(7);

        const tempMessage: ChatMessage = {
            id: clientMessageId, // temporary ID
            clientMessageId,
            bookingId,
            senderId: currentUserId,
            sender: { id: currentUserId, name: user?.name || '', role: user?.role || '' },
            content: content.trim(),
            type: 'TEXT',
            isRead: false,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => {
            const bookingMsgs = prev[bookingId] || [];
            return { ...prev, [bookingId]: [...bookingMsgs, tempMessage] };
        });

        socket.emit('chat:send', { bookingId, content: content.trim(), type: 'TEXT', clientMessageId });
    }, [socket, currentUserId, user]);

    const sendTyping = useCallback((bookingId: string, isTypingStatus: boolean) => {
        if (!socket.connected) return;
        socket.emit('chat:typing', { bookingId, isTyping: isTypingStatus });
    }, [socket]);

    const markAsRead = useCallback((bookingId: string) => {
        if (!socket.connected) return;
        socket.emit('chat:read', { bookingId });
    }, [socket]);

    // ─────────────────────────────────────────────────────────────────────────────
    // Call Methods
    // ─────────────────────────────────────────────────────────────────────────────

    const cleanupCall = useCallback(() => {
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Stop InCallManager audio session and ringtone
        InCallManager?.stop();
        InCallManager?.stopRingtone();

        setCallDuration(0);
        setIsMuted(false);
        setIsSpeaker(false);
        setActiveCallBookingId(null);
        pendingIceCandidatesRef.current = [];
        setRemoteStream(null);
    }, []);

    const createPeerConnection = useCallback((servers?: RTCIceServer[]) => {
        const pc = new RTCPeerConnection({ iceServers: servers || iceServersRef.current });

        (pc as any).addEventListener('icecandidate', (event: any) => {
            if (event.candidate) {
                if ((callIdRef.current || clientCallIdRef.current) && socket.connected) {
                    socket.emit('call:ice-candidate', {
                        callId: callIdRef.current,
                        clientCallId: clientCallIdRef.current,
                        candidate: event.candidate.toJSON(),
                    });
                } else {
                    pendingIceCandidatesRef.current.push(event.candidate.toJSON());
                }
            }
        });

        (pc as any).addEventListener('track', (event: any) => {
            if (event.streams && event.streams[0]) {
                setRemoteStream(event.streams[0]);
            }
        });

        (pc as any).addEventListener('connectionstatechange', () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                endCall();
            }
        });

        peerConnectionRef.current = pc;
        return pc;
    }, [socket]);

    const startDurationTimer = useCallback(() => {
        setCallDuration(0);
        durationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);

        // Start InCallManager: routes audio to earpiece, enables proximity sensor
        InCallManager?.start({ media: 'audio' });
        InCallManager?.setForceSpeakerphoneOn(false);
    }, []);

    const initiateCall = useCallback(async (bookingId: string) => {
        if (!socket.connected || callState !== 'idle') return;

        if (Platform.OS === 'android') {
            try {
                const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
                if (Platform.Version >= 33) {
                    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
                }
                const granted = await PermissionsAndroid.requestMultiple(permissions);
                if (granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
                    console.error('[ChatContext] Microphone permission denied');
                    return;
                }
            } catch (err) {
                console.warn('[ChatContext] Error requesting permissions', err);
            }
        }

        try {
            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream as any;

            const pc = createPeerConnection();
            (stream as any).getTracks().forEach((track: any) => pc.addTrack(track, stream as any));

            clientCallIdRef.current = generateCallId();

            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);

            setCallState('calling');
            setActiveCallBookingId(bookingId);

            socket.emit('call:initiate', {
                bookingId,
                clientCallId: clientCallIdRef.current,
                offer: pc.localDescription,
            });

            // Process any ICE candidates buffered before clientCallId was set
            while (pendingIceCandidatesRef.current.length > 0 && socket.connected) {
                const candidate = pendingIceCandidatesRef.current.shift();
                socket.emit('call:ice-candidate', {
                    clientCallId: clientCallIdRef.current,
                    candidate,
                });
            }
        } catch (error) {
            console.error('[ChatContext] Error initiating call:', error);
            cleanupCall();
            setCallState('idle');
        }
    }, [callState, socket, createPeerConnection, cleanupCall]);

    const answerCall = useCallback(async () => {
        if (!socket.connected || !incomingCall) return;

        if (Platform.OS === 'android') {
            try {
                const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
                if (Platform.Version >= 33) {
                    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
                }
                const granted = await PermissionsAndroid.requestMultiple(permissions);
                if (granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
                    console.error('[ChatContext] Microphone permission denied');
                    return;
                }
            } catch (err) {
                console.warn('[ChatContext] Error requesting permissions', err);
            }
        }

        try {
            const response = await callApi.getPendingCall(incomingCall.callId);
            const pendingData = response.data?.data;

            if (!pendingData || !pendingData.offer) {
                throw new Error('Call offer not found or expired');
            }

            const offer = pendingData.offer;
            const iceServers = pendingData.iceServers || WEBRTC_CONFIG.iceServers;
            const callerIceCandidates = pendingData.callerIceCandidates || [];

            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream as any;

            // Set callIdRef BEFORE creating peer connection so that the
            // icecandidate handler can send candidates to the server
            // instead of buffering them (which causes silent audio).
            callIdRef.current = incomingCall.callId;
            setCallId(incomingCall.callId);
            setActiveCallBookingId(incomingCall.bookingId);

            iceServersRef.current = iceServers;
            const pc = createPeerConnection(iceServers);
            
            (stream as any).getTracks().forEach((track: any) => pc.addTrack(track, stream as any));

            await pc.setRemoteDescription(new RTCSessionDescription(offer as any));
            
            // Process queued ICE candidates (from socket listener)
            while (pendingIceCandidatesRef.current.length > 0) {
                const candidate = pendingIceCandidatesRef.current.shift();
                if (candidate) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error('[ChatContext] Error adding queued ICE candidate:', e);
                    }
                }
            }

            // Apply caller's ICE candidates fetched from the server
            // (these were sent before our socket listener was active)
            for (const candidate of callerIceCandidates) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('[ChatContext] Error adding caller ICE candidate:', e);
                }
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            setCallState('connected');
            setIncomingCall(null);
            startDurationTimer();

            socket.emit('call:answer', {
                callId: incomingCall.callId,
                answer: pc.localDescription,
            });
        } catch (error) {
            console.error('[ChatContext] Error answering call:', error);
            cleanupCall();
            setCallState('idle');
            setIncomingCall(null);
        }
    }, [socket, incomingCall, createPeerConnection, cleanupCall, startDurationTimer]);

    const rejectCall = useCallback(async () => {
        if (incomingCall) {
            try {
                await callApi.rejectCall(incomingCall.callId);
            } catch (error) {
                console.error('[ChatContext] Error rejecting call via REST:', error);
                if (socket.connected) {
                    socket.emit('call:reject', { callId: incomingCall.callId });
                }
            }
        }
        InCallManager?.stopRingtone();
        setIncomingCall(null);
        setCallState('idle');
    }, [incomingCall, socket]);

    const endCall = useCallback(async () => {
        const currentCallId = callIdRef.current;
        const currentClientCallId = clientCallIdRef.current;

        // Clean up immediately to prevent UI hang
        cleanupCall();
        setCallState('ended');
        setCallId(null);
        callIdRef.current = null;
        clientCallIdRef.current = null;
        setTimeout(() => setCallState('idle'), 2000);

        // Then notify server (fire-and-forget)
        if (currentCallId) {
            try {
                await callApi.endCall(currentCallId);
            } catch (error) {
                console.error('[ChatContext] Error ending call via REST:', error);
                if (socket.connected) {
                    socket.emit('call:end', { callId: currentCallId });
                }
            }
        } else if (currentClientCallId) {
            if (socket.connected) {
                socket.emit('call:cancel', { clientCallId: currentClientCallId });
            }
        }
    }, [socket, cleanupCall]);


    const toggleMute = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
                const newMutedState = !track.enabled;
                track.enabled = newMutedState;
                setIsMuted(!newMutedState);
                InCallManager?.setMicrophoneMute(!newMutedState);
            }
        }
    }, []);

    const toggleSpeaker = useCallback(() => {
        setIsSpeaker(prev => {
            const newValue = !prev;
            InCallManager?.setForceSpeakerphoneOn(newValue);
            return newValue;
        });
    }, []);

    // ─────────────────────────────────────────────────────────────────────────────
    // Socket Listeners Setup
    // ─────────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        // --- Chat Events ---
        const handleMessage = (data: ChatMessage) => {
            setMessages(prev => {
                const bookingMsgs = prev[data.bookingId] || [];
                
                if (data.clientMessageId) {
                    const tempIndex = bookingMsgs.findIndex(m => m.clientMessageId === data.clientMessageId);
                    if (tempIndex !== -1) {
                        const newMsgs = [...bookingMsgs];
                        newMsgs[tempIndex] = data;
                        return { ...prev, [data.bookingId]: newMsgs };
                    }
                }

                if (bookingMsgs.some(m => m.id === data.id)) return prev;
                
                // Ignore our own echoes fallback if no clientMessageId
                if (!data.clientMessageId && data.senderId === currentUserId) return prev;
                
                return { ...prev, [data.bookingId]: [...bookingMsgs, data] };
            });

            // Mark read if it's the active chat and from other person
            if (activeChatBookingId === data.bookingId && data.senderId !== currentUserId) {
                socket.emit('chat:read', { bookingId: data.bookingId });
            }
        };

        const handleNewMessage = (data: any) => {
            // Notification-only style event if we aren't in the room
            // Real message will come through handleMessage if in room
            if (activeChatBookingId !== data.bookingId) {
                if (Platform.OS === 'android') {
                    ToastAndroid.show(`New message from ${data.senderName || 'Customer'}`, ToastAndroid.SHORT);
                }
            }
        };

        const handleReadReceipt = (data: any) => {
            if (data.readBy !== currentUserId) {
                setMessages(prev => {
                    const bookingMsgs = prev[data.bookingId] || [];
                    const updatedMsgs = bookingMsgs.map(m => 
                        (m.senderId === currentUserId && !m.isRead) ? { ...m, isRead: true } : m
                    );
                    return { ...prev, [data.bookingId]: updatedMsgs };
                });
            }
        };

        const handleTyping = (data: any) => {
            if (activeChatBookingId === data.bookingId && data.userId !== currentUserId) {
                setIsTyping(data.isTyping);
                setTypingUser(data.isTyping ? data.userId : null);

                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                if (data.isTyping) {
                    typingTimeoutRef.current = setTimeout(() => {
                        setIsTyping(false);
                        setTypingUser(null);
                    }, 3000);
                }
            }
        };

        // --- Call Events ---
        const handleCallInitiated = (data: { callId: string; clientCallId?: string; iceServers?: RTCIceServer[] }) => {
            setCallId(data.callId);
            callIdRef.current = data.callId;
            if (data.clientCallId) {
                clientCallIdRef.current = data.clientCallId;
            }
            if (data.iceServers) iceServersRef.current = data.iceServers;
            
            while (pendingIceCandidatesRef.current.length > 0 && socket.connected) {
                const candidate = pendingIceCandidatesRef.current.shift();
                socket.emit('call:ice-candidate', {
                    callId: data.callId,
                    candidate,
                });
            }
        };

        const handleIncomingCall = (data: IncomingCallData) => {
            setIncomingCall(data);
            setCallState('ringing');
        };

        const handleCallAnswered = async (data: { callId: string; answer: any }) => {
            const pc = peerConnectionRef.current;
            if (!pc) return;
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                
                while (pendingIceCandidatesRef.current.length > 0) {
                    const candidate = pendingIceCandidatesRef.current.shift();
                    if (candidate) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.error('[ChatContext] Error adding queued ICE candidate:', e);
                        }
                    }
                }

                setCallState('connected');
                startDurationTimer();
            } catch (error) {
                console.error('[ChatContext] Remote description error:', error);
                endCall();
            }
        };

        const handleIceCandidate = async (data: { callId: string; candidate: RTCIceCandidateInit }) => {
            const pc = peerConnectionRef.current;
            if (!pc) return;
            try {
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } else {
                    pendingIceCandidatesRef.current.push(data.candidate);
                }
            } catch (error) {
                console.error('[ChatContext] ICE candidate error:', error);
            }
        };

        const handleCallEndedOrRejected = () => {
            cleanupCall();
            setCallState('ended');
            setCallId(null);
            callIdRef.current = null;
            clientCallIdRef.current = null;
            setIncomingCall(null);
            setTimeout(() => setCallState('idle'), 2000);
        };

        // Register
        socket.on('chat:message', handleMessage);
        socket.on('chat:new-message', handleNewMessage);
        socket.on('chat:read-receipt', handleReadReceipt);
        socket.on('chat:typing', handleTyping);
        
        socket.on('call:initiated', handleCallInitiated);
        socket.on('call:incoming', handleIncomingCall);
        socket.on('call:answered', handleCallAnswered);
        socket.on('call:ice-candidate', handleIceCandidate);
        socket.on('call:rejected', handleCallEndedOrRejected);
        socket.on('call:ended', handleCallEndedOrRejected);
        socket.on('call:missed', handleCallEndedOrRejected);
        socket.on('call:cancelled', handleCallEndedOrRejected);

        return () => {
            socket.off('chat:message', handleMessage);
            socket.off('chat:new-message', handleNewMessage);
            socket.off('chat:read-receipt', handleReadReceipt);
            socket.off('chat:typing', handleTyping);

            socket.off('call:initiated', handleCallInitiated);
            socket.off('call:incoming', handleIncomingCall);
            socket.off('call:answered', handleCallAnswered);
            socket.off('call:ice-candidate', handleIceCandidate);
            socket.off('call:rejected', handleCallEndedOrRejected);
            socket.off('call:ended', handleCallEndedOrRejected);
            socket.off('call:missed', handleCallEndedOrRejected);
            socket.off('call:cancelled', handleCallEndedOrRejected);
        };
    }, [socket, activeChatBookingId, currentUserId, cleanupCall, endCall, startDurationTimer]);

    // Initial history fetch when active chat changes
    useEffect(() => {
        if (!activeChatBookingId || !user) return;

        const fetchHistory = async () => {
            try {
                const response = await apiClient.get(`/bookings/${activeChatBookingId}/messages`);
                const history = response.data?.data?.messages || [];
                setMessages(prev => ({
                    ...prev,
                    [activeChatBookingId]: history
                }));
            } catch (error) {
                console.error('[ChatContext] Error fetching history:', error);
            }
        };

        // Only fetch if we don't have it yet
        if (!messages[activeChatBookingId]) {
            fetchHistory();
        }
    }, [activeChatBookingId, user, messages]);

    return (
        <ChatContext.Provider value={{
            messages,
            activeChatBookingId,
            isTyping,
            typingUser,
            setActiveChat,
            sendMessage,
            sendTyping,
            markAsRead,

            callState,
            callId,
            activeCallBookingId,
            incomingCall,
            callDuration,
            isMuted,
            isSpeaker,
            initiateCall,
            answerCall,
            rejectCall,
            endCall,
            toggleMute,
            toggleSpeaker,
            remoteStream,
        }}>
            {children}
        </ChatContext.Provider>
    );
};
