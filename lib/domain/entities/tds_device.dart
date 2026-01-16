import 'package:latlong2/latlong.dart';
import 'device_status.dart';
import 'device_type.dart';

/// TDS monitoring device entity - Infrastructure-grade asset
class TDSDevice {
  final String id;
  final String name;
  final String location;
  final String? locationId; // Reference to Location entity
  final LatLng coordinates;
  final DeviceType deviceType;
  final String? deviceIdentifier; // Hardware ID, serial number
  final String? simIdentifier; // SIM card ID for networked devices
  
  // Data source configuration
  final String? dataSourceType; // 'thingspeak', 'mqtt', 'http', etc.
  final String? apiKey; // ThingSpeak Read API key or equivalent
  final String? channelId; // ThingSpeak channel ID or endpoint
  final Map<String, dynamic>? dataSourceConfig; // Additional config
  
  final double currentTDS;
  final double? temperature;
  final DeviceStatus status;
  final DateTime lastUpdated;
  
  // Lifecycle management
  final bool isActive; // Can be temporarily disabled
  final bool isEnabled;
  final DateTime createdAt;
  final String createdBy; // Admin username
  final DateTime? updatedAt;
  final String? updatedBy;
  final DateTime? lastValidatedAt; // Last successful data fetch
  final String? notes; // Operational notes
  
  final double? warningThreshold;
  final double? criticalThreshold;

  TDSDevice({
    required this.id,
    required this.name,
    required this.location,
    this.locationId,
    required this.coordinates,
    this.deviceType = DeviceType.sensor,
    this.deviceIdentifier,
    this.simIdentifier,
    this.dataSourceType,
    this.apiKey,
    this.channelId,
    this.dataSourceConfig,
    required this.currentTDS,
    this.temperature,
    required this.status,
    required this.lastUpdated,
    this.isActive = true,
    this.isEnabled = true,
    DateTime? createdAt,
    this.createdBy = 'system',
    this.updatedAt,
    this.updatedBy,
    this.lastValidatedAt,
    this.notes,
    this.warningThreshold = 300.0,
    this.criticalThreshold = 600.0,
  }) : createdAt = createdAt ?? DateTime.now();

  /// Determines device status based on TDS value
  DeviceStatus getStatusFromTDS() {
    if (!isEnabled) return DeviceStatus.offline;
    if (currentTDS >= (criticalThreshold ?? 600.0)) return DeviceStatus.critical;
    if (currentTDS >= (warningThreshold ?? 300.0)) return DeviceStatus.warning;
    return DeviceStatus.online;
  }

  /// Check if device is healthy (not offline/critical)
  bool get isHealthy => status != DeviceStatus.offline && status != DeviceStatus.critical;

  /// Check if device needs attention
  bool get needsAttention => status == DeviceStatus.warning || status == DeviceStatus.critical;

  TDSDevice copyWith({
    String? id,
    String? name,
    String? location,
    LatLng? coordinates,
    double? currentTDS,
    double? temperature,
    DeviceStatus? status,
    DateTime? lastUpdated,
    bool? isEnabled,
    double? warningThreshold,
    double? criticalThreshold,
    DateTime? createdAt,
    String? createdBy,
  }) {
    return TDSDevice(
      id: id ?? this.id,
      name: name ?? this.name,
      location: location ?? this.location,
      coordinates: coordinates ?? this.coordinates,
      currentTDS: currentTDS ?? this.currentTDS,
      temperature: temperature ?? this.temperature,
      status: status ?? this.status,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      isEnabled: isEnabled ?? this.isEnabled,
      warningThreshold: warningThreshold ?? this.warningThreshold,
      criticalThreshold: criticalThreshold ?? this.criticalThreshold,
      createdAt: createdAt ?? this.createdAt,
      createdBy: createdBy ?? this.createdBy,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'location': location,
      'latitude': coordinates.latitude,
      'longitude': coordinates.longitude,
      'currentTDS': currentTDS,
      'temperature': temperature,
      'status': status.name,
      'lastUpdated': lastUpdated.toIso8601String(),
      'isEnabled': isEnabled,
      'warningThreshold': warningThreshold,
      'criticalThreshold': criticalThreshold,
    };
  }

  factory TDSDevice.fromJson(Map<String, dynamic> json) {
    return TDSDevice(
      id: json['id'] as String,
      name: json['name'] as String,
      location: json['location'] as String,
      coordinates: LatLng(
        json['latitude'] as double,
        json['longitude'] as double,
      ),
      currentTDS: (json['currentTDS'] as num).toDouble(),
      temperature: json['temperature'] != null 
          ? (json['temperature'] as num).toDouble() 
          : null,
      status: DeviceStatus.values.firstWhere((e) => e.name == json['status']),
      lastUpdated: DateTime.parse(json['lastUpdated'] as String),
      isEnabled: json['isEnabled'] as bool? ?? true,
      warningThreshold: json['warningThreshold'] != null 
          ? (json['warningThreshold'] as num).toDouble() 
          : 300.0,
      criticalThreshold: json['criticalThreshold'] != null 
          ? (json['criticalThreshold'] as num).toDouble() 
          : 600.0,
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt'] as String) 
          : null,
      createdBy: json['createdBy'] as String? ?? 'system',
    );
  }
}
