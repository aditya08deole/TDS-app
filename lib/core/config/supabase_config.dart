import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Supabase configuration
/// 
/// Contains all Supabase credentials and configuration settings.
/// In production, these should be loaded from environment variables.
class SupabaseConfig {
  // Supabase Project URL
  static String get supabaseUrl => dotenv.env['SUPABASE_URL'] ?? '';
  
  // Supabase Anon Key (public)
  static String get supabaseAnonKey => dotenv.env['SUPABASE_ANON_KEY'] ?? '';
  
  // Table names
  static const String profilesTable = 'profiles';
  static const String devicesTable = 'devices';
  static const String deviceReadingsTable = 'device_readings';
  static const String incidentsTable = 'incidents';
  static const String userSettingsTable = 'user_settings';
  static const String appSettingsTable = 'app_settings';
  static const String auditLogsTable = 'audit_logs';
}
