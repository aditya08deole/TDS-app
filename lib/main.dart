import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'core/config/supabase_service.dart';
import 'core/theme/app_theme_config.dart';
import 'core/theme/theme_provider.dart' as theme;
import 'presentation/providers/app_providers.dart';
import 'presentation/pages/main_screen.dart';

/// EvaraTDS - Production-Grade Water Quality Monitoring System
/// 
/// A modern, scalable Flutter application for campus-scale TDS monitoring
/// with role-based access control, real-time visualization, and futuristic UI.
/// 
/// Architecture:
/// - Clean Architecture (Domain, Data, Presentation layers)
/// - State Management: Riverpod
/// - UI: Glassmorphism with cyberpunk aesthetics
/// - Maps: OpenStreetMap integration
/// - Charts: FL Chart for data visualization
/// - Theme System: Enterprise-grade Dark/Light mode with persistence
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Load environment variables
  await dotenv.load(fileName: ".env");
  
  // Initialize Supabase
  await SupabaseService.initialize();
  
  // Initialize SharedPreferences for local storage
  final prefs = await SharedPreferences.getInstance();
  
  runApp(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        theme.sharedPreferencesProvider.overrideWithValue(prefs),
      ],
      child: const EvaraTDSApp(),
    ),
  );
}

class EvaraTDSApp extends ConsumerWidget {
  const EvaraTDSApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(theme.themeModeProvider);
    
    return MaterialApp(
      title: 'EvaraTDS',
      debugShowCheckedModeBanner: false,
      themeMode: themeMode.themeMode,
      theme: AppThemeConfig.lightTheme,
      darkTheme: AppThemeConfig.darkTheme,
      home: const MainScreen(),
    );
  }
}

/// Splash screen shown while loading
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF0A0E27),
              Color(0xFF1A1F3A),
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated Logo
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.0, end: 1.0),
                duration: const Duration(milliseconds: 1000),
                builder: (context, value, child) {
                  return Transform.scale(
                    scale: value,
                    child: Container(
                      padding: const EdgeInsets.all(30),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFF00D9FF), Color(0xFF1DE9B6)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF00D9FF).withOpacity(0.5 * value),
                            blurRadius: 40,
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.water_drop,
                        size: 80,
                        color: Colors.black,
                      ),
                    ),
                  );
                },
              ),
              
              const SizedBox(height: 40),
              
              // App Name
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.0, end: 1.0),
                duration: const Duration(milliseconds: 1200),
                builder: (context, value, child) {
                  return Opacity(
                    opacity: value,
                    child: ShaderMask(
                      shaderCallback: (bounds) => const LinearGradient(
                        colors: [Color(0xFF00D9FF), Color(0xFF1DE9B6)],
                      ).createShader(bounds),
                      child: Text(
                        'EvaraTDS',
                        style: Theme.of(context).textTheme.displayLarge!.copyWith(
                              color: Colors.white,
                              fontSize: 48,
                            ),
                      ),
                    ),
                  );
                },
              ),
              
              const SizedBox(height: 12),
              
              Text(
                'Water Quality Monitoring',
                style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                      color: const Color(0xFF78909C),
                      letterSpacing: 2,
                    ),
              ),
              
              const SizedBox(height: 60),
              
              // Loading Indicator
              const SizedBox(
                width: 40,
                height: 40,
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00D9FF)),
                  strokeWidth: 3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
