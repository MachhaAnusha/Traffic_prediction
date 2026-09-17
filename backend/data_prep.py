import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

# Define road segments (Hyderabad area)
road_segments = [
    {
        "segment_id": "SEG001",
        "road_name": "Hitech City Road",
        "latitude": 17.4483,
        "longitude": 78.3762,
        "baseline_speed": 45,
        "baseline_volume": 800
    },
    {
        "segment_id": "SEG002",
        "road_name": "Banjara Hills Road",
        "latitude": 17.4156,
        "longitude": 78.4347,
        "baseline_speed": 55,
        "baseline_volume": 600
    },
    {
        "segment_id": "SEG003",
        "road_name": "Madhapur Main Road",
        "latitude": 17.4325,
        "longitude": 78.4080,
        "baseline_speed": 40,
        "baseline_volume": 700
    },
    {
        "segment_id": "SEG004",
        "road_name": "Jubilee Hills Road",
        "latitude": 17.4250,
        "longitude": 78.4150,
        "baseline_speed": 50,
        "baseline_volume": 900
    },
    {
        "segment_id": "SEG005",
        "road_name": "Gachibowli Road",
        "latitude": 17.4400,
        "longitude": 78.3500,
        "baseline_speed": 35,
        "baseline_volume": 1000
    },
    {
        "segment_id": "SEG006",
        "road_name": "Begumpet Road",
        "latitude": 17.4350,
        "longitude": 78.4650,
        "baseline_speed": 60,
        "baseline_volume": 500
    },
    {
        "segment_id": "SEG007",
        "road_name": "Ameerpet Road",
        "latitude": 17.4380,
        "longitude": 78.4480,
        "baseline_speed": 45,
        "baseline_volume": 650
    },
    {
        "segment_id": "SEG008",
        "road_name": "Kukatpally Road",
        "latitude": 17.4850,
        "longitude": 78.3900,
        "baseline_speed": 40,
        "baseline_volume": 850
    }
]

# Weather conditions
weather_conditions = ["Clear", "Cloudy", "Rain", "Heavy Rain", "Snow"]

# Generate data for 6 months
start_date = datetime(2026, 3, 1)
end_date = datetime(2026, 8, 31, 23, 59, 59)

all_data = []

for segment in road_segments:
    current_date = start_date
    while current_date <= end_date:
        for hour in range(24):
            timestamp = current_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            
            # Time-based patterns
            is_weekend = timestamp.weekday() >= 5
            is_morning_rush = 7 <= hour < 10
            is_evening_rush = 17 <= hour < 20
            
            # Base speed and volume adjustments
            speed_factor = 1.0
            volume_factor = 1.0
            
            # Rush hour effects
            if is_morning_rush and not is_weekend:
                speed_factor *= 0.6
                volume_factor *= 1.8
            elif is_evening_rush and not is_weekend:
                speed_factor *= 0.5
                volume_factor *= 2.0
            
            # Weekend patterns
            if is_weekend:
                speed_factor *= 1.1
                volume_factor *= 0.7
            
            # Night time (11 PM - 5 AM)
            if hour >= 23 or hour < 5:
                speed_factor *= 1.3
                volume_factor *= 0.3
            
            # Generate weather
            weather_roll = random.random()
            if weather_roll < 0.5:
                weather = "Clear"
            elif weather_roll < 0.7:
                weather = "Cloudy"
            elif weather_roll < 0.85:
                weather = "Rain"
            elif weather_roll < 0.92:
                weather = "Heavy Rain"
            else:
                weather = "Snow"
            
            # Weather effects
            if weather == "Rain":
                speed_factor *= 0.85
                volume_factor *= 1.1
            elif weather == "Heavy Rain":
                speed_factor *= 0.6
                volume_factor *= 1.3
            elif weather == "Snow":
                speed_factor *= 0.5
                volume_factor *= 0.8
            
            # Add random variation
            speed_factor *= np.random.normal(1.0, 0.1)
            volume_factor *= np.random.normal(1.0, 0.15)
            
            # Calculate final values
            speed = max(5, segment["baseline_speed"] * speed_factor)
            volume = max(50, segment["baseline_volume"] * volume_factor)
            
            # Special events (holidays, concerts, accidents)
            is_holiday_or_event = False
            event_roll = random.random()
            
            # Simulate some special events
            if event_roll < 0.01:  # 1% chance of special event
                is_holiday_or_event = True
                speed *= 0.4
                volume *= 1.5
            
            all_data.append({
                "timestamp": timestamp,
                "road_segment_id": segment["segment_id"],
                "road_name": segment["road_name"],
                "latitude": segment["latitude"],
                "longitude": segment["longitude"],
                "speed": round(speed, 2),
                "volume": round(volume, 2),
                "weather_condition": weather,
                "is_holiday_or_event": is_holiday_or_event
            })
        
        current_date += timedelta(days=1)

# Create DataFrame
df = pd.DataFrame(all_data)

# Sort by timestamp and segment
df = df.sort_values(["road_segment_id", "timestamp"]).reset_index(drop=True)

# Save to CSV
df.to_csv("backend/data/traffic_history.csv", index=False)

print(f"Generated {len(df)} traffic records")
print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
print(f"Road segments: {df['road_segment_id'].nunique()}")
print("\nSample data:")
print(df.head(10))
