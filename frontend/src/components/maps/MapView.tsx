import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
    center: [number, number];
    zoom?: number;
    markers?: Array<{ id: string | number; position: [number, number]; label: string }>;
    routes?: Array<[number, number][]>;
}

export const MapView: React.FC<MapViewProps> = ({ center, zoom = 13, markers = [], routes = [] }) => {
    return (
        <MapContainer center={center} zoom={zoom} style={{ height: '400px', width: '100%' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
            />
            {markers.map(marker => (
                <Marker key={marker.id} position={marker.position}>
                    <Popup>{marker.label}</Popup>
                </Marker>
            ))}
            {routes.map((route, idx) => (
                <Polyline key={idx} positions={route} color="blue" />
            ))}
        </MapContainer>
    );
};
