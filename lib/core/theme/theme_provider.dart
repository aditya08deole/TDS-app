import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Theme mode enum
enum AppThemeMode {
  light,
  dark;

  ThemeMode get themeMode {
    switch (this) {
      case AppThemeMode.light:
        return ThemeMode.light;
      case AppThemeMode.dark:
        return ThemeMode.dark;
    }
  }

  String get displayName {
    switch (this) {
      case AppThemeMode.light:
        return 'Light Mode';
      case AppThemeMode.dark:
        return 'Dark Mode';
    }
  }
}

/// Theme persistence service
class ThemeService {
  static const String _themeKey = 'app_theme_mode';
  final SharedPreferences _prefs;

  ThemeService(this._prefs);

  /// Get saved theme mode
  AppThemeMode getSavedTheme() {
    final themeName = _prefs.getString(_themeKey);
    if (themeName == 'light') {
      return AppThemeMode.light;
    }
    return AppThemeMode.dark; // Default to dark
  }

  /// Save theme mode
  Future<void> saveTheme(AppThemeMode mode) async {
    await _prefs.setString(_themeKey, mode.name);
  }
}

/// Theme provider - manages app theme with persistence
final themeServiceProvider = Provider<ThemeService>((ref) {
  final prefs = ref.watch(sharedPreferencesProvider);
  return ThemeService(prefs);
});

final themeModeProvider = StateNotifierProvider<ThemeModeNotifier, AppThemeMode>((ref) {
  final themeService = ref.watch(themeServiceProvider);
  return ThemeModeNotifier(themeService);
});

/// Theme notifier with persistence
class ThemeModeNotifier extends StateNotifier<AppThemeMode> {
  final ThemeService _themeService;

  ThemeModeNotifier(this._themeService) : super(_themeService.getSavedTheme());

  /// Toggle theme between light and dark
  Future<void> toggleTheme() async {
    final newMode = state == AppThemeMode.dark ? AppThemeMode.light : AppThemeMode.dark;
    state = newMode;
    await _themeService.saveTheme(newMode);
  }

  /// Set specific theme
  Future<void> setTheme(AppThemeMode mode) async {
    state = mode;
    await _themeService.saveTheme(mode);
  }
}

/// Shared preferences provider (imported from app_providers)
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError();
});
