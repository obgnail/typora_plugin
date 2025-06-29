#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd -P)
cd "$SCRIPT_DIR" || exit

chmod +x ./move_settings_files.sh
./move_settings_files.sh --no-overwrite
