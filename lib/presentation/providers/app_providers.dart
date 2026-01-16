import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../data/services/auth_service.dart';
import '../../data/services/device_service.dart';
import '../../domain/entities/user.dart';
import '../../domain/entities/user_role.dart';
import '../../domain/entities/tds_device.dart';
import '../../domain/entities/alert.dart';

/// Shared Preferences Provider
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('SharedPreferences must be overridden');
});

/// Auth Service Provider
final authServiceProvider = Provider<AuthService>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return AuthService(prefs);
});

/// Device Service Provider
final deviceServiceProvider = Provider<DeviceService>((ref) {
  return DeviceService();
});

/// Current User Provider
final currentUserProvider = StateNotifierProvider<UserNotifier, AsyncValue<User?>>((ref) {
  return UserNotifier(ref.watch(authServiceProvider));
});

class UserNotifier extends StateNotifier<AsyncValue<User?>> {
  final AuthService _authService;

  UserNotifier(this._authService) : super(const AsyncValue.loading()) {
    _loadUser();
  }

  Future<void> _loadUser() async {
    state = const AsyncValue.loading();
    try {
      final user = await _authService.getCurrentUser();
      state = AsyncValue.data(user);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> login(String username, String password, UserRole role) async {
    try {
      final user = await _authService.login(username, password, role);
      if (user != null) {
        state = AsyncValue.data(user);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    state = const AsyncValue.data(null);
  }
}

/// Devices Provider
final devicesProvider = FutureProvider<List<TDSDevice>>((ref) async {
  final deviceService = ref.watch(deviceServiceProvider);
  return deviceService.getAllDevices();
});

/// Alerts Provider
final alertsProvider = FutureProvider<List<Alert>>((ref) async {
  final deviceService = ref.watch(deviceServiceProvider);
  return deviceService.getAllAlerts();
});

/// Unread Alerts Count Provider
final unreadAlertsCountProvider = FutureProvider<int>((ref) async {
  final deviceService = ref.watch(deviceServiceProvider);
  final alerts = await deviceService.getUnreadAlerts();
  return alerts.length;
});
