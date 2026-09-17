from fastapi import APIRouter

from app.api.v1 import auth, routes, stops, tracking, trucks, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(trucks.router)
api_router.include_router(routes.router)
api_router.include_router(stops.router)
api_router.include_router(tracking.router)

from app.api.v1 import frontend, shops
api_router.include_router(frontend.router)
api_router.include_router(shops.router, prefix="/shops", tags=["shops"])
