// Centralized Configuration

// Fallback to local 8001 if not deployed
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001';

// API base path (assuming Vite proxy takes care of /api in dev, we just use /api/v1)
export const API_URL = '/api/v1';

// Socket base path
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8001';
