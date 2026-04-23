import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetwork';
import { COLORS } from '../config/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const NetworkBanner = () => {
    const { isOnline } = useNetworkStatus();
    const insets = useSafeAreaInsets();
    const [heightAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        if (!isOnline) {
            // Show Banner
            Animated.timing(heightAnim, {
                toValue: 40 + insets.top, // Adjust height based on safe area
                duration: 300,
                useNativeDriver: false,
            }).start();
        } else {
            // Hide Banner
            Animated.timing(heightAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }
    }, [isOnline, insets.top]);

    if (isOnline) return null;

    return (
        <Animated.View style={[styles.container, { height: heightAnim, paddingTop: insets.top }]}>
            <View style={styles.content}>
                <MaterialCommunityIcons name="wifi-off" size={16} color="white" />
                <Text style={styles.text}>No Internet Connection</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.error,
        width: '100%',
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
        zIndex: 9999, // Ensure it sits on top of everything
        elevation: 10,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 4,
        gap: 8,
    },
    text: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
