# Architecture Overview

The Truck Route Management System is built using a clean architecture pattern with a decoupled frontend and backend.

## Backend (Python / FastAPI)
- **API Layer**: Handles HTTP requests and responses. Routes are versioned under `/api/v1/`.
- **Services Layer**: Contains the core business logic (e.g., Auth, Trucks, Routing).
- **Data Access Layer**: SQLAlchemy ORM models mapped to PostgreSQL with PostGIS for spatial data.
- **Integrations**: Abstracts external services like OSRM (routing) and Nominatim (geocoding).

## Frontend (React / Vite)
- Built with React, TypeScript, and Vite.
- Uses TanStack Query for data fetching.
- Uses Leaflet and React-Leaflet for mapping components, isolating the map rendering logic.

## Security
- JWT for authentication.
- Role-based access control (Super Admin, Admin, Driver, Loading Staff).
- Passwords hashed with bcrypt.
