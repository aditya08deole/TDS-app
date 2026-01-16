import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';

/// ThingSpeak API response model for a single feed entry
class ThingSpeakFeed {
  final DateTime createdAt;
  final int entryId;
  final double? field1;
  final double? field2;
  final double? field3;
  final double? field4;
  final double? field5;
  final double? field6;
  final double? field7;
  final double? field8;

  ThingSpeakFeed({
    required this.createdAt,
    required this.entryId,
    this.field1,
    this.field2,
    this.field3,
    this.field4,
    this.field5,
    this.field6,
    this.field7,
    this.field8,
  });

  factory ThingSpeakFeed.fromJson(Map<String, dynamic> json) {
    return ThingSpeakFeed(
      createdAt: DateTime.parse(json['created_at'] as String),
      entryId: json['entry_id'] as int,
      field1: _parseDouble(json['field1']),
      field2: _parseDouble(json['field2']),
      field3: _parseDouble(json['field3']),
      field4: _parseDouble(json['field4']),
      field5: _parseDouble(json['field5']),
      field6: _parseDouble(json['field6']),
      field7: _parseDouble(json['field7']),
      field8: _parseDouble(json['field8']),
    );
  }

  static double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    if (value is String) {
      final parsed = double.tryParse(value);
      return parsed;
    }
    return null;
  }

  /// Get field value by field number (1-8)
  double? getField(int fieldNumber) {
    switch (fieldNumber) {
      case 1: return field1;
      case 2: return field2;
      case 3: return field3;
      case 4: return field4;
      case 5: return field5;
      case 6: return field6;
      case 7: return field7;
      case 8: return field8;
      default: return null;
    }
  }
}

/// Device reading data extracted from ThingSpeak
class DeviceReading {
  final double? tdsValue;
  final double? temperature;
  final double? voltage;
  final DateTime timestamp;
  final bool isValid;

  DeviceReading({
    this.tdsValue,
    this.temperature,
    this.voltage,
    required this.timestamp,
    this.isValid = true,
  });

  /// Check if reading is valid (not negative temp/voltage, TDS >= 20)
  factory DeviceReading.validated({
    double? tdsValue,
    double? temperature,
    double? voltage,
    required DateTime timestamp,
  }) {
    // Validation rules:
    // 1. Negative temperature is ignored
    // 2. Negative voltage is ignored
    // 3. TDS less than 20 ppm is ignored
    final isValidTemp = temperature == null || temperature >= 0;
    final isValidVoltage = voltage == null || voltage >= 0;
    final isValidTds = tdsValue == null || tdsValue >= 20;
    
    final isValid = isValidTemp && isValidVoltage && isValidTds;

    return DeviceReading(
      tdsValue: isValidTds ? tdsValue : null,
      temperature: isValidTemp ? temperature : null,
      voltage: isValidVoltage ? voltage : null,
      timestamp: timestamp,
      isValid: isValid,
    );
  }
}

/// ThingSpeak channel configuration for a device
class ThingSpeakConfig {
  final String readApiKey;
  final String? channelId;
  final int tdsFieldNumber;
  final int? temperatureFieldNumber;
  final int? voltageFieldNumber;

  const ThingSpeakConfig({
    required this.readApiKey,
    this.channelId,
    this.tdsFieldNumber = 1,
    this.temperatureFieldNumber,
    this.voltageFieldNumber,
  });

  Map<String, dynamic> toJson() => {
    'read_api_key': readApiKey,
    'channel_id': channelId,
    'tds_field': tdsFieldNumber,
    'temp_field': temperatureFieldNumber,
    'voltage_field': voltageFieldNumber,
  };

  factory ThingSpeakConfig.fromJson(Map<String, dynamic> json) {
    return ThingSpeakConfig(
      readApiKey: json['read_api_key'] as String,
      channelId: json['channel_id'] as String?,
      tdsFieldNumber: json['tds_field'] as int? ?? 1,
      temperatureFieldNumber: json['temp_field'] as int?,
      voltageFieldNumber: json['voltage_field'] as int?,
    );
  }
}

/// Service for fetching data from ThingSpeak API
class ThingSpeakService {
  static const String _baseUrl = 'https://api.thingspeak.com';
  static const Duration _timeout = Duration(seconds: 10);
  
  final http.Client _client;

  ThingSpeakService({http.Client? client}) : _client = client ?? http.Client();

  /// Fetch the latest feed entry for a channel
  Future<ThingSpeakFeed?> getLatestFeed({
    required String readApiKey,
    String? channelId,
  }) async {
    try {
      // If channelId is not provided, use feeds/last endpoint
      final uri = channelId != null
          ? Uri.parse('$_baseUrl/channels/$channelId/feeds/last.json?api_key=$readApiKey')
          : Uri.parse('$_baseUrl/channels/0/feeds/last.json?api_key=$readApiKey');

      debugPrint('ThingSpeak request: $uri');

      final response = await _client.get(uri).timeout(_timeout);

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        if (json == null || json.isEmpty) return null;
        return ThingSpeakFeed.fromJson(json);
      } else {
        debugPrint('ThingSpeak error: ${response.statusCode} - ${response.body}');
        return null;
      }
    } catch (e) {
      debugPrint('ThingSpeak fetch error: $e');
      return null;
    }
  }

  /// Fetch multiple feed entries for a channel
  Future<List<ThingSpeakFeed>> getFeeds({
    required String readApiKey,
    String? channelId,
    int results = 100,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final queryParams = <String, String>{
        'api_key': readApiKey,
        'results': results.toString(),
      };

      if (startDate != null) {
        queryParams['start'] = startDate.toIso8601String();
      }
      if (endDate != null) {
        queryParams['end'] = endDate.toIso8601String();
      }

      final uri = channelId != null
          ? Uri.parse('$_baseUrl/channels/$channelId/feeds.json').replace(queryParameters: queryParams)
          : Uri.parse('$_baseUrl/channels/0/feeds.json').replace(queryParameters: queryParams);

      debugPrint('ThingSpeak feeds request: $uri');

      final response = await _client.get(uri).timeout(_timeout);

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        final feeds = json['feeds'] as List?;
        if (feeds == null) return [];
        
        return feeds
            .map((f) => ThingSpeakFeed.fromJson(f))
            .toList();
      } else {
        debugPrint('ThingSpeak feeds error: ${response.statusCode}');
        return [];
      }
    } catch (e) {
      debugPrint('ThingSpeak feeds fetch error: $e');
      return [];
    }
  }

  /// Get device reading with validation
  Future<DeviceReading?> getDeviceReading(ThingSpeakConfig config) async {
    final feed = await getLatestFeed(
      readApiKey: config.readApiKey,
      channelId: config.channelId,
    );

    if (feed == null) return null;

    final tds = feed.getField(config.tdsFieldNumber);
    final temp = config.temperatureFieldNumber != null 
        ? feed.getField(config.temperatureFieldNumber!) 
        : null;
    final voltage = config.voltageFieldNumber != null 
        ? feed.getField(config.voltageFieldNumber!) 
        : null;

    return DeviceReading.validated(
      tdsValue: tds,
      temperature: temp,
      voltage: voltage,
      timestamp: feed.createdAt,
    );
  }

  /// Get historical readings with validation
  Future<List<DeviceReading>> getDeviceReadings(
    ThingSpeakConfig config, {
    int results = 100,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final feeds = await getFeeds(
      readApiKey: config.readApiKey,
      channelId: config.channelId,
      results: results,
      startDate: startDate,
      endDate: endDate,
    );

    return feeds.map((feed) {
      final tds = feed.getField(config.tdsFieldNumber);
      final temp = config.temperatureFieldNumber != null 
          ? feed.getField(config.temperatureFieldNumber!) 
          : null;
      final voltage = config.voltageFieldNumber != null 
          ? feed.getField(config.voltageFieldNumber!) 
          : null;

      return DeviceReading.validated(
        tdsValue: tds,
        temperature: temp,
        voltage: voltage,
        timestamp: feed.createdAt,
      );
    }).where((r) => r.isValid).toList(); // Filter out invalid readings
  }

  void dispose() {
    _client.close();
  }
}
