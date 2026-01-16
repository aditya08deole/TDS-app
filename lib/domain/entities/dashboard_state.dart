import 'package:flutter/material.dart';

/// Dashboard operational mode
/// Defines the UI state and information hierarchy
enum DashboardMode {
  /// Normal monitoring - all features visible
  normal,
  
  /// Incident detected but not critical - minimal UI changes
  alert,
  
  /// Critical incident - simplified emergency UI activated
  emergency;

  String get displayName {
    switch (this) {
      case DashboardMode.normal:
        return 'Normal Operations';
      case DashboardMode.alert:
        return 'Alert Mode';
      case DashboardMode.emergency:
        return 'Emergency Mode';
    }
  }

  IconData get icon {
    switch (this) {
      case DashboardMode.normal:
        return Icons.check_circle_outline;
      case DashboardMode.alert:
        return Icons.warning_amber_outlined;
      case DashboardMode.emergency:
        return Icons.emergency;
    }
  }

  /// Background color coding for mode awareness
  Color getBackgroundTint(bool isDark) {
    switch (this) {
      case DashboardMode.normal:
        return Colors.transparent;
      case DashboardMode.alert:
        return isDark 
            ? const Color(0xFFFBBF24).withOpacity(0.03)
            : const Color(0xFFF59E0B).withOpacity(0.03);
      case DashboardMode.emergency:
        return isDark
            ? const Color(0xFFEF4444).withOpacity(0.05)
            : const Color(0xFFDC2626).withOpacity(0.05);
    }
  }

  /// Should navigation be simplified in this mode?
  bool get simplifyNavigation => this == DashboardMode.emergency;

  /// Should analytics/historical views be hidden?
  bool get hideNonEssential => this == DashboardMode.emergency;

  /// Should map auto-focus on incidents?
  bool get autoFocusIncidents => this != DashboardMode.normal;
}

/// Dashboard operational state
/// Tracks current mode and provides transition logic
class DashboardState {
  final DashboardMode mode;
  final String? activeIncidentId; // Primary incident if in emergency mode
  final List<String> relatedIncidentIds; // Related incidents
  final DateTime? modeActivatedAt;
  final String? activatedBy; // User who manually triggered emergency mode
  final bool isAutomatic; // Was mode triggered automatically?

  const DashboardState({
    required this.mode,
    this.activeIncidentId,
    this.relatedIncidentIds = const [],
    this.modeActivatedAt,
    this.activatedBy,
    this.isAutomatic = false,
  });

  /// Duration in current mode
  Duration? get timeInMode {
    if (modeActivatedAt == null) return null;
    return DateTime.now().difference(modeActivatedAt!);
  }

  DashboardState copyWith({
    DashboardMode? mode,
    String? activeIncidentId,
    List<String>? relatedIncidentIds,
    DateTime? modeActivatedAt,
    String? activatedBy,
    bool? isAutomatic,
  }) {
    return DashboardState(
      mode: mode ?? this.mode,
      activeIncidentId: activeIncidentId ?? this.activeIncidentId,
      relatedIncidentIds: relatedIncidentIds ?? this.relatedIncidentIds,
      modeActivatedAt: modeActivatedAt ?? this.modeActivatedAt,
      activatedBy: activatedBy ?? this.activatedBy,
      isAutomatic: isAutomatic ?? this.isAutomatic,
    );
  }
}
