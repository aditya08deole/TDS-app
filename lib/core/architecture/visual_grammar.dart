import 'package:flutter/material.dart';

/// Consistent visual grammar across the system
/// Colors, icons, shapes have FIXED meanings that never change

class VisualGrammar {
  // Status colors - FIXED meanings
  static const Color statusHealthy = Color(0xFF10B981);
  static const Color statusWarning = Color(0xFFF59E0B);
  static const Color statusCritical = Color(0xFFEF4444);
  static const Color statusOffline = Color(0xFF6B7280);
  static const Color statusUnknown = Color(0xFF9CA3AF);

  // Semantic icons - FIXED meanings
  static const IconData iconHealthy = Icons.check_circle;
  static const IconData iconWarning = Icons.warning_amber;
  static const IconData iconCritical = Icons.error;
  static const IconData iconOffline = Icons.cloud_off;
  static const IconData iconUnknown = Icons.help_outline;
  
  // Action icons - FIXED meanings
  static const IconData iconAcknowledge = Icons.check_circle_outline;
  static const IconData iconEscalate = Icons.arrow_upward;
  static const IconData iconResolve = Icons.task_alt;
  static const IconData iconEdit = Icons.edit_outlined;
  static const IconData iconDelete = Icons.delete_outline;
  static const IconData iconRefresh = Icons.refresh;
  static const IconData iconFilter = Icons.filter_list;
  static const IconData iconSearch = Icons.search;
  static const IconData iconSettings = Icons.settings_outlined;
  static const IconData iconHelp = Icons.help_outline;
  
  // Device type icons - FIXED meanings
  static const IconData iconTank = Icons.water_drop;
  static const IconData iconPipeline = Icons.linear_scale;
  static const IconData iconPump = Icons.water;
  static const IconData iconMeter = Icons.speed;
  static const IconData iconSensor = Icons.sensors;
  
  // Shape meanings
  static const double radiusSmall = 4.0;   // Tags, badges
  static const double radiusMedium = 8.0;  // Cards, inputs
  static const double radiusLarge = 12.0;  // Dialogs, panels
  static const double radiusRound = 999.0; // Pills, avatars
  
  // Motion meanings
  static const Duration durationFast = Duration(milliseconds: 150);
  static const Duration durationMedium = Duration(milliseconds: 300);
  static const Duration durationSlow = Duration(milliseconds: 500);
  
  // Get status color by name (for dynamic access)
  static Color getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'normal':
      case 'ok':
        return statusHealthy;
      case 'warning':
      case 'alert':
        return statusWarning;
      case 'critical':
      case 'error':
      case 'emergency':
        return statusCritical;
      case 'offline':
      case 'disconnected':
        return statusOffline;
      default:
        return statusUnknown;
    }
  }
  
  // Get status icon by name
  static IconData getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'normal':
      case 'ok':
        return iconHealthy;
      case 'warning':
      case 'alert':
        return iconWarning;
      case 'critical':
      case 'error':
      case 'emergency':
        return iconCritical;
      case 'offline':
      case 'disconnected':
        return iconOffline;
      default:
        return iconUnknown;
    }
  }
}

/// Orientation cues - always know where you are
class NavigationContext {
  final String currentSection;
  final String? currentSubsection;
  final List<String> breadcrumbs;
  final String? activeEntityId;
  final String? activeEntityName;

  const NavigationContext({
    required this.currentSection,
    this.currentSubsection,
    this.breadcrumbs = const [],
    this.activeEntityId,
    this.activeEntityName,
  });
}
