"""
ML Feature Engineering Pipeline for Disaster Prediction & Nowcasting

Transforms raw time-series telemetry into high-dimensional tabular features
including temporal encodings, lag indicators, rolling window statistics,
velocity/acceleration derivatives, and hazard interaction terms.

Supports two input formats:
  1. OWM/Live readings: list of dicts with per-observation meteorological values
  2. Open-Meteo daily arrays: 7-day forecast arrays from Open-Meteo APIs
     (converted via open_meteo_to_readings() before passing to raw_to_dataframe)
"""

import math
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple, Optional


class FeatureEngineer:
    """
    Constructs ML features from raw historical readings for a district.
    Expected raw records: list of dicts with:
      {'timestamp': '...', 'rainfall_mm': ..., 'temperature_c': ..., 'wind_speed_kmh': ..., 'river_level_m': ...}
    """

    def __init__(self):
        self.indicators = [
            "rainfall_mm",
            "temperature_c",
            "wind_speed_kmh",
            "river_level_m",
        ]

    def raw_to_dataframe(self, readings: List[Dict[str, Any]]) -> pd.DataFrame:
        if not readings:
            return pd.DataFrame()

        df = pd.DataFrame(readings)
        if "timestamp" in df.columns:
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.sort_values("timestamp").reset_index(drop=True)

        for col in self.indicators:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            else:
                df[col] = 0.0

        # Forward fill and backward fill any sparse readings
        df[self.indicators] = df[self.indicators].ffill().bfill().fillna(0.0)
        return df

    def extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Creates engineered features for each timestep.
        """
        if df.empty or len(df) < 3:
            return pd.DataFrame()

        feat_df = df.copy()

        # 1. Temporal encodings (cyclical sin/cos for smooth continuity)
        hours = feat_df["timestamp"].dt.hour
        feat_df["hour_sin"] = np.sin(2 * np.pi * hours / 24.0)
        feat_df["hour_cos"] = np.cos(2 * np.pi * hours / 24.0)
        feat_df["day_of_week"] = feat_df["timestamp"].dt.dayofweek
        feat_df["is_weekend"] = feat_df["day_of_week"].isin([5, 6]).astype(int)

        months = feat_df["timestamp"].dt.month
        feat_df["month_sin"] = np.sin(2 * np.pi * months / 12.0)
        feat_df["month_cos"] = np.cos(2 * np.pi * months / 12.0)
        # Indian monsoon season (June - September)
        feat_df["is_monsoon"] = months.isin([6, 7, 8, 9]).astype(int)

        # 2. Lag features (t-1, t-2, t-3, t-6)
        lags = [1, 2, 3, 6]
        for col in self.indicators:
            for lag in lags:
                feat_df[f"{col}_lag_{lag}"] = feat_df[col].shift(lag)

        # 3. Rolling window statistics (3-step and 6-step)
        for col in self.indicators:
            # Rolling 3-step statistics
            roll3 = feat_df[col].rolling(window=3, min_periods=1)
            feat_df[f"{col}_roll3_mean"] = roll3.mean()
            feat_df[f"{col}_roll3_max"] = roll3.max()
            feat_df[f"{col}_roll3_std"] = roll3.std().fillna(0.0)

            # Rolling 6-step statistics
            roll6 = feat_df[col].rolling(window=6, min_periods=1)
            feat_df[f"{col}_roll6_mean"] = roll6.mean()
            feat_df[f"{col}_roll6_max"] = roll6.max()
            feat_df[f"{col}_roll6_std"] = roll6.std().fillna(0.0)

        # 4. First and second derivatives (velocity & acceleration)
        for col in self.indicators:
            # 1st derivative (rate of change)
            feat_df[f"{col}_diff_1"] = feat_df[col].diff(1).fillna(0.0)
            feat_df[f"{col}_diff_3"] = feat_df[col].diff(3).fillna(0.0)
            # 2nd derivative (acceleration - is it intensifying?)
            feat_df[f"{col}_accel"] = feat_df[f"{col}_diff_1"].diff(1).fillna(0.0)

        # 5. Cross-indicator risk interactions
        # High heat combined with low wind (heatwave vulnerability)
        feat_df["heat_stagnation"] = feat_df["temperature_c"] / (feat_df["wind_speed_kmh"] + 1.0)
        # High rain with high wind (squall / storm hazard)
        feat_df["rain_wind_interaction"] = feat_df["rainfall_mm"] * feat_df["wind_speed_kmh"]

        # Backfill any initial NaNs caused by shifting
        feat_df = feat_df.bfill().fillna(0.0)

        return feat_df

    def create_training_pairs(
        self,
        df: pd.DataFrame,
        horizon_steps: int = 6
    ) -> Dict[str, Tuple[np.ndarray, np.ndarray]]:
        """
        Creates (X, y) arrays for each target indicator predicting `horizon_steps` ahead.
        """
        feat_df = self.extract_features(df)
        if len(feat_df) <= horizon_steps:
            return {}

        feature_cols = [
            c for c in feat_df.columns
            if c not in ["timestamp", "district"]
        ]

        pairs = {}
        for target in self.indicators:
            # Target is the value `horizon_steps` into the future
            y = feat_df[target].shift(-horizon_steps)

            # Drop the last `horizon_steps` rows where target is NaN
            valid_mask = ~y.isna()
            X_valid = feat_df.loc[valid_mask, feature_cols].to_numpy()
            y_valid = y.loc[valid_mask].to_numpy()

            pairs[target] = (X_valid, y_valid, feature_cols)

        return pairs

    def extract_latest_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, List[str]]:
        """
        Extracts feature vector for the most recent observation to make live nowcasts.
        """
        feat_df = self.extract_features(df)
        if feat_df.empty:
            return np.array([]), []

        feature_cols = [
            c for c in feat_df.columns
            if c not in ["timestamp", "district"]
        ]

        latest_vector = feat_df.iloc[-1:][feature_cols].to_numpy()
        return latest_vector, feature_cols

    # ── Open-Meteo Format Converters ─────────────────────────────────────────

    def open_meteo_to_readings(
        self,
        daily_precip: List[float],
        daily_discharge: List[float],
        daily_temp: Optional[List[float]] = None,
        daily_wind: Optional[List[float]] = None,
        district: str = "Unknown",
        discharge_scale: float = 10.0,
    ) -> List[Dict[str, Any]]:
        """
        Converts Open-Meteo daily forecast arrays into the standard readings
        format accepted by raw_to_dataframe() and create_training_pairs().

        The river_level_m is approximated by dividing GloFAS discharge (m³/s)
        by a district-specific scale factor (default 10.0) to produce a proxy
        gauge height compatible with the ML feature space.

        Args:
            daily_precip    : Daily precipitation sums in mm (Open-Meteo)
            daily_discharge : Daily GloFAS median discharge in m³/s (Open-Meteo)
            daily_temp      : Daily max temperature in °C (optional)
            daily_wind      : Daily max wind speed in km/h (optional)
            district        : District name label for the records
            discharge_scale : Divisor to convert m³/s to approximate gauge height
        Returns:
            List of reading dicts compatible with raw_to_dataframe()
        """
        n = max(len(daily_precip or []), len(daily_discharge or []))
        if n == 0:
            return []
        records = []
        now = datetime.now(timezone.utc)

        for i in range(n):
            ts = (now - timedelta(days=n - i - 1)).isoformat()
            rain = float(daily_precip[i]) if (daily_precip and i < len(daily_precip) and daily_precip[i] is not None) else 0.0
            discharge = float(daily_discharge[i]) if (daily_discharge and i < len(daily_discharge) and daily_discharge[i] is not None) else 0.0
            temp = float(daily_temp[i]) if (daily_temp and i < len(daily_temp) and daily_temp[i] is not None) else 32.0
            wind = float(daily_wind[i]) if (daily_wind and i < len(daily_wind) and daily_wind[i] is not None) else 10.0

            records.append({
                "timestamp": ts,
                "district": district,
                "rainfall_mm": max(0.0, rain),
                "temperature_c": temp,
                "wind_speed_kmh": max(0.0, wind),
                # River level proxy: GloFAS discharge scaled to approximate gauge meters
                "river_level_m": max(0.0, discharge / discharge_scale),
            })
        return records

    def open_meteo_telemetry_to_readings(
        self, telemetry: Dict[str, Any], discharge_scale: float = 10.0
    ) -> List[Dict[str, Any]]:
        """
        Convenience wrapper that extracts Open-Meteo daily arrays from a
        telemetry dict (as returned by OpenMeteoIngestor.get_district_telemetry)
        and converts them into the standard readings list for ML ingestion.

        Args:
            telemetry     : Dict returned by OpenMeteoIngestor.get_district_telemetry()
            discharge_scale: Divisor to convert m³/s to approximate gauge height
        Returns:
            List of reading dicts compatible with raw_to_dataframe()
        """
        return self.open_meteo_to_readings(
            daily_precip=telemetry.get("daily_precip_mm", []),
            daily_discharge=telemetry.get("daily_discharge_m3s", []),
            daily_temp=telemetry.get("daily_temp_max_c"),
            daily_wind=telemetry.get("daily_wind_max_kmh"),
            district=telemetry.get("district", "Unknown"),
            discharge_scale=discharge_scale,
        )
