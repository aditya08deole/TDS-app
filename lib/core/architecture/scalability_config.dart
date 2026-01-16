/// Scalability configuration for multi-tenant, future-proof architecture
/// Defines limits, thresholds, and feature flags
library;

class ScalabilityConfig {
  // Pagination defaults
  static const int defaultPageSize = 50;
  static const int maxPageSize = 200;
  
  // Map clustering thresholds
  static const int clusterThreshold = 100; // Cluster when > this many markers
  static const double clusterRadius = 80.0;
  
  // Lazy loading thresholds
  static const int virtualListThreshold = 100;
  static const int prefetchDistance = 20;
  
  // Data refresh intervals (ms)
  static const int liveRefreshInterval = 5000;
  static const int alertRefreshInterval = 10000;
  static const int analyticsRefreshInterval = 60000;
  
  // Performance limits
  static const int maxConcurrentRequests = 5;
  static const int requestTimeout = 30000;
  static const int cacheExpiryMinutes = 5;
  
  // Multi-tenant isolation
  static const bool multiTenantEnabled = true;
  static const bool dataIsolationStrict = true;
}

/// Feature flags for gradual rollout
class FeatureFlags {
  static const bool advancedAnalytics = true;
  static const bool incidentPrediction = false;
  static const bool aiRecommendations = false;
  static const bool multiRegion = true;
  static const bool customDashboards = false;
  static const bool mobileApp = false;
  static const bool apiIntegrations = true;
}

/// Supported sensor types - extensible domain model
enum SensorDomain {
  water,
  gas,
  electricity,
  airQuality,
  temperature,
  humidity,
  pressure,
  flow;

  String get displayName {
    switch (this) {
      case SensorDomain.water: return 'Water Quality';
      case SensorDomain.gas: return 'Gas Detection';
      case SensorDomain.electricity: return 'Electricity';
      case SensorDomain.airQuality: return 'Air Quality';
      case SensorDomain.temperature: return 'Temperature';
      case SensorDomain.humidity: return 'Humidity';
      case SensorDomain.pressure: return 'Pressure';
      case SensorDomain.flow: return 'Flow Rate';
    }
  }
}

/// Tenant configuration model
class TenantConfig {
  final String id;
  final String name;
  final String? logoUrl;
  final Map<String, dynamic> branding;
  final List<SensorDomain> enabledDomains;
  final Map<String, dynamic> settings;

  const TenantConfig({
    required this.id,
    required this.name,
    this.logoUrl,
    this.branding = const {},
    this.enabledDomains = const [SensorDomain.water],
    this.settings = const {},
  });
}
