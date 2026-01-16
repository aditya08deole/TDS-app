/// Time context mode for operational analytics
/// Defines the temporal scope of data being viewed
enum TimeContextMode {
  /// Real-time, continuously updating
  live,
  
  /// Last 15 minutes
  recent15min,
  
  /// Last hour
  recent1hour,
  
  /// Last 24 hours (operational view)
  operational24hr,
  
  /// Last 7 days
  weekly,
  
  /// Custom time range
  custom;

  String get displayName {
    switch (this) {
      case TimeContextMode.live:
        return 'Live';
      case TimeContextMode.recent15min:
        return 'Last 15 min';
      case TimeContextMode.recent1hour:
        return 'Last 1 hour';
      case TimeContextMode.operational24hr:
        return 'Last 24 hours';
      case TimeContextMode.weekly:
        return 'Last 7 days';
      case TimeContextMode.custom:
        return 'Custom Range';
    }
  }

  /// Get duration for this mode (null for custom)
  Duration? get duration {
    switch (this) {
      case TimeContextMode.live:
        return null; // Continuous
      case TimeContextMode.recent15min:
        return const Duration(minutes: 15);
      case TimeContextMode.recent1hour:
        return const Duration(hours: 1);
      case TimeContextMode.operational24hr:
        return const Duration(hours: 24);
      case TimeContextMode.weekly:
        return const Duration(days: 7);
      case TimeContextMode.custom:
        return null; // User-defined
    }
  }

  /// Should data auto-refresh in this mode?
  bool get autoRefresh {
    return this == TimeContextMode.live || 
           this == TimeContextMode.recent15min ||
           this == TimeContextMode.recent1hour;
  }

  /// Refresh interval (null if no auto-refresh)
  Duration? get refreshInterval {
    switch (this) {
      case TimeContextMode.live:
        return const Duration(seconds: 5);
      case TimeContextMode.recent15min:
        return const Duration(seconds: 15);
      case TimeContextMode.recent1hour:
        return const Duration(seconds: 30);
      default:
        return null;
    }
  }
}

/// Time context state for dashboard-wide time awareness
class TimeContext {
  final TimeContextMode mode;
  final DateTime? customStart;
  final DateTime? customEnd;
  final DateTime lastUpdated;

  const TimeContext({
    required this.mode,
    this.customStart,
    this.customEnd,
    required this.lastUpdated,
  });

  /// Get effective start time for queries
  DateTime get effectiveStart {
    if (mode == TimeContextMode.custom && customStart != null) {
      return customStart!;
    }
    final duration = mode.duration;
    if (duration == null) {
      return DateTime.now().subtract(const Duration(hours: 1)); // Default
    }
    return DateTime.now().subtract(duration);
  }

  /// Get effective end time for queries
  DateTime get effectiveEnd {
    if (mode == TimeContextMode.custom && customEnd != null) {
      return customEnd!;
    }
    return DateTime.now();
  }

  TimeContext copyWith({
    TimeContextMode? mode,
    DateTime? customStart,
    DateTime? customEnd,
    DateTime? lastUpdated,
  }) {
    return TimeContext(
      mode: mode ?? this.mode,
      customStart: customStart ?? this.customStart,
      customEnd: customEnd ?? this.customEnd,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }
}
