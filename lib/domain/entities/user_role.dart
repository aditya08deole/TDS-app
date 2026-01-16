/// User role enumeration for role-based access control
enum UserRole {
  user,
  admin;

  String get displayName {
    switch (this) {
      case UserRole.user:
        return 'User';
      case UserRole.admin:
        return 'Admin';
    }
  }

  bool get isAdmin => this == UserRole.admin;
  bool get isUser => this == UserRole.user;
}
