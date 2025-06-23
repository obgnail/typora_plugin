#!/bin/bash

# Robustly move settings.user.toml and custom_plugin.user.toml from ../global/settings/ (relative to script) to $HOME/.config/typora_plugin/
# - Pre-check existence (skip if not found)
# - Create target directory if needed
# - Prompt before overwriting (with -f/--force or -n/--no-overwrite for non-interactive)
# - Ensure read/write permissions after move

set -euo pipefail

# Set SRC_DIR to ../global/settings relative to the script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(cd "$SCRIPT_DIR/../global/settings" && pwd)"
DEST_DIR="$HOME/.config/typora_plugin"
FILES=("settings.user.toml" "custom_plugin.user.toml")

FORCE_OVERWRITE=0
SKIP_OVERWRITE=0

usage() {
    echo "Usage: $0 [-f|--force] [-n|--no-overwrite]"
    echo "  -f, --force         Overwrite existing files without prompting"
    echo "  -n, --no-overwrite  Skip if target file exists, no prompt"
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--force)
            FORCE_OVERWRITE=1
            ;;
        -n|--no-overwrite)
            SKIP_OVERWRITE=1
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown argument: $1"
            usage
            ;;
    esac
    shift
done

if [[ $FORCE_OVERWRITE -eq 1 && $SKIP_OVERWRITE -eq 1 ]]; then
    echo "Cannot use both --force and --no-overwrite"
    exit 1
fi

# Create destination directory if needed
if [[ ! -d "$DEST_DIR" ]]; then
    if mkdir -p "$DEST_DIR"; then
        echo "Created destination directory: $DEST_DIR"
    else
        echo "Error: Failed to create directory $DEST_DIR. Check your permissions."
        exit 1
    fi
fi

# Move files, skipping missing source files
for file in "${FILES[@]}"; do
    SRC="$SRC_DIR/$file"
    DEST="$DEST_DIR/$file"

    if [[ ! -f "$SRC" ]]; then
        echo "Skipped: Source file $SRC does not exist."
        continue
    fi

    if [[ -f "$DEST" ]]; then
        if [[ $FORCE_OVERWRITE -eq 1 ]]; then
            :
        elif [[ $SKIP_OVERWRITE -eq 1 ]]; then
            echo "Skipped: $DEST already exists (--no-overwrite)"
            continue
        else
            read -rp "Target file $DEST exists. Overwrite? [y/N]: " ans
            if [[ ! $ans =~ ^[Yy]$ ]]; then
                echo "Skipped: $file"
                continue
            fi
        fi
    fi

    # Move and handle errors, outputting errors directly
    if mv -f "$SRC" "$DEST" 2>/dev/stdout; then
        if chmod 600 "$DEST"; then
            echo "Success: Moved and set permissions for $file → $DEST"
        else
            echo "Warning: $file moved, but failed to set permissions. Please check $DEST manually."
        fi
    else
        echo "Error: Failed to move $file."
        continue
    fi
done
