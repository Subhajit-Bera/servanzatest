import * as React from 'react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, NativeModules } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../config/theme';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleRestart = () => {
        // In development, we can reload. In prod, we just reset the boundary
        // or asking user to restart. 
        if (__DEV__ && NativeModules.DevSettings) {
            NativeModules.DevSettings.reload();
        } else {
            // Fallback: try to reset state to recover if it was transient
            this.setState({ hasError: false, error: null });
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <ScrollView contentContainerStyle={styles.content}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={80} color={COLORS.error} />

                        <Text style={styles.title}>Oops! Something went wrong.</Text>

                        <Text style={styles.subtitle}>
                            We encountered an unexpected error. The app needs to restart to recover.
                        </Text>

                        {this.state.error && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>
                                    {this.state.error.toString()}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.button}
                            onPress={this.handleRestart}
                        >
                            <Text style={styles.buttonText}>Restart App</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.charcoal,
        marginTop: 20,
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.mediumGray,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    errorBox: {
        backgroundColor: '#FFF5F5',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FED7D7',
        width: '100%',
        marginBottom: 30,
    },
    errorText: {
        color: '#C53030',
        fontSize: 12,
        fontFamily: 'monospace',
    },
    button: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
