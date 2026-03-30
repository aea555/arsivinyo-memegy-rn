#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BUILD_GRADLE="$ROOT_DIR/android/build.gradle"
APP_GRADLE="$ROOT_DIR/android/app/build.gradle"
GRADLE_PROPERTIES="$ROOT_DIR/android/gradle.properties"

require_contains() {
  local file="$1"
  local needle="$2"
  if ! grep -Fq "$needle" "$file"; then
    echo "[verify-local-downloader-prebuild] Missing in ${file#$ROOT_DIR/}: $needle"
    exit 1
  fi
}

require_once() {
  local file="$1"
  local needle="$2"
  local count
  count=$(grep -F "$needle" "$file" | wc -l | tr -d ' ')
  if [[ "$count" != "1" ]]; then
    echo "[verify-local-downloader-prebuild] Expected exactly once in ${file#$ROOT_DIR/}: $needle (found $count)"
    exit 1
  fi
}

echo "[verify-local-downloader-prebuild] Running clean android prebuild"
CI=1 npx expo prebuild --clean --platform android --no-install >/tmp/memegy-local-downloader-prebuild.log 2>&1 || {
  cat /tmp/memegy-local-downloader-prebuild.log
  exit 1
}

for file in "$BUILD_GRADLE" "$APP_GRADLE" "$GRADLE_PROPERTIES"; do
  if [[ ! -f "$file" ]]; then
    echo "[verify-local-downloader-prebuild] Missing generated file: ${file#$ROOT_DIR/}"
    exit 1
  fi
done

require_once "$BUILD_GRADLE" "// @generated begin local-downloader-chaquopy-buildscript-repo"
require_once "$BUILD_GRADLE" "// @generated begin local-downloader-chaquopy-buildscript-classpath"
require_once "$BUILD_GRADLE" "// @generated begin local-downloader-chaquopy-allprojects-repo"

require_contains "$APP_GRADLE" "apply plugin: \"com.chaquo.python\""
require_once "$APP_GRADLE" "// @generated begin local-downloader-python-config"
require_once "$APP_GRADLE" "// @generated begin local-downloader-impersonation-pip"
require_once "$APP_GRADLE" "// @generated begin local-downloader-sourceset-config"
require_once "$APP_GRADLE" "// @generated begin local-downloader-abi-filter-config"
require_contains "$APP_GRADLE" "srcDir(\"../../modules/local-downloader/android/src/main/python\")"
require_contains "$APP_GRADLE" "assets.srcDirs += [\"../../modules/local-downloader/android/src/main/assets\"]"
require_contains "$APP_GRADLE" "abiFilters(*localDownloaderAbis)"

require_contains "$GRADLE_PROPERTIES" "expo.useLegacyPackaging=true"
require_contains "$GRADLE_PROPERTIES" "reactNativeArchitectures=arm64-v8a"

echo "[verify-local-downloader-prebuild] OK"
