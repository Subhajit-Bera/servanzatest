import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Alert } from 'react-native';
import { Button, Surface, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMessaging, onMessage, onNotificationOpenedApp, getInitialNotification } from '@react-native-firebase/messaging';
import { useSocket } from '../../context/SocketContext';
import { COLORS } from '../../config/theme';

interface JobRequest {
  bookingId: string;
  assignmentId: string;
  serviceTitle: string;
  address: string;
  distance: string | number;
  price?: string | number;
  isImmediate?: boolean;
}

export const JobRequestManager = () => {
  const { socket } = useSocket();
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);

  // --- 1. Notification Listeners (FCM) ---
  useEffect(() => {
    // Foreground Handler
    const unsubscribe = onMessage(getMessaging(), async remoteMessage => {
      console.log('[JobRequestManager] FCM Message received:', remoteMessage.data?.type);
      // Workers service sends type: 'buddy-assignment'
      if (remoteMessage.data?.type === 'buddy-assignment') {
        const newReq: JobRequest = {
          bookingId: remoteMessage.data.bookingId as string,
          assignmentId: remoteMessage.data.assignmentId as string || remoteMessage.data.bookingId as string,
          serviceTitle: remoteMessage.data.serviceTitle as string,
          address: remoteMessage.data.address as string,
          distance: remoteMessage.data.distance as string || '0',
          price: remoteMessage.data.price as string,
          isImmediate: remoteMessage.data.isImmediate === 'true',
        };
        addRequest(newReq);
      }
    });

    // Background/Quit Open Handler
    onNotificationOpenedApp(getMessaging(), remoteMessage => {
      console.log('[JobRequestManager] FCM Notification opened:', remoteMessage.data?.type);
      if (remoteMessage.data?.type === 'buddy-assignment') {
        const newReq: JobRequest = {
          bookingId: remoteMessage.data.bookingId as string,
          assignmentId: remoteMessage.data.assignmentId as string || remoteMessage.data.bookingId as string,
          serviceTitle: remoteMessage.data.serviceTitle as string,
          address: remoteMessage.data.address as string,
          distance: remoteMessage.data.distance as string || '0',
          price: remoteMessage.data.price as string,
          isImmediate: remoteMessage.data.isImmediate === 'true',
        };
        addRequest(newReq);
      }
    });

    // Check Initial Notification
    getInitialNotification(getMessaging()).then(remoteMessage => {
      if (remoteMessage?.data?.type === 'buddy-assignment') {
        const newReq: JobRequest = {
          bookingId: remoteMessage.data.bookingId as string,
          assignmentId: remoteMessage.data.assignmentId as string || remoteMessage.data.bookingId as string,
          serviceTitle: remoteMessage.data.serviceTitle as string,
          address: remoteMessage.data.address as string,
          distance: remoteMessage.data.distance as string || '0',
          price: remoteMessage.data.price as string,
          isImmediate: remoteMessage.data.isImmediate === 'true',
        };
        addRequest(newReq);
      }
    });

    return unsubscribe;
  }, []);

  // --- 2. Socket Listeners (Real-time Race Logic) ---
  useEffect(() => {
    if (!socket) return;

    // A. I Won the job
    const onAcceptSuccess = (data: any) => {
      setIsAccepting(false);
      // Clear all requests as we are now busy with a job
      setJobRequests([]);
      Alert.alert("Success!", "You have been assigned the job. Check My Jobs.");
    };

    // B. I Lost the job (Another buddy took it)
    const onJobTaken = (data: { bookingId: string, message?: string }) => {
      setJobRequests(prev => {
        const index = prev.findIndex(req => req.bookingId === data.bookingId);
        // If the job currently on screen was taken
        if (index === 0) {
          Alert.alert("Missed", data.message || "Job taken by another buddy.");
        }
        return prev.filter(req => req.bookingId !== data.bookingId);
      });
      setIsAccepting(false);
    };

    // C. Errors (e.g., Too late, Rate limited)
    const onError = (err: any) => {
      setIsAccepting(false);
      if (err.code === 'JOB_TAKEN') {
        Alert.alert("Too Late", err.message);
        // Remove the top request as it failed
        setJobRequests(prev => prev.slice(1));
      } else if (err.type === 'RATE_LIMITED') {
        // Rate limited - don't show error, just reset state
        // User can try again after a moment
        console.warn('[Jobs] Rate limited on job:accept');
      }
    };

    socket.on('job:accept:success', onAcceptSuccess);
    socket.on('job:taken', onJobTaken);
    socket.on('error', onError);

    return () => {
      socket.off('job:accept:success', onAcceptSuccess);
      socket.off('job:taken', onJobTaken);
      socket.off('error', onError);
    };
  }, [socket]);

  // Helper to avoid duplicates
  const addRequest = (req: JobRequest) => {
    setJobRequests(prev => {
      if (prev.find(r => r.assignmentId === req.assignmentId)) return prev;
      return [...prev, req];
    });
  };

  // --- Actions ---
  const handleAccept = () => {
    const current = jobRequests[0];
    if (!current) return;
    setIsAccepting(true);
    socket.emit('job:accept', { assignmentId: current.assignmentId });
  };

  const handleIgnore = () => {
    const current = jobRequests[0];
    if (!current) return;

    // LOCAL ONLY: Remove from UI without notifying backend
    // This allows the job to remain PENDING and reappear in retry cycles
    setJobRequests(prev => prev.slice(1));
  };

  // Dismiss all pending job requests locally (no backend notification)
  const handleDismissAll = () => {
    // LOCAL ONLY: Clear all requests without notifying backend
    setJobRequests([]);
  };

  if (jobRequests.length === 0) return null;

  const currentRequest = jobRequests[0];

  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={() => { }}>
      <View style={styles.overlay}>
        <Surface style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="bell-ring" size={24} color={COLORS.primary} />
              <Text style={styles.title}>New Job Request</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {jobRequests.length > 1 && (
                <>
                  <Button
                    mode="text"
                    onPress={handleDismissAll}
                    textColor={COLORS.darkGray}
                    compact
                    style={{ marginRight: 4 }}
                  >
                    Dismiss All
                  </Button>
                  <Badge size={24} style={{ backgroundColor: COLORS.accent }}>
                    {`+${jobRequests.length - 1}`}
                  </Badge>
                </>
              )}
            </View>
          </View>
          <View style={styles.divider} />

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.service}>{currentRequest.serviceTitle}</Text>
            <View style={styles.row}>
              <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.darkGray} />
              <Text style={styles.address}>{currentRequest.address}</Text>
            </View>

            <View style={styles.metaBox}>
              <View style={styles.metaItem}>
                <Text style={styles.label}>Distance</Text>
                <Text style={styles.value}>{currentRequest.distance} km</Text>
              </View>
              {currentRequest.price && (
                <View style={styles.metaItem}>
                  <Text style={styles.label}>Est. Earnings</Text>
                  <Text style={[styles.value, { color: COLORS.accent }]}>₹{currentRequest.price}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={handleIgnore}
              textColor={COLORS.error}
              style={{ flex: 1, marginRight: 8, borderColor: COLORS.error }}
            >
              Ignore
            </Button>
            <Button
              mode="contained"
              onPress={handleAccept}
              loading={isAccepting}
              disabled={isAccepting}
              style={{ flex: 1, marginLeft: 8, backgroundColor: COLORS.primary }}
            >
              Accept
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', backgroundColor: 'white', borderRadius: 20, padding: 20, elevation: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary, marginLeft: 10 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  body: { marginBottom: 20 },
  service: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  row: { flexDirection: 'row', marginBottom: 15 },
  address: { marginLeft: 8, color: '#666', flex: 1 },
  metaBox: { flexDirection: 'row', backgroundColor: '#f8f9fa', padding: 15, borderRadius: 12 },
  metaItem: { flex: 1, alignItems: 'center' },
  label: { fontSize: 12, color: '#888' },
  value: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' }
});