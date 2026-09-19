"""
Risk Rules Engine

Fuses raw statistical anomaly scores with official government bulletins (IMD, CWC, NDMA)
and ground hazard thresholds to determine alert proposals.
"""

from typing import Dict, Any, List, Optional

class RiskEngine:
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
        Applies decision fusion rules to decide whether an AiAlert should be proposed.
        """
        should_propose = False
        final_severity = recommended_severity

        # Rule 1: High Anomaly Score alone crosses threshold
        if anomaly_score >= 0.65:
            should_propose = True

        # Rule 2: Official warning exists + moderate anomaly
        if official_warning and anomaly_score >= 0.45:
            should_propose = True
            if recommended_severity == "Advisory":
                final_severity = "Watch"

        # Rule 3: Breached River Danger Level guarantees Emergency
        if cwc_data.get("is_above_danger"):
            should_propose = True
            final_severity = "Emergency"
        elif cwc_data.get("is_above_warning") and final_severity not in ["Emergency", "Warning"]:
            final_severity = "Warning"

        # Suggested actions based on hazard
        suggested_actions = []
        if hazard_type in ["Flood", "FlashFlood"]:
            suggested_actions = [
                f"Notify flood monitoring cell for {district}",
                "Alert NDRF / SDRF battalions for localized watercraft deployment",
                "Issue precautionary advisories to riverbank habitations and low-lying settlements",
                "Ensure local community centers and relief shelters are unlocked and equipped",
            ]
        elif hazard_type == "Heatwave":
            suggested_actions = [
                "Issue public advisory to avoid direct sunlight between 12:00 PM and 3:30 PM",
                "Distribute ORS packets at urban transit hubs",
                "Equip primary healthcare centers with cooling wards",
            ]

        return {
            "should_propose": should_propose,
            "final_severity": final_severity,
            "suggested_actions": suggested_actions,
        }
