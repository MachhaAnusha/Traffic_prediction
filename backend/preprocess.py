import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder

# Load the raw data
df = pd.read_csv("backend/data/traffic_history.csv")
df["timestamp"] = pd.to_datetime(df["timestamp"])

# Sort by segment and timestamp
df = df.sort_values(["road_segment_id", "timestamp"]).reset_index(drop=True)

print("Original data shape:", df.shape)

# Create time features
df["hour"] = df["timestamp"].dt.hour
df["day_of_week"] = df["timestamp"].dt.dayofweek  # 0=Monday, 6=Sunday
df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
df["month"] = df["timestamp"].dt.month

# Create lag features (per segment)
df["speed_lag_1"] = df.groupby("road_segment_id")["speed"].shift(1)
df["volume_lag_1"] = df.groupby("road_segment_id")["volume"].shift(1)

# Create rolling features (3-hour window, per segment)
df["speed_rolling_mean"] = df.groupby("road_segment_id")["speed"].transform(
    lambda x: x.rolling(window=3, min_periods=1).mean()
)
df["volume_rolling_mean"] = df.groupby("road_segment_id")["volume"].transform(
    lambda x: x.rolling(window=3, min_periods=1).mean()
)

# Encode weather condition
weather_encoder = LabelEncoder()
df["weather_encoded"] = weather_encoder.fit_transform(df["weather_condition"])

# Encode road segment
segment_encoder = LabelEncoder()
df["segment_encoded"] = segment_encoder.fit_transform(df["road_segment_id"])

# Fill NaN values from lag features (first row of each segment)
df["speed_lag_1"] = df["speed_lag_1"].fillna(df["speed"])
df["volume_lag_1"] = df["volume_lag_1"].fillna(df["volume"])

# Congestion classification based on speed and volume
def classify_congestion(row):
    speed = row["speed"]
    volume = row["volume"]
    
    # Classify based on speed and volume thresholds
    if speed >= 50 and volume < 600:
        return "Free Flow"
    elif speed >= 40 and volume < 900:
        return "Moderate"
    elif speed >= 25 and volume < 1200:
        return "Heavy"
    else:
        return "Severe"

df["congestion_level"] = df.apply(classify_congestion, axis=1)

# Encode congestion level for model training
congestion_encoder = LabelEncoder()
df["congestion_encoded"] = congestion_encoder.fit_transform(df["congestion_level"])

# Save encoders for later use
import joblib
joblib.dump(weather_encoder, "backend/models/weather_encoder.joblib")
joblib.dump(segment_encoder, "backend/models/segment_encoder.joblib")
joblib.dump(congestion_encoder, "backend/models/congestion_encoder.joblib")

# Save processed data
df.to_csv("backend/data/traffic_processed.csv", index=False)

print("Processed data shape:", df.shape)
print("\nCongestion level distribution:")
print(df["congestion_level"].value_counts())
print("\nSample processed data:")
print(df[["timestamp", "road_segment_id", "speed", "volume", "congestion_level", 
          "hour", "day_of_week", "is_weekend"]].head(10))
