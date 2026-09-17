class DisasterAlert {
  final String id;
  final String title;
  final String type; // Flood, Cyclone, Earthquake, Heatwave, Landslide, Fire, etc.
  final String severity; // Low, Medium, High, Critical
  final String description;
  final String zoneType; // polygon, radius
  final List<List<double>>? polygonCoords; // [[lng, lat], ...]
  final List<double>? centreCoords; // [lng, lat]
  final double? radiusKm;
  final double bufferRadiusKm;
  final String? safetyGuideId;
  final DateTime createdAt;
  final bool isRetracted;

  DisasterAlert({
    required this.id,
    required this.title,
    required this.type,
    required this.severity,
    required this.description,
    required this.zoneType,
    this.polygonCoords,
    this.centreCoords,
    this.radiusKm,
    this.bufferRadiusKm = 5.0,
    this.safetyGuideId,
    required this.createdAt,
    this.isRetracted = false,
  });

  factory DisasterAlert.fromJson(Map<String, dynamic> json) {
    List<List<double>>? poly;
    if (json['polygon'] != null && json['polygon']['coordinates'] != null) {
      final rings = json['polygon']['coordinates'] as List;
      if (rings.isNotEmpty) {
        final ring = rings[0] as List;
        poly = ring.map<List<double>>((pt) => [
          (pt[0] as num).toDouble(),
          (pt[1] as num).toDouble(),
        ]).toList();
      }
    }

    List<double>? centre;
    if (json['centre'] != null && json['centre']['coordinates'] != null) {
      final c = json['centre']['coordinates'] as List;
      centre = [(c[0] as num).toDouble(), (c[1] as num).toDouble()];
    }

    return DisasterAlert(
      id: json['_id'] ?? json['id'] ?? '',
      title: json['title'] ?? 'Emergency Disaster Alert',
      type: json['type'] ?? 'Other',
      severity: json['severity'] ?? 'Critical',
      description: json['description'] ?? '',
      zoneType: json['zoneType'] ?? 'radius',
      polygonCoords: poly,
      centreCoords: centre,
      radiusKm: json['radiusKm'] != null ? (json['radiusKm'] as num).toDouble() : null,
      bufferRadiusKm: json['bufferRadiusKm'] != null ? (json['bufferRadiusKm'] as num).toDouble() : 5.0,
      safetyGuideId: json['safetyGuideId'] is Map ? json['safetyGuideId']['_id'] : json['safetyGuideId'],
      createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : DateTime.now(),
      isRetracted: json['status'] == 'retracted',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'type': type,
      'severity': severity,
      'description': description,
      'zoneType': zoneType,
      'radiusKm': radiusKm,
      'bufferRadiusKm': bufferRadiusKm,
      'safetyGuideId': safetyGuideId,
      'createdAt': createdAt.toIso8601String(),
      'isRetracted': isRetracted,
    };
  }
}
