from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import pandas as pd
import numpy as np
import joblib
from datetime import datetime
from pathlib import Path
import json
import warnings

# Ignore benign sklearn feature name warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

app = FastAPI(title="TrafficAI API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model and encoders using path relative to backend file location
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"

model = joblib.load(MODELS_DIR / "traffic_model.joblib")
weather_encoder = joblib.load(MODELS_DIR / "weather_encoder.joblib")
segment_encoder = joblib.load(MODELS_DIR / "segment_encoder.joblib")
congestion_encoder = joblib.load(MODELS_DIR / "congestion_encoder.joblib")
feature_columns = joblib.load(MODELS_DIR / "feature_columns.joblib")

# Load data
df = pd.read_csv(DATA_DIR / "traffic_processed.csv")
df["timestamp"] = pd.to_datetime(df["timestamp"])

# Define request/response models
class PredictionRequest(BaseModel):
    segment_id: str
    future_timestamp: str

class PredictionResponse(BaseModel):
    segment_id: str
    timestamp: str
    congestion_level: str
    confidence: float
    probabilities: Dict[str, float]
    expected_speed: float
    expected_volume: float
    peak_period: str

class RoadSegment(BaseModel):
    segment_id: str
    id: str
    road_name: str
    name: str
    latitude: float
    longitude: float

@app.get("/")
def root():
    return {"message": "TrafficAI API", "version": "1.0.0"}

@app.get("/api/segments")
def get_segments():
    """Get all road segments"""
    segments = df[["road_segment_id", "road_name", "latitude", "longitude"]].drop_duplicates()
    return [
        {
            "segment_id": row["road_segment_id"],
            "id": row["road_segment_id"],
            "road_name": row["road_name"],
            "name": row["road_name"],
            "latitude": row["latitude"],
            "longitude": row["longitude"]
        }
        for _, row in segments.iterrows()
    ]

@app.get("/api/history/{segment_id}")
def get_history(segment_id: str, limit: int = 168):
    """Get historical traffic data for a segment (default: last 7 days = 168 hours)"""
    segment_data = df[df["road_segment_id"] == segment_id].sort_values("timestamp", ascending=False).head(limit)
    
    return [
        {
            "timestamp": row["timestamp"].isoformat(),
            "speed": float(row["speed"]),
            "volume": float(row["volume"]),
            "congestion_level": row["congestion_level"],
            "weather_condition": row["weather_condition"]
        }
        for _, row in segment_data.iterrows()
    ]

@app.get("/api/peaks/{segment_id}")
def get_peak_hours(segment_id: str):
    """Calculate peak congestion hours from historical data"""
    segment_data = df[df["road_segment_id"] == segment_id].copy()
    
    # Calculate average congestion severity per hour
    congestion_map = {"Free Flow": 1, "Moderate": 2, "Heavy": 3, "Severe": 4}
    segment_data["congestion_score"] = segment_data["congestion_level"].map(congestion_map)
    
    # Group by hour and calculate average score
    hourly_scores = segment_data.groupby("hour")["congestion_score"].mean()
    
    # Find morning peak (6-12)
    morning_hours = hourly_scores[(hourly_scores.index >= 6) & (hourly_scores.index < 12)]
    if len(morning_hours) > 0:
        morning_peak_hour = morning_hours.idxmax()
        morning_peak_start = max(6, morning_peak_hour - 1)
        morning_peak_end = min(12, morning_peak_hour + 2)
    else:
        morning_peak_start = 7
        morning_peak_end = 10
    
    # Find evening peak (16-22)
    evening_hours = hourly_scores[(hourly_scores.index >= 16) & (hourly_scores.index < 22)]
    if len(evening_hours) > 0:
        evening_peak_hour = evening_hours.idxmax()
        evening_peak_start = max(16, evening_peak_hour - 1)
        evening_peak_end = min(22, evening_peak_hour + 2)
    else:
        evening_peak_start = 17
        evening_peak_end = 20
    
    return {
        "morning_peak": f"{morning_peak_start}:00 AM – {morning_peak_end}:00 AM" if morning_peak_end < 12 else f"{morning_peak_start}:00 AM – {morning_peak_end-12}:00 PM",
        "evening_peak": f"{evening_peak_start-12}:00 PM – {evening_peak_end-12}:00 PM"
    }

@app.post("/api/predict")
def predict(request: PredictionRequest):
    """Predict traffic congestion for a future timestamp"""
    try:
        future_time = datetime.fromisoformat(request.future_timestamp)
        
        segment_data = df[df["road_segment_id"] == request.segment_id]
        if len(segment_data) == 0:
            raise HTTPException(status_code=404, detail="Segment not found")
        
        recent_data = segment_data.sort_values("timestamp", ascending=False).head(3)
        
        hour = future_time.hour
        day_of_week = future_time.weekday()
        is_weekend = 1 if day_of_week >= 5 else 0
        month = future_time.month
        
        avg_speed = recent_data["speed"].mean()
        avg_volume = recent_data["volume"].mean()
        avg_speed_lag = recent_data["speed_lag_1"].mean()
        avg_volume_lag = recent_data["volume_lag_1"].mean()
        avg_speed_rolling = recent_data["speed_rolling_mean"].mean()
        avg_volume_rolling = recent_data["volume_rolling_mean"].mean()
        
        common_weather = recent_data["weather_condition"].mode()[0]
        weather_encoded = weather_encoder.transform([common_weather])[0]
        segment_encoded = segment_encoder.transform([request.segment_id])[0]
        
        features_df = pd.DataFrame([{
            'hour': hour,
            'day_of_week': day_of_week,
            'is_weekend': is_weekend,
            'month': month,
            'speed': avg_speed,
            'volume': avg_volume,
            'speed_lag_1': avg_speed_lag,
            'volume_lag_1': avg_volume_lag,
            'speed_rolling_mean': avg_speed_rolling,
            'volume_rolling_mean': avg_volume_rolling,
            'weather_encoded': weather_encoded,
            'segment_encoded': segment_encoded
        }])
        
        prediction_encoded = model.predict(features_df)[0]
        prediction = congestion_encoder.inverse_transform([prediction_encoded])[0]
        
        probabilities = model.predict_proba(features_df)[0]
        class_names = congestion_encoder.inverse_transform(range(len(probabilities)))
        prob_dict = {name: float(prob) for name, prob in zip(class_names, probabilities)}
        
        confidence = float(max(probabilities))
        
        if 7 <= hour < 10:
            peak_period = "Morning Rush"
        elif 17 <= hour < 20:
            peak_period = "Evening Rush"
        elif hour >= 23 or hour < 5:
            peak_period = "Night"
        else:
            peak_period = "Off-Peak"
        
        return PredictionResponse(
            segment_id=request.segment_id,
            timestamp=request.future_timestamp,
            congestion_level=prediction,
            confidence=confidence,
            probabilities=prob_dict,
            expected_speed=round(avg_speed, 2),
            expected_volume=round(avg_volume, 2),
            peak_period=peak_period
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/overview")
def get_overview():
    """Get overall statistics across all segments"""
    total_records = len(df)
    total_segments = df["road_segment_id"].nunique()
    avg_speed = df["speed"].mean()
    avg_volume = df["volume"].mean()
    
    congestion_map = {"Free Flow": 1, "Moderate": 2, "Heavy": 3, "Severe": 4}
    df["congestion_score"] = df["congestion_level"].map(congestion_map)
    most_congested_hour = df.groupby("hour")["congestion_score"].mean().idxmax()
    
    return {
        "total_records": total_records,
        "total_segments": total_segments,
        "average_speed": round(avg_speed, 2),
        "average_volume": round(avg_volume, 2),
        "most_congested_hour": f"{most_congested_hour}:00"
    }

def _build_map_response():
    """Generate structured road map data using precomputed high-precision OSRM road geometries"""
    road_network_file = DATA_DIR / "road_network.json"
    if road_network_file.exists():
        with open(road_network_file, "r", encoding="utf-8") as f:
            return json.load(f)
            
    # Fallback if json file is missing
    latest_data = df.sort_values("timestamp").groupby("road_segment_id").last().reset_index()
    segments_info = df[["road_segment_id", "road_name", "latitude", "longitude"]].drop_duplicates()
    
    result = []
    for _, seg in segments_info.iterrows():
        seg_id = seg["road_segment_id"]
        matching = latest_data[latest_data["road_segment_id"] == seg_id]
        latest = matching.iloc[0] if len(matching) > 0 else None
        
        result.append({
            "segment_id": seg_id,
            "id": seg_id,
            "road_name": seg["road_name"],
            "name": seg["road_name"],
            "latitude": float(seg["latitude"]),
            "longitude": float(seg["longitude"]),
            "congestion_level": latest["congestion_level"] if latest is not None else "Free Flow",
            "speed": round(float(latest["speed"]), 2) if latest is not None else 50.0,
            "volume": round(float(latest["volume"]), 2) if latest is not None else 300.0,
            "geometry": [[float(seg["latitude"]), float(seg["longitude"])]]
        })
    
    return result

@app.get("/api/map-data")
def get_map_data():
    """Get current congestion data for all road segments for map visualization"""
    return _build_map_response()

@app.get("/api/map")
def get_map():
    """Alias endpoint for map data"""
    return _build_map_response()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

