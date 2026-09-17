import math

from app.schemas.route import RouteStopCreate


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in kilometers between two points on the earth."""
    R = 6371.0 # Radius of earth in kilometers
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

class RoutePlanningService:
    """
    Service responsible for route planning.
    Currently implements a deterministic nearest-neighbor fallback using coordinates.
    Architected to be replaced by a real mapping provider (OSRM/Google Maps) in production.
    """
    
    @staticmethod
    def plan_route(stops: list[RouteStopCreate], start_lat: float, start_lon: float) -> list[RouteStopCreate]:
        """
        Sorts the stops using nearest neighbor algorithm starting from a given coordinate.
        Returns the optimized list of stops.
        """
        if not stops:
            return []
            
        unvisited = list(stops)
        optimized_route = []
        
        current_lat, current_lon = start_lat, start_lon
        
        while unvisited:
            # Find the closest unvisited stop
            closest_stop = min(
                unvisited, 
                key=lambda stop: haversine_distance(current_lat, current_lon, stop.latitude, stop.longitude)
            )
            
            optimized_route.append(closest_stop)
            unvisited.remove(closest_stop)
            
            # Update current location
            current_lat, current_lon = closest_stop.latitude, closest_stop.longitude
            
        # Re-assign stop numbers based on optimized order
        for idx, stop in enumerate(optimized_route):
            stop.stop_number = idx + 1
            
        return optimized_route
