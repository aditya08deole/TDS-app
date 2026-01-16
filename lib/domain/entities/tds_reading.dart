/// TDS reading data point for historical data
class TDSReading {
  final String deviceId;
  final double tdsValue;
  final double? temperature;
  final DateTime timestamp;

  const TDSReading({
    required this.deviceId,
    required this.tdsValue,
    this.temperature,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() {
    return {
      'deviceId': deviceId,
      'tdsValue': tdsValue,
      'temperature': temperature,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  factory TDSReading.fromJson(Map<String, dynamic> json) {
    return TDSReading(
      deviceId: json['deviceId'] as String,
      tdsValue: (json['tdsValue'] as num).toDouble(),
      temperature: json['temperature'] != null 
          ? (json['temperature'] as num).toDouble() 
          : null,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }
}
