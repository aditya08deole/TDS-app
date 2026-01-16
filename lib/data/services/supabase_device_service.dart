import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:latlong2/latlong.dart';
import '../../core/config/supabase_config.dart';
import '../../core/config/supabase_service.dart';
import '../../domain/entities/models/device_model.dart';
import '../../domain/entities/device_status.dart';
import '../../domain/entities/tds_device.dart';

/// Supabase service for device operations
class SupabaseDeviceService {
  final SupabaseClient _client = SupabaseService.client;

  /// Get all devices
  Future<List<DeviceModel>> getAllDevices() async {
    try {
      final response = await _client
          .from(SupabaseConfig.devicesTable)
          .select()
          .eq('is_active', true)
          .order('name');

      return (response as List)
          .map((json) => DeviceModel.fromJson(json))
          .toList();
    } catch (e) {
      print('Error fetching devices: $e');
      return [];
    }
  }

  /// Get device by ID
  Future<DeviceModel?> getDeviceById(String id) async {
    try {
      final response = await _client
          .from(SupabaseConfig.devicesTable)
          .select()
          .eq('id', id)
          .single();

      return DeviceModel.fromJson(response);
    } catch (e) {
      print('Error fetching device: $e');
      return null;
    }
  }

  /// Create new device (admin only)
  Future<DeviceModel?> createDevice(DeviceModel device) async {
    try {
      final response = await _client
          .from(SupabaseConfig.devicesTable)
          .insert(device.toInsertJson())
          .select()
          .single();

      return DeviceModel.fromJson(response);
    } catch (e) {
      print('Error creating device: $e');
      return null;
    }
  }

  /// Update device (admin only)
  Future<DeviceModel?> updateDevice(String id, Map<String, dynamic> updates) async {
    try {
      final response = await _client
          .from(SupabaseConfig.devicesTable)
          .update(updates)
          .eq('id', id)
          .select()
          .single();

      return DeviceModel.fromJson(response);
    } catch (e) {
      print('Error updating device: $e');
      return null;
    }
  }

  /// Delete device (soft delete - sets is_active to false)
  Future<bool> deleteDevice(String id) async {
    try {
      await _client
          .from(SupabaseConfig.devicesTable)
          .update({'is_active': false})
          .eq('id', id);

      return true;
    } catch (e) {
      print('Error deleting device: $e');
      return false;
    }
  }

  /// Hard delete device (admin only)
  Future<bool> hardDeleteDevice(String id) async {
    try {
      await _client
          .from(SupabaseConfig.devicesTable)
          .delete()
          .eq('id', id);

      return true;
    } catch (e) {
      print('Error hard deleting device: $e');
      return false;
    }
  }

  /// Update device status
  Future<bool> updateDeviceStatus(String id, DeviceStatus status) async {
    try {
      await _client
          .from(SupabaseConfig.devicesTable)
          .update({'status': status.name})
          .eq('id', id);

      return true;
    } catch (e) {
      print('Error updating device status: $e');
      return false;
    }
  }

  /// Update device TDS reading
  Future<bool> updateDeviceReading(String id, double tds, double? temperature) async {
    try {
      await _client
          .from(SupabaseConfig.devicesTable)
          .update({
            'current_tds': tds,
            'temperature': temperature,
          })
          .eq('id', id);

      // Also insert into readings history
      await _client
          .from(SupabaseConfig.deviceReadingsTable)
          .insert({
            'device_id': id,
            'tds_value': tds,
            'temperature': temperature,
          });

      return true;
    } catch (e) {
      print('Error updating device reading: $e');
      return false;
    }
  }

  /// Get device readings history
  Future<List<DeviceReadingModel>> getDeviceReadings(
    String deviceId, {
    DateTime? from,
    DateTime? to,
    int limit = 100,
  }) async {
    try {
      var query = _client
          .from(SupabaseConfig.deviceReadingsTable)
          .select()
          .eq('device_id', deviceId);

      if (from != null) {
        query = query.gte('recorded_at', from.toIso8601String());
      }
      if (to != null) {
        query = query.lte('recorded_at', to.toIso8601String());
      }

      final response = await query
          .order('recorded_at', ascending: false)
          .limit(limit);

      return (response as List)
          .map((json) => DeviceReadingModel.fromJson(json))
          .toList();
    } catch (e) {
      print('Error fetching device readings: $e');
      return [];
    }
  }

  /// Convert DeviceModel to TDSDevice (for UI compatibility)
  TDSDevice toTDSDevice(DeviceModel model) {
    return TDSDevice(
      id: model.id,
      name: model.name,
      location: model.location,
      coordinates: LatLng(model.latitude, model.longitude),
      status: model.status,
      currentTDS: model.currentTds,
      temperature: model.temperature,
      lastUpdated: model.updatedAt,
    );
  }

  /// Get all devices as TDSDevice (for UI compatibility)
  Future<List<TDSDevice>> getAllTDSDevices() async {
    final devices = await getAllDevices();
    return devices.map((d) => toTDSDevice(d)).toList();
  }

  /// Subscribe to device changes (realtime)
  RealtimeChannel subscribeToDevices(void Function(List<DeviceModel>) onData) {
    return _client
        .channel('devices-changes')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: SupabaseConfig.devicesTable,
          callback: (payload) async {
            // Refetch all devices on any change
            final devices = await getAllDevices();
            onData(devices);
          },
        )
        .subscribe();
  }
}
