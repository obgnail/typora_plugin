#!/bin/bash

# Robustly move settings.user.toml and custom_plugin.user.toml
# between ../global/settings/ (relative to script) and $HOME/.config/typora_plugin/
# Supports
# - --force: overwrite existing files without prompting
# - --no-overwrite: skip overwriting
# - --restore: moves $HOME/.config/typora_plugin back to global/settings (If source file missing, create empty destination file)

set -euo pipefail

readonly FILES=("settings.user.toml" "custom_plugin.user.toml")
readonly DEST_DIR="$HOME/.config/typora_plugin"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
SRC_DIR="$SCRIPT_DIR/../global/settings"
if command -v realpath &>/dev/null; then
    SRC_DIR=$(realpath "$SRC_DIR")
fi

FORCE_OVERWRITE=0
SKIP_OVERWRITE=0
RESTORE=0

usage() {
    echo "Usage: $0 [-f|--force] [-n|--no-overwrite] [-r|--restore]"
    echo "  -f, --force         Overwrite existing files without prompting"
    echo "  -n, --no-overwrite  Skip if target file exists, no prompt"
    echo "  -r, --restore       Move settings files from home dir back to plugin dir"
    echo "  -h, --help          Display this help message"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--force)
            FORCE_OVERWRITE=1
            ;;
        -n|--no-overwrite)
            SKIP_OVERWRITE=1
            ;;
        -r|--restore)
            RESTORE=1
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

move_or_create_empty_file() {
    local FROM="$1"
    local TO="$2"
    local FILE_DESC="$3"
    local DIRECTION="$4"
    local CREATE_EMPTY="$5"

    if [[ ! -f "$FROM" ]]; then
        if [[ "$CREATE_EMPTY" == "1" ]]; then
            if [[ ! -f "$TO" ]]; then
                if touch "$TO"; then
                    chmod 666 "$TO"
                    echo "Notice: $FROM not found, created empty file at $TO"
                else
                    echo "Error: Failed to create empty file at $TO"
                fi
            else
                echo "Notice: $FROM not found, $TO already exists."
            fi
        else
            echo "Skipped: Source file $FROM does not exist."
        fi
        return
    fi

    if [[ -f "$TO" ]]; then
        if [[ $FORCE_OVERWRITE -eq 1 ]]; then
            : # Do nothing, proceed with overwrite
        elif [[ $SKIP_OVERWRITE -eq 1 ]]; then
            echo "Skipped: $TO already exists (--no-overwrite)"
            return
        else
            read -rp "Target file $TO exists. Overwrite? [y/N]: " ans
            if [[ ! $ans =~ ^[Yy]$ ]]; then
                echo "Skipped: $FILE_DESC"
                return
            fi
        fi
    fi

    local TO_DIR=$(dirname "$TO")
    if [[ ! -d "$TO_DIR" ]]; then
        mkdir -p "$TO_DIR" || { echo "Error: Failed to create target directory $TO_DIR"; return 1; }
    fi

    if mv -f "$FROM" "$TO" 2>/dev/stdout; then
        if chmod 666 "$TO"; then
            echo "Success: $DIRECTION and set permissions for $FILE_DESC → $TO"
        else
            echo "Warning: $FILE_DESC $DIRECTION, but failed to set permissions. Please check $TO manually."
        fi
    else
        echo "Error: Failed to $DIRECTION $FILE_DESC."
    fi
}

move_to_home_dir() {
    [[ -d "$DEST_DIR" ]] || { mkdir -p "$DEST_DIR" && echo "Created destination directory: $DEST_DIR"; }
    for file in "${FILES[@]}"; do
        move_or_create_empty_file "$SRC_DIR/$file" "$DEST_DIR/$file" "$file" "Moved" 0
    done
}

restore_to_plugin_dir() {
    [[ -d "$SRC_DIR" ]] || { mkdir -p "$SRC_DIR" && echo "Created directory: $SRC_DIR"; }
    for file in "${FILES[@]}"; do
        move_or_create_empty_file "$DEST_DIR/$file" "$SRC_DIR/$file" "$file" "Restored" 1
    done
}

if [[ $RESTORE -eq 0 ]]; then
    move_to_home_dir
else
    restore_to_plugin_dir
fi
