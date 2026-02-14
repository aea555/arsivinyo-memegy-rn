#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./launch_ota.sh [-c "<channel_name>"] [-m "<message>"]
  ./launch_ota.sh "<message>"

Options:
  -c  OTA channel to publish to. Defaults to EXPO_UPDATES_CHANNEL, then .env value, then "production".
  -m  Update message. If omitted, defaults to "No message".
  -h  Show this help.

Examples:
  ./launch_ota.sh -c "production-v1-1" -m "V1.1.0 first patch"
  ./launch_ota.sh -c "production-v1-0" "Hotfix for V1.0.0"
EOF
}

read_channel_from_dotenv() {
  if [[ ! -f ".env" ]]; then
    return 1
  fi

  local line
  line="$(grep -E '^[[:space:]]*EXPO_UPDATES_CHANNEL=' .env | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi

  local value
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  value="${value## }"
  value="${value%% }"

  if [[ -z "$value" ]]; then
    return 1
  fi

  printf '%s' "$value"
  return 0
}

default_channel="${EXPO_UPDATES_CHANNEL:-}"
if [[ -z "${default_channel// }" ]]; then
  default_channel="$(read_channel_from_dotenv || true)"
fi
if [[ -z "${default_channel// }" ]]; then
  default_channel="production"
fi

channel="$default_channel"
message=""

while getopts ":c:m:h" opt; do
  case "$opt" in
    c) channel="$OPTARG" ;;
    m) message="$OPTARG" ;;
    h)
      usage
      exit 0
      ;;
    :)
      echo "Missing argument for -$OPTARG" >&2
      usage
      exit 1
      ;;
    \?)
      echo "Unknown option: -$OPTARG" >&2
      usage
      exit 1
      ;;
  esac
done
shift $((OPTIND - 1))

if [[ -z "$message" && $# -gt 0 ]]; then
  message="$*"
fi

if [[ -z "$message" ]]; then
  message="No message"
fi

if [[ -z "${channel// }" ]]; then
  echo "Channel cannot be empty." >&2
  exit 1
fi

echo "Publishing OTA update"
echo "  channel: $channel"
echo "  message: $message"

eas update --channel "$channel" --message "$message"
