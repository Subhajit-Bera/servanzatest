import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_JOB_STORAGE_KEY = '@servanza_active_job';

interface ActiveJobData {
    assignmentId: string;
    bookingId: string;
    startedAt: string; // ISO date string when job started
    durationMinutes: number;
    serviceName: string;
    customerName: string;
    customerPhone: string;
    address: string;
    totalAmount: number;
}

interface ActiveJobContextType {
    activeJob: ActiveJobData | null;
    elapsedSeconds: number;
    remainingSeconds: number;
    isTimerRunning: boolean;
    startJob: (data: ActiveJobData) => Promise<void>;
    clearJob: () => Promise<void>;
}

const ActiveJobContext = createContext<ActiveJobContextType>({
    activeJob: null,
    elapsedSeconds: 0,
    remainingSeconds: 0,
    isTimerRunning: false,
    startJob: async () => { },
    clearJob: async () => { },
});

export const useActiveJob = () => useContext(ActiveJobContext);

export const ActiveJobProvider = ({ children }: { children: ReactNode }) => {
    const [activeJob, setActiveJob] = useState<ActiveJobData | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Calculate remaining seconds
    const remainingSeconds = activeJob
        ? Math.max(0, (activeJob.durationMinutes * 60) - elapsedSeconds)
        : 0;

    const isTimerRunning = activeJob !== null && remainingSeconds > 0;

    // Load active job from storage on mount
    useEffect(() => {
        loadActiveJob();
    }, []);

    // Timer logic
    useEffect(() => {
        if (activeJob) {
            // Calculate elapsed time from startedAt
            const startTime = new Date(activeJob.startedAt).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - startTime) / 1000);
            setElapsedSeconds(elapsed);

            // Start timer interval
            timerRef.current = setInterval(() => {
                setElapsedSeconds((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [activeJob?.assignmentId]);

    const loadActiveJob = async () => {
        try {
            const stored = await AsyncStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored) as ActiveJobData;
                setActiveJob(data);
            }
        } catch (error) {
            console.error('[ActiveJobContext] Error loading active job:', error);
        }
    };

    const startJob = async (data: ActiveJobData) => {
        try {
            await AsyncStorage.setItem(ACTIVE_JOB_STORAGE_KEY, JSON.stringify(data));
            setActiveJob(data);
            setElapsedSeconds(0);
        } catch (error) {
            console.error('[ActiveJobContext] Error saving active job:', error);
        }
    };

    const clearJob = async () => {
        try {
            await AsyncStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
            setActiveJob(null);
            setElapsedSeconds(0);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        } catch (error) {
            console.error('[ActiveJobContext] Error clearing active job:', error);
        }
    };

    return (
        <ActiveJobContext.Provider value={{
            activeJob,
            elapsedSeconds,
            remainingSeconds,
            isTimerRunning,
            startJob,
            clearJob,
        }}>
            {children}
        </ActiveJobContext.Provider>
    );
};
