import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { timeAgo } from '../../../utils/timeAgo';

const DEFAULT_CENTER = [22.9734, 78.6569]; // India, used when nobody has a fix yet
const DEFAULT_ZOOM = 5;

// Avatar-style marker built from CSS only — no external icon images to fetch,
// which keeps the map lightweight on a small VPS and sidesteps Leaflet's classic
// bundler asset-path issue for the default marker PNGs.
const buildIcon = (fullName, isOnline) => {
  const initials = (fullName || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

  const ring = isOnline ? '#10b981' : '#94a3b8';
  const bg = isOnline ? '#059669' : '#64748b';

  return L.divIcon({
    className: '',
    html: `<div style="
        width:34px;height:34px;border-radius:9999px;background:${bg};
        border:3px solid ${ring};box-shadow:0 2px 6px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:700;font-size:11px;font-family:system-ui,sans-serif;
      ">${initials}</div>
      ${isOnline ? `<div style="
        position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:9999px;
        background:#22c55e;border:2px solid white;
      "></div>` : ''}`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
};

// Recenters/zooms the map when the caller asks to focus a specific employee.
const FlyToFocused = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 15, { duration: 0.75 });
  }, [target, map]);
  return null;
};

// Fits the viewport to all markers once, on first load.
const FitToMarkers = ({ positions }) => {
  const map = useMap();
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || positions.length === 0) return;
    didFit.current = true;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
};

const EmployeeMap = ({ employees, focusedEmployeeId }) => {
  const located = useMemo(() => employees.filter((e) => e.lastLatitude != null && e.lastLongitude != null), [employees]);
  const positions = useMemo(() => located.map((e) => [e.lastLatitude, e.lastLongitude]), [located]);
  const focused = located.find((e) => e.id === focusedEmployeeId);
  const focusTarget = focused ? [focused.lastLatitude, focused.lastLongitude] : null;

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom className="w-full h-full rounded-xl z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitToMarkers positions={positions} />
      <FlyToFocused target={focusTarget} />
      {located.map((e) => (
        <Marker key={e.id} position={[e.lastLatitude, e.lastLongitude]} icon={buildIcon(e.fullName, e.isOnline)}>
          <Popup>
            <div className="text-sm">
              <p className="font-bold text-gray-900">{e.fullName}</p>
              <p className="text-xs text-gray-500">{e.employeeRole || '—'}</p>
              <p className={`text-xs font-semibold mt-1 ${e.isOnline ? 'text-emerald-600' : 'text-gray-400'}`}>
                {e.isOnline ? 'Online now' : `Last seen ${timeAgo(e.lastSeenAt)}`}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Located {timeAgo(e.lastLocationAt)}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default EmployeeMap;
