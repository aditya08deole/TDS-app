import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';
import '../../core/config/supabase_service.dart';
import '../../core/config/supabase_config.dart';
import '../../domain/entities/models/device_model.dart';
import '../../domain/entities/device_status.dart';
import '../../domain/entities/tds_device.dart';
import 'thingspeak_service.dart';
import 'cache_service.dart';

/// Unified device data service with ThingSpeak integration and caching
/// Designed for reliable performance with many concurrent users
class DeviceDataService {
  static final DeviceDataService _instance = DeviceDataService._internal();
  factory DeviceDataService() => _instance;
  DeviceDataService._internal();

  final ThingSpeakService _thingspeak = ThingSpeakService();
  final CacheService _cache = CacheService();
  final DeviceReadingCache _readingCache = DeviceReadingCache();
  final DeviceListCache _deviceListCache = DeviceListCache();

  /// Auto-refresh timer for real-time updates
  Timer? _refreshTimer;
  
  /// Callbacks for device updates
  final List<void Function(List<DeviceModel>)> _deviceUpdateCallbacks = [];

  /// Start auto-refresh for real-time data (3 seconds for fast updates)
  void startAutoRefresh({Duration interval = const Duration(seconds: 3)}) {
    _refreshTimer?.cancel();
    _refreshTimer = Timer.periodic(interval, (_) => refreshAllDevices());
    debugPrint('🔄 Real-time data refresh started: every ${interval.inSeconds}s');
  }

  /// Stop auto-refresh
  void stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
    debugPrint('Auto-refresh stopped');
  }

  /// Register callback for device updates
  void onDeviceUpdate(void Function(List<DeviceModel>) callback) {
    _deviceUpdateCallbacks.add(callback);
  }

  /// Remove callback
  void removeDeviceUpdateCallback(void Function(List<DeviceModel>) callback) {
    _deviceUpdateCallbacks.remove(callback);
  }

  /// Notify all callbacks
  void _notifyDeviceUpdate(List<DeviceModel> devices) {
    for (final callback in _deviceUpdateCallbacks) {
      callback(devices);
    }
  }

  /// Get all devices from Supabase with caching
  Future<List<DeviceModel>> getAllDevices({bool forceRefresh = false}) async {
    return await _deviceListCache.getOrFetchDevices<DeviceModel>(
      () async {
        try {
          final response = await SupabaseService.client
              .from(SupabaseConfig.devicesTable)
              .select()
              .eq('is_active', true)
              .order('name');

          return (response as List)
              .map((json) => DeviceModel.fromJson(json))
              .toList();
        } catch (e) {
          debugPrint('Error fetching devices: $e');
          return [];
        }
      },
      forceRefresh: forceRefresh,
    ) ?? [];
  }

  /// Get device by ID with caching
  Future<DeviceModel?> getDevice(String id) async {
    return await _cache.getOrFetch<DeviceModel>(
      'device:$id',
      () async {
        try {
          final response = await SupabaseService.client
              .from(SupabaseConfig.devicesTable)
              .select()
              .eq('id', id)
              .single();

          return DeviceModel.fromJson(response);
        } catch (e) {
          debugPrint('Error fetching device $id: $e');
          return null;
        }
      },
      ttl: CacheService.defaultTtl,
    );
  }

  /// Fetch latest reading from ThingSpeak for a device
  Future<DeviceReading?> fetchDeviceReading(DeviceModel device) async {
    if (!device.hasThingspeakConfig) {
      debugPrint('Device ${device.name} has no ThingSpeak config');
      return null;
    }

    return await _readingCache.getOrFetchReading<DeviceReading>(
      device.id,
      () => _thingspeak.getDeviceReading(device.thingspeakConfig!),
    );
  }

  /// Fetch and update device with latest ThingSpeak data
  Future<DeviceModel?> fetchAndUpdateDevice(DeviceModel device) async {
    final reading = await fetchDeviceReading(device);
    
    if (reading == null || !reading.isValid) {
      debugPrint('No valid reading for device ${device.name}');
      return device;
    }

    // Calculate status based on TDS value
    DeviceStatus newStatus;
    if (reading.tdsValue == null) {
      newStatus = DeviceStatus.offline;
    } else if (reading.tdsValue! >= device.criticalThreshold) {
      newStatus = DeviceStatus.critical;
    } else if (reading.tdsValue! >= device.warningThreshold) {
      newStatus = DeviceStatus.warning;
    } else {
      newStatus = DeviceStatus.online;
    }

    // Update device in Supabase
    try {
      await SupabaseService.client
          .from(SupabaseConfig.devicesTable)
          .update({
            'current_tds': reading.tdsValue,
            'temperature': reading.temperature,
            'voltage': reading.voltage,
            'status': newStatus.name,
            'last_reading_at': reading.timestamp.toIso8601String(),
          })
          .eq('id', device.id);

      // Also insert into readings history if valid
      if (reading.tdsValue != null) {
        await SupabaseService.client
            .from(SupabaseConfig.deviceReadingsTable)
            .insert({
              'device_id': device.id,
              'tds_value': reading.tdsValue,
              'temperature': reading.temperature,
              'voltage': reading.voltage,
              'is_valid': true,
            });
      }

      // Invalidate cache
      _cache.invalidate('device:${device.id}');
      _deviceListCache.invalidate();

      return device.copyWith(
        currentTds: reading.tdsValue ?? device.currentTds,
        temperature: reading.temperature,
        voltage: reading.voltage,
        status: newStatus,
        lastReadingAt: reading.timestamp,
      );
    } catch (e) {
      debugPrint('Error updating device ${device.name}: $e');
      return device.copyWith(
        currentTds: reading.tdsValue ?? device.currentTds,
        temperature: reading.temperature,
        voltage: reading.voltage,
        status: newStatus,
        lastReadingAt: reading.timestamp,
      );
    }
  }

  /// Refresh all devices with latest ThingSpeak data
  Future<List<DeviceModel>> refreshAllDevices() async {
    debugPrint('Refreshing all devices...');
    
    final devices = await getAllDevices(forceRefresh: true);
    final updatedDevices = <DeviceModel>[];

    // Fetch readings in parallel with rate limiting
    final futures = <Future<DeviceModel?>>[];
    for (final device in devices) {
      if (device.hasThingspeakConfig) {
        futures.add(fetchAndUpdateDevice(device));
      } else {
        updatedDevices.add(device);
      }
    }

    // Wait for all updates with timeout
    try {
      final results = await Future.wait(
        futures,
        eagerError: false,
      ).timeout(
        const Duration(seconds: 30),
        onTimeout: () => futures.map((f) => null).toList() as List<DeviceModel?>,
      );

      for (final result in results) {
        if (result != null) {
          updatedDevices.add(result);
        }
      }
    } catch (e) {
      debugPrint('Error refreshing devices: $e');
    }

    // Sort by name
    updatedDevices.sort((a, b) => a.name.compareTo(b.name));

    // Update cache
    _deviceListCache.setDevices(updatedDevices);

    // Notify listeners
    _notifyDeviceUpdate(updatedDevices);

    debugPrint('Refreshed ${updatedDevices.length} devices');
    return updatedDevices;
  }

  /// Get historical readings for a device
  Future<List<DeviceReading>> getDeviceHistory(
    DeviceModel device, {
    int results = 100,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    if (!device.hasThingspeakConfig) return [];

    return await _thingspeak.getDeviceReadings(
      device.thingspeakConfig!,
      results: results,
      startDate: startDate,
      endDate: endDate,
    );
  }

  /// Create new device
  Future<DeviceModel?> createDevice(DeviceModel device) async {
    try {
      debugPrint('📝 Creating device: ${device.name}');
      debugPrint('📝 Insert data: ${device.toInsertJson()}');
      
      final response = await SupabaseService.client
          .from(SupabaseConfig.devicesTable)
          .insert(device.toInsertJson())
          .select()
          .single();

      debugPrint('✅ Device created successfully: ${response['id']}');
      _deviceListCache.invalidate();
      return DeviceModel.fromJson(response);
    } catch (e, stackTrace) {
      debugPrint('❌ Error creating device: $e');
      debugPrint('❌ Stack trace: $stackTrace');
      // Rethrow to show error in UI
      rethrow;
    }
  }

  /// Update device
  Future<DeviceModel?> updateDevice(String id, Map<String, dynamic> updates) async {
    try {
      final response = await SupabaseService.client
          .from(SupabaseConfig.devicesTable)
          .update(updates)
          .eq('id', id)
          .select()
          .single();

      _cache.invalidate('device:$id');
      _deviceListCache.invalidate();
      return DeviceModel.fromJson(response);
    } catch (e) {
      debugPrint('Error updating device: $e');
      return null;
    }
  }

  /// Delete device (soft delete)
  Future<bool> deleteDevice(String id) async {
    try {
      await SupabaseService.client
          .from(SupabaseConfig.devicesTable)
          .update({'is_active': false})
          .eq('id', id);

      _cache.invalidate('device:$id');
      _deviceListCache.invalidate();
      return true;
    } catch (e) {
      debugPrint('Error deleting device: $e');
      return false;
    }
  }

  /// Convert DeviceModel to TDSDevice for UI compatibility
  TDSDevice toTDSDevice(DeviceModel model) {
    return TDSDevice(
      id: model.id,
      name: model.name,
      location: model.location,
      coordinates: LatLng(model.latitude, model.longitude),
      status: model.status,
      currentTDS: model.currentTds,
      temperature: model.temperature,
      lastUpdated: model.lastReadingAt ?? model.updatedAt,
      deviceIdentifier: model.deviceId,
      simIdentifier: model.simNumber,
      apiKey: model.thingspeakApiKey,
      channelId: model.thingspeakChannelId,
      warningThreshold: model.warningThreshold,
      criticalThreshold: model.criticalThreshold,
    );
  }

  /// Get all devices as TDSDevice for UI
  Future<List<TDSDevice>> getAllTDSDevices({bool forceRefresh = false}) async {
    final devices = await getAllDevices(forceRefresh: forceRefresh);
    return devices.map((d) => toTDSDevice(d)).toList();
  }

  /// Get cache statistics
  CacheStats getCacheStats() => _cache.getStats();

  /// Clear all caches
  void clearCache() {
    _cache.clear();
    _readingCache.invalidateAllReadings();
    _deviceListCache.invalidate();
  }

  /// Dispose resources
  void dispose() {
    stopAutoRefresh();
    _thingspeak.dispose();
    _deviceUpdateCallbacks.clear();
  }
}
