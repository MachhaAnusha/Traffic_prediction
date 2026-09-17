import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

# Load processed data
df = pd.read_csv("backend/data/traffic_processed.csv")

# Define features for the model
feature_columns = [
    "hour",
    "day_of_week",
    "is_weekend",
    "month",
    "speed",
    "volume",
    "speed_lag_1",
    "volume_lag_1",
    "speed_rolling_mean",
    "volume_rolling_mean",
    "weather_encoded",
    "segment_encoded"
]

# Prepare feature matrix and target
X = df[feature_columns]
y = df["congestion_encoded"]

# Time-aware split: use last 20% of data for testing
split_idx = int(len(df) * 0.8)
X_train = X.iloc[:split_idx]
X_test = X.iloc[split_idx:]
y_train = y.iloc[:split_idx]
y_test = y.iloc[split_idx:]

print(f"Training set size: {len(X_train)}")
print(f"Test set size: {len(X_test)}")

# Train Random Forest Classifier
print("\nTraining Random Forest Classifier...")
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=15,
    min_samples_split=10,
    min_samples_leaf=5,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

# Evaluate model
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\nModel Accuracy: {accuracy:.4f}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["Free Flow", "Moderate", "Heavy", "Severe"]))

# Feature importance
feature_importance = pd.DataFrame({
    "feature": feature_columns,
    "importance": model.feature_importances_
}).sort_values("importance", ascending=False)

print("\nFeature Importance:")
print(feature_importance)

# Save model
joblib.dump(model, "backend/models/traffic_model.joblib")
print("\nModel saved to backend/models/traffic_model.joblib")

# Save feature columns for later use
joblib.dump(feature_columns, "backend/models/feature_columns.joblib")
print("Feature columns saved to backend/models/feature_columns.joblib")
