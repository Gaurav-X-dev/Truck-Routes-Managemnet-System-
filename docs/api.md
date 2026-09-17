# API Documentation

The backend exposes a RESTful API using FastAPI.
Interactive Swagger documentation is available at `/docs` when running the application.

## Endpoints (Foundation)
- `POST /api/v1/auth/login`: Authenticate and receive JWT.
- `GET /api/v1/users/me`: Get current authenticated user profile.
- `GET /api/v1/users/`: List users.

## Authentication
All protected endpoints require an Authorization header with a Bearer token.
