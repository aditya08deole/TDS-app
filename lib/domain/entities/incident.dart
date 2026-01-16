import 'package:flutter/material.dart';
import 'severity_level.dart';
import 'incident_state.dart';
import 'package:latlong2/latlong.dart';

/// Incident entity - represents a single underlying problem
/// Aggregates related alerts, tracks lifecycle, provides decision support
class Incident {
  final String id;
  final String title; // Plain language: "Water quality unsafe at Tank B"
  final String description; // Detailed context
  final SeverityLevel severity;
  final IncidentState state;
  
  // Affected assets
  final List<String> affectedDeviceIds;
  final List<String> affectedLocationIds;
  final LatLng? primaryLocation; // For map centering
  
  // Temporal context
  final DateTime detectedAt;
  final DateTime? acknowledgedAt;
  final DateTime? resolvedAt;
  final DateTime? closedAt;
  final DateTime lastUpdated;
  
  // Trend analysis
  final IncidentTrend trend; // worsening, stable, improving
  final double? currentValue; // Current metric value
  final double? thresholdValue; // Threshold that was breached
  final String? metricUnit; // 'ppm', '°C', etc.
  
  // Operator context
  final String? acknowledgedBy;
  final List<IncidentAction> actions; // History of actions taken
  final String? recommendedAction; // System guidance
  final int confidenceLevel; // 0-100, data reliability indicator
  
  // Escalation
  final SeverityLevel? originalSeverity;
  final DateTime? lastEscalatedAt;
  final int escalationCount;
  
  // Grouping
  final List<String> relatedAlertIds; // Source alerts
  final String? parentIncidentId; // If this is a sub-incident

  const Incident({
    required this.id,
    required this.title,
    required this.description,
    required this.severity,
    required this.state,
    required this.affectedDeviceIds,
    required this.affectedLocationIds,
    this.primaryLocation,
    required this.detectedAt,
    this.acknowledgedAt,
    this.resolvedAt,
    this.closedAt,
    required this.lastUpdated,
    required this.trend,
    this.currentValue,
    this.thresholdValue,
    this.metricUnit,
    this.acknowledgedBy,
    this.actions = const [],
    this.recommendedAction,
    this.confidenceLevel = 100,
    this.originalSeverity,
    this.lastEscalatedAt,
    this.escalationCount = 0,
    this.relatedAlertIds = const [],
    this.parentIncidentId,
  });

  /// Duration since detection
  Duration get elapsedTime => DateTime.now().difference(detectedAt);

  /// Human-readable elapsed time
  String get elapsedTimeString {
    final duration = elapsedTime;
    if (duration.inMinutes < 60) {
      return '${duration.inMinutes} minutes ago';
    } else if (duration.inHours < 24) {
      return '${duration.inHours} hours ago';
    } else {
      return '${duration.inDays} days ago';
    }
  }

  /// Check if incident should auto-escalate
  bool shouldEscalate() {
    if (state == IncidentState.resolved || state == IncidentState.closed) {
      return false;
    }
    
    final escalationDuration = severity.autoEscalationDuration;
    if (escalationDuration == null) return false;
    
    final timeSinceLastEscalation = lastEscalatedAt != null
        ? DateTime.now().difference(lastEscalatedAt!)
        : elapsedTime;
    
    return timeSinceLastEscalation >= escalationDuration;
  }

  Incident copyWith({
    String? id,
    String? title,
    String? description,
    SeverityLevel? severity,
    IncidentState? state,
    List<String>? affectedDeviceIds,
    List<String>? affectedLocationIds,
    LatLng? primaryLocation,
    DateTime? detectedAt,
    DateTime? acknowledgedAt,
    DateTime? resolvedAt,
    DateTime? closedAt,
    DateTime? lastUpdated,
    IncidentTrend? trend,
    double? currentValue,
    double? thresholdValue,
    String? metricUnit,
    String? acknowledgedBy,
    List<IncidentAction>? actions,
    String? recommendedAction,
    int? confidenceLevel,
    SeverityLevel? originalSeverity,
    DateTime? lastEscalatedAt,
    int? escalationCount,
    List<String>? relatedAlertIds,
    String? parentIncidentId,
  }) {
    return Incident(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      severity: severity ?? this.severity,
      state: state ?? this.state,
      affectedDeviceIds: affectedDeviceIds ?? this.affectedDeviceIds,
      affectedLocationIds: affectedLocationIds ?? this.affectedLocationIds,
      primaryLocation: primaryLocation ?? this.primaryLocation,
      detectedAt: detectedAt ?? this.detectedAt,
      acknowledgedAt: acknowledgedAt ?? this.acknowledgedAt,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      closedAt: closedAt ?? this.closedAt,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      trend: trend ?? this.trend,
      currentValue: currentValue ?? this.currentValue,
      thresholdValue: thresholdValue ?? this.thresholdValue,
      metricUnit: metricUnit ?? this.metricUnit,
      acknowledgedBy: acknowledgedBy ?? this.acknowledgedBy,
      actions: actions ?? this.actions,
      recommendedAction: recommendedAction ?? this.recommendedAction,
      confidenceLevel: confidenceLevel ?? this.confidenceLevel,
      originalSeverity: originalSeverity ?? this.originalSeverity,
      lastEscalatedAt: lastEscalatedAt ?? this.lastEscalatedAt,
      escalationCount: escalationCount ?? this.escalationCount,
      relatedAlertIds: relatedAlertIds ?? this.relatedAlertIds,
      parentIncidentId: parentIncidentId ?? this.parentIncidentId,
    );
  }
}

/// Trend direction for incident progression
enum IncidentTrend {
  worsening,
  stable,
  improving;

  String get displayName {
    switch (this) {
      case IncidentTrend.worsening:
        return 'Worsening';
      case IncidentTrend.stable:
        return 'Stable';
      case IncidentTrend.improving:
        return 'Improving';
    }
  }

  IconData get icon {
    switch (this) {
      case IncidentTrend.worsening:
        return Icons.trending_up;
      case IncidentTrend.stable:
        return Icons.trending_flat;
      case IncidentTrend.improving:
        return Icons.trending_down;
    }
  }
}

/// Action taken by operator during incident
class IncidentAction {
  final String id;
  final DateTime timestamp;
  final String performedBy;
  final String action; // "Acknowledged", "Verified sensor", etc.
  final String? notes;

  const IncidentAction({
    required this.id,
    required this.timestamp,
    required this.performedBy,
    required this.action,
    this.notes,
  });
}
