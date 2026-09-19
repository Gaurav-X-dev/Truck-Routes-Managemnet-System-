// Centralized Configuration

// Fallback to empty string if not deployed so it uses current origin
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// API base path (assuming Vite proxy takes care of /api in dev, we just use /api/v1)
export const API_URL = '/api/v1';

// Socket base path
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
