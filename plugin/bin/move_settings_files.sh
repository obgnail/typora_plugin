#!/bin/bash

# Robustly move settings.user.toml
# between ../global/settings/ (relative to script) and $HOME/.config/typora_plugin/
# Supports
# - --force: overwrite existing files without prompting
# - --no-overwrite: skip overwriting
# - --restore: moves $HOME/.config/typora_plugin back to global/settings (If source file missing, create empty destination file)

set -euo pipefail

readonly FILES=("settings.user.toml")
readonly DEST_DIR="$HOME/.config/typora_plugin"

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P)"
if [[ -z "$SCRIPT_DIR" ]]; then
  echo -e "\033[0;31m[ERROR] Execution context error. Cannot determine script directory.\033[0m" >&2
  exit 1
fi

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
    echo -e "\033[0;31mUnknown argument: $1\033[0m"
    usage
  ;;
esac
shift
done

if [[ $FORCE_OVERWRITE -eq 1 && $SKIP_OVERWRITE -eq 1 ]]; then
  echo -e "\033[0;31m[ERROR] Cannot use both --force and --no-overwrite\033[0m"
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
          echo -e "\033[0;36m[NOTICE] $FROM not found, created empty file at $TO\033[0m"
        else
          echo -e "\033[0;31m[ERROR] Failed to create empty file at $TO\033[0m"
        fi
      else
        echo -e "\033[1;30m[SKIP] $FROM not found, $TO already exists.\033[0m"
      fi
    else
      echo -e "\033[1;30m[SKIP] Source file $FROM does not exist.\033[0m"
    fi
    return
  fi

  if [[ -f "$TO" ]]; then
    if [[ $FORCE_OVERWRITE -eq 1 ]]; then
      : # Do nothing, proceed with overwrite
    elif [[ $SKIP_OVERWRITE -eq 1 ]]; then
      echo -e "\033[1;30m[SKIP] $TO already exists (--no-overwrite)\033[0m"
      return
    else
      echo -e "\033[0;35m[PROMPT] Target file $TO exists.\033[0m"
      read -rp "Overwrite? [y/N]: " ans
      if [[ ! $ans =~ ^[Yy]$ ]]; then
        echo -e "\033[1;30m[SKIP] User cancelled overwrite for $FILE_DESC\033[0m"
        return
      fi
    fi
  fi

  local TO_DIR=$(dirname "$TO")
  if [[ ! -d "$TO_DIR" ]]; then
    mkdir -p "$TO_DIR" || { echo -e "\033[0;31m[ERROR] Failed to create target directory $TO_DIR\033[0m"; return 1; }
  fi

  if mv -f "$FROM" "$TO" 2>/dev/stdout; then
    if chmod 666 "$TO"; then
      echo -e "\033[0;32m[SUCCESS] $DIRECTION and set permissions for $FILE_DESC -> $TO\033[0m"
    else
      echo -e "\033[0;33m[WARN] $FILE_DESC $DIRECTION, but failed to set permissions. Please check $TO manually.\033[0m"
    fi
  else
    echo -e "\033[0;31m[ERROR] Failed to $DIRECTION $FILE_DESC.\033[0m"
  fi
}

move_to_home_dir() {
  [[ -d "$DEST_DIR" ]] || { mkdir -p "$DEST_DIR" && echo -e "\033[0;32m[SUCCESS] Created destination directory: $DEST_DIR\033[0m"; }
  for file in "${FILES[@]}"; do
    move_or_create_empty_file "$SRC_DIR/$file" "$DEST_DIR/$file" "$file" "Moved" 0
  done
}

restore_to_plugin_dir() {
  [[ -d "$SRC_DIR" ]] || { mkdir -p "$SRC_DIR" && echo -e "\033[0;32m[SUCCESS] Created directory: $SRC_DIR\033[0m"; }
  for file in "${FILES[@]}"; do
    move_or_create_empty_file "$DEST_DIR/$file" "$SRC_DIR/$file" "$file" "Restored" 1
  done
}

if [[ $RESTORE -eq 0 ]]; then
  move_to_home_dir
else
  restore_to_plugin_dir
fi
