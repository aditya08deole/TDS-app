import '../../domain/entities/incident.dart';
import '../../domain/entities/alert.dart';
import '../../domain/entities/incident_state.dart';
import '../../domain/entities/tds_device.dart';
import 'package:uuid/uuid.dart';

/// Intelligent incident management service
/// Aggregates alerts into incidents, manages lifecycle, handles escalation
class IncidentService {
  final _uuid = const Uuid();

  /// Analyze new alert and determine if it should:
  /// 1. Create a new incident
  /// 2. Join an existing incident
  /// 3. Update an existing incident's severity
  Future<Incident?> processAlert({
    required Alert alert,
    required List<Incident> existingIncidents,
    required TDSDevice device,
  }) async {
    // Check if this alert can be grouped with existing incidents
    final relatedIncident = _findRelatedIncident(
      alert: alert,
      incidents: existingIncidents,
    );

    if (relatedIncident != null) {
      // Update existing incident
      return _updateIncidentWithAlert(relatedIncident, alert);
    } else {
      // Create new incident
      return _createIncidentFromAlert(alert, device);
    }
  }

  /// Find existing incident that this alert should join
  Incident? _findRelatedIncident({
    required Alert alert,
    required List<Incident> incidents,
  }) {
    // Find active incidents affecting the same device
    for (final incident in incidents) {
      if (!incident.state.isActive) continue;

      // Same device, recent incident (< 1 hour between alerts)
      if (incident.affectedDeviceIds.contains(alert.deviceId)) {
        final timeSinceLastUpdate =
            DateTime.now().difference(incident.lastUpdated);
        if (timeSinceLastUpdate.inMinutes < 60) {
          return incident;
        }
      }
    }

    return null;
  }

  /// Create new incident from alert
  Incident _createIncidentFromAlert(Alert alert, TDSDevice device) {
    final title = _generateIncidentTitle(alert, device);
    final description = _generateIncidentDescription(alert, device);
    final recommendedAction = _generateRecommendedAction(alert);

    return Incident(
      id: _uuid.v4(),
      title: title,
      description: description,
      severity: alert.severity,
      state: IncidentState.detected,
      affectedDeviceIds: [alert.deviceId],
      affectedLocationIds: device.locationId != null ? [device.locationId!] : [],
      primaryLocation: device.coordinates,
      detectedAt: alert.timestamp,
      lastUpdated: DateTime.now(),
      trend: IncidentTrend.stable,
      currentValue: alert.value,
      thresholdValue: alert.threshold,
      metricUnit: alert.metricUnit,
      recommendedAction: recommendedAction,
      confidenceLevel: _calculateConfidenceLevel(alert, device),
      relatedAlertIds: [alert.id],
    );
  }

  /// Update existing incident with new alert
  Incident _updateIncidentWithAlert(Incident incident, Alert alert) {
    // Determine if severity should increase
    final newSeverity = alert.severity.priority > incident.severity.priority
        ? alert.severity
        : incident.severity;

    // Update trend based on alert value
    IncidentTrend newTrend = incident.trend;
    if (alert.value != null && incident.currentValue != null) {
      if (alert.value! > incident.currentValue!) {
        newTrend = IncidentTrend.worsening;
      } else if (alert.value! < incident.currentValue!) {
        newTrend = IncidentTrend.improving;
      }
    }

    // Add alert to related alerts
    final updatedAlertIds = [...incident.relatedAlertIds, alert.id];

    return incident.copyWith(
      severity: newSeverity,
      trend: newTrend,
      currentValue: alert.value,
      lastUpdated: DateTime.now(),
      relatedAlertIds: updatedAlertIds,
    );
  }

  /// Generate human-readable incident title
  String _generateIncidentTitle(Alert alert, TDSDevice device) {
    switch (alert.type) {
      case AlertType.thresholdExceeded:
        return '${alert.metricName ?? "Value"} unsafe at ${device.location}';
      case AlertType.deviceOffline:
        return 'Device offline at ${device.location}';
      case AlertType.dataStale:
        return 'Data stale at ${device.location}';
      case AlertType.sensorFault:
        return 'Sensor fault at ${device.location}';
      case AlertType.communicationLoss:
        return 'Communication lost with ${device.location}';
      default:
        return 'Issue detected at ${device.location}';
    }
  }

  /// Generate detailed incident description
  String _generateIncidentDescription(Alert alert, TDSDevice device) {
    final buffer = StringBuffer();
    buffer.write('${alert.type.displayName} detected. ');

    if (alert.value != null && alert.threshold != null) {
      buffer.write(
        'Current value: ${alert.value!.toStringAsFixed(1)}${alert.metricUnit ?? ""}, '
        'Threshold: ${alert.threshold!.toStringAsFixed(1)}${alert.metricUnit ?? ""}. ',
      );
    }

    buffer.write('Device: ${device.name} (${device.deviceIdentifier ?? device.id})');

    return buffer.toString();
  }

  /// Generate action guidance
  String _generateRecommendedAction(Alert alert) {
    switch (alert.type) {
      case AlertType.thresholdExceeded:
        return 'Verify sensor accuracy. Inspect water source. Notify maintenance if confirmed.';
      case AlertType.deviceOffline:
        return 'Check device power and network connectivity. Inspect physical installation.';
      case AlertType.dataStale:
        return 'Verify network connection. Check device status. Review last known reading.';
      case AlertType.sensorFault:
        return 'Inspect sensor hardware. Replace if faulty. Log maintenance action.';
      case AlertType.communicationLoss:
        return 'Check network infrastructure. Verify SIM card status. Reset device if needed.';
      default:
        return 'Monitor situation. Investigate if condition persists.';
    }
  }

  /// Calculate data confidence level
  int _calculateConfidenceLevel(Alert alert, TDSDevice device) {
    int confidence = 100;

    // Reduce confidence for stale data
    final dataAge = DateTime.now().difference(device.lastUpdated);
    if (dataAge.inMinutes > 10) confidence -= 20;
    if (dataAge.inMinutes > 30) confidence -= 20;

    // Reduce confidence for offline devices
    if (alert.type == AlertType.deviceOffline) confidence = 50;

    return confidence.clamp(0, 100);
  }

  /// Acknowledge incident
  Incident acknowledgeIncident(Incident incident, String acknowledgedBy) {
    final action = IncidentAction(
      id: _uuid.v4(),
      timestamp: DateTime.now(),
      performedBy: acknowledgedBy,
      action: 'Acknowledged',
    );

    return incident.copyWith(
      state: IncidentState.acknowledged,
      acknowledgedAt: DateTime.now(),
      acknowledgedBy: acknowledgedBy,
      actions: [...incident.actions, action],
      lastUpdated: DateTime.now(),
    );
  }

  /// Add action to incident
  Incident addAction(
    Incident incident,
    String performedBy,
    String action,
    String? notes,
  ) {
    final incidentAction = IncidentAction(
      id: _uuid.v4(),
      timestamp: DateTime.now(),
      performedBy: performedBy,
      action: action,
      notes: notes,
    );

    return incident.copyWith(
      actions: [...incident.actions, incidentAction],
      lastUpdated: DateTime.now(),
    );
  }

  /// Escalate incident severity
  Incident escalateIncident(Incident incident) {
    final newSeverity = incident.severity.escalate();
    if (newSeverity == null) return incident;

    return incident.copyWith(
      severity: newSeverity,
      state: IncidentState.escalated,
      originalSeverity: incident.originalSeverity ?? incident.severity,
      lastEscalatedAt: DateTime.now(),
      escalationCount: incident.escalationCount + 1,
      lastUpdated: DateTime.now(),
    );
  }

  /// Mark incident as resolved
  Incident resolveIncident(Incident incident, String resolvedBy) {
    final action = IncidentAction(
      id: _uuid.v4(),
      timestamp: DateTime.now(),
      performedBy: resolvedBy,
      action: 'Resolved',
    );

    return incident.copyWith(
      state: IncidentState.resolved,
      resolvedAt: DateTime.now(),
      actions: [...incident.actions, action],
      lastUpdated: DateTime.now(),
    );
  }

  /// Close incident permanently
  Incident closeIncident(Incident incident, String closedBy) {
    final action = IncidentAction(
      id: _uuid.v4(),
      timestamp: DateTime.now(),
      performedBy: closedBy,
      action: 'Closed',
    );

    return incident.copyWith(
      state: IncidentState.closed,
      closedAt: DateTime.now(),
      actions: [...incident.actions, action],
      lastUpdated: DateTime.now(),
    );
  }

  /// Auto-escalate incidents based on time thresholds
  List<Incident> checkForEscalations(List<Incident> incidents) {
    final updatedIncidents = <Incident>[];

    for (final incident in incidents) {
      if (incident.shouldEscalate()) {
        updatedIncidents.add(escalateIncident(incident));
      } else {
        updatedIncidents.add(incident);
      }
    }

    return updatedIncidents;
  }
}
