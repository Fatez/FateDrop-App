#!/usr/bin/env bash
set -euo pipefail

PORT="${EXPO_CODESPACES_PORT:-8081}"

if [[ "${CODESPACES:-}" != "true" || -z "${CODESPACE_NAME:-}" ]]; then
  echo "This launcher is for GitHub Codespaces."
  echo "Outside Codespaces use: npm run start:clean"
  exit 1
fi

DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
PUBLIC_URL="https://${CODESPACE_NAME}-${PORT}.${DOMAIN}"

echo ""
echo "FateDrop Expo via GitHub Codespaces"
echo "Metro port: ${PORT}"
echo "Public proxy: ${PUBLIC_URL}"
echo ""

echo "Static asset preflight..."
node --test lib/static-assets.test.js
echo ""

restore_private() {
  if command -v gh >/dev/null 2>&1; then
    gh codespace ports visibility "${PORT}:private" -c "${CODESPACE_NAME}" >/dev/null 2>&1 || true
  fi
}

make_public() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "GitHub CLI was not found."
    echo "In the Codespaces PORTS panel, set port ${PORT} to Public."
    return 0
  fi

  # Codespaces may need a moment to notice Metro listening on the port.
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if gh codespace ports visibility "${PORT}:public" -c "${CODESPACE_NAME}" >/dev/null 2>&1; then
      echo "Port ${PORT} is Public for Expo Go."
      echo "It will be returned to Private when this launcher exits."
      return 0
    fi
    sleep 1
  done

  echo ""
  echo "Could not automatically make port ${PORT} Public."
  echo "Open the Codespaces PORTS panel and set port ${PORT} to Public."
  echo "Then scan/open the Expo Go URL."
}

trap restore_private EXIT INT TERM

# Start the public-port helper after Metro begins listening.
make_public &
VISIBILITY_PID=$!

EXPO_PACKAGER_PROXY_URL="${PUBLIC_URL}" npx expo start --port "${PORT}" --lan --clear
wait "${VISIBILITY_PID}" 2>/dev/null || true
