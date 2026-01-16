import 'package:flutter/material.dart';

/// Responsive breakpoints following web design standards
/// Optimized for desktop-first design while supporting smaller screens
class ResponsiveBreakpoints {
  // Screen size breakpoints
  static const double mobile = 480;
  static const double tablet = 768;
  static const double desktop = 1024;
  static const double desktopLarge = 1440;
  static const double desktopXL = 1920;

  // Helper methods
  static bool isMobile(BuildContext context) =>
      MediaQuery.of(context).size.width < tablet;

  static bool isTablet(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return width >= tablet && width < desktop;
  }

  static bool isDesktop(BuildContext context) =>
      MediaQuery.of(context).size.width >= desktop;

  static bool isDesktopLarge(BuildContext context) =>
      MediaQuery.of(context).size.width >= desktopLarge;

  static bool isDesktopXL(BuildContext context) =>
      MediaQuery.of(context).size.width >= desktopXL;

  /// Get current device type
  static DeviceType getDeviceType(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < tablet) return DeviceType.mobile;
    if (width < desktop) return DeviceType.tablet;
    if (width < desktopLarge) return DeviceType.desktop;
    if (width < desktopXL) return DeviceType.desktopLarge;
    return DeviceType.desktopXL;
  }

  /// Get responsive value based on screen size
  static T responsive<T>(
    BuildContext context, {
    required T mobile,
    T? tablet,
    T? desktop,
    T? desktopLarge,
    T? desktopXL,
  }) {
    final width = MediaQuery.of(context).size.width;
    if (width >= ResponsiveBreakpoints.desktopXL && desktopXL != null) {
      return desktopXL;
    }
    if (width >= ResponsiveBreakpoints.desktopLarge && desktopLarge != null) {
      return desktopLarge;
    }
    if (width >= ResponsiveBreakpoints.desktop && desktop != null) {
      return desktop;
    }
    if (width >= ResponsiveBreakpoints.tablet && tablet != null) {
      return tablet;
    }
    return mobile;
  }

  /// Get number of columns for grid layouts
  static int getGridColumns(BuildContext context) {
    return responsive<int>(
      context,
      mobile: 1,
      tablet: 2,
      desktop: 3,
      desktopLarge: 4,
      desktopXL: 5,
    );
  }

  /// Get sidebar width
  static double getSidebarWidth(BuildContext context) {
    return responsive<double>(
      context,
      mobile: 0,
      tablet: 72,
      desktop: 240,
      desktopLarge: 280,
    );
  }

  /// Get content max width for readability
  static double getContentMaxWidth(BuildContext context) {
    return responsive<double>(
      context,
      mobile: double.infinity,
      tablet: 720,
      desktop: 960,
      desktopLarge: 1200,
      desktopXL: 1400,
    );
  }

  /// Get horizontal padding
  static double getHorizontalPadding(BuildContext context) {
    return responsive<double>(
      context,
      mobile: 16,
      tablet: 24,
      desktop: 32,
      desktopLarge: 48,
      desktopXL: 64,
    );
  }
}

/// Device type enumeration
enum DeviceType {
  mobile,
  tablet,
  desktop,
  desktopLarge,
  desktopXL,
}

/// Extension on DeviceType for convenience
extension DeviceTypeExtension on DeviceType {
  bool get isMobile => this == DeviceType.mobile;
  bool get isTablet => this == DeviceType.tablet;
  bool get isDesktop =>
      this == DeviceType.desktop ||
      this == DeviceType.desktopLarge ||
      this == DeviceType.desktopXL;
}
