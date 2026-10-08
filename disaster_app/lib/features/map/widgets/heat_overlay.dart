import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/services/api_service.dart';

enum HeatLayerType {
  rainfall,
  temperature,
  wind,
  river,
  risk,
}

class HeatOverlayWidget extends StatelessWidget {
  final List<HeatPoint> points;
  final HeatLayerType layerType;
  final double opacity;

  const HeatOverlayWidget({
    super.key,
    required this.points,
    required this.layerType,
    this.opacity = 0.65,
  });

  @override
  Widget build(BuildContext context) {
    if (points.isEmpty) return const SizedBox.shrink();

    final camera = MapCamera.of(context);

    return Opacity(
      opacity: opacity,
      child: CustomPaint(
        size: camera.size,
        painter: HeatMapPainter(
          camera: camera,
          points: points,
          layerType: layerType,
        ),
      ),
    );
  }
}

class HeatMapPainter extends CustomPainter {
  final MapCamera camera;
  final List<HeatPoint> points;
  final HeatLayerType layerType;

  HeatMapPainter({
    required this.camera,
    required this.points,
    required this.layerType,
  });

  List<Color> _getColorPalette(HeatLayerType type) {
    switch (type) {
      case HeatLayerType.rainfall:
        return const [
          Color(0x0038BDF8),
          Color(0x772563EB),
          Color(0xAA7C3AED),
          Color(0xCCEC4899),
          Color(0xFFEF4444),
        ];
      case HeatLayerType.temperature:
        return const [
          Color(0x0006B6D4),
          Color(0x6610B981),
          Color(0x99F59E0B),
          Color(0xCCF97316),
          Color(0xFFEF4444),
        ];
      case HeatLayerType.wind:
        return const [
          Color(0x0010B981),
          Color(0x77EAB308),
          Color(0xAAF97316),
          Color(0xCCEF4444),
          Color(0xFF831843),
        ];
      case HeatLayerType.river:
        return const [
          Color(0x0010B981),
          Color(0x773B82F6),
          Color(0xAAEAB308),
          Color(0xCCF97316),
          Color(0xFFEF4444),
        ];
      case HeatLayerType.risk:
        return const [
          Color(0x0022C55E),
          Color(0x77EAB308),
          Color(0xAAF97316),
          Color(0xCCEF4444),
          Color(0xFFA855F7),
        ];
    }
  }

  Color _interpolateColor(double t, List<Color> palette) {
    final clamped = t.clamp(0.0, 1.0);
    final scaled = clamped * (palette.length - 1);
    final index = scaled.floor();
    final remainder = scaled - index;

    if (index >= palette.length - 1) return palette.last;
    return Color.lerp(palette[index], palette[index + 1], remainder) ?? palette[index];
  }

  @override
  void paint(Canvas canvas, Size size) {
    final palette = _getColorPalette(layerType);
    final zoom = camera.zoom;
    // Scale circle radius dynamically with map zoom
    final radius = (18.0 * (zoom / 8.5)).clamp(16.0, 52.0);

    for (final pt in points) {
      final latLng = LatLng(pt.lat, pt.lng);
      // Map camera coordinate translation
      final screenOffset = camera.latLngToScreenOffset(latLng);

      // Skip points outside visible bounds (plus margin)
      if (screenOffset.dx < -radius ||
          screenOffset.dx > size.width + radius ||
          screenOffset.dy < -radius ||
          screenOffset.dy > size.height + radius) {
        continue;
      }

      final color = _interpolateColor(pt.intensity, palette);

      final paint = Paint()
        ..shader = ui.Gradient.radial(
          Offset(screenOffset.dx, screenOffset.dy),
          radius,
          [
            color,
            color.withValues(alpha: color.a * 0.4),
            const Color(0x00000000),
          ],
          [0.0, 0.6, 1.0],
        )
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);

      canvas.drawCircle(Offset(screenOffset.dx, screenOffset.dy), radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant HeatMapPainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.layerType != layerType ||
        oldDelegate.camera != camera;
  }
}
