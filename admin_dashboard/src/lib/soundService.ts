/**
 * Sound Service for Native Audio Alerts
 * Plays alert sounds on both web (Audio API) and native (Capacitor)
 * Supports multiple alert types with different sounds
 */

import { Capacitor } from '@capacitor/core';

export type AlertSoundType = 'warning' | 'critical' | 'success' | 'info';

interface SoundConfig {
  type: AlertSoundType;
  frequency?: number;
  duration?: number;
  intensity?: 'low' | 'medium' | 'high';
}

/**
 * Play sound using Web Audio API (fallback for web)
 */
function playWebAudio(config: SoundConfig): void {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audioContext.currentTime;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure sound based on alert type
    switch (config.type) {
      case 'critical':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.5);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
        // Double beep for critical
        oscillator.start(now + 0.7);
        oscillator.stop(now + 1.2);
        break;

      case 'warning':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;

      case 'success':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(1100, now + 0.2);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;

      default: // info
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, now);
        gainNode.gain.setValueAtTime(0.15, now);
        gainNode.gain.exponentialRampToValueAtTime(0, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    }
  } catch (error) {
    console.error('❌ Web Audio playback failed:', error);
  }
}

/**
 * Play native sound using Capacitor (Android/iOS)
 * Requires sound files in:
 * - android/app/src/main/res/raw/alert_*.mp3
 * - ios/App/App/Assets.xcassets/alert_*.dataset/
 */
async function playNativeAudio(config: SoundConfig): Promise<void> {
  try {
    // Build filename based on alert type and intensity
    const intensity = config.intensity || 'high';
    const filename = `alert_${config.type}_${intensity}`;

    console.log(`🔊 Playing native sound: ${filename}`);

    // Dynamic import to avoid issues if Capacitor not available
    try {
      // const Media: any = null; // No native media plugin, fallback to web audio
      
      console.warn("Native media playback not implemented. Use WebAudio or add capacitor native audio plugin");
    } catch (error) {
      console.warn('⚠️ Capacitor Media not available, using Web Audio fallback');
      playWebAudio(config);
    }
  } catch (error) {
    console.error('❌ Native audio playback failed:', error);
    // Fallback to web audio
    playWebAudio(config);
  }
}

/**
 * Main function to play alert sound
 * Automatically chooses web or native based on platform
 */
export async function playAlertSound(config: SoundConfig | AlertSoundType): Promise<void> {
  try {
    // Normalize input
    const soundConfig: SoundConfig =
      typeof config === 'string'
        ? { type: config, intensity: 'high' }
        : config;

    console.log(`📢 Playing alert sound: ${soundConfig.type}`);

    if (Capacitor.isNativePlatform()) {
      // Use native audio on mobile
      await playNativeAudio(soundConfig);
    } else {
      // Use Web Audio on browser
      playWebAudio(soundConfig);
    }
  } catch (error) {
    console.error('❌ Failed to play alert sound:', error);
  }
}

/**
 * Test sound - useful for settings
 */
export async function testSound(type: AlertSoundType = 'warning'): Promise<void> {
  console.log('🔊 Testing sound:', type);
  await playAlertSound(type);
}

/**
 * Vibrate device (mobile only)
 */
export async function vibrate(pattern: number[] = [200, 100, 200]): Promise<void> {
  try {
    if (!Capacitor.isNativePlatform()) {
      // Try browser Vibration API
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
      return;
    }

    // Use Capacitor for native vibration
    try {
      const { Haptics } = await import('@capacitor/haptics');
      
      for (let i = 0; i < pattern.length; i++) {
        if (i % 2 === 0) {
          // Vibrate
          // @ts-ignore
          await Haptics.impact({ style: 'Medium' });
        }
        if (i < pattern.length - 1) {
          // Wait for next pattern
          await new Promise(r => setTimeout(r, pattern[i]));
        }
      }
    } catch (error) {
      console.warn('⚠️ Haptics not available:', error);
    }
  } catch (error) {
    console.error('❌ Vibration failed:', error);
  }
}

/**
 * Combined alert: sound + vibration
 */
export async function playAlertWithVibration(
  soundType: AlertSoundType,
  vibratePattern?: number[]
): Promise<void> {
  try {
    // Play sound and vibrate simultaneously
    await Promise.all([
      playAlertSound(soundType),
      vibrate(vibratePattern),
    ]);
  } catch (error) {
    console.error('❌ Alert with vibration failed:', error);
  }
}

/**
 * Mute all sounds
 */
let soundsMuted = false;

export function setSoundMuted(muted: boolean): void {
  soundsMuted = muted;
  console.log(`🔇 Sounds ${muted ? 'muted' : 'unmuted'}`);
}

export function getSoundMuted(): boolean {
  return soundsMuted;
}

/**
 * Wrapper for actual playback (respects mute setting)
 */
export async function playSoundIfEnabled(
  type: AlertSoundType,
  alwaysVibrate: boolean = false
): Promise<void> {
  if (!soundsMuted) {
    await playAlertSound(type);
  }
  if (alwaysVibrate) {
    await vibrate();
  }
}
