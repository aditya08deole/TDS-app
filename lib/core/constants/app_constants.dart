/// Application-wide constants
class AppConstants {
  // App Info
  static const String appName = 'EvaraTDS';
  static const String appVersion = '1.0.0';
  
  // TDS Thresholds (in ppm)
  static const double tdsNormalMax = 300.0;
  static const double tdsWarningMax = 600.0;
  static const double tdsCriticalMin = 600.0;
  
  // Map Configuration - IIIT Hyderabad Campus
  static const double defaultLatitude = 17.4450; // IIIT Hyderabad Campus Center
  static const double defaultLongitude = 78.3483;
  static const double defaultZoom = 16.0;
  static const double minZoom = 3.0;
  static const double maxZoom = 18.0;
  
  // IIITH Campus Boundary
  static const double campusCenterLat = 17.4450;
  static const double campusCenterLng = 78.3483;
  static const double campusRadiusMeters = 500.0;
  
  // Animation Durations
  static const int shortAnimationDuration = 200;
  static const int mediumAnimationDuration = 300;
  static const int longAnimationDuration = 500;
  
  // Storage Keys
  static const String keyAuthToken = 'auth_token';
  static const String keyUserRole = 'user_role';
  static const String keyUserId = 'user_id';
  static const String keyUsername = 'username';
  static const String keyThemeMode = 'theme_mode';
}
