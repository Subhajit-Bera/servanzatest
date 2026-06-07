import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
    ReactNode,
} from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useAppSelector } from '../store/hooks';
import { socket } from '../utils/socket';
import { buddyApi } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { navigate } from '../utils/navigationRef';
import JobAlertContainer from '../components/JobAlertContainer';
import { JobAlertData } from '../components/JobAlertCard';

const AUTO_DISMISS_MS = 90000; // 90 seconds

interface JobRequestContextType {
    alertCount: number;
    addJobRequest: (job: JobAlertData) => void;
    dismissAll: () => void;
}

const JobRequestContext = createContext<JobRequestContextType>({
    alertCount: 0,
    addJobRequest: () => { },
    dismissAll: () => { },
});

export const useJobRequests = () => useContext(JobRequestContext);

export const JobRequestProvider = ({ children }: { children: ReactNode }) => {
    const { isAuthenticated } = useAppSelector((state) => state.auth);

    const [jobs, setJobs] = useState<JobAlertData[]>([]);
    const [takenJobIds, setTakenJobIds] = useState<Set<string>>(new Set());
    const [loadingJobId, setLoadingJobId] = useState<string | null>(null);

    // Track job IDs to prevent duplicates
    const seenJobIds = useRef<Set<string>>(new Set());
    // Track auto-dismiss timers
    const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    // Track processed event IDs for deduplication
    const processedEventsRef = useRef<Set<string>>(new Set());
    
    const queryClient = useQueryClient();

    // Add a new job request (with deduplication)
    const addJobRequest = useCallback((job: JobAlertData) => {
        // Deduplicate by assignmentId
        if (seenJobIds.current.has(job.assignmentId)) {
            console.log('[JobRequestContext] Duplicate job ignored:', job.assignmentId);
            return;
        }

        seenJobIds.current.add(job.assignmentId);
        console.log('[JobRequestContext] Adding job:', job.assignmentId);

        setJobs((prev) => [...prev, job]);

        // Set auto-dismiss timer (90 seconds)
        const timer = setTimeout(() => {
            removeJob(job.assignmentId);
        }, AUTO_DISMISS_MS);

        dismissTimers.current.set(job.assignmentId, timer);
    }, []);

    // Remove a specific job
    const removeJob = useCallback((assignmentId: string) => {
        setJobs((prev) => prev.filter((j) => j.assignmentId !== assignmentId));
        seenJobIds.current.delete(assignmentId);

        // Clear timer if exists
        const timer = dismissTimers.current.get(assignmentId);
        if (timer) {
            clearTimeout(timer);
            dismissTimers.current.delete(assignmentId);
        }
    }, []);

    // Mark job as taken (by another buddy)
    const markJobTaken = useCallback((bookingId: string) => {
        setTakenJobIds((prev) => new Set(prev).add(bookingId));

        // Remove after short delay to show "taken" message
        setTimeout(() => {
            setJobs((prev) => prev.filter((j) => j.bookingId !== bookingId));
        }, 2000);
    }, []);

    // Dismiss all jobs
    const dismissAll = useCallback(() => {
        // Clear all timers
        dismissTimers.current.forEach((timer) => clearTimeout(timer));
        dismissTimers.current.clear();
        seenJobIds.current.clear();
        setJobs([]);
        setTakenJobIds(new Set());
    }, []);

    // Helper to check if date is today (in IST/local timezone)
    const isToday = (dateStr?: string): boolean => {
        if (!dateStr) return true; // Default to today if no date
        const scheduledDate = new Date(dateStr);
        const today = new Date();
        return (
            scheduledDate.getFullYear() === today.getFullYear() &&
            scheduledDate.getMonth() === today.getMonth() &&
            scheduledDate.getDate() === today.getDate()
        );
    };

    // Handle Accept
    const handleAccept = useCallback(async (assignmentId: string) => {
        setLoadingJobId(assignmentId);

        // Find the job to get its scheduledDate
        const job = jobs.find((j) => j.assignmentId === assignmentId);

        try {
            await buddyApi.acceptJob(assignmentId);
            removeJob(assignmentId);

            // Navigate to correct section based on scheduled date
            // Add refreshKey to force refresh even if already on Jobs screen
            const initialFilter = isToday(job?.scheduledDate) ? 'TODAY' : 'UPCOMING';
            navigate('Jobs', { initialFilter, refreshKey: Date.now() });
        } catch (error: any) {
            console.error('Accept job error:', error);

            if (error.response?.status === 409) {
                // Job already taken
                if (job) {
                    markJobTaken(job.bookingId);
                }
            }
        } finally {
            setLoadingJobId(null);
        }
    }, [jobs, removeJob, markJobTaken]);

    // Handle Ignore (just remove from screen, don't reject)
    const handleIgnore = useCallback((assignmentId: string) => {
        removeJob(assignmentId);
    }, [removeJob]);

    // Keep a ref to jobs for socket listeners to avoid stale closures without re-subscribing
    const jobsRef = useRef(jobs);
    useEffect(() => {
        jobsRef.current = jobs;
    }, [jobs]);

    // Socket Listeners
    useEffect(() => {
        if (!isAuthenticated) {
            console.log('[JobRequestContext] Not authenticated, skipping socket listeners');
            return;
        }

        console.log('[JobRequestContext] Setting up socket listeners');

        const handleJobEvent = (data: any, ack: any, handler: (d: any) => void) => {
            // Send acknowledgement immediately if requested
            if (typeof ack === 'function') {
                ack({ success: true, timestamp: Date.now() });
            }

            // Deduplicate incoming events using a recent eventId store
            if (data.eventId) {
                if (processedEventsRef.current.has(data.eventId)) {
                    console.log(`[JobRequestContext] Ignored duplicate event: ${data.eventId}`);
                    return;
                }
                processedEventsRef.current.add(data.eventId);
                // Keep set small
                if (processedEventsRef.current.size > 100) {
                    const firstItem = Array.from(processedEventsRef.current)[0];
                    processedEventsRef.current.delete(firstItem);
                }
            }

            // Invalidate React Query jobs cache
            if (queryClient) {
                queryClient.invalidateQueries({ queryKey: ['jobs'] });
            }

            handler(data);
        };

        // Listen for new job assignments (socket only - when app is open)
        const handleJobAssigned = (data: any, ack?: any) => {
            handleJobEvent(data, ack, (d) => {
                console.log('[JobRequestContext] Socket: buddy-assignment/job:assigned received', d);

                const jobData: JobAlertData = {
                    assignmentId: d.assignmentId,
                    bookingId: d.bookingId,
                    serviceTitle: d.serviceTitle || 'Service',
                    address: d.address || 'Address',
                    price: d.price || 0,
                    scheduledDate: d.scheduledStart, // Use scheduledStart from backend
                    scheduledEnd: d.scheduledEnd,
                    metadata: d.metadata,
                    isImmediate: d.isImmediate === true || d.isImmediate === 'true',
                };

                if (!d.assignedByAdmin) {
                    addJobRequest(jobData);
                } else {
                    console.log('[JobRequestContext] Job assigned by admin, skipping popup modal.');
                }
            });
        };

        // Listen for job taken by another buddy
        const handleJobTaken = (data: any, ack?: any) => {
            handleJobEvent(data, ack, (d) => {
                console.log('[JobRequestContext] Socket: job:taken received', d);
                markJobTaken(d.bookingId);
            });
        };

        // Listen for job cancelled
        const handleJobCancelled = (data: any, ack?: any) => {
            handleJobEvent(data, ack, (d) => {
                console.log('[JobRequestContext] Socket: booking-cancelled received', d);
                // Use Ref to get latest jobs without re-running effect
                const job = jobsRef.current.find((j) => j.bookingId === d.bookingId);
                if (job) {
                    removeJob(job.assignmentId);
                }
            });
        };
        
        // Listen for admin withdrawal
        const handleJobWithdrawn = (data: any, ack?: any) => {
            handleJobEvent(data, ack, (d) => {
                console.log('[JobRequestContext] Socket: job:withdrawn received', d);
                // Similar to job cancelled, remove the assignment
                const job = jobsRef.current.find((j) => j.bookingId === d.bookingId);
                if (job) {
                    removeJob(job.assignmentId);
                }
            });
        };

        socket.on('buddy-assignment', handleJobAssigned);
        socket.on('job:assigned', handleJobAssigned); // New event name
        socket.on('job:taken', handleJobTaken);
        socket.on('booking-cancelled', handleJobCancelled);
        socket.on('job:withdrawn', handleJobWithdrawn); // New event name

        // Listen for requests triggered by FCM foreground messages or pending offline messages
        const sub = DeviceEventEmitter.addListener('incoming-job-request', handleJobAssigned);

        return () => {
            socket.off('buddy-assignment', handleJobAssigned);
            socket.off('job:assigned', handleJobAssigned);
            socket.off('job:taken', handleJobTaken);
            socket.off('booking-cancelled', handleJobCancelled);
            socket.off('job:withdrawn', handleJobWithdrawn);
            sub.remove();
        };
    }, [isAuthenticated, addJobRequest, markJobTaken, removeJob, queryClient]); // Removed 'jobs' dependency

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            dismissTimers.current.forEach((timer) => clearTimeout(timer));
        };
    }, []);

    return (
        <JobRequestContext.Provider value={{ alertCount: jobs.length, addJobRequest, dismissAll }}>
            {children}
            {/* Render job alerts at top of screen */}
            <JobAlertContainer
                jobs={jobs}
                takenJobIds={takenJobIds}
                loadingJobId={loadingJobId}
                onAccept={handleAccept}
                onIgnore={handleIgnore}
                onDismissAll={dismissAll}
            />
        </JobRequestContext.Provider>
    );
};
