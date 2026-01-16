import '../device_status.dart';
import '../../../data/services/thingspeak_service.dart';

/// Enhanced Device model matching Supabase devices table
/// Includes ThingSpeak configuration and SIM information
class DeviceModel {
  final String id;
  final String deviceId; // Hardware device identifier
  final String name;
  final String location;
  final double latitude;
  final double longitude;
  final DeviceStatus status;
  final double currentTds;
  final double? temperature;
  final double? voltage;
  final int batteryLevel;
  final bool isActive;
  final String? createdBy;
  final DateTime createdAt;
  final DateTime updatedAt;
  
  // SIM Information
  final String? simNumber;
  
  // ThingSpeak Configuration
  final String? thingspeakApiKey; // Read API Key
  final String? thingspeakChannelId;
  final int tdsFieldNumber; // Field number for TDS (1-8)
  final int? temperatureFieldNumber; // Field number for Temperature
  final int? voltageFieldNumber; // Field number for Voltage
  
  // Thresholds
  final double warningThreshold;
  final double criticalThreshold;
  
  // Last valid reading timestamp
  final DateTime? lastReadingAt;

  const DeviceModel({
    required this.id,
    required this.deviceId,
    required this.name,
    required this.location,
    required this.latitude,
    required this.longitude,
    required this.status,
    required this.currentTds,
    this.temperature,
    this.voltage,
    required this.batteryLevel,
    required this.isActive,
    this.createdBy,
    required this.createdAt,
    required this.updatedAt,
    this.simNumber,
    this.thingspeakApiKey,
    this.thingspeakChannelId,
    this.tdsFieldNumber = 1,
    this.temperatureFieldNumber,
    this.voltageFieldNumber,
    this.warningThreshold = 300.0,
    this.criticalThreshold = 600.0,
    this.lastReadingAt,
  });

  /// Check if device has ThingSpeak configured
  bool get hasThingspeakConfig => thingspeakApiKey != null && thingspeakApiKey!.isNotEmpty;

  /// Get ThingSpeak configuration
  ThingSpeakConfig? get thingspeakConfig {
    if (!hasThingspeakConfig) return null;
    return ThingSpeakConfig(
      readApiKey: thingspeakApiKey!,
      channelId: thingspeakChannelId,
      tdsFieldNumber: tdsFieldNumber,
      temperatureFieldNumber: temperatureFieldNumber,
      voltageFieldNumber: voltageFieldNumber,
    );
  }

  factory DeviceModel.fromJson(Map<String, dynamic> json) {
    return DeviceModel(
      id: json['id'] as String,
      deviceId: json['device_id'] as String? ?? json['id'] as String,
      name: json['name'] as String,
      location: json['location'] as String,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      status: _statusFromString(json['status'] as String? ?? 'offline'),
      currentTds: (json['current_tds'] as num?)?.toDouble() ?? 0.0,
      temperature: (json['temperature'] as num?)?.toDouble(),
      voltage: (json['voltage'] as num?)?.toDouble(),
      batteryLevel: json['battery_level'] as int? ?? 100,
      isActive: json['is_active'] as bool? ?? true,
      createdBy: json['created_by'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      simNumber: json['sim_number'] as String?,
      thingspeakApiKey: json['thingspeak_api_key'] as String?,
      thingspeakChannelId: json['thingspeak_channel_id'] as String?,
      tdsFieldNumber: json['tds_field_number'] as int? ?? 1,
      temperatureFieldNumber: json['temperature_field_number'] as int?,
      voltageFieldNumber: json['voltage_field_number'] as int?,
      warningThreshold: (json['warning_threshold'] as num?)?.toDouble() ?? 300.0,
      criticalThreshold: (json['critical_threshold'] as num?)?.toDouble() ?? 600.0,
      lastReadingAt: json['last_reading_at'] != null 
          ? DateTime.parse(json['last_reading_at'] as String) 
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'device_id': deviceId,
      'name': name,
      'location': location,
      'latitude': latitude,
      'longitude': longitude,
      'status': status.name,
      'current_tds': currentTds,
      'temperature': temperature,
      'voltage': voltage,
      'battery_level': batteryLevel,
      'is_active': isActive,
      'created_by': createdBy,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'sim_number': simNumber,
      'thingspeak_api_key': thingspeakApiKey,
      'thingspeak_channel_id': thingspeakChannelId,
      'tds_field_number': tdsFieldNumber,
      'temperature_field_number': temperatureFieldNumber,
      'voltage_field_number': voltageFieldNumber,
      'warning_threshold': warningThreshold,
      'critical_threshold': criticalThreshold,
      'last_reading_at': lastReadingAt?.toIso8601String(),
    };
  }

  /// For creating new device (without id, createdAt, updatedAt)
  Map<String, dynamic> toInsertJson() {
    return {
      'device_id': deviceId,
      'name': name,
      'location': location,
      'latitude': latitude,
      'longitude': longitude,
      'status': status.name,
      'current_tds': currentTds,
      'temperature': temperature,
      'voltage': voltage,
      'battery_level': batteryLevel,
      'is_active': isActive,
      'created_by': createdBy,
      'sim_number': simNumber,
      'thingspeak_api_key': thingspeakApiKey,
      'thingspeak_channel_id': thingspeakChannelId,
      'tds_field_number': tdsFieldNumber,
      'temperature_field_number': temperatureFieldNumber,
      'voltage_field_number': voltageFieldNumber,
      'warning_threshold': warningThreshold,
      'critical_threshold': criticalThreshold,
    };
  }

  DeviceModel copyWith({
    String? id,
    String? deviceId,
    String? name,
    String? location,
    double? latitude,
    double? longitude,
    DeviceStatus? status,
    double? currentTds,
    double? temperature,
    double? voltage,
    int? batteryLevel,
    bool? isActive,
    String? createdBy,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? simNumber,
    String? thingspeakApiKey,
    String? thingspeakChannelId,
    int? tdsFieldNumber,
    int? temperatureFieldNumber,
    int? voltageFieldNumber,
    double? warningThreshold,
    double? criticalThreshold,
    DateTime? lastReadingAt,
  }) {
    return DeviceModel(
      id: id ?? this.id,
      deviceId: deviceId ?? this.deviceId,
      name: name ?? this.name,
      location: location ?? this.location,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      status: status ?? this.status,
      currentTds: currentTds ?? this.currentTds,
      temperature: temperature ?? this.temperature,
      voltage: voltage ?? this.voltage,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      isActive: isActive ?? this.isActive,
      createdBy: createdBy ?? this.createdBy,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      simNumber: simNumber ?? this.simNumber,
      thingspeakApiKey: thingspeakApiKey ?? this.thingspeakApiKey,
      thingspeakChannelId: thingspeakChannelId ?? this.thingspeakChannelId,
      tdsFieldNumber: tdsFieldNumber ?? this.tdsFieldNumber,
      temperatureFieldNumber: temperatureFieldNumber ?? this.temperatureFieldNumber,
      voltageFieldNumber: voltageFieldNumber ?? this.voltageFieldNumber,
      warningThreshold: warningThreshold ?? this.warningThreshold,
      criticalThreshold: criticalThreshold ?? this.criticalThreshold,
      lastReadingAt: lastReadingAt ?? this.lastReadingAt,
    );
  }

  static DeviceStatus _statusFromString(String status) {
    switch (status.toLowerCase()) {
      case 'online':
        return DeviceStatus.online;
      case 'warning':
        return DeviceStatus.warning;
      case 'critical':
        return DeviceStatus.critical;
      case 'offline':
      default:
        return DeviceStatus.offline;
    }
  }
}

/// Device reading model matching Supabase device_readings table
class DeviceReadingModel {
  final String id;
  final String deviceId;
  final double tdsValue;
  final double? temperature;
  final double? voltage;
  final DateTime recordedAt;
  final bool isValid;

  const DeviceReadingModel({
    required this.id,
    required this.deviceId,
    required this.tdsValue,
    this.temperature,
    this.voltage,
    required this.recordedAt,
    this.isValid = true,
  });

  factory DeviceReadingModel.fromJson(Map<String, dynamic> json) {
    return DeviceReadingModel(
      id: json['id'] as String,
      deviceId: json['device_id'] as String,
      tdsValue: (json['tds_value'] as num).toDouble(),
      temperature: (json['temperature'] as num?)?.toDouble(),
      voltage: (json['voltage'] as num?)?.toDouble(),
      recordedAt: DateTime.parse(json['recorded_at'] as String),
      isValid: json['is_valid'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'device_id': deviceId,
      'tds_value': tdsValue,
      'temperature': temperature,
      'voltage': voltage,
      'recorded_at': recordedAt.toIso8601String(),
      'is_valid': isValid,
    };
  }

  Map<String, dynamic> toInsertJson() {
    return {
      'device_id': deviceId,
      'tds_value': tdsValue,
      'temperature': temperature,
      'voltage': voltage,
      'is_valid': isValid,
    };
  }
}
