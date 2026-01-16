import 'package:flutter/material.dart';

/// System-wide severity classification
/// Determines visual treatment, escalation behavior, and operator urgency
enum SeverityLevel {
  /// Routine information - no action required
  informational,
  
  /// Approaching threshold - awareness required
  warning,
  
  /// Threshold exceeded - intervention recommended
  critical,
  
  /// Safety or service-critical failure - immediate action required
  emergency;

  String get displayName {
    switch (this) {
      case SeverityLevel.informational:
        return 'Informational';
      case SeverityLevel.warning:
        return 'Warning';
      case SeverityLevel.critical:
        return 'Critical';
      case SeverityLevel.emergency:
        return 'Emergency';
    }
  }

  /// Priority ranking (higher = more urgent)
  int get priority {
    switch (this) {
      case SeverityLevel.informational:
        return 0;
      case SeverityLevel.warning:
        return 1;
      case SeverityLevel.critical:
        return 2;
      case SeverityLevel.emergency:
        return 3;
    }
  }

  /// Color coding for calm institutional visibility
  Color getColorForTheme(bool isDark) {
    switch (this) {
      case SeverityLevel.informational:
        return isDark ? const Color(0xFF60A5FA) : const Color(0xFF3B82F6);
      case SeverityLevel.warning:
        return isDark ? const Color(0xFFFBBF24) : const Color(0xFFF59E0B);
      case SeverityLevel.critical:
        return isDark ? const Color(0xFFEF4444) : const Color(0xFFDC2626);
      case SeverityLevel.emergency:
        return isDark ? const Color(0xFFF87171) : const Color(0xFFB91C1C);
    }
  }

  /// Icon representation
  IconData get icon {
    switch (this) {
      case SeverityLevel.informational:
        return Icons.info_outline;
      case SeverityLevel.warning:
        return Icons.warning_amber_outlined;
      case SeverityLevel.critical:
        return Icons.error_outline;
      case SeverityLevel.emergency:
        return Icons.emergency;
    }
  }

  /// Auto-escalate after duration without resolution
  Duration? get autoEscalationDuration {
    switch (this) {
      case SeverityLevel.informational:
        return null; // No auto-escalation
      case SeverityLevel.warning:
        return const Duration(hours: 4);
      case SeverityLevel.critical:
        return const Duration(hours: 1);
      case SeverityLevel.emergency:
        return const Duration(minutes: 30);
    }
  }

  /// Escalate to next severity level
  SeverityLevel? escalate() {
    switch (this) {
      case SeverityLevel.informational:
        return SeverityLevel.warning;
      case SeverityLevel.warning:
        return SeverityLevel.critical;
      case SeverityLevel.critical:
        return SeverityLevel.emergency;
      case SeverityLevel.emergency:
        return null; // Already at max
    }
  }
}
