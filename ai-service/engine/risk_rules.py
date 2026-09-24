"""
Risk Rules Engine

Fuses raw statistical anomaly scores with official government bulletins (IMD, CWC, NDMA)
and ground hazard thresholds to determine alert proposals for Delhi-NCR.

Hazard types supported:
  - Flood / FlashFlood
  - Heatwave
  - Storm
  - Drought (future)
"""

from typing import Dict, Any, List, Optional


class RiskEngine:
    # Minimum score to propose an alert
    PROPOSE_THRESHOLD = 0.55

    # Suggested actions catalogue
    _FLOOD_ACTIONS = [
        "Notify flood monitoring cell and district disaster management authority",
        "Alert NDRF / SDRF battalions for localized watercraft pre-positioning",
        "Issue precautionary advisories to riverbank habitations and low-lying areas",
        "Ensure local community centres, relief shelters are unlocked and stocked",
        "Coordinate with PWD to inspect drainage channels and embankment strength",
    ]
    _FLASH_FLOOD_ACTIONS = [
        "Issue IMMEDIATE FlashFlood warning to all riverbank settlements",
        "Evacuate low-lying and flood-prone zones without delay",
        "Deploy NDRF rescue teams — boats, life jackets, ropes — at identified risk points",
        "Close vulnerable bridges and water-crossing roads",
        "Activate district-level emergency operations centre at highest readiness",
    ]
    _HEATWAVE_ACTIONS = [
        "Issue IMD Heatwave advisory and activate district heat action plan",
        "Open cooling centres at community halls, schools, and government buildings",
        "Deploy mobile ORS distribution teams at bus stands, railway stations, and markets",
        "Alert ASHA workers and urban local bodies for door-to-door health monitoring",
        "Restrict outdoor labour and construction activities 11:00 AM – 4:00 PM",
        "Ensure uninterrupted water supply and additional tanker deployment",
    ]
    _STORM_ACTIONS = [
        "Issue storm / squall warning for affected areas",
        "Alert NDRF and fire services for rapid tree / structure clearance",
        "Instruct residents to secure loose outdoor items and stay indoors",
        "Coordinate with power utilities for preventive line isolation",
        "Keep emergency medical teams on standby for trauma cases",
    ]

    def evaluate_risk(
        self,
        district: str,
        hazard_type: str,
        anomaly_score: float,
        recommended_severity: str,
        official_warning: Optional[str],
        cwc_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Applies decision-fusion rules to decide whether an AiAlert should be proposed.

        Rules (in priority order):
          1. River danger level breached → Emergency, always propose
          2. River warning level breached → Warning, propose
          3. Official government bulletin present + moderate anomaly → propose at Watch+
          4. High anomaly score alone (≥ PROPOSE_THRESHOLD) → propose
        """
        should_propose = False
        final_severity = recommended_severity

        # Rule 1: River danger breach — highest priority, always Emergency
        if cwc_data.get("is_above_danger"):
            should_propose = True
            final_severity = "Emergency"

        # Rule 2: River warning breach
        elif cwc_data.get("is_above_warning"):
            should_propose = True
            if final_severity not in ["Emergency"]:
                final_severity = "Warning"

        # Rule 3: Official warning from IMD/CWC/NDMA
        if official_warning and anomaly_score >= 0.40:
            should_propose = True
            if final_severity == "Advisory":
                final_severity = "Watch"

        # Rule 4: Statistical anomaly score threshold
        if anomaly_score >= self.PROPOSE_THRESHOLD:
            should_propose = True

        # Map hazard type to suggested action list
        if hazard_type == "FlashFlood":
            suggested_actions = self._FLASH_FLOOD_ACTIONS
        elif hazard_type == "Flood":
            suggested_actions = self._FLOOD_ACTIONS
        elif hazard_type == "Heatwave":
            suggested_actions = self._HEATWAVE_ACTIONS
        elif hazard_type == "Storm":
            suggested_actions = self._STORM_ACTIONS
        else:
            suggested_actions = [
                f"Assess ground situation in {district} for {hazard_type} conditions",
                "Put district disaster management authority on standby",
            ]

        return {
            "should_propose": should_propose,
            "final_severity": final_severity,
            "suggested_actions": suggested_actions,
        }
