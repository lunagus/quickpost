#!/usr/bin/env bash
set -e

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"

echo "Downloading quickpost CLI..."
curl -sL "https://raw.githubusercontent.com/lunagus/quickpost/main/scripts/qp.sh" -o "$INSTALL_DIR/qp"
chmod +x "$INSTALL_DIR/qp"

echo -e "\033[0;32mquickpost installed successfully!\033[0m"
echo "Executable is at $INSTALL_DIR/qp"

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo -e "\033[0;33mMake sure $INSTALL_DIR is in your PATH.\033[0m"
fi
echo "Usage: qp file.png"
