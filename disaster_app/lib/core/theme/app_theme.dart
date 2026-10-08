import 'package:flutter/material.dart';

class AppTheme {
  // Brand & Core Colors
  static const Color inkNavy = Color(0xFF0A0F1C);
  static const Color deepBlue = Color(0xFF12234A);
  static const Color background = Color(0xFFF4F6FA);
  static const Color surface = Color(0xFFFFFFFF);

  // Text Colors
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);

  // Semantic Colors
  static const Color safeGreen = Color(0xFF12B76A);
  static const Color dangerRed = Color(0xFFE5313F);
  static const Color warningAmber = Color(0xFFF59E0B);
  static const Color infoBlue = Color(0xFF3B82F6);

  // Accents
  static const Color accentSaffron = Color(0xFFFF9933);
  static const Color accentWhite = Color(0xFFFFFFFF);
  static const Color accentGreen = Color(0xFF138808);

  // Constants
  static const double cardRadius = 20.0;
  static const double buttonHeight = 52.0;

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Inter',
      scaffoldBackgroundColor: background,
      colorScheme: const ColorScheme.light(
        primary: deepBlue,
        onPrimary: surface,
        secondary: infoBlue,
        onSecondary: surface,
        surface: surface,
        onSurface: textPrimary,
        error: dangerRed,
        onError: surface,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontWeight: FontWeight.w700,
          color: textPrimary,
        ),
        displayMedium: TextStyle(
          fontWeight: FontWeight.w700,
          color: textPrimary,
        ),
        displaySmall: TextStyle(
          fontWeight: FontWeight.w700,
          color: textPrimary,
        ),
        headlineLarge: TextStyle(
          fontWeight: FontWeight.w700,
          color: textPrimary,
        ),
        headlineMedium: TextStyle(
          fontWeight: FontWeight.w700,
          color: textPrimary,
        ),
        headlineSmall: TextStyle(
          fontWeight: FontWeight.w700,
          color: textPrimary,
          fontSize: 24,
        ),
        titleLarge: TextStyle(
          fontWeight: FontWeight.w600,
          color: textPrimary,
          fontSize: 20,
        ),
        titleMedium: TextStyle(
          fontWeight: FontWeight.w600,
          color: textPrimary,
          fontSize: 16,
        ),
        titleSmall: TextStyle(
          fontWeight: FontWeight.w600,
          color: textPrimary,
          fontSize: 14,
        ),
        bodyLarge: TextStyle(
          fontWeight: FontWeight.w400,
          color: textPrimary,
          fontSize: 16,
        ),
        bodyMedium: TextStyle(
          fontWeight: FontWeight.w400,
          color: textPrimary,
          fontSize: 14,
        ),
        bodySmall: TextStyle(
          fontWeight: FontWeight.w400,
          color: textSecondary,
          fontSize: 12,
        ),
        labelLarge: TextStyle(
          fontWeight: FontWeight.w600,
          color: textPrimary,
          fontSize: 14,
        ),
        labelSmall: TextStyle(
          fontWeight: FontWeight.w700,
          color: textSecondary,
          fontSize: 10,
          letterSpacing: 1.0, // Small uppercase tracked captions
        ),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
        ),
        margin: EdgeInsets.zero,
      ),
    );
  }

  // Helper BoxShadow for cards
  static List<BoxShadow> get softShadow => [
    BoxShadow(
      color: inkNavy.withValues(alpha: 0.04),
      blurRadius: 16,
      offset: const Offset(0, 4),
    ),
    BoxShadow(
      color: inkNavy.withValues(alpha: 0.02),
      blurRadius: 4,
      offset: const Offset(0, 2),
    ),
  ];

  // --- LEGACY COLORS (To keep untouched screens compiling during migration) ---
  @Deprecated('Use new design tokens')
  static const Color black = Color(0xFF000000);
  @Deprecated('Use new design tokens')
  static const Color white = Color(0xFFFFFFFF);
  @Deprecated('Use new design tokens')
  static const Color grey900 = Color(0xFF171717);
  @Deprecated('Use new design tokens')
  static const Color grey800 = Color(0xFF262626);
  @Deprecated('Use new design tokens')
  static const Color grey700 = Color(0xFF404040);
  @Deprecated('Use new design tokens')
  static const Color grey600 = Color(0xFF525252);
  @Deprecated('Use new design tokens')
  static const Color grey500 = Color(0xFF737373);
  @Deprecated('Use new design tokens')
  static const Color grey400 = Color(0xFFA3A3A3);
  @Deprecated('Use new design tokens')
  static const Color grey300 = Color(0xFFD4D4D4);
  @Deprecated('Use new design tokens')
  static const Color grey200 = Color(0xFFE5E5E5);
  @Deprecated('Use new design tokens')
  static const Color grey100 = Color(0xFFF5F5F5);
  @Deprecated('Use new design tokens')
  static const Color severityLow = Color(0xFFD4D4D4);
  @Deprecated('Use new design tokens')
  static const Color severityMedium = Color(0xFFA3A3A3);
  @Deprecated('Use new design tokens')
  static const Color severityHigh = Color(0xFF525252);
  @Deprecated('Use new design tokens')
  static const Color severityCritical = Color(0xFF000000);
}
