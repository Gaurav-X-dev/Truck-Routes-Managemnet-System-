# Database Architecture

The system uses PostgreSQL with the PostGIS extension to handle standard relational data and spatial data.

## Key Tables (Foundation Phase)
- **roles**: Stores user roles (SUPER_ADMIN, ADMIN, DRIVER, LOADING_STAFF).
- **users**: Core user accounts for all system participants.
- **trucks**: Physical trucks with capacity limits.
- **drivers**: Drivers linked to user accounts.
- **customers**: Clients receiving deliveries.
- **locations**: Addresses with latitude, longitude, and a PostGIS `geom` column (SRID 4326) for spatial querying.
- **audit_logs**: Tracks sensitive actions in the system.

## Future Tables
- bills, bills_items, trips, route_plans, route_stops, loading_plans, deliveries, etc.

## Migrations
Database schema changes are managed via Alembic. Never modify the database directly.
