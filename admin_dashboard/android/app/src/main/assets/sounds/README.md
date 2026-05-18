# Audio Asset Instructions

This folder is the destination for the native Android alert `.mp3` files required by the Capacitor Media plugin. Since an AI cannot generate rich MP3 files, you need to provide them.

## Required Files
Please obtain or record standard alert sounds (in `.mp3` format) and place them in this folder (`admin_dashboard/android/app/src/main/assets/sounds/`).

Ensure they are named exactly as follows:
1. `alert_critical_high.mp3`
2. `alert_warning_high.mp3`
3. `alert_success_high.mp3`
4. `alert_info_high.mp3`

*(Note: If you are using `res/raw` for native Android access instead of assets, you may need to copy them there as well depending on your precise Capacitor Media plugin configuration. The `soundService.ts` currently looks for `file:///android_asset/sounds/alert_...mp3`.)*

## Next Steps
After you drop the `.mp3` files here:
1. Run `npx cap sync android` in the `admin_dashboard` folder.
2. Build the Android app again (`./gradlew assembleDebug` or via Android Studio).
3. Sound alerts will now play correctly when notifications arrive!