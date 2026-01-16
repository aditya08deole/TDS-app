import 'severity_level.dart';

/// Alert entity - raw signal from a device or system
/// Multiple alerts can be grouped into a single Incident
class Alert {
  final String id;
  final String deviceId;
  final String? locationId;
  final AlertType type;
  final SeverityLevel severity;
  final DateTime timestamp;
  final String message; // Raw alert message
  final double? value; // Metric value that triggered alert
  final double? threshold; // Threshold that was crossed
  final String? metricName; // 'TDS', 'Temperature', etc.
  final String? metricUnit; // 'ppm', '°C', etc.
  final bool isAcknowledged;
  final String? incidentId; // Linked incident if grouped
  final Map<String, dynamic>? metadata; // Additional context

  const Alert({
    required this.id,
    required this.deviceId,
    this.locationId,
    required this.type,
    required this.severity,
    required this.timestamp,
    required this.message,
    this.value,
    this.threshold,
    this.metricName,
    this.metricUnit,
    this.isAcknowledged = false,
    this.incidentId,
    this.metadata,
  });

  /// Age of alert
  Duration get age => DateTime.now().difference(timestamp);

  /// Check if alert is recent (< 5 minutes)
  bool get isRecent => age.inMinutes < 5;

  Alert copyWith({
    String? id,
    String? deviceId,
    String? locationId,
    AlertType? type,
    SeverityLevel? severity,
    DateTime? timestamp,
    String? message,
    double? value,
    double? threshold,
    String? metricName,
    String? metricUnit,
    bool? isAcknowledged,
    String? incidentId,
    Map<String, dynamic>? metadata,
  }) {
    return Alert(
      id: id ?? this.id,
      deviceId: deviceId ?? this.deviceId,
      locationId: locationId ?? this.locationId,
      type: type ?? this.type,
      severity: severity ?? this.severity,
      timestamp: timestamp ?? this.timestamp,
      message: message ?? this.message,
      value: value ?? this.value,
      threshold: threshold ?? this.threshold,
      metricName: metricName ?? this.metricName,
      metricUnit: metricUnit ?? this.metricUnit,
      isAcknowledged: isAcknowledged ?? this.isAcknowledged,
      incidentId: incidentId ?? this.incidentId,
      metadata: metadata ?? this.metadata,
    );
  }
}

/// Classification of alert types
enum AlertType {
  thresholdExceeded, // Metric crossed threshold
  deviceOffline, // Device stopped responding
  dataStale, // No new data received
  sensorFault, // Hardware failure detected
  communicationLoss, // Network connectivity issue
  configurationError, // Misconfiguration detected
  anomalyDetected, // Statistical anomaly
  manualAlert; // Operator-generated

  String get displayName {
    switch (this) {
      case AlertType.thresholdExceeded:
        return 'Threshold Exceeded';
      case AlertType.deviceOffline:
        return 'Device Offline';
      case AlertType.dataStale:
        return 'Data Stale';
      case AlertType.sensorFault:
        return 'Sensor Fault';
      case AlertType.communicationLoss:
        return 'Communication Loss';
      case AlertType.configurationError:
        return 'Configuration Error';
      case AlertType.anomalyDetected:
        return 'Anomaly Detected';
      case AlertType.manualAlert:
        return 'Manual Alert';
    }
  }
}
