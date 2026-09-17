import 'package:flutter/material.dart';

class AppTheme {
  // Pure Black & White Palette
  static const Color black = Color(0xFF000000);
  static const Color white = Color(0xFFFFFFFF);
  static const Color grey900 = Color(0xFF171717);
  static const Color grey800 = Color(0xFF262626);
  static const Color grey700 = Color(0xFF404040);
  static const Color grey600 = Color(0xFF525252);
  static const Color grey500 = Color(0xFF737373);
  static const Color grey400 = Color(0xFFA3A3A3);
  static const Color grey300 = Color(0xFFD4D4D4);
  static const Color grey200 = Color(0xFFE5E5E5);
  static const Color grey100 = Color(0xFFF5F5F5);

  // Severity greyscale coding (darker = more severe)
  static const Color severityLow = Color(0xFFD4D4D4);
  static const Color severityMedium = Color(0xFFA3A3A3);
  static const Color severityHigh = Color(0xFF525252);
  static const Color severityCritical = Color(0xFF000000);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: white,
      colorScheme: const ColorScheme.light(
        primary: black,
        onPrimary: white,
        secondary: grey800,
        onSecondary: white,
        surface: white,
        onSurface: black,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: black,
        foregroundColor: white,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: white,
          fontSize: 16,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: black,
        selectedItemColor: white,
        unselectedItemColor: grey400,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 10),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: black,
          foregroundColor: white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(4),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: black,
          side: const BorderSide(color: black, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(4),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: grey300, width: 1),
          borderRadius: BorderRadius.circular(4),
        ),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: const DividerThemeData(
        color: grey300,
        thickness: 1,
        space: 1,
      ),
    );
  }
}
