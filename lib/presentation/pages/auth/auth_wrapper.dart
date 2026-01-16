import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'login_page.dart';
import 'signup_page.dart';

/// Auth wrapper that handles navigation between login and signup
class AuthWrapper extends ConsumerStatefulWidget {
  final VoidCallback? onAuthSuccess;
  final bool allowAdminSignUp;

  const AuthWrapper({
    super.key,
    this.onAuthSuccess,
    this.allowAdminSignUp = false,
  });

  @override
  ConsumerState<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends ConsumerState<AuthWrapper> {
  bool _showLogin = true;

  @override
  Widget build(BuildContext context) {
    if (_showLogin) {
      return LoginPage(
        onLoginSuccess: widget.onAuthSuccess,
        onNavigateToSignUp: () => setState(() => _showLogin = false),
      );
    } else {
      return SignUpPage(
        allowAdminSignUp: widget.allowAdminSignUp,
        onSignUpSuccess: () {
          // After signup, show login page
          setState(() => _showLogin = true);
        },
        onNavigateToLogin: () => setState(() => _showLogin = true),
      );
    }
  }
}
