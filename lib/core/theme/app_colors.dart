import 'package:flutter/material.dart';

/// Futuristic glassmorphism color palette - Pure Black Theme
class AppColors {
  // Base Colors - Dark Theme (Pure Black)
  static const Color backgroundDark = Color(0xFF000000);
  static const Color backgroundSecondaryDark = Color(0xFF0A0A0A);
  static const Color surfaceDark = Color(0xFF111111);
  
  // Base Colors - Light Theme (Pure white and soft gray)
  static const Color backgroundLight = Color(0xFFFAFAFA);
  static const Color backgroundSecondaryLight = Color(0xFFF5F5F5);
  static const Color surfaceLight = Color(0xFFFFFFFF);
  
  // Accent Colors - Neon Cyberpunk
  static const Color primaryCyan = Color(0xFF00D9FF);
  static const Color secondaryTeal = Color(0xFF1DE9B6);
  static const Color accentBlue = Color(0xFF2979FF);
  static const Color accentPurple = Color(0xFF7C4DFF);
  
  // Status Colors
  static const Color statusNormal = Color(0xFF00E676);
  static const Color statusWarning = Color(0xFFFFD600);
  static const Color statusCritical = Color(0xFFFF1744);
  static const Color statusOffline = Color(0xFF757575);
  
  // Text Colors - Dark Theme
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFB0BEC5);
  static const Color textTertiary = Color(0xFF78909C);
  
  // Text Colors - Light Theme
  static const Color textPrimaryLight = Color(0xFF000000);
  static const Color textSecondaryLight = Color(0xFF424242);
  static const Color textTertiaryLight = Color(0xFF757575);
  
  // Glass Effect - Dark Theme (More visible glass)
  static const Color glassLight = Color(0x18FFFFFF);
  static const Color glassMedium = Color(0x25FFFFFF);
  static const Color glassDark = Color(0x10FFFFFF);
  static const Color glassStroke = Color(0x30FFFFFF);
  
  // Glass Effect - Light Theme
  static const Color glassLightTheme = Color(0x10000000);
  static const Color glassMediumTheme = Color(0x15000000);
  static const Color glassDarkTheme = Color(0x08000000);
  static const Color glassStrokeLight = Color(0x20000000);
  
  // Gradients - Dark Theme
  static const List<Color> primaryGradient = [
    Color(0xFF00D9FF),
    Color(0xFF1DE9B6),
  ];
  
  static const List<Color> backgroundGradient = [
    Color(0xFF000000),
    Color(0xFF0A0A0A),
  ];
  
  // Gradients - Light Theme
  static const List<Color> backgroundGradientLight = [
    Color(0xFFFAFAFA),
    Color(0xFFFFFFFF),
  ];
  
  static const List<Color> cardGradient = [
    Color(0x18FFFFFF),
    Color(0x08FFFFFF),
  ];
  
  static const List<Color> cardGradientLight = [
    Color(0xFFFFFFFF),
    Color(0xFFFAFAFA),
  ];
  
  // Neon glow colors
  static const Color neonCyanGlow = Color(0x4000D9FF);
  static const Color neonGreenGlow = Color(0x4000E676);
  static const Color neonRedGlow = Color(0x40FF1744);
  static const Color neonYellowGlow = Color(0x40FFD600);
}
