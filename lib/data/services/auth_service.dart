import 'package:shared_preferences/shared_preferences.dart';
import '../../domain/entities/user.dart';
import '../../domain/entities/user_role.dart';
import '../../core/constants/app_constants.dart';

/// Authentication service for managing user authentication and sessions
class AuthService {
  final SharedPreferences _prefs;
  
  AuthService(this._prefs);
  
  /// Authenticate user with credentials
  /// In production, this would call a backend API
  Future<User?> login(String username, String password, UserRole role) async {
    // Simulate API call delay
    await Future.delayed(const Duration(milliseconds: 500));
    
    // Demo authentication logic
    // In production, replace with actual API call
    if (username.isNotEmpty && password.length >= 6) {
      final user = User(
        id: 'user_${DateTime.now().millisecondsSinceEpoch}',
        username: username,
        email: '$username@evaratds.com',
        role: role,
        lastLogin: DateTime.now(),
      );
      
      // Store session
      await _saveUserSession(user);
      
      return user;
    }
    
    return null;
  }
  
  /// Logout user and clear session
  Future<void> logout() async {
    await _prefs.remove(AppConstants.keyAuthToken);
    await _prefs.remove(AppConstants.keyUserRole);
    await _prefs.remove(AppConstants.keyUserId);
    await _prefs.remove(AppConstants.keyUsername);
  }
  
  /// Get current user from stored session
  Future<User?> getCurrentUser() async {
    final userId = _prefs.getString(AppConstants.keyUserId);
    final username = _prefs.getString(AppConstants.keyUsername);
    final roleStr = _prefs.getString(AppConstants.keyUserRole);
    
    if (userId == null || username == null || roleStr == null) {
      return null;
    }
    
    final role = UserRole.values.firstWhere((e) => e.name == roleStr);
    
    return User(
      id: userId,
      username: username,
      email: '$username@evaratds.com',
      role: role,
    );
  }
  
  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    final token = _prefs.getString(AppConstants.keyAuthToken);
    return token != null;
  }
  
  /// Save user session to local storage
  Future<void> _saveUserSession(User user) async {
    await _prefs.setString(AppConstants.keyAuthToken, 'token_${user.id}');
    await _prefs.setString(AppConstants.keyUserId, user.id);
    await _prefs.setString(AppConstants.keyUsername, user.username);
    await _prefs.setString(AppConstants.keyUserRole, user.role.name);
  }
}
