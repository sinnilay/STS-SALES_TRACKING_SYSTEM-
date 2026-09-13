import * as signalR from '@microsoft/signalr';
import api from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7202/api';
// The hub lives at the server root, not under /api.
const HUB_URL = `${API_BASE_URL.replace(/\/api\/?$/, '')}/hubs/gps`;

export const gpsService = {
  getEmployees: async () => {
    const response = await api.get('/Admin/gps/employees');
    return response.data;
  },
};

let connection = null;
let connectPromise = null;
let stopTimer = null;

// A single shared SignalR connection per tab — both the admin's live map and an
// employee's location broadcaster reuse it instead of opening their own sockets.
export const getGpsConnection = () => {
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => localStorage.getItem('token') || '',
      // Auth is JWT-based, not cookies — and the API's CORS policy allows any
      // origin, which browsers refuse to combine with credentialed requests.
      withCredentials: false,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  return connection;
};

export const startGpsConnection = async () => {
  // Cancel any teardown a just-unmounted consumer scheduled — e.g. React StrictMode's
  // mount/cleanup/remount dance, or navigating away and back — so this call reuses the
  // still-live connection instead of racing a `.stop()` that would kill it right after
  // handlers get attached.
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }

  const conn = getGpsConnection();
  if (conn.state === signalR.HubConnectionState.Connected) return conn;
  if (!connectPromise) {
    connectPromise = conn.start().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  await connectPromise;
  return conn;
};

export const stopGpsConnection = () => {
  if (stopTimer) clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    stopTimer = null;
    if (connection) {
      connection.stop().catch(() => {});
      connection = null;
      connectPromise = null;
    }
  }, 1000);
};
