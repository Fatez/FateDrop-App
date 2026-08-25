#!/usr/bin/env bash
set -euo pipefail

PORT="${EXPO_CODESPACES_PORT:-8081}"
METRO_WAIT_SECONDS="${EXPO_CODESPACES_METRO_WAIT_SECONDS:-90}"
PROXY_WAIT_SECONDS="${EXPO_CODESPACES_PROXY_WAIT_SECONDS:-30}"
CLEAR_CACHE="${EXPO_CODESPACES_CLEAR_CACHE:-0}"

if [[ "${CODESPACES:-}" != "true" || -z "${CODESPACE_NAME:-}" ]]; then
  echo "This launcher is for GitHub Codespaces."
  echo "Outside Codespaces use: npm run start:clean"
  exit 1
fi

DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
PUBLIC_URL="https://${CODESPACE_NAME}-${PORT}.${DOMAIN}"
LOCAL_STATUS_URL="http://127.0.0.1:${PORT}/status"
PUBLIC_STATUS_URL="${PUBLIC_URL}/status"

echo ""
echo "FateDrop Expo via GitHub Codespaces"
echo "Metro port: ${PORT}"
echo "Public proxy: ${PUBLIC_URL}"
echo ""
echo "Do not open the proxy root in a browser; Metro may return 404 at /."
echo "Wait for the READY message below, then scan the Expo QR code."
echo ""

echo "Static asset preflight..."
node --test lib/static-assets.test.js
echo ""

restore_private() {
  if command -v gh >/dev/null 2>&1; then
    gh codespace ports visibility "${PORT}:private" -c "${CODESPACE_NAME}" >/dev/null 2>&1 || true
  fi
}

metro_is_running() {
  local url="$1"
  local response
  response="$(curl --silent --show-error --max-time 3 "${url}" 2>/dev/null || true)"
  [[ "${response}" == *"packager-status:running"* ]]
}

wait_for_local_metro() {
  echo "Waiting for Metro to become ready on localhost:${PORT}..."
  for ((attempt=1; attempt<=METRO_WAIT_SECONDS; attempt++)); do
    if metro_is_running "${LOCAL_STATUS_URL}"; then
      echo "✅ Metro running locally."
      return 0
    fi
    sleep 1
  done

  echo "❌ Metro did not become ready within ${METRO_WAIT_SECONDS}s."
  return 1
}

make_public() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "⚠️ GitHub CLI was not found."
    echo "Set port ${PORT} to Public in the Codespaces PORTS panel."
    return 1
  fi

  echo "Publishing port ${PORT} after Metro is ready..."
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if gh codespace ports visibility "${PORT}:public" -c "${CODESPACE_NAME}" >/dev/null 2>&1; then
      echo "✅ Port ${PORT} is Public."
      return 0
    fi
    sleep 1
  done

  echo "❌ Could not automatically make port ${PORT} Public."
  echo "Set it to Public in the Codespaces PORTS panel."
  return 1
}

verify_public_proxy() {
  echo "Verifying the Codespaces proxy can reach Metro..."
  for ((attempt=1; attempt<=PROXY_WAIT_SECONDS; attempt++)); do
    if metro_is_running "${PUBLIC_STATUS_URL}"; then
      echo "✅ Codespaces proxy reachable."
      echo ""
      echo "✅ READY FOR EXPO GO"
      echo "Scan the Expo QR code in this terminal."
      echo ""
      return 0
    fi
    sleep 1
  done

  echo "❌ Public proxy did not expose Metro within ${PROXY_WAIT_SECONDS}s."
  echo "Check the PORTS panel and confirm ${PORT} is Public."
  return 1
}

prepare_codespaces_bridge() {
  if ! wait_for_local_metro; then
    return 1
  fi
  if ! make_public; then
    return 1
  fi
  verify_public_proxy
}

trap restore_private EXIT INT TERM

# Expo remains in the foreground so the QR code and logs stay visible.
# The helper waits for Metro first, then publishes/verifies the Codespaces port.
prepare_codespaces_bridge &
BRIDGE_PID=$!

EXPO_ARGS=(start --port "${PORT}" --lan)
if [[ "${CLEAR_CACHE}" == "1" || "${CLEAR_CACHE}" == "true" ]]; then
  echo "Expo cache clear requested for this launch."
  EXPO_ARGS+=(--clear)
fi

EXPO_PACKAGER_PROXY_URL="${PUBLIC_URL}" npx expo "${EXPO_ARGS[@]}"
EXPO_EXIT=$?
wait "${BRIDGE_PID}" 2>/dev/null || true
exit "${EXPO_EXIT}"
