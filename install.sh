#!/bin/sh

set -eu

say() {
  printf '%s\n' "[RepoMemo] $*"
}

fail() {
  printf '%s\n' "[RepoMemo] ERROR: $*" >&2
  exit 1
}

download() {
  repomemo_download_url=$1
  repomemo_download_output=$2
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --connect-timeout 15 "$repomemo_download_url" -o "$repomemo_download_output"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$repomemo_download_output" "$repomemo_download_url"
  else
    fail "curl or wget is required to download Node.js. Install one downloader and rerun this script."
  fi
}

sha256_file() {
  repomemo_checksum_file=$1
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$repomemo_checksum_file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$repomemo_checksum_file" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$repomemo_checksum_file" | awk '{print $NF}'
  else
    fail "sha256sum, shasum, or openssl is required to verify the Node.js download."
  fi
}

repomemo_user_home=${HOME:?HOME is required}
repomemo_install_root=${REPOMEMO_INSTALL_ROOT:-"$repomemo_user_home/.local/share/repomemo"}
repomemo_bin_dir=${REPOMEMO_BIN_DIR:-"$repomemo_user_home/.local/bin"}
repomemo_profile_home=${REPOMEMO_PROFILE_HOME:-"$repomemo_user_home"}
repomemo_package_spec=${REPOMEMO_PACKAGE_SPEC:-repomemo@latest}
repomemo_mirror=${REPOMEMO_MIRROR:-global}

case "$repomemo_install_root" in
  ""|/) fail "unsafe installation root: $repomemo_install_root" ;;
  /*) ;;
  *) fail "installation root must be an absolute path: $repomemo_install_root" ;;
esac
case "$repomemo_bin_dir" in
  ""|/) fail "unsafe binary directory: $repomemo_bin_dir" ;;
  /*) ;;
  *) fail "binary directory must be an absolute path: $repomemo_bin_dir" ;;
esac

if [ "$repomemo_mirror" = "cn" ]; then
  repomemo_node_mirror=${REPOMEMO_NODE_MIRROR:-https://npmmirror.com/mirrors/node}
  repomemo_registry=${REPOMEMO_NPM_REGISTRY:-https://registry.npmmirror.com}
  say "Using China mirrors: npmmirror Node.js and npm registry."
else
  repomemo_node_mirror=${REPOMEMO_NODE_MIRROR:-https://nodejs.org/dist}
  repomemo_registry=${REPOMEMO_NPM_REGISTRY:-https://registry.npmjs.org}
fi

mkdir -p "$repomemo_install_root" "$repomemo_bin_dir"
repomemo_temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/repomemo-install.XXXXXX")
trap 'rm -rf "$repomemo_temp_dir"' EXIT HUP INT TERM

repomemo_node_exec=
repomemo_npm_exec=
if [ "${REPOMEMO_FORCE_PRIVATE_NODE:-0}" != "1" ] && command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  repomemo_node_major=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0')
  if [ "$repomemo_node_major" -ge 22 ] 2>/dev/null; then
    repomemo_node_exec=$(command -v node)
    repomemo_npm_exec=$(command -v npm)
    say "Using existing Node.js $(node --version)."
  fi
fi

if [ -z "$repomemo_node_exec" ]; then
  command -v uname >/dev/null 2>&1 || fail "uname is required to select a Node.js build."
  command -v awk >/dev/null 2>&1 || fail "awk is required to select a Node.js version."
  command -v tar >/dev/null 2>&1 || fail "tar is required to unpack Node.js."

  case "$(uname -s)" in
    Darwin) repomemo_platform=darwin ;;
    Linux) repomemo_platform=linux ;;
    *) fail "unsupported operating system: $(uname -s). Use install.ps1 on Windows." ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) repomemo_arch=x64 ;;
    arm64|aarch64) repomemo_arch=arm64 ;;
    *) fail "unsupported CPU architecture: $(uname -m)" ;;
  esac

  repomemo_target="$repomemo_platform-$repomemo_arch"
  if [ "$repomemo_platform" = "linux" ] && command -v ldd >/dev/null 2>&1 && ldd --version 2>&1 | grep -i musl >/dev/null 2>&1; then
    if [ "$repomemo_arch" != "x64" ]; then
      fail "musl Linux on $repomemo_arch has no supported official Node.js binary. Install Node.js 22+ with npm through the distribution package manager, then rerun."
    fi
    repomemo_target="linux-x64-musl"
  fi

  repomemo_index="$repomemo_temp_dir/index.tab"
  download "$repomemo_node_mirror/index.tab" "$repomemo_index"
  repomemo_node_version=${REPOMEMO_NODE_VERSION:-$(awk 'NR > 1 && $1 ~ /^v24\./ { print $1; exit }' "$repomemo_index")}
  [ -n "$repomemo_node_version" ] || fail "could not find a Node.js 24 release in $repomemo_node_mirror/index.tab"
  printf '%s\n' "$repomemo_node_version" | grep -E '^v24\.[0-9]+\.[0-9]+$' >/dev/null 2>&1 \
    || fail "REPOMEMO_NODE_VERSION must be a complete Node.js 24 version such as v24.20.0"

  repomemo_archive="node-$repomemo_node_version-$repomemo_target.tar.gz"
  repomemo_archive_path="$repomemo_temp_dir/$repomemo_archive"
  repomemo_sums_path="$repomemo_temp_dir/SHASUMS256.txt"
  say "Downloading private Node.js $repomemo_node_version ($repomemo_target)."
  download "$repomemo_node_mirror/$repomemo_node_version/$repomemo_archive" "$repomemo_archive_path"
  download "$repomemo_node_mirror/$repomemo_node_version/SHASUMS256.txt" "$repomemo_sums_path"

  repomemo_expected_sum=$(awk -v name="$repomemo_archive" '$2 == name { print $1; exit }' "$repomemo_sums_path")
  [ -n "$repomemo_expected_sum" ] || fail "Node.js checksum entry is missing for $repomemo_archive"
  repomemo_actual_sum=$(sha256_file "$repomemo_archive_path")
  [ "$repomemo_expected_sum" = "$repomemo_actual_sum" ] || fail "Node.js SHA-256 verification failed"

  tar -xzf "$repomemo_archive_path" -C "$repomemo_temp_dir"
  repomemo_runtime_dir="$repomemo_install_root/runtime/node-$repomemo_node_version-$repomemo_target"
  mkdir -p "$repomemo_install_root/runtime"
  if [ ! -d "$repomemo_runtime_dir" ]; then
    mv "$repomemo_temp_dir/node-$repomemo_node_version-$repomemo_target" "$repomemo_runtime_dir"
  fi
  repomemo_node_exec="$repomemo_runtime_dir/bin/node"
  repomemo_npm_exec="$repomemo_runtime_dir/bin/npm"
fi

[ -x "$repomemo_node_exec" ] || fail "Node.js executable is unavailable: $repomemo_node_exec"
[ -x "$repomemo_npm_exec" ] || fail "npm executable is unavailable: $repomemo_npm_exec"

repomemo_app_dir=$(mktemp -d "$repomemo_install_root/app.XXXXXX")
say "Installing $repomemo_package_spec."
PATH="$(dirname "$repomemo_node_exec"):$PATH" "$repomemo_npm_exec" install \
  --prefix "$repomemo_app_dir" \
  --no-save \
  --omit=dev \
  --ignore-scripts \
  --registry="$repomemo_registry" \
  "$repomemo_package_spec"

repomemo_cli="$repomemo_app_dir/node_modules/repomemo/dist/cli.js"
[ -f "$repomemo_cli" ] || fail "RepoMemo CLI was not installed at $repomemo_cli"

repomemo_wrapper="$repomemo_bin_dir/repomemo"
repomemo_wrapper_temp="$repomemo_bin_dir/.repomemo.$$.tmp"
{
  printf '%s\n' '#!/bin/sh'
  printf 'exec "%s" "%s" "$@"\n' "$repomemo_node_exec" "$repomemo_cli"
} > "$repomemo_wrapper_temp"
chmod 755 "$repomemo_wrapper_temp"
mv -f "$repomemo_wrapper_temp" "$repomemo_wrapper"

if [ "${REPOMEMO_SKIP_PATH_UPDATE:-0}" != "1" ]; then
  mkdir -p "$repomemo_profile_home"
  repomemo_path_line="export PATH=\"$repomemo_bin_dir:\$PATH\""
  add_repomemo_profile_path() {
    repomemo_profile=$1
    if [ ! -f "$repomemo_profile" ] || ! grep -F "$repomemo_bin_dir" "$repomemo_profile" >/dev/null 2>&1; then
      {
        printf '\n%s\n' '# Added by RepoMemo installer'
        printf '%s\n' "$repomemo_path_line"
      } >> "$repomemo_profile"
    fi
  }
  add_repomemo_profile_path "$repomemo_profile_home/.profile"
  case "${SHELL:-}" in
    */zsh) add_repomemo_profile_path "$repomemo_profile_home/.zshrc" ;;
    */bash) add_repomemo_profile_path "$repomemo_profile_home/.bashrc" ;;
  esac
fi

repomemo_version_output=$("$repomemo_wrapper" --version)
say "Installed successfully: $repomemo_version_output"
say "Run: $repomemo_wrapper init --target /path/to/project"
if [ "${REPOMEMO_SKIP_PATH_UPDATE:-0}" != "1" ]; then
  say "Open a new terminal, or run: export PATH=\"$repomemo_bin_dir:\$PATH\""
fi
