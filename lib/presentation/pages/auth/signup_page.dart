import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/design_tokens.dart';
import '../../widgets/glass_card.dart';
import '../../widgets/gradient_background.dart';
import '../../providers/supabase_providers.dart';

/// Sign up page for Supabase authentication
class SignUpPage extends ConsumerStatefulWidget {
  final VoidCallback? onSignUpSuccess;
  final VoidCallback? onNavigateToLogin;
  final bool allowAdminSignUp;

  const SignUpPage({
    super.key,
    this.onSignUpSuccess,
    this.onNavigateToLogin,
    this.allowAdminSignUp = false, // Set to true for initial admin creation
  });

  @override
  ConsumerState<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends ConsumerState<SignUpPage> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _signUpAsAdmin = false;
  String? _errorMessage;
  bool _signUpSuccess = false;

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignUp() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final authService = ref.read(supabaseAuthServiceProvider);
      
      if (_signUpAsAdmin && widget.allowAdminSignUp) {
        await authService.signUpAdmin(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          fullName: _fullNameController.text.trim(),
        );
      } else {
        await authService.signUp(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          fullName: _fullNameController.text.trim(),
          role: 'user',
        );
      }

      setState(() {
        _signUpSuccess = true;
      });

      if (mounted) {
        widget.onSignUpSuccess?.call();
      }
    } on AuthException catch (e) {
      setState(() {
        _errorMessage = e.message;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'An unexpected error occurred. Please try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final screenSize = MediaQuery.of(context).size;
    final isDesktop = screenSize.width > 800;

    if (_signUpSuccess) {
      return Scaffold(
        body: GradientBackground(
          child: Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.all(DesignTokens.space24),
              child: GlassCard(
                padding: const EdgeInsets.all(DesignTokens.space32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: AppColors.statusNormal.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.check, color: AppColors.statusNormal, size: 40),
                    ),
                    const SizedBox(height: DesignTokens.space24),
                    Text(
                      'Account Created!',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: DesignTokens.space12),
                    Text(
                      'Please check your email to verify your account before signing in.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: DesignTokens.space24),
                    FilledButton(
                      onPressed: widget.onNavigateToLogin,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: DesignTokens.space32, vertical: DesignTokens.space16),
                        backgroundColor: AppColors.primaryCyan,
                        foregroundColor: Colors.black,
                      ),
                      child: const Text('Go to Login'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: GradientBackground(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(DesignTokens.space24),
            child: Container(
              constraints: BoxConstraints(maxWidth: isDesktop ? 450 : 400),
              child: GlassCard(
                padding: EdgeInsets.all(isDesktop ? DesignTokens.space40 : DesignTokens.space24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Logo and Title
                      Center(
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: AppColors.primaryGradient),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primaryCyan.withOpacity(0.3),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.water_drop, color: Colors.black, size: 40),
                        ),
                      ),
                      const SizedBox(height: DesignTokens.space24),
                      Text(
                        'Create Account',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: DesignTokens.space8),
                      Text(
                        'Join EvaraTDS Dashboard',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colorScheme.onSurfaceVariant),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: DesignTokens.space32),

                      // Error message
                      if (_errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(DesignTokens.space12),
                          decoration: BoxDecoration(
                            color: AppColors.statusCritical.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
                            border: Border.all(color: AppColors.statusCritical.withOpacity(0.3)),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.error_outline, color: AppColors.statusCritical, size: 20),
                              const SizedBox(width: DesignTokens.space8),
                              Expanded(child: Text(_errorMessage!, style: TextStyle(color: AppColors.statusCritical, fontSize: 13))),
                            ],
                          ),
                        ),
                        const SizedBox(height: DesignTokens.space16),
                      ],

                      // Full Name field
                      TextFormField(
                        controller: _fullNameController,
                        textInputAction: TextInputAction.next,
                        textCapitalization: TextCapitalization.words,
                        decoration: InputDecoration(
                          labelText: 'Full Name',
                          hintText: 'Enter your full name',
                          prefixIcon: const Icon(Icons.person_outlined),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(DesignTokens.radiusMd)),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please enter your name';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: DesignTokens.space16),

                      // Email field
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(
                          labelText: 'Email',
                          hintText: 'Enter your email',
                          prefixIcon: const Icon(Icons.email_outlined),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(DesignTokens.radiusMd)),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please enter your email';
                          }
                          if (!value.contains('@')) {
                            return 'Please enter a valid email';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: DesignTokens.space16),

                      // Password field
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          hintText: 'Create a password',
                          prefixIcon: const Icon(Icons.lock_outlined),
                          suffixIcon: IconButton(
                            icon: Icon(_obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          ),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(DesignTokens.radiusMd)),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please enter a password';
                          }
                          if (value.length < 6) {
                            return 'Password must be at least 6 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: DesignTokens.space16),

                      // Confirm Password field
                      TextFormField(
                        controller: _confirmPasswordController,
                        obscureText: _obscureConfirmPassword,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _handleSignUp(),
                        decoration: InputDecoration(
                          labelText: 'Confirm Password',
                          hintText: 'Confirm your password',
                          prefixIcon: const Icon(Icons.lock_outlined),
                          suffixIcon: IconButton(
                            icon: Icon(_obscureConfirmPassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                            onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                          ),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(DesignTokens.radiusMd)),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please confirm your password';
                          }
                          if (value != _passwordController.text) {
                            return 'Passwords do not match';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: DesignTokens.space16),

                      // Admin toggle (only if allowed)
                      if (widget.allowAdminSignUp) ...[
                        Container(
                          padding: const EdgeInsets.all(DesignTokens.space12),
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest.withOpacity(0.5),
                            borderRadius: BorderRadius.circular(DesignTokens.radiusMd),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.admin_panel_settings, color: _signUpAsAdmin ? AppColors.primaryCyan : colorScheme.onSurfaceVariant),
                              const SizedBox(width: DesignTokens.space12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Administrator Account', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500)),
                                    Text('Full access to manage devices and users', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colorScheme.onSurfaceVariant)),
                                  ],
                                ),
                              ),
                              Switch(
                                value: _signUpAsAdmin,
                                onChanged: (value) => setState(() => _signUpAsAdmin = value),
                                activeThumbColor: AppColors.primaryCyan,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: DesignTokens.space16),
                      ],

                      // Sign up button
                      FilledButton(
                        onPressed: _isLoading ? null : _handleSignUp,
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: DesignTokens.space16),
                          backgroundColor: AppColors.primaryCyan,
                          foregroundColor: Colors.black,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(DesignTokens.radiusMd)),
                        ),
                        child: _isLoading
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                            : Text(_signUpAsAdmin ? 'Create Admin Account' : 'Create Account', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                      const SizedBox(height: DesignTokens.space24),

                      // Login link
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Already have an account?', style: Theme.of(context).textTheme.bodyMedium),
                          TextButton(
                            onPressed: widget.onNavigateToLogin,
                            child: Text('Sign In', style: TextStyle(color: AppColors.primaryCyan, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
