"""
Shared Cached Weather Client — Resilient OpenWeatherMap Data Access

Provides cached, rate-limited, and retry-resilient requests to OpenWeatherMap.
Shares telemetry between IMD and CWC ingestors to eliminate duplicate API calls,
prevent WinError 10054 connection resets, and handle transient DNS hiccups gracefully.
"""

import os
import time
import logging
from typing import Optional, Dict, Any, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

OWM_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OWM_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

# Cache TTLs in seconds
CACHE_TTL_SUCCESS = 180.0   # 3 minutes for valid weather readings
CACHE_TTL_FAILURE = 45.0    # 45 seconds for failed calls (avoids hammering & 10054 socket resets)

_CACHE: Dict[str, Tuple[float, Optional[Dict[str, Any]]]] = {}
_SESSION: Optional[requests.Session] = None


def _get_session() -> requests.Session:
    """Returns a shared requests.Session configured with TCP connection pooling & retries."""
    global _SESSION
    if _SESSION is None:
        _SESSION = requests.Session()
        retries = Retry(
            total=2,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(
            max_retries=retries,
            pool_connections=10,
            pool_maxsize=10,
            pool_block=False,
        )
        _SESSION.mount("https://", adapter)
        _SESSION.mount("http://", adapter)
    return _SESSION


def fetch_owm_weather(city: str, force_refresh: bool = False) -> Optional[Dict[str, Any]]:
    """
    Fetches live weather from OpenWeatherMap for a given city string (e.g. 'Noida,IN').
    
    Features:
      - In-memory caching: Subsequent calls for the same city within 3 minutes return
        instantly without incurring network latency or rate-limiting.
      - Negative caching: Failures prevent immediate retries for 45s, avoiding 10054 TCP resets.
      - Connection pooling & retries via urllib3 HTTPAdapter.
    """
    if not OWM_API_KEY:
        logger.debug("[Weather Client] OPENWEATHER_API_KEY not configured; using baseline fallback.")
        return None

    now = time.time()
    if not force_refresh and city in _CACHE:
        cached_time, cached_data = _CACHE[city]
        ttl = CACHE_TTL_SUCCESS if cached_data is not None else CACHE_TTL_FAILURE
        if (now - cached_time) < ttl:
            return cached_data

    session = _get_session()
    try:
        resp = session.get(
            OWM_BASE_URL,
            params={
                "q": city,
                "appid": OWM_API_KEY,
                "units": "metric",
            },
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            _CACHE[city] = (now, data)
            return data
        elif resp.status_code == 429:
            logger.warning(f"[Weather Client] OWM rate limit (429) hit for '{city}'. Backing off for 45s.")
            _CACHE[city] = (now, None)
            return None
        else:
            logger.warning(f"[Weather Client] OWM returned HTTP {resp.status_code} for '{city}'.")
            _CACHE[city] = (now, None)
            return None
    except requests.RequestException as exc:
        err_name = exc.__class__.__name__
        logger.info(f"[Weather Client] OWM request for '{city}' unavailable ({err_name}). Utilizing fallback baseline.")
        _CACHE[city] = (now, None)
        return None
