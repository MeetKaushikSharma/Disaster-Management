import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'audio_service.dart';
import 'api_service.dart';
import 'storage_service.dart';

/// Top-level background message handler.
/// Must be a top-level function (not a class method) for Firebase Messaging.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[NotificationService] Background message: ${message.messageId}');
  // Background messages are automatically shown as system notifications by FCM
  // when a `notification` payload is present — no extra handling needed here.
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  bool _initialised = false;

  /// Callback invoked when a push notification triggers a new alert.
  /// Set this from the alert screen to force a refresh.
  VoidCallback? onAlertReceived;

  // ── Notification channels (Android) ────────────────────────────────────────
  static const _criticalChannel = AndroidNotificationChannel(
    'disaster_critical_v2',
    'Critical Disaster Alerts',
    description: 'Maximum-priority alerts that override Do Not Disturb',
    importance: Importance.max,
    playSound: true,
    sound: RawResourceAndroidNotificationSound('emergency_buzzer'),
    enableVibration: true,
  );

  static const _highChannel = AndroidNotificationChannel(
    'disaster_high_v2',
    'High Priority Alerts',
    description: 'High-priority disaster warnings',
    importance: Importance.high,
    playSound: true,
    sound: RawResourceAndroidNotificationSound('emergency_buzzer'),
    enableVibration: true,
  );

  static const _mediumChannel = AndroidNotificationChannel(
    'disaster_medium_v2',
    'Medium Priority Alerts',
    description: 'Medium-priority disaster advisories',
    importance: Importance.defaultImportance,
    playSound: true,
  );

  static const _lowChannel = AndroidNotificationChannel(
    'disaster_low_v2',
    'Low Priority Alerts',
    description: 'Low-priority disaster information',
    importance: Importance.low,
  );

  /// Initialise Firebase Messaging, request permissions, register channels,
  /// and set up foreground/tap handlers.
  Future<void> init() async {
    if (_initialised) return;

    // Request notification permission (required on Android 13+ and iOS)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      criticalAlert: true,  // For critical disaster alerts
      provisional: false,
    );
    debugPrint('[NotificationService] Permission: ${settings.authorizationStatus}');

    // Create Android notification channels
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin != null) {
      await androidPlugin.createNotificationChannel(_criticalChannel);
      await androidPlugin.createNotificationChannel(_highChannel);
      await androidPlugin.createNotificationChannel(_mediumChannel);
      await androidPlugin.createNotificationChannel(_lowChannel);
    }

    // Initialise local notifications plugin
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);
    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // Listen for foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle notification tap when app was in background
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check if the app was opened from a terminated state via notification
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      debugPrint('[NotificationService] App opened from terminated notification');
      _handleNotificationTap(initialMessage);
    }

    // Get FCM token and send to backend
    await _registerFcmToken();

    // Listen for token refreshes
    _messaging.onTokenRefresh.listen((newToken) {
      debugPrint('[NotificationService] FCM token refreshed');
      _sendTokenToBackend(newToken);
    });

    _initialised = true;
    debugPrint('[NotificationService] Initialised successfully');
  }

  // ── FCM Token Management ───────────────────────────────────────────────────

  Future<void> _registerFcmToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        debugPrint('[NotificationService] FCM token: ${token.substring(0, 20)}…');
        await _sendTokenToBackend(token);
      } else {
        debugPrint('[NotificationService] FCM token is null — will retry on refresh');
      }
    } catch (e) {
      debugPrint('[NotificationService] Failed to get FCM token: $e');
    }
  }

  Future<void> _sendTokenToBackend(String token) async {
    final userId = await StorageService.getUserId();
    if (userId == null) {
      debugPrint('[NotificationService] No userId yet — will send token after registration');
      // Store token locally so it can be sent during registration
      await StorageService.setFcmToken(token);
      return;
    }
    await ApiService().updateFcmToken(userId, token);
  }

  /// Call this after user registration to ensure the FCM token is sent.
  Future<void> sendPendingToken(String userId) async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await ApiService().updateFcmToken(userId, token);
      }
    } catch (e) {
      debugPrint('[NotificationService] Failed to send pending token: $e');
    }
  }

  // ── Foreground Message Handling ────────────────────────────────────────────

  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('[NotificationService] Foreground message: ${message.notification?.title}');

    final notification = message.notification;
    if (notification == null) return;

    final data = message.data;
    final severity = data['severity'] ?? 'High';
    final isRetraction = data['isRetraction'] == 'true';

    // Pick the correct channel based on severity
    String channelId;
    switch (severity) {
      case 'Critical':
        channelId = 'disaster_critical_v2';
        break;
      case 'High':
        channelId = 'disaster_high_v2';
        break;
      case 'Medium':
        channelId = 'disaster_medium_v2';
        break;
      default:
        channelId = 'disaster_low_v2';
    }

    // Show local notification
    _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channelId,
          channelId.replaceAll('_', ' ').toUpperCase(),
          importance: severity == 'Critical' ? Importance.max : Importance.high,
          priority: Priority.high,
          fullScreenIntent: severity == 'Critical',
          playSound: true,
        ),
      ),
      payload: json.encode(data),
    );

    // Play emergency buzzer for Critical/High severity
    if (!isRetraction && (severity == 'Critical' || severity == 'High')) {
      AudioService().playEmergencyBuzzer();
    }

    // Notify the alert screen to refresh
    onAlertReceived?.call();
  }

  // ── Notification Tap Handling ──────────────────────────────────────────────

  void _handleNotificationTap(RemoteMessage message) {
    debugPrint('[NotificationService] Notification tapped: ${message.data}');
    // Trigger alert screen refresh
    onAlertReceived?.call();
  }

  void _onNotificationTap(NotificationResponse response) {
    debugPrint('[NotificationService] Local notification tapped');
    onAlertReceived?.call();
  }
}
