import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';
const CLIENT_ID_KEY = 'gravitycloud-client-id';

function getClientId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  let clientId = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = window.crypto?.randomUUID?.() ?? `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(CLIENT_ID_KEY, clientId);
  }

  return clientId;
}

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    config.headers = config.headers ?? {};
    config.headers['X-GravityCloud-Client-Id'] = getClientId();
  }
  return config;
});

/* ── Health / DB ── */
export const getHealth = () => api.get('/');
export const getDbStatus = () => api.get('/db-status');
export const clearDb = () => api.post('/clear-db');
export const getNodes = () => api.get('/nodes');
export const getServicesStatus = () => api.get('/services-status');
export const getAutoscalingStatus = () => api.get('/autoscaling-status');

/* ── Chat ── */
export const askQuestion = (prompt) =>
  api.post('/ask', prompt, {
    headers: { 'Content-Type': 'text/plain' },
  });

/* ── Documents ── */
export const uploadFile = (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload-file', formData, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
};

export default api;
