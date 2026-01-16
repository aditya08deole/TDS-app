import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/config/supabase_config.dart';
import '../../core/config/supabase_service.dart';
import '../../domain/entities/user_profile.dart';

/// Supabase Authentication service
class SupabaseAuthService {
  final SupabaseClient _client = SupabaseService.client;

  /// Get current user
  User? get currentUser => _client.auth.currentUser;

  /// Check if user is logged in
  bool get isLoggedIn => currentUser != null;

  /// Listen to auth state changes
  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  /// Sign up with email and password
  /// 
  /// [role] can be 'admin', 'user', or 'viewer' - defaults to 'user'
  Future<AuthResponse> signUp({
    required String email,
    required String password,
    String? fullName,
    String role = 'user',
  }) async {
    final response = await _client.auth.signUp(
      email: email,
      password: password,
      data: {
        'full_name': fullName ?? email.split('@').first,
        'role': role,
      },
    );

    return response;
  }

  /// Sign up as admin (requires special handling)
  /// In production, admin creation should be restricted
  Future<AuthResponse> signUpAdmin({
    required String email,
    required String password,
    String? fullName,
  }) async {
    return signUp(
      email: email,
      password: password,
      fullName: fullName,
      role: 'admin',
    );
  }

  /// Sign in with email and password
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    final response = await _client.auth.signInWithPassword(
      email: email,
      password: password,
    );

    return response;
  }

  /// Sign out
  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  /// Reset password - sends reset email
  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(email);
  }

  /// Update password
  Future<UserResponse> updatePassword(String newPassword) async {
    return await _client.auth.updateUser(
      UserAttributes(password: newPassword),
    );
  }

  /// Get current user profile from profiles table
  Future<UserProfile?> getCurrentProfile() async {
    final user = currentUser;
    if (user == null) return null;

    try {
      final response = await _client
          .from(SupabaseConfig.profilesTable)
          .select()
          .eq('id', user.id)
          .maybeSingle();

      if (response == null) {
        // Profile doesn't exist, create it from user metadata
        print('Profile not found, creating from user metadata...');
        final metadata = user.userMetadata ?? {};
        final role = metadata['role'] as String? ?? 'user';
        final fullName = metadata['full_name'] as String? ?? user.email?.split('@').first;
        
        try {
          final newProfile = await _client
              .from(SupabaseConfig.profilesTable)
              .insert({
                'id': user.id,
                'email': user.email,
                'full_name': fullName,
                'role': role,
              })
              .select()
              .single();
          
          print('Profile created with role: $role');
          return UserProfile.fromJson(newProfile);
        } catch (insertError) {
          print('Error creating profile: $insertError');
          // Return a default profile based on metadata
          return UserProfile(
            id: user.id,
            email: user.email ?? '',
            fullName: fullName,
            role: UserRole.fromString(role),
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          );
        }
      }

      print('Profile loaded with role: ${response['role']}');
      return UserProfile.fromJson(response);
    } catch (e) {
      print('Error fetching profile: $e');
      // Return a default profile from user metadata
      final metadata = user.userMetadata ?? {};
      final role = metadata['role'] as String? ?? 'user';
      return UserProfile(
        id: user.id,
        email: user.email ?? '',
        fullName: metadata['full_name'] as String?,
        role: UserRole.fromString(role),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
    }
  }

  /// Update user profile
  Future<UserProfile?> updateProfile({
    String? fullName,
    String? avatarUrl,
  }) async {
    final user = currentUser;
    if (user == null) return null;

    try {
      final updates = <String, dynamic>{};
      if (fullName != null) updates['full_name'] = fullName;
      if (avatarUrl != null) updates['avatar_url'] = avatarUrl;

      if (updates.isEmpty) return getCurrentProfile();

      final response = await _client
          .from(SupabaseConfig.profilesTable)
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();

      return UserProfile.fromJson(response);
    } catch (e) {
      print('Error updating profile: $e');
      return null;
    }
  }

  /// Update user role (admin only)
  Future<UserProfile?> updateUserRole(String userId, UserRole role) async {
    try {
      final response = await _client
          .from(SupabaseConfig.profilesTable)
          .update({'role': role.name})
          .eq('id', userId)
          .select()
          .single();

      return UserProfile.fromJson(response);
    } catch (e) {
      print('Error updating user role: $e');
      return null;
    }
  }

  /// Get all users (admin only)
  Future<List<UserProfile>> getAllUsers() async {
    try {
      final response = await _client
          .from(SupabaseConfig.profilesTable)
          .select()
          .order('created_at', ascending: false);

      return (response as List)
          .map((json) => UserProfile.fromJson(json))
          .toList();
    } catch (e) {
      print('Error fetching users: $e');
      return [];
    }
  }

  /// Check if current user is admin
  Future<bool> isCurrentUserAdmin() async {
    final profile = await getCurrentProfile();
    return profile?.role == UserRole.admin;
  }

  /// Delete user account
  Future<void> deleteAccount() async {
    // This requires the service role key to delete from auth.users
    // For now, we'll just sign out
    await signOut();
  }
}
