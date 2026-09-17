import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import Trucks from './pages/Trucks';
import Shops from './pages/Shops';
import MapTracking from './pages/MapTracking';
import RoutePlanner from './pages/RoutePlanner';
import TripHistory from './pages/TripHistory';
import Login from './pages/Login';
import DriverPortal from './pages/DriverPortal';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        
        {/* Driver Portal Route (No Dashboard Layout) */}
        <Route path="/driver/:truckId" element={<DriverPortal />} />

        {/* Dashboard Routes */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="trucks" element={<Trucks />} />
          <Route path="shops" element={<Shops />} />
          <Route path="map" element={<MapTracking />} />
          <Route path="planner/:truckId" element={<RoutePlanner />} />
          <Route path="history/:truckId" element={<TripHistory />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
