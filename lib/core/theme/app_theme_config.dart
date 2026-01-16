import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_color_system.dart';
import 'design_tokens.dart';

/// Enterprise-grade theme configuration
/// Supports both Dark Mode (control room) and Light Mode (reporting)
class AppThemeConfig {
  /// Dark Theme - Optimized for nighttime operations and low-light environments
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      
      // Color Scheme
      scaffoldBackgroundColor: AppColorSystem.darkBackground,
      colorScheme: const ColorScheme.dark(
        brightness: Brightness.dark,
        primary: AppColorSystem.primaryDark,
        onPrimary: Colors.black,
        secondary: AppColorSystem.secondaryDark,
        onSecondary: Colors.black,
        error: AppColorSystem.criticalDark,
        onError: Colors.white,
        surface: AppColorSystem.darkSurface,
        onSurface: AppColorSystem.darkTextPrimary,
        surfaceContainerHighest: AppColorSystem.darkSurfaceElevated,
        outline: AppColorSystem.darkBorder,
        outlineVariant: AppColorSystem.darkDivider,
      ),
      
      // Typography
      textTheme: _buildTextTheme(Brightness.dark),
      
      // Card Theme
      cardTheme: CardThemeData(
        elevation: DesignTokens.elevationNone,
        color: AppColorSystem.darkSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          side: const BorderSide(
            color: AppColorSystem.darkBorder,
            width: 1,
          ),
        ),
      ),
      
      // App Bar Theme
      appBarTheme: AppBarTheme(
        elevation: DesignTokens.elevationNone,
        backgroundColor: AppColorSystem.darkBackgroundElevated,
        foregroundColor: AppColorSystem.darkTextPrimary,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.inter(
          fontSize: DesignTokens.fontSizeLg,
          fontWeight: DesignTokens.fontWeightSemiBold,
          color: AppColorSystem.darkTextPrimary,
        ),
      ),
      
      // Input Decoration Theme
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColorSystem.darkSurfaceElevated,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          borderSide: const BorderSide(color: AppColorSystem.darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          borderSide: const BorderSide(color: AppColorSystem.darkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          borderSide: const BorderSide(color: AppColorSystem.primaryDark, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          borderSide: const BorderSide(color: AppColorSystem.criticalDark),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: DesignTokens.space16,
          vertical: DesignTokens.space16,
        ),
      ),
      
      // Elevated Button Theme
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: DesignTokens.elevationNone,
          backgroundColor: AppColorSystem.primaryDark,
          foregroundColor: Colors.black,
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.space24,
            vertical: DesignTokens.space16,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: DesignTokens.fontSizeMd,
            fontWeight: DesignTokens.fontWeightSemiBold,
          ),
        ),
      ),
      
      // Outlined Button Theme
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColorSystem.primaryDark,
          side: const BorderSide(color: AppColorSystem.primaryDark),
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.space24,
            vertical: DesignTokens.space16,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          ),
        ),
      ),
      
      // Divider Theme
      dividerTheme: const DividerThemeData(
        color: AppColorSystem.darkDivider,
        thickness: 1,
      ),
      
      // Bottom Navigation Bar Theme
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColorSystem.darkBackgroundElevated,
        selectedItemColor: AppColorSystem.primaryDark,
        unselectedItemColor: AppColorSystem.darkTextTertiary,
        type: BottomNavigationBarType.fixed,
        elevation: DesignTokens.elevationNone,
      ),
      
      // Icon Theme
      iconTheme: const IconThemeData(
        color: AppColorSystem.darkTextSecondary,
      ),
    );
  }
  
  /// Light Theme - Optimized for daytime operations and reporting
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      
      // Color Scheme
      scaffoldBackgroundColor: AppColorSystem.lightBackground,
      colorScheme: const ColorScheme.light(
        brightness: Brightness.light,
        primary: AppColorSystem.primaryLight,
        onPrimary: Colors.white,
        secondary: AppColorSystem.secondaryLight,
        onSecondary: Colors.white,
        error: AppColorSystem.criticalLight,
        onError: Colors.white,
        surface: AppColorSystem.lightSurface,
        onSurface: AppColorSystem.lightTextPrimary,
        surfaceContainerHighest: AppColorSystem.lightSurfaceElevated,
        outline: AppColorSystem.lightBorder,
        outlineVariant: AppColorSystem.lightDivider,
      ),
      
      // Typography
      textTheme: _buildTextTheme(Brightness.light),
      
      // Card Theme
      cardTheme: CardThemeData(
        elevation: DesignTokens.elevationXs,
        color: AppColorSystem.lightSurface,
        shadowColor: Colors.black.withOpacity(0.05),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          side: const BorderSide(
            color: AppColorSystem.lightBorder,
            width: 1,
          ),
        ),
      ),
      
      // App Bar Theme
      appBarTheme: AppBarTheme(
        elevation: DesignTokens.elevationNone,
        backgroundColor: AppColorSystem.lightBackgroundElevated,
        foregroundColor: AppColorSystem.lightTextPrimary,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.inter(
          fontSize: DesignTokens.fontSizeLg,
          fontWeight: DesignTokens.fontWeightSemiBold,
          color: AppColorSystem.lightTextPrimary,
        ),
      ),
      
      // Input Decoration Theme
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColorSystem.lightSurfaceElevated,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          borderSide: const BorderSide(color: AppColorSystem.lightBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          borderSide: const BorderSide(color: AppColorSystem.lightBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          borderSide: const BorderSide(color: AppColorSystem.primaryLight, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          borderSide: const BorderSide(color: AppColorSystem.criticalLight),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: DesignTokens.space16,
          vertical: DesignTokens.space16,
        ),
      ),
      
      // Elevated Button Theme
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: DesignTokens.elevationXs,
          backgroundColor: AppColorSystem.primaryLight,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.space24,
            vertical: DesignTokens.space16,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: DesignTokens.fontSizeMd,
            fontWeight: DesignTokens.fontWeightSemiBold,
          ),
        ),
      ),
      
      // Outlined Button Theme
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColorSystem.primaryLight,
          side: const BorderSide(color: AppColorSystem.primaryLight),
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.space24,
            vertical: DesignTokens.space16,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
          ),
        ),
      ),
      
      // Divider Theme
      dividerTheme: const DividerThemeData(
        color: AppColorSystem.lightDivider,
        thickness: 1,
      ),
      
      // Bottom Navigation Bar Theme
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColorSystem.lightBackgroundElevated,
        selectedItemColor: AppColorSystem.primaryLight,
        unselectedItemColor: AppColorSystem.lightTextTertiary,
        type: BottomNavigationBarType.fixed,
        elevation: DesignTokens.elevationSm,
      ),
      
      // Icon Theme
      iconTheme: const IconThemeData(
        color: AppColorSystem.lightTextSecondary,
      ),
    );
  }
  
  /// Build text theme for given brightness
  static TextTheme _buildTextTheme(Brightness brightness) {
    final textColor = brightness == Brightness.dark 
        ? AppColorSystem.darkTextPrimary 
        : AppColorSystem.lightTextPrimary;
    final secondaryColor = brightness == Brightness.dark 
        ? AppColorSystem.darkTextSecondary 
        : AppColorSystem.lightTextSecondary;
    
    return TextTheme(
      // Display styles (Orbitron for headings)
      displayLarge: GoogleFonts.orbitron(
        fontSize: DesignTokens.fontSize6xl,
        fontWeight: DesignTokens.fontWeightBold,
        color: textColor,
        height: DesignTokens.lineHeightTight,
      ),
      displayMedium: GoogleFonts.orbitron(
        fontSize: DesignTokens.fontSize5xl,
        fontWeight: DesignTokens.fontWeightBold,
        color: textColor,
        height: DesignTokens.lineHeightTight,
      ),
      displaySmall: GoogleFonts.orbitron(
        fontSize: DesignTokens.fontSize4xl,
        fontWeight: DesignTokens.fontWeightSemiBold,
        color: textColor,
        height: DesignTokens.lineHeightTight,
      ),
      
      // Headline styles
      headlineLarge: GoogleFonts.inter(
        fontSize: DesignTokens.fontSize3xl,
        fontWeight: DesignTokens.fontWeightSemiBold,
        color: textColor,
        height: DesignTokens.lineHeightTight,
      ),
      headlineMedium: GoogleFonts.inter(
        fontSize: DesignTokens.fontSize2xl,
        fontWeight: DesignTokens.fontWeightSemiBold,
        color: textColor,
        height: DesignTokens.lineHeightTight,
      ),
      headlineSmall: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeXl,
        fontWeight: DesignTokens.fontWeightSemiBold,
        color: textColor,
        height: DesignTokens.lineHeightNormal,
      ),
      
      // Title styles
      titleLarge: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeLg,
        fontWeight: DesignTokens.fontWeightSemiBold,
        color: textColor,
        height: DesignTokens.lineHeightNormal,
      ),
      titleMedium: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeMd,
        fontWeight: DesignTokens.fontWeightMedium,
        color: textColor,
        height: DesignTokens.lineHeightNormal,
      ),
      titleSmall: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeBase,
        fontWeight: DesignTokens.fontWeightMedium,
        color: textColor,
        height: DesignTokens.lineHeightNormal,
      ),
      
      // Body styles
      bodyLarge: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeMd,
        fontWeight: DesignTokens.fontWeightNormal,
        color: secondaryColor,
        height: DesignTokens.lineHeightNormal,
      ),
      bodyMedium: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeBase,
        fontWeight: DesignTokens.fontWeightNormal,
        color: secondaryColor,
        height: DesignTokens.lineHeightNormal,
      ),
      bodySmall: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeSm,
        fontWeight: DesignTokens.fontWeightNormal,
        color: secondaryColor,
        height: DesignTokens.lineHeightNormal,
      ),
      
      // Label styles
      labelLarge: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeBase,
        fontWeight: DesignTokens.fontWeightSemiBold,
        color: textColor,
        height: DesignTokens.lineHeightNormal,
      ),
      labelMedium: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeSm,
        fontWeight: DesignTokens.fontWeightSemiBold,
        color: textColor,
        height: DesignTokens.lineHeightNormal,
      ),
      labelSmall: GoogleFonts.inter(
        fontSize: DesignTokens.fontSizeXs,
        fontWeight: DesignTokens.fontWeightSemiBold,
        color: textColor,
        height: DesignTokens.lineHeightNormal,
      ),
    );
  }
}
