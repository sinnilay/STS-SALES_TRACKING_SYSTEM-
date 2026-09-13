import { useEffect, useRef } from 'react';
import { startGpsConnection, stopGpsConnection } from '../services/gpsService';

const SEND_INTERVAL_MS = 30000;

// Mounted (invisible) inside the Sales layout while the GPS Tracking module is enabled.
// Keeps one lightweight SignalR connection open and pushes at most one location ping
// every 30s — cheap enough for a small VPS regardless of how often the GPS fix updates.
const GpsBroadcaster = () => {
  const lastCoordsRef = useRef(null);

  useEffect(() => {
    let watchId;
    let intervalId;

    const send = async () => {
      try {
        const conn = await startGpsConnection();
        const coords = lastCoordsRef.current;
        if (coords) {
          await conn.invoke('UpdateLocation', coords.lat, coords.lng);
        } else {
          await conn.invoke('Heartbeat');
        }
      } catch {
        // Silently retry on the next tick — SignalR's auto-reconnect handles transient drops.
      }
    };

    startGpsConnection().catch(() => {});

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          lastCoordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        },
        () => {
          // Permission denied or unavailable — heartbeats still keep the online badge accurate.
        },
        { enableHighAccuracy: false, maximumAge: 20000, timeout: 20000 }
      );
    }

    intervalId = setInterval(send, SEND_INTERVAL_MS);
    send();

    return () => {
      clearInterval(intervalId);
      if (watchId !== undefined && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      stopGpsConnection();
    };
  }, []);

  return null;
};

export default GpsBroadcaster;
