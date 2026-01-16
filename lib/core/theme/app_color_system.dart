import 'package:flutter/material.dart';

/// Enterprise-grade color system with Dark and Light mode palettes
/// Optimized for professional monitoring environments
/// WCAG AAA compliant for critical text and AA for all other content
class AppColorSystem {
  // ============================================
  // DARK MODE PALETTE (Control Room / Night Ops)
  // ============================================
  
  // Dark Mode - Backgrounds (Deep neutral tones)
  static const Color darkBackground = Color(0xFF0B0E1A); // Deep slate
  static const Color darkBackgroundElevated = Color(0xFF12151F); // Slightly elevated
  static const Color darkSurface = Color(0xFF1A1E2E); // Card surface
  static const Color darkSurfaceElevated = Color(0xFF232837); // Elevated surface
  static const Color darkOverlay = Color(0xFF2C3142); // Modal/overlay
  
  // Dark Mode - Text (Calibrated for readability)
  static const Color darkTextPrimary = Color(0xFFE8EAED); // High emphasis
  static const Color darkTextSecondary = Color(0xFFBDC1C6); // Medium emphasis
  static const Color darkTextTertiary = Color(0xFF9AA0A6); // Low emphasis
  static const Color darkTextDisabled = Color(0xFF5F6368); // Disabled
  
  // Dark Mode - Borders & Dividers
  static const Color darkBorder = Color(0xFF2C3142);
  static const Color darkDivider = Color(0xFF3C4257);
  
  // ============================================
  // LIGHT MODE PALETTE (Daytime / Reporting)
  // ============================================
  
  // Light Mode - Backgrounds (Soft neutral tones, no pure white)
  static const Color lightBackground = Color(0xFFF8F9FA); // Soft off-white
  static const Color lightBackgroundElevated = Color(0xFFFFFFFF); // Elevated white
  static const Color lightSurface = Color(0xFFFFFFFF); // Card surface
  static const Color lightSurfaceElevated = Color(0xFFFAFBFC); // Elevated surface
  static const Color lightOverlay = Color(0xFFF5F6F7); // Modal/overlay
  
  // Light Mode - Text (Optimized contrast)
  static const Color lightTextPrimary = Color(0xFF1F2937); // High emphasis
  static const Color lightTextSecondary = Color(0xFF4B5563); // Medium emphasis
  static const Color lightTextTertiary = Color(0xFF6B7280); // Low emphasis
  static const Color lightTextDisabled = Color(0xFF9CA3AF); // Disabled
  
  // Light Mode - Borders & Dividers
  static const Color lightBorder = Color(0xFFE5E7EB);
  static const Color lightDivider = Color(0xFFD1D5DB);
  
  // ============================================
  // SEMANTIC COLORS (Consistent across themes)
  // ============================================
  
  // Primary Brand (Cyan - Data & Technology)
  static const Color primaryLight = Color(0xFF0EA5E9); // Daytime cyan
  static const Color primaryDark = Color(0xFF38BDF8); // Night cyan (higher luminance)
  static const Color primaryContainer = Color(0xFF1E40AF);
  
  // Secondary Accent (Teal - Success & Growth)
  static const Color secondaryLight = Color(0xFF14B8A6);
  static const Color secondaryDark = Color(0xFF2DD4BF);
  
  // Status Colors - Critical (Red spectrum)
  static const Color criticalLight = Color(0xFFDC2626); // Daytime red
  static const Color criticalDark = Color(0xFFEF4444); // Night red (higher luminance)
  static const Color criticalContainer = Color(0xFF7F1D1D);
  
  // Status Colors - Warning (Amber spectrum)
  static const Color warningLight = Color(0xFFF59E0B);
  static const Color warningDark = Color(0xFFFBBF24);
  static const Color warningContainer = Color(0xFF78350F);
  
  // Status Colors - Success (Green spectrum)
  static const Color successLight = Color(0xFF10B981);
  static const Color successDark = Color(0xFF34D399);
  static const Color successContainer = Color(0xFF065F46);
  
  // Status Colors - Info (Blue spectrum)
  static const Color infoLight = Color(0xFF3B82F6);
  static const Color infoDark = Color(0xFF60A5FA);
  static const Color infoContainer = Color(0xFF1E3A8A);
  
  // Status Colors - Offline/Inactive (Gray spectrum)
  static const Color offlineLight = Color(0xFF6B7280);
  static const Color offlineDark = Color(0xFF9CA3AF);
  
  // ============================================
  // CHART & DATA VISUALIZATION COLORS
  // ============================================
  
  // Light Mode Chart Palette
  static const List<Color> chartColorsLight = [
    Color(0xFF0EA5E9), // Cyan
    Color(0xFF8B5CF6), // Purple
    Color(0xFFF59E0B), // Amber
    Color(0xFF10B981), // Green
    Color(0xFFEC4899), // Pink
    Color(0xFF06B6D4), // Teal
    Color(0xFFF97316), // Orange
    Color(0xFF6366F1), // Indigo
  ];
  
  // Dark Mode Chart Palette (Higher luminance)
  static const List<Color> chartColorsDark = [
    Color(0xFF38BDF8), // Cyan
    Color(0xFFA78BFA), // Purple
    Color(0xFFFBBF24), // Amber
    Color(0xFF34D399), // Green
    Color(0xFFF472B6), // Pink
    Color(0xFF22D3EE), // Teal
    Color(0xFFFB923C), // Orange
    Color(0xFF818CF8), // Indigo
  ];
  
  // ============================================
  // GLASS EFFECT COLORS
  // ============================================
  
  static const Color glassDark = Color(0x1AFFFFFF);
  static const Color glassLight = Color(0x0D000000);
  
  // ============================================
  // ROLE-BASED INDICATOR COLORS
  // ============================================
  
  // Admin Role
  static const Color adminLight = Color(0xFF7C3AED); // Purple
  static const Color adminDark = Color(0xFF9333EA);
  
  // User Role
  static const Color userLight = Color(0xFF0284C7); // Blue
  static const Color userDark = Color(0xFF0EA5E9);
}
