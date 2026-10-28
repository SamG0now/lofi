#!/usr/bin/env bash
# Cross-builds the Windows installer on Linux: dist-win/lofi-<version>-setup.exe
# The installer is unsigned, so Windows SmartScreen warns on first run.
#
# One-time toolchain setup in $LOFI_WIN_TOOLCHAIN (default ~/.cache/lofi-win-toolchain):
#   llvm/        llvm-mingw, ucrt ubuntu x86_64 build (github.com/mstorsjo/llvm-mingw/releases)
#   dl/node.lib  https://artifacts.electronjs.org/headers/dist/v<electron version>/win-x64/node.lib
#                (check it against SHASUMS256.txt in the same folder)
# Electron's headers come from `pnpm install` (node-gyp puts them in ~/.electron-gyp).
set -euo pipefail
cd "$(dirname "$0")/../.."

TOOLCHAIN=${LOFI_WIN_TOOLCHAIN:-$HOME/.cache/lofi-win-toolchain}
CXX=$TOOLCHAIN/llvm/bin/x86_64-w64-mingw32-clang++
NODE_LIB=$TOOLCHAIN/dl/node.lib
ELECTRON=$(node -p "require('electron/package.json').version")
HEADERS=$HOME/.electron-gyp/$ELECTRON/include/node
ADDON=$(node -p "require('node-addon-api').include_dir")

for f in "$CXX" "$NODE_LIB" "$HEADERS/node_api.h"; do
  [ -e "$f" ] || { echo "Missing $f (see the top of scripts/windows/build.sh)" >&2; exit 1; }
done

rm -rf build-win dist-win
mkdir -p build-win/native

for module in volume black-magic; do
  "$CXX" -shared -O2 -std=c++17 -static \
    -DNAPI_DISABLE_CPP_EXCEPTIONS -DBUILDING_NODE_EXTENSION \
    -Iscripts/windows/include -I"$HEADERS" -I"$ADDON" \
    "src/native/$module/$module.cc" scripts/windows/delay-load-hook.cc \
    "$NODE_LIB" -Wl,--delayload=node.exe -lole32 -luuid \
    -o "build-win/native/$module.node"
done

# The modules must load node.exe only lazily, so the delay-load hook can point it at lofi.exe.
for module in volume black-magic; do
  if "$TOOLCHAIN/llvm/bin/llvm-readobj" --coff-imports "build-win/native/$module.node" |
    awk '/^Import \{/{imp=1} /^DelayImport \{/{imp=0} imp && /node\.exe/{found=1} END{exit !found}'; then
    echo "$module.node imports node.exe directly" >&2
    exit 1
  fi
done

pnpm exec webpack --config scripts/windows/webpack.win.js
pnpm exec node scripts/windows/builder.js
