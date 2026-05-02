/**
 * API Request Optimization Utilities
 * - Request deduplication (prevents duplicate simultaneous requests)
 * - Response caching with TTL
 * - Debouncing for frequently called endpoints
 * - Retry logic with exponential backoff for 429 errors
 */

// In-flight requests map for deduplication
const inFlightRequests = new Map<string, Promise<any>>();

// Response cache with timestamps
const responseCache = new Map<string, { data: any; timestamp: number }>();

// Default cache TTL in milliseconds
const DEFAULT_CACHE_TTL = 2000; // 2 seconds

/**
 * Generates a unique key for a request
 */
export const getRequestKey = (method: string, url: string, params?: any): string => {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramsStr}`;
};

/**
 * Checks if a cached response is still valid
 */
export const isCacheValid = (key: string, ttl: number = DEFAULT_CACHE_TTL): boolean => {
    const cached = responseCache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < ttl;
};

/**
 * Gets cached response if valid
 */
export const getCachedResponse = (key: string, ttl: number = DEFAULT_CACHE_TTL): any | null => {
    if (isCacheValid(key, ttl)) {
        return responseCache.get(key)?.data;
    }
    responseCache.delete(key);
    return null;
};

/**
 * Caches a response
 */
export const cacheResponse = (key: string, data: any): void => {
    responseCache.set(key, { data, timestamp: Date.now() });
};

/**
 * Clears specific cache entry
 */
export const clearCache = (key?: string): void => {
    if (key) {
        responseCache.delete(key);
    } else {
        responseCache.clear();
    }
};

/**
 * Deduplicates in-flight requests
 * If the same request is already in progress, returns the existing promise
 */
export const deduplicateRequest = async <T>(
    key: string,
    requestFn: () => Promise<T>
): Promise<T> => {
    // Check if request is already in flight
    const existingRequest = inFlightRequests.get(key);
    if (existingRequest) {
        console.log(`[API] Deduplicating request: ${key}`);
        return existingRequest;
    }

    // Create new request and store it
    const request = requestFn().finally(() => {
        inFlightRequests.delete(key);
    });

    inFlightRequests.set(key, request);
    return request;
};

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
        }, wait);
    };
};

/**
 * Creates a throttled function that only invokes func at most once per every limit milliseconds
 */
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let lastRun = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        const now = Date.now();

        if (now - lastRun >= limit) {
            lastRun = now;
            func(...args);
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastRun = Date.now();
                timeoutId = null;
                func(...args);
            }, limit - (now - lastRun));
        }
    };
};

/**
 * Retry with exponential backoff
 */
export const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Only retry on 429 (rate limit) or 5xx errors
            const status = error.response?.status;
            if (status !== 429 && (status < 500 || status >= 600)) {
                throw error;
            }

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`[API] Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
};

/**
 * Last fetch timestamps for rate limiting on client side
 */
const lastFetchTimestamps = new Map<string, number>();

/**
 * Checks if enough time has passed since last fetch for a given endpoint
 */
export const canFetch = (endpoint: string, minIntervalMs: number = 1000): boolean => {
    const lastFetch = lastFetchTimestamps.get(endpoint);
    if (!lastFetch) return true;
    return Date.now() - lastFetch >= minIntervalMs;
};

/**
 * Records fetch timestamp for an endpoint
 */
export const recordFetch = (endpoint: string): void => {
    lastFetchTimestamps.set(endpoint, Date.now());
};
