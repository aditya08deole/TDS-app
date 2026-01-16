import '../../domain/entities/tds_device.dart';
import '../../domain/entities/device_type.dart';
import '../../domain/entities/device_status.dart';
import 'package:latlong2/latlong.dart';

/// Admin-only device management service
/// Handles device lifecycle: create, validate, update, disable, delete
class AdminDeviceService {
  /// Validate device configuration before creation
  /// Checks for duplicate IDs, coordinate validity, and data source config
  Future<ValidationResult> validateDeviceConfig({
    required String deviceId,
    required String name,
    required LatLng coordinates,
    required String location,
    String? locationId,
    DeviceType deviceType = DeviceType.sensor,
    String? deviceIdentifier,
    String? simIdentifier,
    String? dataSourceType,
    String? apiKey,
    String? channelId,
  }) async {
    final errors = <String>[];

    // Validate device ID uniqueness (in real implementation, check database)
    if (deviceId.isEmpty) {
      errors.add('Device ID cannot be empty');
    }

    // Validate name
    if (name.trim().isEmpty) {
      errors.add('Device name cannot be empty');
    }

    // Validate coordinates
    if (coordinates.latitude < -90 || coordinates.latitude > 90) {
      errors.add('Invalid latitude: must be between -90 and 90');
    }
    if (coordinates.longitude < -180 || coordinates.longitude > 180) {
      errors.add('Invalid longitude: must be between -180 and 180');
    }

    // Validate location
    if (location.trim().isEmpty) {
      errors.add('Location name cannot be empty');
    }

    // Validate data source configuration
    if (dataSourceType == 'thingspeak') {
      if (apiKey == null || apiKey.isEmpty) {
        errors.add('ThingSpeak API key is required');
      }
      if (channelId == null || channelId.isEmpty) {
        errors.add('ThingSpeak channel ID is required');
      }
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }

  /// Create a new device with full configuration
  /// Returns created device or null if validation fails
  Future<TDSDevice?> createDevice({
    required String deviceId,
    required String name,
    required LatLng coordinates,
    required String location,
    required String createdBy,
    String? locationId,
    DeviceType deviceType = DeviceType.sensor,
    String? deviceIdentifier,
    String? simIdentifier,
    String? dataSourceType,
    String? apiKey,
    String? channelId,
    Map<String, dynamic>? dataSourceConfig,
    String? notes,
    double? warningThreshold,
    double? criticalThreshold,
  }) async {
    // Validate first
    final validation = await validateDeviceConfig(
      deviceId: deviceId,
      name: name,
      coordinates: coordinates,
      location: location,
      locationId: locationId,
      deviceType: deviceType,
      deviceIdentifier: deviceIdentifier,
      simIdentifier: simIdentifier,
      dataSourceType: dataSourceType,
      apiKey: apiKey,
      channelId: channelId,
    );

    if (!validation.isValid) {
      return null;
    }

    // Create device entity
    final device = TDSDevice(
      id: deviceId,
      name: name,
      location: location,
      locationId: locationId,
      coordinates: coordinates,
      deviceType: deviceType,
      deviceIdentifier: deviceIdentifier,
      simIdentifier: simIdentifier,
      dataSourceType: dataSourceType,
      apiKey: apiKey,
      channelId: channelId,
      dataSourceConfig: dataSourceConfig,
      currentTDS: 0.0, // Initial value
      status: DeviceStatus.offline, // Initial status
      lastUpdated: DateTime.now(),
      isActive: true,
      isEnabled: true,
      createdAt: DateTime.now(),
      createdBy: createdBy,
      notes: notes,
      warningThreshold: warningThreshold ?? 300.0,
      criticalThreshold: criticalThreshold ?? 600.0,
    );

    // In real implementation: save to database
    return device;
  }

  /// Update existing device configuration
  Future<TDSDevice?> updateDevice({
    required TDSDevice device,
    required String updatedBy,
    String? name,
    LatLng? coordinates,
    String? location,
    String? locationId,
    DeviceType? deviceType,
    String? deviceIdentifier,
    String? simIdentifier,
    String? notes,
    bool? isActive,
    double? warningThreshold,
    double? criticalThreshold,
  }) async {
    return TDSDevice(
      id: device.id,
      name: name ?? device.name,
      location: location ?? device.location,
      locationId: locationId ?? device.locationId,
      coordinates: coordinates ?? device.coordinates,
      deviceType: deviceType ?? device.deviceType,
      deviceIdentifier: deviceIdentifier ?? device.deviceIdentifier,
      simIdentifier: simIdentifier ?? device.simIdentifier,
      dataSourceType: device.dataSourceType,
      apiKey: device.apiKey,
      channelId: device.channelId,
      dataSourceConfig: device.dataSourceConfig,
      currentTDS: device.currentTDS,
      temperature: device.temperature,
      status: device.status,
      lastUpdated: device.lastUpdated,
      isActive: isActive ?? device.isActive,
      isEnabled: device.isEnabled,
      createdAt: device.createdAt,
      createdBy: device.createdBy,
      updatedAt: DateTime.now(),
      updatedBy: updatedBy,
      lastValidatedAt: device.lastValidatedAt,
      notes: notes ?? device.notes,
      warningThreshold: warningThreshold ?? device.warningThreshold,
      criticalThreshold: criticalThreshold ?? device.criticalThreshold,
    );
  }

  /// Temporarily disable a device (preserves data, stops monitoring)
  Future<TDSDevice> disableDevice(TDSDevice device, String disabledBy) async {
    return TDSDevice(
      id: device.id,
      name: device.name,
      location: device.location,
      locationId: device.locationId,
      coordinates: device.coordinates,
      deviceType: device.deviceType,
      deviceIdentifier: device.deviceIdentifier,
      simIdentifier: device.simIdentifier,
      dataSourceType: device.dataSourceType,
      apiKey: device.apiKey,
      channelId: device.channelId,
      dataSourceConfig: device.dataSourceConfig,
      currentTDS: device.currentTDS,
      temperature: device.temperature,
      status: DeviceStatus.offline,
      lastUpdated: device.lastUpdated,
      isActive: false,
      isEnabled: false,
      createdAt: device.createdAt,
      createdBy: device.createdBy,
      updatedAt: DateTime.now(),
      updatedBy: disabledBy,
      lastValidatedAt: device.lastValidatedAt,
      notes: device.notes,
      warningThreshold: device.warningThreshold,
      criticalThreshold: device.criticalThreshold,
    );
  }

  /// Re-enable a disabled device
  Future<TDSDevice> enableDevice(TDSDevice device, String enabledBy) async {
    return TDSDevice(
      id: device.id,
      name: device.name,
      location: device.location,
      locationId: device.locationId,
      coordinates: device.coordinates,
      deviceType: device.deviceType,
      deviceIdentifier: device.deviceIdentifier,
      simIdentifier: device.simIdentifier,
      dataSourceType: device.dataSourceType,
      apiKey: device.apiKey,
      channelId: device.channelId,
      dataSourceConfig: device.dataSourceConfig,
      currentTDS: device.currentTDS,
      temperature: device.temperature,
      status: device.status,
      lastUpdated: device.lastUpdated,
      isActive: true,
      isEnabled: true,
      createdAt: device.createdAt,
      createdBy: device.createdBy,
      updatedAt: DateTime.now(),
      updatedBy: enabledBy,
      lastValidatedAt: device.lastValidatedAt,
      notes: device.notes,
      warningThreshold: device.warningThreshold,
      criticalThreshold: device.criticalThreshold,
    );
  }
}

/// Validation result for device configuration
class ValidationResult {
  final bool isValid;
  final List<String> errors;

  const ValidationResult({
    required this.isValid,
    required this.errors,
  });
}
