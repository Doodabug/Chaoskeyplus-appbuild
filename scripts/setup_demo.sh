#!/usr/bin/env bash
set -euo pipefail

# Demo setup script (safe; no secrets are stored)
# Usage: ./scripts/setup_demo.sh

echo "Setting up demo environment..."

# Simple dependency hints (edit to match your environment)
if command -v npm >/dev/null 2>&1; then
  echo "Installing node dependencies (if package.json exists)..."
  [ -f package.json ] && npm install || true
fi

if command -v pip >/dev/null 2>&1; then
  echo "Installing python deps (if requirements.txt exists)..."
  [ -f requirements.txt ] && pip install -r requirements.txt || true
fi

echo "Demo setup complete. Review demo/README.md to run the demo."
