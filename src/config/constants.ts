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


export const WEBRTC_CONFIG = {
    iceServers: [
        // Primary Fallback: Google's free STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },

        // Metered STUN
        {
            urls: 'stun:stun.relay.metered.ca:80',
        },
        // Metered TURN Servers (For Symmetric NAT traversal)
        {
            urls: 'turn:in.relay.metered.ca:80',
            username: 'f27bc21350803d756c169b95',    
            credential: 'VJyJWq1KLfONxuYg',
        },
        {
            urls: 'turn:in.relay.metered.ca:80?transport=tcp',
            username: 'f27bc21350803d756c169b95',
            credential: 'VJyJWq1KLfONxuYg',
        },
        {
            urls: 'turn:in.relay.metered.ca:443',
            username: 'f27bc21350803d756c169b95',
            credential: 'VJyJWq1KLfONxuYg',
        },
        {
            urls: 'turns:in.relay.metered.ca:443?transport=tcp',
            username: 'f27bc21350803d756c169b95',
            credential: 'VJyJWq1KLfONxuYg',
        },
    ],
};