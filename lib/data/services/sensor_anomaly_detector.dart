import '../../domain/entities/tds_device.dart';
import '../../domain/entities/data_confidence.dart';

/// Service for detecting sensor anomalies and data quality issues
/// Prevents false incidents from sensor faults
class SensorAnomalyDetector {
  /// Detect anomalies in device data stream
  /// Returns list of detected issues
  List<SensorAnomaly> detectAnomalies(
    TDSDevice device,
    List<double>? recentValues,
  ) {
    final anomalies = <SensorAnomaly>[];

    // Check data age
    final dataAge = DateTime.now().difference(device.lastUpdated);
    if (dataAge.inMinutes > 15) {
      anomalies.add(SensorAnomaly(
        type: AnomalyType.staleData,
        severity: DataConfidence.offline,
        description: 'No data received for ${dataAge.inMinutes} minutes',
        detectedAt: DateTime.now(),
      ));
    }

    // Check for flat-lined readings (same value repeated)
    if (recentValues != null && recentValues.length >= 5) {
      final uniqueValues = recentValues.toSet();
      if (uniqueValues.length == 1) {
        anomalies.add(SensorAnomaly(
          type: AnomalyType.flatLine,
          severity: DataConfidence.unreliable,
          description: 'Sensor reading unchanged for extended period',
          detectedAt: DateTime.now(),
        ));
      }
    }

    // Check for implausible jumps
    if (recentValues != null && recentValues.length >= 2) {
      for (int i = 1; i < recentValues.length; i++) {
        final change = (recentValues[i] - recentValues[i - 1]).abs();
        final changePercent = change / recentValues[i - 1] * 100;
        
        // More than 50% change in single reading = suspicious
        if (changePercent > 50 && change > 100) {
          anomalies.add(SensorAnomaly(
            type: AnomalyType.implausibleJump,
            severity: DataConfidence.unreliable,
            description: 'Sudden ${changePercent.toStringAsFixed(0)}% change detected',
            detectedAt: DateTime.now(),
          ));
          break;
        }
      }
    }

    // Check for impossible values (negative TDS, extreme values)
    if (device.currentTDS < 0 || device.currentTDS > 10000) {
      anomalies.add(SensorAnomaly(
        type: AnomalyType.outOfRange,
        severity: DataConfidence.unreliable,
        description: 'Value outside physically possible range',
        detectedAt: DateTime.now(),
      ));
    }

    // Check temperature sensor if present
    if (device.temperature != null) {
      if (device.temperature! < -10 || device.temperature! > 60) {
        anomalies.add(SensorAnomaly(
          type: AnomalyType.outOfRange,
          severity: DataConfidence.unreliable,
          description: 'Temperature reading implausible',
          detectedAt: DateTime.now(),
        ));
      }
    }

    return anomalies;
  }

  /// Calculate overall data confidence based on anomalies and age
  DataConfidence calculateConfidence(
    TDSDevice device,
    List<SensorAnomaly> anomalies,
  ) {
    // If any unreliable anomaly, mark as unreliable
    if (anomalies.any((a) => a.severity == DataConfidence.unreliable)) {
      return DataConfidence.unreliable;
    }

    // Check data age
    final dataAge = DateTime.now().difference(device.lastUpdated);
    final ageConfidence = DataConfidence.fromDataAge(dataAge);

    // If stale/offline anomaly exists, use that
    if (anomalies.any((a) => a.severity == DataConfidence.offline)) {
      return DataConfidence.offline;
    }
    if (anomalies.any((a) => a.severity == DataConfidence.stale)) {
      return DataConfidence.stale;
    }

    // Otherwise use age-based confidence
    return ageConfidence;
  }

  /// Generate advisory message for low confidence data
  String? generateAdvisory(List<SensorAnomaly> anomalies) {
    if (anomalies.isEmpty) return null;

    final highestSeverity = anomalies
        .map((a) => a.severity.confidenceScore)
        .reduce((a, b) => a < b ? a : b);

    if (highestSeverity < 50) {
      return 'Data reliability compromised. Verify sensor before acting on readings.';
    } else if (highestSeverity < 85) {
      return 'Data quality degraded. Exercise caution when evaluating trends.';
    }

    return null;
  }
}

/// Detected sensor anomaly
class SensorAnomaly {
  final AnomalyType type;
  final DataConfidence severity;
  final String description;
  final DateTime detectedAt;

  const SensorAnomaly({
    required this.type,
    required this.severity,
    required this.description,
    required this.detectedAt,
  });
}

/// Types of sensor anomalies
enum AnomalyType {
  staleData,
  flatLine,
  implausibleJump,
  outOfRange,
  frequentDisconnects,
  calibrationDrift;

  String get displayName {
    switch (this) {
      case AnomalyType.staleData:
        return 'Stale Data';
      case AnomalyType.flatLine:
        return 'Flat-lined Reading';
      case AnomalyType.implausibleJump:
        return 'Implausible Jump';
      case AnomalyType.outOfRange:
        return 'Out of Range';
      case AnomalyType.frequentDisconnects:
        return 'Frequent Disconnects';
      case AnomalyType.calibrationDrift:
        return 'Calibration Drift';
    }
  }
}
