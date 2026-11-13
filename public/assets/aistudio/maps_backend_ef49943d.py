from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

app = FastAPI(title="Flood Forecasting Spatial API")

# Enable CORS so your frontend frontend can communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock database simulating sensor stations and dynamic forecast water level adjustments
# Timeline represents: hours ahead -> predicted water height increase (in meters)
RIVER_GAUGE_FORECASTS = {
    "station_01": {
        "name": "Surma River - Sylhet Bridge Point",
        "base_level_meters": 8.5,
        "timeline": {
            "0": 0.0,    # Current: No additional rise
            "6": 0.4,    # +6 Hours: Water rises 0.4m
            "12": 0.9,   # +12 Hours: Water rises 0.9m
            "24": 1.6,   # +24 Hours: Water rises 1.6m (Heavy Flooding Triggered)
        }
    }
}

# Base Topography & Infrastructure Layer (Simulating a database spatial query)
# In production, this would be fetched from a PostGIS database using GeoAlchemy2/Shapely
def get_base_spatial_features() -> Dict[str, Any]:
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Zone A - Low-lying Settlement", "elevation_meters": 8.8, "type": "residential"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[91.86, 24.89], [91.87, 24.89], [91.87, 24.88], [91.86, 24.88], [91.86, 24.89]]]
                }
            },
            {
                "type": "Feature",
                "properties": {"name": "Zone B - Market Area", "elevation_meters": 9.5, "type": "commercial"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[91.87, 24.90], [91.88, 24.90], [91.88, 24.89], [91.87, 24.89], [91.87, 24.90]]]
                }
            },
            {
                "type": "Feature",
                "properties": {"name": "Primary School Shelter", "elevation_meters": 11.2, "type": "shelter"},
                "geometry": {
                    "type": "Point",
                    "coordinates": [91.865, 24.895]
                }
            }
        ]
    }

@app.get("/api/v1/sensor-forecast")
def get_sensor_data():
    """Returns real-time and predicted river elevations."""
    return RIVER_GAUGE_FORECASTS

@app.get("/api/v1/flood-risk-map")
def get_flood_risk_map(hours_ahead: str = "0"):
    """
    Dynamically maps flood hazard by comparing forecasted river water level 
    against static land surface elevation.
    """
    # 1. Fetch current forecast parameter
    gauge = RIVER_GAUGE_FORECASTS["station_01"]
    water_rise = gauge["timeline"].get(hours_ahead, 0.0)
    total_water_level = gauge["base_level_meters"] + water_rise
    
    # 2. Pull base terrain layers
    spatial_data = get_base_spatial_features()
    
    # 3. Dynamic Multi-Criteria Evaluation Loop
    for feature in spatial_data["features"]:
        props = feature["properties"]
        
        # Safe spaces stay green
        if props["type"] == "shelter":
            props["risk_level"] = "Safe"
            props["description"] = f"Designated Shelter (Elevation: {props['elevation_meters']}m)"
            continue
            
        # Calculate water depth relative to ground level
        land_height = props["elevation_meters"]
        water_depth = total_water_level - land_height
        
        # Risk Classification Logic Matrix
        if water_depth <= 0:
            props["risk_level"] = "Low"
            props["description"] = "Dry / Negligible Risk"
        elif 0 < water_depth <= 0.5:
            props["risk_level"] = "Medium"
            props["description"] = f"Waterlogging warning. Predicted Depth: {water_depth:.2f}m"
        else:
            props["risk_level"] = "High"
            props["description"] = f"CRITICAL FLOODING. Evacuate immediately. Predicted Depth: {water_depth:.2f}m"
            
    return spatial_data

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
