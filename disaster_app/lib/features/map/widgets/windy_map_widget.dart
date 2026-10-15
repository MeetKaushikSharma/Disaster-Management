import 'package:flutter/material.dart';
import 'windy_map_mobile.dart'
    if (dart.library.js_interop) 'windy_map_web.dart' as platform_view;

class WindyMapWidget extends StatefulWidget {
  final double initialLat;
  final double initialLng;
  final String activeOverlay;

  const WindyMapWidget({
    super.key,
    this.initialLat = 28.6139,
    this.initialLng = 77.2090,
    this.activeOverlay = 'radar',
  });

  @override
  State<WindyMapWidget> createState() => _WindyMapWidgetState();
}

class _WindyMapWidgetState extends State<WindyMapWidget> {
  bool _isLoading = true;
  String _currentOverlay = 'radar';

  static const String windyApiKey =
      'eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfdTkzZGc0dmQiLCJqdGkiOiIzZmVhYWE2OWFiOTczNWFlNTFlZjk0N2U1MGEzOWUxNCJ9.8BaRQCak3VMYT59hiN0Z-D02KGSzCP2kogkcvNGf19I';

  final List<Map<String, dynamic>> _overlayOptions = [
    {'id': 'radar', 'label': 'Radar', 'icon': Icons.radar_rounded},
    {'id': 'wind', 'label': 'Wind', 'icon': Icons.air_rounded},
    {'id': 'rain', 'label': 'Rain', 'icon': Icons.water_drop_rounded},
    {'id': 'temp', 'label': 'Temp', 'icon': Icons.thermostat_rounded},
    {'id': 'waves', 'label': 'Waves', 'icon': Icons.waves_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _currentOverlay = widget.activeOverlay;
  }

  String _buildWindyUrl(String overlay) {
    final lat = widget.initialLat;
    final lon = widget.initialLng;
    return 'https://embed.windy.com/embed.html?'
        'lat=$lat&lon=$lon&zoom=9&level=surface'
        '&overlay=$overlay&menu=&message=true&marker=true'
        '&calendar=12&pressure=&type=map&location=coordinates'
        '&detail=&detailLat=$lat&detailLon=$lon'
        '&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1'
        '&key=$windyApiKey';
  }

  void _switchOverlay(String overlayId) {
    setState(() {
      _currentOverlay = overlayId;
      _isLoading = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // 1. Embedded Interactive Live Windy Map (runs inside the app only)
        Positioned.fill(
          child: platform_view.createWindyPlatformView(
            url: _buildWindyUrl(_currentOverlay),
            onLoaded: () {
              if (mounted) setState(() => _isLoading = false);
            },
          ),
        ),

        // 2. Loading overlay
        if (_isLoading)
          Container(
            color: const Color(0xFF0B1120).withAlpha(180),
            child: const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(color: Colors.amberAccent),
                  SizedBox(height: 12),
                  Text(
                    'Loading Live Windy Particle Radar...',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),

        // 3. Floating Overlay Chips (Top)
        Positioned(
          top: 12,
          left: 12,
          right: 12,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ..._overlayOptions.map((opt) {
                  final isSelected = _currentOverlay == opt['id'];
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: FilterChip(
                      selected: isSelected,
                      avatar: Icon(
                        opt['icon'] as IconData,
                        size: 15,
                        color: isSelected ? Colors.black : Colors.white70,
                      ),
                      label: Text(
                        opt['label'] as String,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight:
                              isSelected ? FontWeight.bold : FontWeight.normal,
                          color: isSelected ? Colors.black : Colors.white,
                        ),
                      ),
                      backgroundColor: const Color(0xFF1E293B).withAlpha(220),
                      selectedColor: Colors.amberAccent,
                      checkmarkColor: Colors.black,
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: BorderSide(
                          color: isSelected
                              ? Colors.amberAccent
                              : Colors.white24,
                        ),
                      ),
                      onSelected: (_) => _switchOverlay(opt['id'] as String),
                    ),
                  );
                }),
              ],
            ),
          ),
        ),

        // 4. Attribution chip (Bottom-left)
        Positioned(
          bottom: 12,
          left: 12,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A).withAlpha(200),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: Colors.white12),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '🛰️ Windy Live Radar Engine',
                  style: TextStyle(color: Colors.white70, fontSize: 10),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
