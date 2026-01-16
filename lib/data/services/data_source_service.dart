import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../domain/entities/tds_device.dart';
import '../../domain/entities/device_status.dart';

/// Service for fetching live data from ThingSpeak and other data sources
/// Provides real-time telemetry integration
class DataSourceService {
  final http.Client _httpClient;

  DataSourceService({http.Client? httpClient})
      : _httpClient = httpClient ?? http.Client();

  /// Fetch latest reading from ThingSpeak channel
  /// Returns updated device with fresh data or null if fetch fails
  Future<TDSDevice?> fetchThingSpeakData(TDSDevice device) async {
    if (device.apiKey == null || device.channelId == null) {
      return null; // Missing configuration
    }

    try {
      final url = Uri.parse(
        'https://api.thingspeak.com/channels/${device.channelId}/feeds.json'
        '?api_key=${device.apiKey}&results=1',
      );

      final response = await _httpClient.get(url).timeout(
            const Duration(seconds: 10),
          );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final feeds = data['feeds'] as List<dynamic>?;

        if (feeds != null && feeds.isNotEmpty) {
          final latestFeed = feeds.first as Map<String, dynamic>;

          // Extract TDS value (assuming field1 contains TDS)
          final tdsValue = double.tryParse(
                latestFeed['field1']?.toString() ?? '',
              ) ??
              device.currentTDS;

          // Extract temperature (assuming field2 contains temperature)
          final tempValue = double.tryParse(
            latestFeed['field2']?.toString() ?? '',
          );

          // Parse timestamp
          final timestamp = DateTime.tryParse(
                latestFeed['created_at']?.toString() ?? '',
              ) ??
              DateTime.now();

          // Determine status based on TDS value
          final status = _determineStatus(
            tdsValue,
            device.warningThreshold ?? 300.0,
            device.criticalThreshold ?? 600.0,
          );

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
            currentTDS: tdsValue,
            temperature: tempValue,
            status: status,
            lastUpdated: timestamp,
            isActive: device.isActive,
            isEnabled: device.isEnabled,
            createdAt: device.createdAt,
            createdBy: device.createdBy,
            updatedAt: device.updatedAt,
            updatedBy: device.updatedBy,
            lastValidatedAt: DateTime.now(),
            notes: device.notes,
            warningThreshold: device.warningThreshold,
            criticalThreshold: device.criticalThreshold,
          );
        }
      }

      return null; // Failed to fetch or parse
    } catch (e) {
      print('Error fetching ThingSpeak data: $e');
      return null;
    }
  }

  /// Validate ThingSpeak connection during device onboarding
  /// Returns true if channel is accessible and has valid structure
  Future<bool> validateThingSpeakConnection(
    String channelId,
    String apiKey,
  ) async {
    try {
      final url = Uri.parse(
        'https://api.thingspeak.com/channels/$channelId/feeds.json'
        '?api_key=$apiKey&results=1',
      );

      final response = await _httpClient.get(url).timeout(
            const Duration(seconds: 10),
          );

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  DeviceStatus _determineStatus(
    double tdsValue,
    double warningThreshold,
    double criticalThreshold,
  ) {
    if (tdsValue >= criticalThreshold) {
      return DeviceStatus.critical;
    } else if (tdsValue >= warningThreshold) {
      return DeviceStatus.warning;
    } else {
      return DeviceStatus.online;
    }
  }

  void dispose() {
    _httpClient.close();
  }
}
