import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/config/supabase_config.dart';
import '../../core/config/supabase_service.dart';

/// Supabase service for user and app settings
class SupabaseSettingsService {
  final SupabaseClient _client = SupabaseService.client;

  // ==================== User Settings ====================

  /// Get user setting by key
  Future<dynamic> getUserSetting(String key) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return null;

    try {
      final response = await _client
          .from(SupabaseConfig.userSettingsTable)
          .select('setting_value')
          .eq('user_id', userId)
          .eq('setting_key', key)
          .maybeSingle();

      if (response == null) return null;
      return response['setting_value'];
    } catch (e) {
      print('Error fetching user setting: $e');
      return null;
    }
  }

  /// Set user setting
  Future<bool> setUserSetting(String key, dynamic value) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return false;

    try {
      await _client.from(SupabaseConfig.userSettingsTable).upsert(
        {
          'user_id': userId,
          'setting_key': key,
          'setting_value': value,
        },
        onConflict: 'user_id,setting_key',
      );

      return true;
    } catch (e) {
      print('Error setting user setting: $e');
      return false;
    }
  }

  /// Get all user settings
  Future<Map<String, dynamic>> getAllUserSettings() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return {};

    try {
      final response = await _client
          .from(SupabaseConfig.userSettingsTable)
          .select()
          .eq('user_id', userId);

      final settings = <String, dynamic>{};
      for (final row in response as List) {
        settings[row['setting_key']] = row['setting_value'];
      }
      return settings;
    } catch (e) {
      print('Error fetching user settings: $e');
      return {};
    }
  }

  /// Delete user setting
  Future<bool> deleteUserSetting(String key) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return false;

    try {
      await _client
          .from(SupabaseConfig.userSettingsTable)
          .delete()
          .eq('user_id', userId)
          .eq('setting_key', key);

      return true;
    } catch (e) {
      print('Error deleting user setting: $e');
      return false;
    }
  }

  // ==================== App Settings (Admin Only) ====================

  /// Get app setting by key
  Future<dynamic> getAppSetting(String key) async {
    try {
      final response = await _client
          .from(SupabaseConfig.appSettingsTable)
          .select('setting_value')
          .eq('setting_key', key)
          .maybeSingle();

      if (response == null) return null;
      return response['setting_value'];
    } catch (e) {
      print('Error fetching app setting: $e');
      return null;
    }
  }

  /// Set app setting (admin only)
  Future<bool> setAppSetting(String key, dynamic value) async {
    final userId = _client.auth.currentUser?.id;

    try {
      await _client.from(SupabaseConfig.appSettingsTable).upsert(
        {
          'setting_key': key,
          'setting_value': value,
          'updated_by': userId,
        },
        onConflict: 'setting_key',
      );

      return true;
    } catch (e) {
      print('Error setting app setting: $e');
      return false;
    }
  }

  /// Get all app settings
  Future<Map<String, dynamic>> getAllAppSettings() async {
    try {
      final response = await _client
          .from(SupabaseConfig.appSettingsTable)
          .select();

      final settings = <String, dynamic>{};
      for (final row in response as List) {
        settings[row['setting_key']] = row['setting_value'];
      }
      return settings;
    } catch (e) {
      print('Error fetching app settings: $e');
      return {};
    }
  }

  /// Delete app setting (admin only)
  Future<bool> deleteAppSetting(String key) async {
    try {
      await _client
          .from(SupabaseConfig.appSettingsTable)
          .delete()
          .eq('setting_key', key);

      return true;
    } catch (e) {
      print('Error deleting app setting: $e');
      return false;
    }
  }

  // ==================== Common Settings Keys ====================

  // User settings keys
  static const String themeMode = 'theme_mode';
  static const String notifications = 'notifications_enabled';
  static const String emailAlerts = 'email_alerts_enabled';
  static const String refreshInterval = 'refresh_interval_seconds';
  static const String mapStyle = 'map_style';
  static const String dashboardLayout = 'dashboard_layout';

  // App settings keys
  static const String tdsWarningThreshold = 'tds_warning_threshold';
  static const String tdsCriticalThreshold = 'tds_critical_threshold';
  static const String tempWarningThreshold = 'temp_warning_threshold';
  static const String tempCriticalThreshold = 'temp_critical_threshold';
  static const String maintenanceMode = 'maintenance_mode';
  static const String systemAnnouncement = 'system_announcement';
}
