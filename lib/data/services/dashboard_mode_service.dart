import '../../domain/entities/dashboard_state.dart';
import '../../domain/entities/incident.dart';
import '../../domain/entities/severity_level.dart';
import '../../domain/entities/incident_state.dart';
import '../../domain/entities/audit_entry.dart';
import 'package:uuid/uuid.dart';

/// Service for managing dashboard operational mode
/// Handles automatic and manual transitions between normal/alert/emergency
class DashboardModeService {
  final _uuid = const Uuid();

  /// Evaluate if dashboard should transition modes based on incidents
  /// Returns new dashboard state if transition needed
  DashboardState? evaluateModeTransition({
    required DashboardState currentState,
    required List<Incident> activeIncidents,
  }) {
    // Get highest severity active incident
    final criticalIncidents = activeIncidents
        .where((i) => i.state.isActive)
        .where((i) => i.severity == SeverityLevel.emergency || 
                     i.severity == SeverityLevel.critical)
        .toList();

    if (criticalIncidents.isEmpty) {
      // No critical incidents - return to normal
      if (currentState.mode != DashboardMode.normal) {
        return DashboardState(
          mode: DashboardMode.normal,
          modeActivatedAt: DateTime.now(),
          isAutomatic: true,
        );
      }
      return null; // Already in correct state
    }

    // Find most severe incident
    criticalIncidents.sort((a, b) => 
      b.severity.priority.compareTo(a.severity.priority));
    
    final primaryIncident = criticalIncidents.first;
    final relatedIds = criticalIncidents
        .skip(1)
        .map((i) => i.id)
        .toList();

    // Determine required mode
    final requiredMode = primaryIncident.severity == SeverityLevel.emergency
        ? DashboardMode.emergency
        : DashboardMode.alert;

    // Check if transition needed
    if (currentState.mode != requiredMode ||
        currentState.activeIncidentId != primaryIncident.id) {
      return DashboardState(
        mode: requiredMode,
        activeIncidentId: primaryIncident.id,
        relatedIncidentIds: relatedIds,
        modeActivatedAt: DateTime.now(),
        isAutomatic: true,
      );
    }

    return null; // No change needed
  }

  /// Manually activate emergency mode (Admin only)
  /// Returns new state and audit entry
  ({DashboardState state, AuditEntry auditEntry}) activateEmergencyMode({
    required String incidentId,
    required String activatedBy,
    required String userRole,
    List<String>? relatedIncidentIds,
  }) {
    final state = DashboardState(
      mode: DashboardMode.emergency,
      activeIncidentId: incidentId,
      relatedIncidentIds: relatedIncidentIds ?? [],
      modeActivatedAt: DateTime.now(),
      activatedBy: activatedBy,
      isAutomatic: false,
    );

    final audit = AuditEntry(
      id: _uuid.v4(),
      timestamp: DateTime.now(),
      performedBy: activatedBy,
      userRole: userRole,
      actionType: AuditActionType.incidentEscalated,
      action: 'Manually activated Emergency Mode',
      targetEntityType: 'incident',
      targetEntityId: incidentId,
      notes: 'Emergency mode manually triggered by operator',
    );

    return (state: state, auditEntry: audit);
  }

  /// Manually deactivate emergency mode (Admin only)
  /// Returns new state and audit entry
  ({DashboardState state, AuditEntry auditEntry}) deactivateEmergencyMode({
    required DashboardState currentState,
    required String deactivatedBy,
    required String userRole,
    required String reason,
  }) {
    final state = DashboardState(
      mode: DashboardMode.normal,
      modeActivatedAt: DateTime.now(),
      isAutomatic: false,
    );

    final audit = AuditEntry(
      id: _uuid.v4(),
      timestamp: DateTime.now(),
      performedBy: deactivatedBy,
      userRole: userRole,
      actionType: AuditActionType.incidentResolved,
      action: 'Manually deactivated Emergency Mode',
      targetEntityType: 'incident',
      targetEntityId: currentState.activeIncidentId,
      notes: 'Emergency mode deactivated: $reason',
    );

    return (state: state, auditEntry: audit);
  }

  /// Check if emergency mode should auto-deactivate
  /// Based on incident resolution or time limits
  bool shouldAutoDeactivate({
    required DashboardState currentState,
    required List<Incident> activeIncidents,
  }) {
    if (currentState.mode != DashboardMode.emergency) return false;
    if (!currentState.isAutomatic) return false; // Manual mode, don't auto-exit

    // Check if primary incident is resolved
    if (currentState.activeIncidentId != null) {
      final primaryIncident = activeIncidents.firstWhere(
        (i) => i.id == currentState.activeIncidentId,
        orElse: () => throw StateError('Primary incident not found'),
      );

      // Deactivate if incident resolved or improving for >30 min
      if (primaryIncident.state == IncidentState.resolved ||
          primaryIncident.state == IncidentState.closed) {
        return true;
      }

      if (primaryIncident.state == IncidentState.improving &&
          primaryIncident.trend == IncidentTrend.improving) {
        final improvingDuration = DateTime.now()
            .difference(primaryIncident.lastUpdated);
        if (improvingDuration.inMinutes > 30) {
          return true;
        }
      }
    }

    return false;
  }

  /// Generate operator guidance for current mode
  String getModeGuidance(DashboardMode mode) {
    switch (mode) {
      case DashboardMode.normal:
        return 'All systems operating normally. Continue routine monitoring.';
      case DashboardMode.alert:
        return 'Alert condition detected. Review incidents and take appropriate action.';
      case DashboardMode.emergency:
        return 'Emergency mode active. Focus on critical incident resolution. Non-essential features hidden.';
    }
  }

  /// Get recommended actions for mode transition
  List<String> getTransitionActions(DashboardMode mode) {
    switch (mode) {
      case DashboardMode.normal:
        return ['Resume standard monitoring procedures'];
      case DashboardMode.alert:
        return [
          'Review active alerts',
          'Verify sensor readings',
          'Monitor trend progression',
          'Prepare for escalation if needed',
        ];
      case DashboardMode.emergency:
        return [
          'Acknowledge critical incident',
          'Verify physical site conditions',
          'Contact relevant personnel',
          'Implement response procedures',
          'Document all actions taken',
        ];
    }
  }
}
