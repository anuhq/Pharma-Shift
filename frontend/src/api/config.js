// Use Vite's /api proxy locally so requests and login cookies share an origin.
// Deployed frontends can provide a backend origin with VITE_API_BASE_URL.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
