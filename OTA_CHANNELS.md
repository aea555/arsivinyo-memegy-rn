# OTA Channels (EAS Update) for `V1.0.0` and `V1.1.0`

This app now reads OTA channel from environment when building native config.

## How channel selection works

- Source of truth in config: `EXPO_UPDATES_CHANNEL`
- Applied in `app.config.ts` to:
  - `expo.updates.requestHeaders["expo-channel-name"]`
  - `expo.extra.ota.channel` (debug visibility)
- Update check is already enabled at startup (`checkOnLaunch: "ALWAYS"`), so app checks the channel baked into the binary.

Important:
- OTA channel is effectively a **build-time setting** for a binary.
- Changing `.env` after install does not change channel for an already installed build.
- Existing `V1.0.0` users stay safe if you publish `V1.1.0` updates to a different channel.

## Recommended channel strategy

- `production-v1-0` for stable `V1.0.0` binaries
- `production-v1-1` for `V1.1.0` development and release

## Create and manage channels (EAS CLI)

You can create channels explicitly with EAS CLI (works on older and newer CLI versions):

```bash
eas channel:create production-v1-0
eas channel:edit production-v1-0 --branch production-v1-0

eas channel:create production-v1-1
eas channel:edit production-v1-1 --branch production-v1-1
```

Useful management commands:

```bash
eas channel:list
eas channel:view production-v1-1
eas channel:edit production-v1-1 --branch production-v1-1
```

Notes:
- Channel names and branch names can be the same (recommended for clarity).
- If you publish with `eas update --channel <name>` and channel does not exist yet, EAS may create it automatically; explicit creation keeps rollout setup predictable.
- On older CLI (like `eas-cli 16.x`), `eas channel:create` does not accept `--branch`; use the two-step `create` then `edit --branch`.

## Runtime safety between versions

`app.json` uses:
- `"runtimeVersion": { "policy": "appVersion" }`

So even if a channel is accidentally shared, runtime version mismatch blocks incompatible updates between `1.0.0` and `1.1.0`.

## Configure `.env`

Set:

```bash
EXPO_UPDATES_CHANNEL=production-v1-1
```

You can keep `production` if you want, but version-specific channels are safer for parallel release trains.

## Publish OTA to selected channel

Use script:

```bash
./launch_ota.sh -c "production-v1-1" -m "V1.1.0 patch: ..."
```

Without `-c`, script falls back to `EXPO_UPDATES_CHANNEL`, then `production`.
If `EXPO_UPDATES_CHANNEL` is not exported, the script also reads it from `.env`.

## Example release flow

1. Keep current stable users (`V1.0.0`) on channel `production-v1-0`.
2. Build new `V1.1.0` binary with:
   - `expo.version = "1.1.0"` in `app.json`
   - `EXPO_UPDATES_CHANNEL=production-v1-1`
3. Publish new OTA patches only to `production-v1-1`.
4. Only publish to `production-v1-0` when intentionally hotfixing `V1.0.0`.

## Quick verification

After build/install:
- Run `./launch_ota.sh -c "<same_channel_as_binary>" -m "test"`
- Restart app (cold start)
- Confirm test change appears.

If it does not:
- ensure channel passed to publish matches binary channel,
- ensure runtime version matches app version,
- ensure device has network and app restarts fully.
