# EAS OTA Updates Runbook

This project now includes baseline EAS Update configuration so JavaScript/TypeScript/UI/assets can ship without rebuilding APK/IPA each time.

## Important

- OTA updates are delivered with `eas update` (not `expo publish`).
- Google Play hosting is **not required**.
  - Sideloaded/internal builds can still receive OTA updates if:
    - they were built with `expo-updates` enabled, and
    - devices can reach Expo update servers.

## One-time setup

1. Login and link project:
   - `eas login`
   - `npm run eas:init`
2. Configure updates:
   - `npm run eas:update:configure`
3. Replace placeholder project id in `app.json`:
   - `expo.updates.url`
   - `expo.extra.eas.projectId`
4. Build OTA-capable binaries:
   - `npm run build:preview`
   - `npm run build:production`

## Release workflow

1. Publish to preview first:
   - `npm run update:preview -- --message "Preview: <summary>"`
2. Validate on preview build.
3. Publish same change to production:
   - `npm run update:production -- --message "Prod: <summary>"`

## Channels and profiles

- `development` profile -> `development` channel
- `preview` profile -> `preview` channel
- `production` profile -> `production` channel

Channel mapping is defined in `eas.json`.

## What can go via OTA vs new binary

### OTA allowed

- JS/TS logic changes
- UI/styling/layout
- localization/copy
- static assets bundled by Metro

### New binary required

- new native libraries/plugins
- AndroidManifest/Info.plist/native permission changes
- Expo SDK/native runtime changes
- anything that changes runtime compatibility

## Runtime compatibility

`app.json` uses:

- `runtimeVersion.policy = "fingerprint"`

This blocks incompatible OTA updates from loading on older binaries.

## Startup behavior

Configured as non-blocking:

- `updates.checkAutomatically = "ON_LOAD"`
- `updates.fallbackToCacheTimeout = 0`

App starts with cached bundle, then applies new OTA on next cold start.

## Security hardening (recommended)

1. Enable update code signing for the EAS project.
2. Keep private keys outside git.
3. Store public cert metadata only in app config.
4. Define key-rotation + rollback procedure:
   - if issue detected, republish last known good update.

## Verification checklist

1. Install preview build.
2. Publish a tiny UI change to `preview`.
3. Relaunch app and verify change is applied.
4. Confirm production build does not receive preview channel updates.
5. Test offline launch: app still starts from cache.
