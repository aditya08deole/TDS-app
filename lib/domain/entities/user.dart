import 'user_role.dart';

/// User entity representing an authenticated user
class User {
  final String id;
  final String username;
  final String email;
  final UserRole role;
  final DateTime? lastLogin;

  const User({
    required this.id,
    required this.username,
    required this.email,
    required this.role,
    this.lastLogin,
  });

  bool get isAdmin => role.isAdmin;
  bool get isUser => role.isUser;

  User copyWith({
    String? id,
    String? username,
    String? email,
    UserRole? role,
    DateTime? lastLogin,
  }) {
    return User(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      role: role ?? this.role,
      lastLogin: lastLogin ?? this.lastLogin,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'role': role.name,
      'lastLogin': lastLogin?.toIso8601String(),
    };
  }

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String,
      role: UserRole.values.firstWhere((e) => e.name == json['role']),
      lastLogin: json['lastLogin'] != null 
          ? DateTime.parse(json['lastLogin'] as String) 
          : null,
    );
  }
}
