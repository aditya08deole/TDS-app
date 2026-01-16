import 'package:flutter/material.dart';

/// Data confidence state - explicit trust indicator
/// Never assumes data is reliable - always communicates uncertainty
enum DataConfidence {
  /// Real-time data, recently validated (<30 seconds old)
  liveVerified,
  
  /// Data received but slightly delayed (30s - 2 min)
  delayed,
  
  /// Connection unstable, data arriving sporadically (2-5 min)
  intermittent,
  
  /// No new data for extended period (5-15 min) - showing last known value
  stale,
  
  /// Device offline >15 min, value is historical estimate
  offline,
  
  /// Value calculated/interpolated, not directly measured
  estimated,
  
  /// Sensor showing anomalous behavior (flat-line, implausible jumps)
  unreliable;

  String get displayName {
    switch (this) {
      case DataConfidence.liveVerified:
        return 'Live';
      case DataConfidence.delayed:
        return 'Delayed';
      case DataConfidence.intermittent:
        return 'Intermittent';
      case DataConfidence.stale:
        return 'Stale';
      case DataConfidence.offline:
        return 'Offline';
      case DataConfidence.estimated:
        return 'Estimated';
      case DataConfidence.unreliable:
        return 'Unreliable';
    }
  }

  String get description {
    switch (this) {
      case DataConfidence.liveVerified:
        return 'Real-time data, recently verified';
      case DataConfidence.delayed:
        return 'Data received, slightly delayed';
      case DataConfidence.intermittent:
        return 'Connection unstable, data sporadic';
      case DataConfidence.stale:
        return 'No recent updates, showing last known value';
      case DataConfidence.offline:
        return 'Device offline, historical value shown';
      case DataConfidence.estimated:
        return 'Calculated value, not directly measured';
      case DataConfidence.unreliable:
        return 'Anomalous sensor behavior detected';
    }
  }

  IconData get icon {
    switch (this) {
      case DataConfidence.liveVerified:
        return Icons.check_circle_outline;
      case DataConfidence.delayed:
        return Icons.schedule;
      case DataConfidence.intermittent:
        return Icons.signal_cellular_alt_2_bar;
      case DataConfidence.stale:
        return Icons.update;
      case DataConfidence.offline:
        return Icons.cloud_off_outlined;
      case DataConfidence.estimated:
        return Icons.functions;
      case DataConfidence.unreliable:
        return Icons.warning_amber_outlined;
    }
  }

  /// Color coding for institutional visibility (calm, professional)
  Color getColorForTheme(bool isDark) {
    switch (this) {
      case DataConfidence.liveVerified:
        return isDark ? const Color(0xFF34D399) : const Color(0xFF10B981);
      case DataConfidence.delayed:
        return isDark ? const Color(0xFF60A5FA) : const Color(0xFF3B82F6);
      case DataConfidence.intermittent:
        return isDark ? const Color(0xFFFBBF24) : const Color(0xFFF59E0B);
      case DataConfidence.stale:
        return isDark ? const Color(0xFFFB923C) : const Color(0xFFEA580C);
      case DataConfidence.offline:
        return isDark ? const Color(0xFF9CA3AF) : const Color(0xFF6B7280);
      case DataConfidence.estimated:
        return isDark ? const Color(0xFFA78BFA) : const Color(0xFF8B5CF6);
      case DataConfidence.unreliable:
        return isDark ? const Color(0xFFEF4444) : const Color(0xFFDC2626);
    }
  }

  /// Confidence score (0-100) for incident evaluation
  int get confidenceScore {
    switch (this) {
      case DataConfidence.liveVerified:
        return 100;
      case DataConfidence.delayed:
        return 85;
      case DataConfidence.intermittent:
        return 70;
      case DataConfidence.stale:
        return 50;
      case DataConfidence.offline:
        return 20;
      case DataConfidence.estimated:
        return 60;
      case DataConfidence.unreliable:
        return 30;
    }
  }

  /// Should this confidence level trigger advisory alerts?
  bool get requiresAttention {
    return this == DataConfidence.unreliable ||
        this == DataConfidence.stale ||
        this == DataConfidence.offline;
  }

  /// Determine confidence from data age
  static DataConfidence fromDataAge(Duration age) {
    if (age.inSeconds < 30) {
      return DataConfidence.liveVerified;
    } else if (age.inMinutes < 2) {
      return DataConfidence.delayed;
    } else if (age.inMinutes < 5) {
      return DataConfidence.intermittent;
    } else if (age.inMinutes < 15) {
      return DataConfidence.stale;
    } else {
      return DataConfidence.offline;
    }
  }
}
