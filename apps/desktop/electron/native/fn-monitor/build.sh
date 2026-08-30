#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../bin"
mkdir -p "$OUT_DIR"

# Compile for current architecture
swiftc "$SCRIPT_DIR/main.swift" \
    -framework Cocoa \
    -framework CoreGraphics \
    -o "$OUT_DIR/fn-monitor" \
    -O

echo "Built fn-monitor → $OUT_DIR/fn-monitor"
