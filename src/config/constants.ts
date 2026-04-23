/**
 * Centralized Configuration
 * 
 * UPDATE YOUR LOCAL IP HERE
 */

const LOCAL_IP = '192.168.29.95';
const PORT = '3000';

export const CONFIG = {
    // API Config
    API_BASE_URL: `http://${LOCAL_IP}:${PORT}/api/v1`,
    SOCKET_URL: `http://${LOCAL_IP}:${PORT}`,

    // External Keys
    GOOGLE_MAPS_API_KEY: 'AIzaSyCW6yH2vM0migj58Wz7CJDLw5ZDDGvIjS8',

    // App Config
    GPS_UPDATE_INTERVAL: 3000,
    JOBS_FETCH_INTERVAL: 2000,
    CACHE_TTL: 3000,
};
