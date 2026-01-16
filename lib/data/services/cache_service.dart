import 'dart:async';
import 'dart:collection';
import 'package:flutter/foundation.dart';

/// Cache entry with timestamp and TTL
class CacheEntry<T> {
  final T data;
  final DateTime cachedAt;
  final Duration ttl;

  CacheEntry({
    required this.data,
    required this.ttl,
    DateTime? cachedAt,
  }) : cachedAt = cachedAt ?? DateTime.now();

  bool get isExpired => DateTime.now().difference(cachedAt) > ttl;
  
  Duration get age => DateTime.now().difference(cachedAt);
  
  Duration get remainingTtl {
    final remaining = ttl - age;
    return remaining.isNegative ? Duration.zero : remaining;
  }
}

/// Cache statistics for monitoring
class CacheStats {
  int hits = 0;
  int misses = 0;
  int evictions = 0;
  int size = 0;

  double get hitRate => (hits + misses) > 0 ? hits / (hits + misses) : 0;

  Map<String, dynamic> toJson() => {
    'hits': hits,
    'misses': misses,
    'evictions': evictions,
    'size': size,
    'hitRate': hitRate,
  };

  @override
  String toString() => 'CacheStats(hits: $hits, misses: $misses, evictions: $evictions, size: $size, hitRate: ${(hitRate * 100).toStringAsFixed(1)}%)';
}

/// High-performance in-memory cache with LRU eviction
/// Designed for handling many concurrent users without lag
class CacheService {
  static final CacheService _instance = CacheService._internal();
  factory CacheService() => _instance;
  CacheService._internal();

  /// Maximum number of entries in cache
  static const int _maxEntries = 1000;

  /// Default TTL for cached data
  static const Duration defaultTtl = Duration(seconds: 5);

  /// Short TTL for real-time data (very short for 3s refresh)
  static const Duration realtimeTtl = Duration(seconds: 2);

  /// Long TTL for static data
  static const Duration staticTtl = Duration(minutes: 5);

  /// LRU cache with LinkedHashMap for O(1) access
  final LinkedHashMap<String, CacheEntry<dynamic>> _cache = LinkedHashMap();

  /// Pending requests to prevent duplicate fetches
  final Map<String, Completer<dynamic>> _pendingRequests = {};

  /// Cache statistics
  final CacheStats stats = CacheStats();

  /// Get item from cache
  T? get<T>(String key) {
    final entry = _cache[key];
    if (entry == null) {
      stats.misses++;
      return null;
    }

    if (entry.isExpired) {
      _cache.remove(key);
      stats.misses++;
      stats.evictions++;
      return null;
    }

    // Move to end (most recently used)
    _cache.remove(key);
    _cache[key] = entry;
    stats.hits++;
    
    return entry.data as T?;
  }

  /// Set item in cache
  void set<T>(String key, T data, {Duration? ttl}) {
    // Evict oldest entries if at capacity
    while (_cache.length >= _maxEntries) {
      final oldestKey = _cache.keys.first;
      _cache.remove(oldestKey);
      stats.evictions++;
    }

    _cache[key] = CacheEntry<T>(
      data: data,
      ttl: ttl ?? defaultTtl,
    );
    stats.size = _cache.length;
  }

  /// Get or fetch with automatic caching
  /// Prevents duplicate concurrent requests for the same key
  Future<T?> getOrFetch<T>(
    String key,
    Future<T?> Function() fetcher, {
    Duration? ttl,
    bool forceRefresh = false,
  }) async {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      final cached = get<T>(key);
      if (cached != null) {
        debugPrint('Cache hit: $key');
        return cached;
      }
    }

    // Check if there's already a pending request for this key
    if (_pendingRequests.containsKey(key)) {
      debugPrint('Waiting for pending request: $key');
      return await _pendingRequests[key]!.future as T?;
    }

    // Create new request
    final completer = Completer<T?>();
    _pendingRequests[key] = completer;

    try {
      debugPrint('Fetching: $key');
      final data = await fetcher();
      
      if (data != null) {
        set<T>(key, data, ttl: ttl);
      }
      
      completer.complete(data);
      return data;
    } catch (e) {
      completer.completeError(e);
      rethrow;
    } finally {
      _pendingRequests.remove(key);
    }
  }

  /// Invalidate a specific key
  void invalidate(String key) {
    _cache.remove(key);
    stats.size = _cache.length;
  }

  /// Invalidate all keys matching a pattern
  void invalidatePattern(String pattern) {
    final regex = RegExp(pattern);
    final keysToRemove = _cache.keys.where((k) => regex.hasMatch(k)).toList();
    for (final key in keysToRemove) {
      _cache.remove(key);
    }
    stats.size = _cache.length;
  }

  /// Clear all cache
  void clear() {
    _cache.clear();
    stats.size = 0;
  }

  /// Clear expired entries
  int clearExpired() {
    final expiredKeys = _cache.entries
        .where((e) => e.value.isExpired)
        .map((e) => e.key)
        .toList();
    
    for (final key in expiredKeys) {
      _cache.remove(key);
      stats.evictions++;
    }
    
    stats.size = _cache.length;
    return expiredKeys.length;
  }

  /// Get cache statistics
  CacheStats getStats() => stats;

  /// Warm up cache with pre-loaded data
  void warmUp<T>(Map<String, T> data, {Duration? ttl}) {
    for (final entry in data.entries) {
      set<T>(entry.key, entry.value, ttl: ttl ?? staticTtl);
    }
  }
}

/// Specialized cache for device readings
class DeviceReadingCache {
  static final DeviceReadingCache _instance = DeviceReadingCache._internal();
  factory DeviceReadingCache() => _instance;
  DeviceReadingCache._internal();

  final CacheService _cache = CacheService();

  /// Cache key prefix for device readings
  static const String _prefix = 'device_reading';

  /// Get cached reading for a device
  T? getReading<T>(String deviceId) {
    return _cache.get<T>('$_prefix:$deviceId');
  }

  /// Set reading for a device
  void setReading<T>(String deviceId, T reading) {
    _cache.set<T>(
      '$_prefix:$deviceId',
      reading,
      ttl: CacheService.realtimeTtl,
    );
  }

  /// Get or fetch reading with automatic caching
  Future<T?> getOrFetchReading<T>(
    String deviceId,
    Future<T?> Function() fetcher, {
    bool forceRefresh = false,
  }) {
    return _cache.getOrFetch<T>(
      '$_prefix:$deviceId',
      fetcher,
      ttl: CacheService.realtimeTtl,
      forceRefresh: forceRefresh,
    );
  }

  /// Invalidate reading for a device
  void invalidateReading(String deviceId) {
    _cache.invalidate('$_prefix:$deviceId');
  }

  /// Invalidate all device readings
  void invalidateAllReadings() {
    _cache.invalidatePattern('^$_prefix:');
  }

  /// Get cache stats
  CacheStats getStats() => _cache.getStats();
}

/// Specialized cache for device list
class DeviceListCache {
  static final DeviceListCache _instance = DeviceListCache._internal();
  factory DeviceListCache() => _instance;
  DeviceListCache._internal();

  final CacheService _cache = CacheService();

  static const String _key = 'device_list';

  /// Get cached device list
  List<T>? getDevices<T>() {
    return _cache.get<List<T>>(_key);
  }

  /// Set device list
  void setDevices<T>(List<T> devices) {
    _cache.set<List<T>>(
      _key,
      devices,
      ttl: CacheService.defaultTtl,
    );
  }

  /// Get or fetch device list
  Future<List<T>?> getOrFetchDevices<T>(
    Future<List<T>?> Function() fetcher, {
    bool forceRefresh = false,
  }) {
    return _cache.getOrFetch<List<T>>(
      _key,
      fetcher,
      ttl: CacheService.defaultTtl,
      forceRefresh: forceRefresh,
    );
  }

  /// Invalidate device list
  void invalidate() {
    _cache.invalidate(_key);
  }
}
