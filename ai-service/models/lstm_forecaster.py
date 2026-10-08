"""
PyTorch LSTM Sequence Forecaster (Secondary ML Model)

Captures non-linear temporal trends, cyclic oscillations, and cumulative
meteorological dynamics (e.g., rainfall saturation, persistent heat index).
Runs efficiently on CPU with a lightweight 2-layer architecture.
"""

import os
import glob
import numpy as np
import torch
import torch.nn as nn
from typing import Dict, Any, Optional, List, Tuple
from .feature_engineer import FeatureEngineer

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "trained_models")


class DisasterLSTMNet(nn.Module):
    def __init__(self, input_size: int = 4, hidden_size: int = 32, num_layers: int = 2, output_steps: int = 6):
        super().__init__()
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.output_steps = output_steps

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.1 if num_layers > 1 else 0.0,
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Linear(32, output_steps * input_size),
        )

    def forward(self, x):
        # x: (batch_size, seq_len, input_size)
        out, (hn, cn) = self.lstm(x)
        # Use last hidden state
        last_hidden = out[:, -1, :]
        preds = self.fc(last_hidden)
        # Reshape to (batch_size, output_steps, input_size)
        return preds.view(-1, self.output_steps, self.input_size)


class LSTMForecaster:
    def __init__(self, seq_len: int = 12, output_steps: int = 6):
        self.seq_len = seq_len
        self.output_steps = output_steps
        self.feature_engineer = FeatureEngineer()
        self.indicators = ["rainfall_mm", "temperature_c", "wind_speed_kmh", "river_level_m"]
        self.models: Dict[str, DisasterLSTMNet] = {}
        self.scalers: Dict[str, Dict[str, Tuple[float, float]]] = {}
        self.device = torch.device("cpu")
        self._load_saved_models()

    def _get_model_path(self, district: str) -> str:
        safe_district = district.lower().replace(" ", "_")
        return os.path.join(MODELS_DIR, f"lstm_{safe_district}.pt")

    def _load_saved_models(self):
        pattern = os.path.join(MODELS_DIR, "lstm_*.pt")
        for fpath in glob.glob(pattern):
            try:
                district_key = os.path.basename(fpath).replace("lstm_", "").replace(".pt", "")
                checkpoint = torch.load(fpath, map_location=self.device)
                model = DisasterLSTMNet(
                    input_size=len(self.indicators),
                    hidden_size=32,
                    num_layers=2,
                    output_steps=self.output_steps
                )
                model.load_state_dict(checkpoint["state_dict"])
                model.eval()
                self.models[district_key] = model
                self.scalers[district_key] = checkpoint.get("scalers", {})
            except Exception as e:
                print(f"[LSTMForecaster] Could not load checkpoint from {fpath}: {e}")

    def train_district(
        self,
        district: str,
        readings: List[Dict[str, Any]],
        epochs: int = 25
    ) -> Dict[str, float]:
        """
        Trains the sequence model on sliding historical windows.
        """
        df = self.feature_engineer.raw_to_dataframe(readings)
        if len(df) < self.seq_len + self.output_steps + 4:
            return {"error": "Insufficient sequence length for LSTM training"}

        # Extract numerical indicator matrix
        data_matrix = df[self.indicators].to_numpy(dtype=np.float32)

        # Min-max scaling per column
        mins = data_matrix.min(axis=0)
        maxs = data_matrix.max(axis=0)
        ranges = np.where(maxs - mins == 0, 1.0, maxs - mins)
        scaled_data = (data_matrix - mins) / ranges

        district_key = district.lower().replace(" ", "_")
        self.scalers[district_key] = {
            self.indicators[i]: (float(mins[i]), float(ranges[i]))
            for i in range(len(self.indicators))
        }

        # Build sliding windows
        X_list, y_list = [], []
        for i in range(len(scaled_data) - self.seq_len - self.output_steps + 1):
            X_list.append(scaled_data[i:i + self.seq_len])
            y_list.append(scaled_data[i + self.seq_len:i + self.seq_len + self.output_steps])

        if not X_list:
            return {"error": "No sliding windows generated"}

        X_tensor = torch.tensor(np.array(X_list), dtype=torch.float32)
        y_tensor = torch.tensor(np.array(y_list), dtype=torch.float32)

        model = DisasterLSTMNet(
            input_size=len(self.indicators),
            hidden_size=32,
            num_layers=2,
            output_steps=self.output_steps
        )
        model.train()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=1e-5)
        criterion = nn.MSELoss()

        for epoch in range(epochs):
            optimizer.zero_grad()
            outputs = model(X_tensor)
            loss = criterion(outputs, y_tensor)
            loss.backward()
            optimizer.step()

        model.eval()
        final_loss = float(loss.item())

        self.models[district_key] = model

        # Save checkpoint
        checkpoint = {
            "state_dict": model.state_dict(),
            "scalers": self.scalers[district_key],
            "loss": final_loss,
            "district": district,
        }
        torch.save(checkpoint, self._get_model_path(district))

        return {"lstm_loss": round(final_loss, 4), "epochs": epochs}

    def predict_district(
        self,
        district: str,
        recent_readings: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        district_key = district.lower().replace(" ", "_")
        model = self.models.get(district_key)
        if not model or district_key not in self.scalers:
            return None

        df = self.feature_engineer.raw_to_dataframe(recent_readings)
        if len(df) < self.seq_len:
            return None

        # Take last seq_len rows
        window = df[self.indicators].iloc[-self.seq_len:].to_numpy(dtype=np.float32)
        scaler = self.scalers[district_key]

        mins = np.array([scaler[col][0] for col in self.indicators], dtype=np.float32)
        ranges = np.array([scaler[col][1] for col in self.indicators], dtype=np.float32)
        scaled_window = (window - mins) / ranges

        with torch.no_grad():
            x_in = torch.tensor(scaled_window[np.newaxis, :, :], dtype=torch.float32)
            preds_scaled = model(x_in).numpy()[0]  # shape (output_steps, num_indicators)

        # Unscale
        preds_unscaled = (preds_scaled * ranges) + mins

        # Use 6th step (index 5) for 6h forecast
        step_6 = preds_unscaled[-1]

        preds_dict = {}
        for i, ind in enumerate(self.indicators):
            val = float(step_6[i])
            if ind != "temperature_c":
                val = max(0.0, val)
            preds_dict[ind] = {
                "value": round(val, 2),
                "source": "lstm_forecaster",
            }

        return {
            "district": district,
            "horizon": "6h",
            "model": "lstm_forecaster",
            "predictions": preds_dict,
        }
