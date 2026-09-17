# Route Optimization Strategy

The system is designed to calculate optimized delivery sequences and road-network routing.

## Phase 1 (Foundation)
- No optimization algorithms implemented.
- The `locations` table stores `latitude`, `longitude`, and PostGIS `geom` points.
- Map UI components use Leaflet for display.

## Phase 2 (Future)
- **Geocoding**: Convert string addresses to lat/long using Nominatim (via an integration abstraction).
- **Routing**: Calculate distance and road travel time between stops using OSRM.
- **Optimization Algorithms**: Utilize TSP (Traveling Salesperson Problem) or VRP (Vehicle Routing Problem) solvers (e.g., Google OR-Tools or a custom heuristic) to determine optimal stop sequences based on:
  - Road distance
  - Travel time
  - Truck capacity
  - Delivery time windows
- **Loading Plans**: Reverse-engineer the delivery sequence into a Last-In-First-Out (LIFO) loading plan so cargo is easily accessible for the driver.
