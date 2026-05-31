import { useState, useCallback } from 'react';
import { callApi } from '../api/client';
import { IncomingCallData } from '../context/ChatContext';

export const usePendingCall = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPendingCall = useCallback(async (callId: string): Promise<IncomingCallData | null> => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await callApi.getPendingCall(callId);
            if (response.data.success && response.data.data) {
                const data = response.data.data;
                // Normalize to IncomingCallData
                return {
                    callId: data.callId,
                    bookingId: data.bookingId,
                    caller: data.caller || {
                        id: data.callerId,
                        name: 'Caller',
                    },
                    offer: data.offer,
                    iceServers: data.iceServers,
                };
            }
            return null;
        } catch (err: any) {
            console.error('Error fetching pending call:', err);
            setError(err.message || 'Failed to fetch pending call');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        fetchPendingCall,
        isLoading,
        error,
    };
};
