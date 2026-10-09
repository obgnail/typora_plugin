#!/usr/bin/env bash
#
# 构建 Typora 插件安装器（可在 Linux/WSL 上交叉编译出 Windows 可执行文件）。
#
# 用法：
#   ./build/build.sh                 # 自包含单文件 win-x64 exe（目标机无需装 .NET）
#   ./build/build.sh --test          # 先跑单元测试
#   ./build/build.sh --fx-dependent  # 框架依赖（体积小，目标机需要 .NET 8 运行时）
#   ./build/build.sh --cli-only      # 只发布命令行版本
#   ./build/build.sh --rid linux-x64 # 换目标平台
#
# 产物：dist/<rid>/TyporaPluginInstaller.exe 与 dist/<rid>/typora-plugin-installer-cli(.exe)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"

RID="${RID:-win-x64}"
CONFIG="${CONFIG:-Release}"
SELF_CONTAINED=true
# 自包含单文件默认开启压缩：43MB vs 92MB，代价是启动时解压（GUI 工具可接受）
SELF_CONTAINED_COMPRESS=true
RUN_TESTS=0
TARGETS=(gui cli)

for arg in "$@"; do
  case "$arg" in
    --test) RUN_TESTS=1 ;;
    --fx-dependent|--no-self-contained) SELF_CONTAINED=false ;;
    --cli-only) TARGETS=(cli) ;;
    --rid=*) RID="${arg#--rid=}" ;;
    --rid) ;;
    --config=*) CONFIG="${arg#--config=}" ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "未知参数：$arg" >&2; exit 2 ;;
  esac
done
# 支持 "--rid linux-x64" 这种写法
prev=""
for arg in "$@"; do
  if [[ "$prev" == "--rid" ]]; then RID="$arg"; fi
  prev="$arg"
done

# 让构建不依赖用户主目录（沙箱里 ~/.nuget 往往只读）
export DOTNET_CLI_HOME="${DOTNET_CLI_HOME:-$ROOT_DIR/.cache/dotnet-home}"
export NUGET_PACKAGES="${NUGET_PACKAGES:-$ROOT_DIR/.cache/nuget-packages}"
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1
mkdir -p "$DOTNET_CLI_HOME" "$NUGET_PACKAGES"

# 优先用 PATH 里的 dotnet，其次 ~/.dotnet
DOTNET_BIN="${DOTNET_BIN:-}"
if [[ -z "$DOTNET_BIN" ]]; then
  if command -v dotnet >/dev/null 2>&1; then
    DOTNET_BIN="$(command -v dotnet)"
  elif [[ -x "$HOME/.dotnet/dotnet" ]]; then
    DOTNET_BIN="$HOME/.dotnet/dotnet"
  else
    echo "找不到 dotnet（需要 .NET 8 SDK）。" >&2
    exit 1
  fi
fi
export DOTNET_ROOT="${DOTNET_ROOT:-$(dirname "$DOTNET_BIN")}"

echo "==> dotnet   : $DOTNET_BIN ($("$DOTNET_BIN" --version))"
echo "==> 目标平台 : $RID   配置: $CONFIG   自包含: $SELF_CONTAINED"

if [[ "$RUN_TESTS" == "1" ]]; then
  echo "==> 单元测试"
  "$DOTNET_BIN" test "$ROOT_DIR/tests/TyporaPluginInstaller.Tests/TyporaPluginInstaller.Tests.csproj" \
    -c "$CONFIG" --nologo
fi

OUT="$ROOT_DIR/dist/$RID"
rm -rf "$OUT"
mkdir -p "$OUT"

publish() {
  local project="$1" target="$2"
  echo "==> 发布 $target"
  "$DOTNET_BIN" publish "$ROOT_DIR/$project" \
    -c "$CONFIG" \
    -r "$RID" \
    --self-contained "$SELF_CONTAINED" \
    -p:PublishSingleFile=true \
    -p:IncludeNativeLibrariesForSelfExtract=true \
    -p:EnableCompressionInSingleFile="$SELF_CONTAINED_COMPRESS" \
    -o "$OUT" \
    --nologo
}

if [[ " ${TARGETS[*]} " == *" gui "* ]]; then
  publish "src/TyporaPluginInstaller.Gui/TyporaPluginInstaller.Gui.csproj" "GUI"
fi
if [[ " ${TARGETS[*]} " == *" cli "* ]]; then
  publish "src/TyporaPluginInstaller.Cli/TyporaPluginInstaller.Cli.csproj" "CLI"
fi

# 单文件发布仍会带出 pdb；产物目录里只留可执行文件更干净。
find "$OUT" -maxdepth 1 -name "*.pdb" -delete

echo
echo "==> 产物：$OUT"
ls -la "$OUT"
