/**
 * System-wide TDS Configuration
 * Centralized source of truth for TDS thresholds and ranges
 */
export const TDS_CONFIG = {
  RANGES: {
    // User-visible safe range (Default)
    SAFE_MIN: 35,
    SAFE_MAX: 175,

    // Minimum valid reading (filter out sensor noise)
    MIN_VALID: 20,
    
    // Maximum valid reading (filter out voltage/temp misreads)
    MAX_VALID: 2000
  },
  THRESHOLDS: {
    CRITICAL_LOW: 35,
    CRITICAL_HIGH: 175,
    DEFAULT_MIN: 5,
    DEFAULT_MAX: 2000
  },
  HEARTBEAT: {
    EXPECTED_INTERVAL_MS: 30 * 1000,
    OFFLINE_THRESHOLD_MS: 60 * 60 * 1000, // 1 hour
    STALE_THRESHOLD_MS: 5 * 60 * 1000     // 5 minutes
  }
};

export default TDS_CONFIG;
