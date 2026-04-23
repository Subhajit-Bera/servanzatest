import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
    const [isConnected, setIsConnected] = useState<boolean>(true);
    const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setIsConnected(!!state.isConnected);
            setIsInternetReachable(state.isInternetReachable);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Consider online if connected AND (reachable is true OR reachable is null/unknown yet)
    // We don't want to block users if reachable check is just slow/pending
    const isOnline = isConnected && (isInternetReachable !== false);

    return { isConnected, isInternetReachable, isOnline };
};
