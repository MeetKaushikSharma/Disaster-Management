import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import '../models/alert_model.dart';
import '../models/guide_model.dart';
import 'storage_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  Future<String> _getBaseUrl() async {
    return await StorageService.getBackendUrl();
  }

  // Register or initialize User on server
  Future<String?> registerUser({
    required String phone,
    required String name,
    required List<double> coordinates, // [lng, lat]
    required String language,
    String? fcmToken,
  }) async {
    try {
      final baseUrl = await _getBaseUrl();
      final payload = <String, dynamic>{
        'phone': phone,
        'name': name,
        'preferredLanguage': language,
      };
      if (fcmToken != null) payload['fcmToken'] = fcmToken;

      final res = await http.post(
        Uri.parse('$baseUrl/api/users/register'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(payload),
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = json.decode(res.body);
        final userId = data['userId'] ?? data['user']?['_id'] ?? data['user']?['id'];
        if (userId != null) {
          await StorageService.setUserId(userId.toString());
          // After registration, also update location if available
          if (coordinates.length == 2) {
            await sendLocationHeartbeat(userId.toString(), coordinates[0], coordinates[1]);
          }
          return userId.toString();
        }
      } else {
        debugPrint('Registration failed (${res.statusCode}): ${res.body}');
      }
    } catch (e) {
      debugPrint('Registration network error: $e');
    }
    return null;
  }

  // Update FCM token
  Future<bool> updateFcmToken(String userId, String token) async {
    try {
      final baseUrl = await _getBaseUrl();
      final res = await http.put(
        Uri.parse('$baseUrl/api/users/$userId/fcm-token'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'fcmToken': token}),
      ).timeout(const Duration(seconds: 6));

      return res.statusCode == 200;
    } catch (e) {
      debugPrint('Update FCM token error: $e');
      return false;
    }
  }

  // Periodic heartbeat sync of location
  // Backend PUT /api/users/:id/location accepts { coordinates: [lng, lat] }
  Future<bool> sendLocationHeartbeat(String userId, double lng, double lat) async {
    try {
      final baseUrl = await _getBaseUrl();
      final res = await http.put(
        Uri.parse('$baseUrl/api/users/$userId/location'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'coordinates': [lng, lat],
        }),
      ).timeout(const Duration(seconds: 6));

      return res.statusCode == 200;
    } catch (e) {
      debugPrint('Heartbeat error: $e');
      return false;
    }
  }

  // Fetch active disaster events
  Future<List<DisasterAlert>> getActiveDisasterEvents() async {
    try {
      final baseUrl = await _getBaseUrl();
      final res = await http.get(
        Uri.parse('$baseUrl/api/events/public?limit=10'),
      ).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final List events = data['events'] ?? [];
        return events.map((e) => DisasterAlert.fromJson(e)).toList();
      }
    } catch (e) {
      debugPrint('Fetch active events error: $e');
    }
    return [];
  }

  // Fetch Safety Guides (with automatic offline caching)
  Future<List<SafetyGuide>> getSafetyGuides(String language) async {
    try {
      final baseUrl = await _getBaseUrl();
      final res = await http.get(
        Uri.parse('$baseUrl/api/guides?language=$language'),
      ).timeout(const Duration(seconds: 6));

      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final List guides = data['guides'] ?? [];
        final parsed = guides.map((g) => SafetyGuide.fromJson(g)).toList();
        if (parsed.isNotEmpty) {
          await StorageService.saveGuides(parsed);
          return parsed;
        }
      }
    } catch (e) {
      debugPrint('Fetch guides online failed, using offline cache: $e');
    }

    // Fallback to local offline cache
    final cached = await StorageService.getGuides();
    return cached;
  }

  // Submit Citizen Safety Check-In ("safe", "need_help", "family_safe")
  Future<bool> submitCitizenCheckIn({
    required String status,
    required double lng,
    required double lat,
    String? message,
    String? district,
    String? eventId,
    int peopleCount = 1,
  }) async {
    try {
      final baseUrl = await _getBaseUrl();
      final userId = await StorageService.getUserId();
      if (userId == null) return false;

      final payload = <String, dynamic>{
        'userId': userId,
        'status': status,
        'coordinates': [lng, lat],
        'district': district ?? 'Varanasi',
        'state': 'Uttar Pradesh',
        'peopleCount': peopleCount,
      };
      if (eventId != null) payload['eventId'] = eventId;
      if (message != null) payload['message'] = message;

      final res = await http.post(
        Uri.parse('$baseUrl/api/citizens/check-in'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(payload),
      ).timeout(const Duration(seconds: 8));

      return res.statusCode == 200 || res.statusCode == 201;
    } catch (e) {
      debugPrint('Check-in error: $e');
      return false;
    }
  }
}
