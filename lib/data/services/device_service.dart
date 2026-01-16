import 'package:uuid/uuid.dart';
import 'package:latlong2/latlong.dart';
import '../../domain/entities/tds_device.dart';
import '../../domain/entities/device_status.dart';
import '../../domain/entities/tds_reading.dart';
import '../../domain/entities/alert.dart';
import '../../domain/entities/severity_level.dart';
import 'dart:math';

/// Mock data service for TDS devices
/// In production, replace with actual API calls
class DeviceService {
  final _uuid = const Uuid();
  final _random = Random();
  
  // Mock device data storage
  final List<TDSDevice> _devices = [];
  final List<Alert> _alerts = [];
  final Map<String, List<TDSReading>> _historicalData = {};
  
  DeviceService() {
    _initializeMockDevices();
  }
  
  /// Initialize mock devices for demo purposes
  void _initializeMockDevices() {
    // IIIT Hyderabad Campus locations - ACCURATE coordinates
    // Campus center: 17.4455° N, 78.3489° E (near academic building)
    // These are verified coordinates for actual IIITH buildings
    _devices.addAll([
      TDSDevice(
        id: _uuid.v4(),
        name: 'Himalaya Mess',
        location: 'Himalaya Block Dining Hall',
        coordinates: const LatLng(17.4427, 78.3481), // South of campus
        currentTDS: 185.5,
        temperature: 24.5,
        status: DeviceStatus.online,
        lastUpdated: DateTime.now(),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'Vindhya Mess',
        location: 'Vindhya Block Food Court',
        coordinates: const LatLng(17.4465, 78.3467), // West side near Vindhya
        currentTDS: 225.0,
        temperature: 23.8,
        status: DeviceStatus.online,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 3)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'Kadamba Canteen',
        location: 'Kadamba Mess, Near NBH',
        coordinates: const LatLng(17.4439, 78.3502), // Near NBH area - Kadamba
        currentTDS: 425.0,
        temperature: 25.2,
        status: DeviceStatus.warning,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 2)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
        // ThingSpeak config for real device
        apiKey: 'EHEK3A1XD48TY98B',
        dataSourceType: 'thingspeak',
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'Library Building',
        location: 'IIITH Central Library',
        coordinates: const LatLng(17.4453, 78.3484), // Central campus library
        currentTDS: 195.0,
        temperature: 22.5,
        status: DeviceStatus.online,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 1)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'OBH (Old Boys Hostel)',
        location: 'Old Boys Hostel Block',
        coordinates: const LatLng(17.4473, 78.3498), // OBH location
        currentTDS: 310.0,
        temperature: 24.0,
        status: DeviceStatus.warning,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 8)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'NBH (New Boys Hostel)',
        location: 'New Boys Hostel Complex',
        coordinates: const LatLng(17.4435, 78.3512), // NBH southeast
        currentTDS: 725.0,
        temperature: 26.1,
        status: DeviceStatus.critical,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 5)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'Girls Hostel (Parijaat)',
        location: 'Parijaat Girls Hostel',
        coordinates: const LatLng(17.4483, 78.3472), // GH near main road
        currentTDS: 165.0,
        temperature: 23.2,
        status: DeviceStatus.online,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 4)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'KRB (Kohli Research Building)',
        location: 'Kohli Research Block',
        coordinates: const LatLng(17.4459, 78.3455), // KRB west side
        currentTDS: 210.0,
        temperature: 22.8,
        status: DeviceStatus.online,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 6)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'Sports Complex',
        location: 'IIITH Sports Ground',
        coordinates: const LatLng(17.4415, 78.3478), // Sports area south
        currentTDS: 0.0,
        temperature: 0.0,
        status: DeviceStatus.offline,
        lastUpdated: DateTime.now().subtract(const Duration(hours: 2)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
      TDSDevice(
        id: _uuid.v4(),
        name: 'Nilgiri Block',
        location: 'Nilgiri Academic Building',
        coordinates: const LatLng(17.4448, 78.3493), // Nilgiri center
        currentTDS: 285.0,
        temperature: 24.3,
        status: DeviceStatus.online,
        lastUpdated: DateTime.now().subtract(const Duration(minutes: 7)),
        warningThreshold: 300.0,
        criticalThreshold: 600.0,
      ),
    ]);
    
    _generateMockAlertsAndHistory();
  }
  
  /// Generate mock alerts and historical data
  void _generateMockAlertsAndHistory() {
    for (var device in _devices) {
      if (device.status == DeviceStatus.critical) {
        _alerts.add(Alert(
          id: _uuid.v4(),
          deviceId: device.id,
          type: AlertType.thresholdExceeded,
          severity: SeverityLevel.critical,
          message: 'TDS level exceeded critical threshold at ${device.name}',
          value: device.currentTDS,
          threshold: device.criticalThreshold,
          metricName: 'TDS',
          metricUnit: 'ppm',
          timestamp: device.lastUpdated,
        ));
      } else if (device.status == DeviceStatus.warning) {
        _alerts.add(Alert(
          id: _uuid.v4(),
          deviceId: device.id,
          type: AlertType.thresholdExceeded,
          severity: SeverityLevel.warning,
          message: 'TDS level exceeded warning threshold at ${device.name}',
          value: device.currentTDS,
          threshold: device.warningThreshold,
          metricName: 'TDS',
          metricUnit: 'ppm',
          timestamp: device.lastUpdated,
        ));
      }
      
      // Generate historical data for past 24 hours
      _historicalData[device.id] = _generateHistoricalReadings(device.id, 24);
    }
  }
  
  /// Generate mock historical readings
  List<TDSReading> _generateHistoricalReadings(String deviceId, int hours) {
    final readings = <TDSReading>[];
    final now = DateTime.now();
    
    for (int i = hours * 6; i >= 0; i--) {
      readings.add(TDSReading(
        deviceId: deviceId,
        tdsValue: 200 + _random.nextDouble() * 300,
        temperature: 22 + _random.nextDouble() * 4,
        timestamp: now.subtract(Duration(minutes: i * 10)),
      ));
    }
    
    return readings;
  }
  
  /// Get all devices
  Future<List<TDSDevice>> getAllDevices() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return List.unmodifiable(_devices);
  }
  
  /// Get device by ID
  Future<TDSDevice?> getDeviceById(String id) async {
    await Future.delayed(const Duration(milliseconds: 100));
    try {
      return _devices.firstWhere((device) => device.id == id);
    } catch (e) {
      return null;
    }
  }
  
  /// Get historical data for a device
  Future<List<TDSReading>> getDeviceHistory(String deviceId, {int hours = 24}) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return _historicalData[deviceId] ?? [];
  }
  
  /// Get all alerts
  Future<List<Alert>> getAllAlerts() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return List.unmodifiable(_alerts);
  }
  
  /// Get unread alerts
  Future<List<Alert>> getUnreadAlerts() async {
    await Future.delayed(const Duration(milliseconds: 150));
    return _alerts.where((alert) => !alert.isAcknowledged).toList();
  }
  
  /// Mark alert as read
  Future<void> markAlertAsRead(String alertId) async {
    await Future.delayed(const Duration(milliseconds: 100));
    final index = _alerts.indexWhere((alert) => alert.id == alertId);
    if (index != -1) {
      _alerts[index] = _alerts[index].copyWith(isAcknowledged: true);
    }
  }
  
  /// Add new device (Admin only)
  Future<TDSDevice> addDevice(TDSDevice device) async {
    await Future.delayed(const Duration(milliseconds: 300));
    _devices.add(device);
    _historicalData[device.id] = [];
    return device;
  }
  
  /// Update device (Admin only)
  Future<TDSDevice> updateDevice(TDSDevice device) async {
    await Future.delayed(const Duration(milliseconds: 300));
    final index = _devices.indexWhere((d) => d.id == device.id);
    if (index != -1) {
      _devices[index] = device;
      return device;
    }
    throw Exception('Device not found');
  }
  
  /// Delete device (Admin only)
  Future<void> deleteDevice(String deviceId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    _devices.removeWhere((d) => d.id == deviceId);
    _historicalData.remove(deviceId);
    _alerts.removeWhere((a) => a.deviceId == deviceId);
  }
  
  /// Simulate real-time TDS updates
  Stream<TDSDevice> watchDevice(String deviceId) async* {
    while (true) {
      await Future.delayed(const Duration(seconds: 5));
      final device = _devices.firstWhere((d) => d.id == deviceId);
      
      // Simulate TDS fluctuation
      final newTDS = device.currentTDS + (_random.nextDouble() - 0.5) * 10;
      final updatedDevice = device.copyWith(
        currentTDS: newTDS.clamp(0, 1000),
        lastUpdated: DateTime.now(),
        status: _calculateStatus(newTDS, device.warningThreshold!, device.criticalThreshold!),
      );
      
      final index = _devices.indexWhere((d) => d.id == deviceId);
      _devices[index] = updatedDevice;
      
      yield updatedDevice;
    }
  }
  
  DeviceStatus _calculateStatus(double tds, double warning, double critical) {
    if (tds >= critical) return DeviceStatus.critical;
    if (tds >= warning) return DeviceStatus.warning;
    return DeviceStatus.online;
  }
}
