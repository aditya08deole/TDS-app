import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/config/supabase_service.dart';
import '../../data/services/supabase_auth_service.dart';
import '../../data/services/supabase_device_service.dart';
import '../../data/services/supabase_incident_service.dart';
import '../../data/services/supabase_settings_service.dart';
import '../../data/services/device_data_service.dart';
import '../../data/services/cache_service.dart';
import '../../domain/entities/user_profile.dart';
import '../../domain/entities/models/device_model.dart';
import '../../domain/entities/models/incident_model.dart';
import '../../domain/entities/tds_device.dart';

// ==================== Service Providers ====================

/// Supabase Auth Service provider
final supabaseAuthServiceProvider = Provider<SupabaseAuthService>((ref) {
  return SupabaseAuthService();
});

/// Supabase Device Service provider
final supabaseDeviceServiceProvider = Provider<SupabaseDeviceService>((ref) {
  return SupabaseDeviceService();
});

/// Supabase Incident Service provider
final supabaseIncidentServiceProvider = Provider<SupabaseIncidentService>((ref) {
  return SupabaseIncidentService();
});

/// Supabase Settings Service provider
final supabaseSettingsServiceProvider = Provider<SupabaseSettingsService>((ref) {
  return SupabaseSettingsService();
});

/// Device Data Service provider (with caching and ThingSpeak integration)
final deviceDataServiceProvider = Provider<DeviceDataService>((ref) {
  return DeviceDataService();
});

/// Cache Service provider
final cacheServiceProvider = Provider<CacheService>((ref) {
  return CacheService();
});

// ==================== Auth Providers ====================

/// Auth state provider - stream of auth changes
final authStateProvider = StreamProvider<AuthState>((ref) {
  return SupabaseService.client.auth.onAuthStateChange;
});

/// Current Supabase user provider
final currentSupabaseUserProvider = Provider<User?>((ref) {
  ref.watch(authStateProvider);
  return SupabaseService.currentUser;
});

/// Is logged in provider
final isLoggedInProvider = Provider<bool>((ref) {
  final user = ref.watch(currentSupabaseUserProvider);
  return user != null;
});

/// Admin email constant - hardcoded for simplicity
const String _adminEmail = 'adityadeole08@gmail.com';

/// Current user profile provider - uses email-based admin detection
final userProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final user = SupabaseService.currentUser;
  if (user == null) return null;
  
  // Simple email-based admin detection
  final isAdmin = user.email?.toLowerCase() == _adminEmail.toLowerCase();
  
  return UserProfile(
    id: user.id,
    email: user.email ?? '',
    fullName: user.userMetadata?['full_name'] as String? ?? user.email?.split('@').first,
    role: isAdmin ? UserRole.admin : UserRole.user,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );
});

/// Is admin provider - checks if current user email is admin email
final isAdminProvider = Provider<bool>((ref) {
  final user = ref.watch(currentSupabaseUserProvider);
  if (user == null) return false;
  return user.email?.toLowerCase() == _adminEmail.toLowerCase();
});

/// User role provider
final userRoleProvider = Provider<UserRole?>((ref) {
  final profileAsync = ref.watch(userProfileProvider);
  return profileAsync.when(
    data: (profile) => profile?.role,
    loading: () => null,
    error: (_, __) => null,
  );
});

// ==================== Device Providers ====================

/// All devices from Supabase
final supabaseDevicesProvider = FutureProvider<List<DeviceModel>>((ref) async {
  final deviceService = ref.watch(supabaseDeviceServiceProvider);
  return await deviceService.getAllDevices();
});

/// All devices with ThingSpeak data (cached and real-time)
final deviceDataProvider = FutureProvider<List<DeviceModel>>((ref) async {
  final deviceDataService = ref.watch(deviceDataServiceProvider);
  return await deviceDataService.getAllDevices();
});

/// Refreshed devices with latest ThingSpeak readings
final refreshedDevicesProvider = FutureProvider<List<DeviceModel>>((ref) async {
  final deviceDataService = ref.watch(deviceDataServiceProvider);
  return await deviceDataService.refreshAllDevices();
});

/// All devices as TDSDevice (for UI compatibility)
final supabaseTDSDevicesProvider = FutureProvider<List<TDSDevice>>((ref) async {
  final deviceDataService = ref.watch(deviceDataServiceProvider);
  return await deviceDataService.getAllTDSDevices();
});

/// Single device by ID
final deviceByIdProvider = FutureProvider.family<DeviceModel?, String>((ref, id) async {
  final deviceService = ref.watch(supabaseDeviceServiceProvider);
  return await deviceService.getDeviceById(id);
});

/// Device readings by device ID
final deviceReadingsProvider = FutureProvider.family<List<DeviceReadingModel>, String>((ref, deviceId) async {
  final deviceService = ref.watch(supabaseDeviceServiceProvider);
  return await deviceService.getDeviceReadings(deviceId);
});

// ==================== Incident Providers ====================

/// All incidents
final supabaseIncidentsProvider = FutureProvider<List<IncidentModel>>((ref) async {
  final incidentService = ref.watch(supabaseIncidentServiceProvider);
  return await incidentService.getAllIncidents();
});

/// Open incidents only
final openIncidentsProvider = FutureProvider<List<IncidentModel>>((ref) async {
  final incidentService = ref.watch(supabaseIncidentServiceProvider);
  return await incidentService.getOpenIncidents();
});

/// Incident statistics
final incidentStatsProvider = FutureProvider<Map<String, int>>((ref) async {
  final incidentService = ref.watch(supabaseIncidentServiceProvider);
  return await incidentService.getIncidentStats();
});

/// Single incident by ID
final incidentByIdProvider = FutureProvider.family<IncidentModel?, String>((ref, id) async {
  final incidentService = ref.watch(supabaseIncidentServiceProvider);
  return await incidentService.getIncidentById(id);
});

// ==================== Settings Providers ====================

/// All user settings
final userSettingsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final settingsService = ref.watch(supabaseSettingsServiceProvider);
  ref.watch(authStateProvider); // React to auth changes
  return await settingsService.getAllUserSettings();
});

/// All app settings
final appSettingsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final settingsService = ref.watch(supabaseSettingsServiceProvider);
  return await settingsService.getAllAppSettings();
});

/// Theme mode setting
final themeModeSetting = FutureProvider<String?>((ref) async {
  final settingsService = ref.watch(supabaseSettingsServiceProvider);
  final value = await settingsService.getUserSetting(SupabaseSettingsService.themeMode);
  return value as String?;
});

// ==================== All Users Provider (Admin) ====================

/// All users (admin only)
final allUsersProvider = FutureProvider<List<UserProfile>>((ref) async {
  final authService = ref.watch(supabaseAuthServiceProvider);
  return await authService.getAllUsers();
});
