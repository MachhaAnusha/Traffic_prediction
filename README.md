# TrafficAI — AI-Powered Traffic Congestion Prediction

A full-stack web application that predicts future traffic congestion using machine learning. Built for hackathon demonstration with a polished dashboard interface.

## Project Overview

TrafficAI uses historical traffic patterns, time features, weather conditions, and road segment characteristics to predict traffic congestion levels. The system employs a Random Forest Classifier trained on synthetic but realistic traffic data to provide predictions with confidence scores.

## Features

- **Real-time Traffic Prediction**: Select any road segment and future date/time to get congestion predictions
- **Confidence Scoring**: Model confidence percentages based on probability distributions
- **Historical Analytics**: View historical traffic trends with interactive charts
- **Peak Hour Detection**: Automatically calculated morning and evening peak hours per segment
- **Congestion Heatmap**: Visual representation of congestion patterns across days and hours
- **Interactive Map**: Leaflet-based map showing all road segments
- **Analytics Dashboard**: Overview statistics across the entire road network

## Architecture

```
Frontend (React + Vite + Tailwind CSS)
       |
       | REST API
       ↓
Backend (FastAPI + Python)
       |
       ├── Data Processing (pandas)
       ├── Feature Engineering (lag, rolling, time features)
       ├── ML Model (RandomForestClassifier)
       ├── Prediction Engine
       └── Peak-Time Analysis
              |
              ↓
       Historical Dataset (CSV)
```

## Dataset

**Important**: The current traffic dataset is **synthetic** and generated for demonstration purposes. It contains:

- **8 road segments** with realistic names and coordinates
- **6 months of hourly data** (March - August 2026)
- **35,328 traffic records**
- Features include:
  - Timestamp
  - Road segment ID and name
  - Latitude/longitude
  - Traffic speed (km/h)
  - Traffic volume (vehicles/hour)
  - Weather conditions (Clear, Cloudy, Rain, Heavy Rain, Snow)
  - Holiday/event flags

The synthetic data includes realistic patterns:
- Morning rush hour (7-10 AM)
- Evening rush hour (5-8 PM)
- Weekend vs weekday differences
- Weather impacts
- Special events (concerts, accidents)

## Congestion Classification

Traffic is classified into four categories based on speed and volume thresholds:

| Level | Speed (km/h) | Volume (veh/hr) | Color |
|-------|--------------|-----------------|-------|
| Free Flow | ≥ 50 | < 600 | Green |
| Moderate | ≥ 40 | < 900 | Yellow |
| Heavy | ≥ 25 | < 1200 | Orange |
| Severe | < 25 | ≥ 1200 | Red |

## ML Model

### Random Forest Classifier

The model uses a Random Forest Classifier with the following configuration:
- **n_estimators**: 100
- **max_depth**: 15
- **min_samples_split**: 10
- **min_samples_leaf**: 5
- **random_state**: 42

### Feature Engineering

The model is trained on 12 engineered features:

1. **Time Features**
   - Hour of day (0-23)
   - Day of week (0-6)
   - Is weekend (binary)
   - Month (1-12)

2. **Traffic Features**
   - Current speed
   - Current volume
   - Speed lag (previous hour)
   - Volume lag (previous hour)
   - Speed rolling mean (3-hour window)
   - Volume rolling mean (3-hour window)

3. **Context Features**
   - Weather condition (encoded)
   - Road segment (encoded)

### Model Performance

On the synthetic test set (20% split):
- **Accuracy**: 99.99%
- **Precision**: 1.00 (all classes)
- **Recall**: 1.00 (all classes)

**Note**: High accuracy is expected on synthetic data. Real-world performance would vary.

### Feature Importance

1. Speed (49.3%)
2. Volume (25.9%)
3. Speed rolling mean (7.7%)
4. Volume rolling mean (5.5%)
5. Weather (3.6%)
6. Volume lag (2.6%)
7. Hour (2.1%)
8. Speed lag (1.4%)
9. Segment (1.3%)
10. Day of week (0.3%)
11. Is weekend (0.2%)
12. Month (0.1%)

## Prediction Confidence

The model uses `predict_proba()` to generate probability distributions across all four congestion classes. The confidence score displayed is the maximum probability from this distribution, representing the model's certainty in its prediction.

**Example**: If the model predicts "Heavy" with probabilities [Free Flow: 3%, Moderate: 12%, Heavy: 82%, Severe: 3%], the confidence is 82%.

## Peak-Time Detection

Peak hours are calculated from historical data by:
1. Mapping congestion levels to numeric scores (Free Flow=1, Moderate=2, Heavy=3, Severe=4)
2. Calculating average congestion score per hour
3. Identifying hours with highest scores in morning (6-12) and evening (16-22) periods

Results are segment-specific, reflecting actual patterns in the data.

## Installation

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

### Start Backend

```bash
cd backend
py main.py
```

Or using uvicorn directly:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Data Preparation (First Time Only)

If the data files don't exist, run:

```bash
# Generate synthetic data
py backend/data_prep.py

# Preprocess and engineer features
py backend/preprocess.py

# Train the model
py backend/model.py
```

## API Endpoints

### GET `/api/segments`
Returns all available road segments.

**Response**:
```json
[
  {
    "segment_id": "SEG001",
    "road_name": "Downtown Main Road",
    "latitude": 40.7128,
    "longitude": -74.0060
  }
]
```

### GET `/api/history/{segment_id}?limit=168`
Returns historical traffic data for a segment (default: last 168 hours = 7 days).

**Response**:
```json
[
  {
    "timestamp": "2026-08-31T23:00:00",
    "speed": 45.2,
    "volume": 850.5,
    "congestion_level": "Moderate",
    "weather_condition": "Clear"
  }
]
```

### GET `/api/peaks/{segment_id}`
Returns calculated peak hours for a segment.

**Response**:
```json
{
  "morning_peak": "7:00 AM – 10:00 AM",
  "evening_peak": "5:00 PM – 8:00 PM"
}
```

### POST `/api/predict`
Predicts traffic congestion for a future timestamp.

**Request**:
```json
{
  "segment_id": "SEG001",
  "future_timestamp": "2026-09-18T18:30:00"
}
```

**Response**:
```json
{
  "segment_id": "SEG001",
  "timestamp": "2026-09-18T18:30:00",
  "congestion_level": "Heavy",
  "confidence": 0.82,
  "probabilities": {
    "Free Flow": 0.03,
    "Moderate": 0.12,
    "Heavy": 0.82,
    "Severe": 0.03
  },
  "expected_speed": 32.5,
  "expected_volume": 1420.0,
  "peak_period": "Evening Rush"
}
```

### GET `/api/overview`
Returns overall statistics across all segments.

**Response**:
```json
{
  "total_records": 35328,
  "total_segments": 8,
  "average_speed": 45.32,
  "average_volume": 785.6,
  "most_congested_hour": "18:00"
}
```

## Limitations

1. **Synthetic Data**: The current dataset is generated for demonstration. Real-world deployment requires integration with actual traffic APIs.

2. **Simplified Features**: The model uses basic features. Advanced deployments could include:
   - Real-time weather API integration
   - Accident/incident feeds
   - Event calendar integration
   - GPS trajectory data
   - Social media sentiment

3. **No Persistence**: The system doesn't use a database. All data is stored in CSV files.

4. **Single-Region**: All segments are in one geographic area (NYC coordinates).

5. **Time-Aware Split**: The model uses a simple time-based train/test split. Production systems would use more sophisticated time-series cross-validation.

## Future Improvements

- **Real Data Integration**: Connect to traffic APIs like Google Maps, TomTom, or city DOT feeds
- **Weather API**: Integrate real-time weather data from OpenWeatherMap or similar
- **Accident Feeds**: Pull real-time accident reports from emergency services
- **Event Feeds**: Integrate with event calendars (concerts, sports, conferences)
- **Advanced Models**: Implement LSTM, Prophet, or Transformer-based time-series models
- **Database**: Add PostgreSQL or MongoDB for persistent storage
- **Authentication**: Add user accounts and saved preferences
- **Mobile App**: Build React Native or Flutter mobile application
- **Real-time Updates**: WebSocket integration for live traffic updates
- **Geographic Expansion**: Support multiple cities and regions
- **Route Optimization**: Add route planning based on predictions

## Tech Stack

### Backend
- Python 3.8+
- FastAPI
- pandas
- NumPy
- scikit-learn
- joblib

### Frontend
- React 18
- Vite
- Tailwind CSS
- Recharts
- Leaflet
- React-Leaflet

## License

This project is built for hackathon demonstration purposes.

## Acknowledgments

Built for traffic congestion prediction hackathon. Uses synthetic data for demonstration.
