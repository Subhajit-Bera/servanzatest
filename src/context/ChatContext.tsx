import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { WEBRTC_CONFIG } from '../config/constants';
import InCallManager from 'react-native-incall-manager';

export interface ChatMessage {
    id: string;
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
    offer: RTCSessionDescriptionInit;
    iceServers: RTCIceServer[];
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
    const { user } = useSelector((state: RootState) => state.auth);
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

    // --- WebRTC Refs ---
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const callIdRef = useRef<string | null>(null);
    const iceServersRef = useRef<RTCIceServer[]>(WEBRTC_CONFIG.iceServers);

    // ─────────────────────────────────────────────────────────────────────────────
    // Chat Methods
    // ─────────────────────────────────────────────────────────────────────────────
    
    const setActiveChat = useCallback((bookingId: string | null) => {
        if (activeChatBookingId === bookingId) return;

        // Leave previous
        if (activeChatBookingId && socket.connected) {
            socket.emit('chat:leave', { bookingId: activeChatBookingId });
        }

        setActiveChatBookingId(bookingId);

        // Join new
        if (bookingId && socket.connected) {
            socket.emit('chat:join', { bookingId });
            // Mark as read immediately when opening
            socket.emit('chat:read', { bookingId });
        }
    }, [activeChatBookingId, socket]);

    const sendMessage = useCallback((bookingId: string, content: string) => {
        if (!socket.connected || !content.trim()) return;
        socket.emit('chat:send', { bookingId, content: content.trim(), type: 'TEXT' });
    }, [socket]);

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
        InCallManager.stop();
        InCallManager.stopRingtone();

        setCallDuration(0);
        setIsMuted(false);
        setIsSpeaker(false);
        setActiveCallBookingId(null);
    }, []);

    const createPeerConnection = useCallback((servers?: RTCIceServer[]) => {
        const pc = new RTCPeerConnection({ iceServers: servers || iceServersRef.current });

        pc.onicecandidate = (event) => {
            if (event.candidate && callIdRef.current && socket.connected) {
                socket.emit('call:ice-candidate', {
                    callId: callIdRef.current,
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                endCall();
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    }, [socket]);

    const startDurationTimer = useCallback(() => {
        setCallDuration(0);
        durationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);

        // Start InCallManager: routes audio to earpiece, enables proximity sensor
        InCallManager.start({ media: 'audio' });
        InCallManager.setForceSpeakerphoneOn(false);
    }, []);

    const initiateCall = useCallback(async (bookingId: string) => {
        if (!socket.connected || callState !== 'idle') return;

        try {
            const { mediaDevices } = require('react-native-webrtc');
            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            const pc = createPeerConnection();
            stream.getTracks().forEach((track: MediaStreamTrack) => pc.addTrack(track, stream));

            const offer = await pc.createOffer({});
            await pc.setLocalDescription(offer);

            setCallState('calling');
            setActiveCallBookingId(bookingId);

            socket.emit('call:initiate', {
                bookingId,
                offer: pc.localDescription,
            });
        } catch (error) {
            console.error('[ChatContext] Error initiating call:', error);
            cleanupCall();
            setCallState('idle');
        }
    }, [callState, socket, createPeerConnection, cleanupCall]);

    const answerCall = useCallback(async () => {
        if (!socket.connected || !incomingCall) return;

        try {
            const { mediaDevices } = require('react-native-webrtc');
            const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            iceServersRef.current = incomingCall.iceServers;
            const pc = createPeerConnection(incomingCall.iceServers);
            
            stream.getTracks().forEach((track: MediaStreamTrack) => pc.addTrack(track, stream));

            await pc.setRemoteDescription(incomingCall.offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            setCallId(incomingCall.callId);
            callIdRef.current = incomingCall.callId;
            setActiveCallBookingId(incomingCall.bookingId);
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

    const rejectCall = useCallback(() => {
        if (incomingCall && socket.connected) {
            socket.emit('call:reject', { callId: incomingCall.callId });
        }
        InCallManager.stopRingtone();
        setIncomingCall(null);
        setCallState('idle');
    }, [incomingCall, socket]);

    const endCall = useCallback(() => {
        if (callIdRef.current && socket.connected) {
            socket.emit('call:end', { callId: callIdRef.current });
        }
        cleanupCall();
        setCallState('ended');
        setCallId(null);
        callIdRef.current = null;
        setTimeout(() => setCallState('idle'), 2000);
    }, [socket, cleanupCall]);

    const toggleMute = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                setIsMuted(!track.enabled);
            }
        }
    }, []);

    const toggleSpeaker = useCallback(() => {
        setIsSpeaker(prev => {
            const newValue = !prev;
            InCallManager.setForceSpeakerphoneOn(newValue);
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
                if (bookingMsgs.some(m => m.id === data.id)) return prev;
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
        const handleCallInitiated = (data: { callId: string; iceServers?: RTCIceServer[] }) => {
            setCallId(data.callId);
            callIdRef.current = data.callId;
            if (data.iceServers) iceServersRef.current = data.iceServers;
        };

        const handleIncomingCall = (data: IncomingCallData) => {
            setIncomingCall(data);
            setCallState('ringing');
        };

        const handleCallAnswered = async (data: { callId: string; answer: RTCSessionDescriptionInit }) => {
            const pc = peerConnectionRef.current;
            if (!pc) return;
            try {
                await pc.setRemoteDescription(data.answer);
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
                const { RTCIceCandidate } = require('react-native-webrtc');
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('[ChatContext] ICE candidate error:', error);
            }
        };

        const handleCallEndedOrRejected = () => {
            cleanupCall();
            setCallState('ended');
            setCallId(null);
            callIdRef.current = null;
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
        };
    }, [socket, activeChatBookingId, currentUserId, cleanupCall, endCall, startDurationTimer]);

    // Initial history fetch when active chat changes
    useEffect(() => {
        if (!activeChatBookingId || !user) return;

        const fetchHistory = async () => {
            try {
                const { apiClient } = require('../utils/api');
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
        }}>
            {children}
        </ChatContext.Provider>
    );
};
