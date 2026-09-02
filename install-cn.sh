#!/bin/sh

set -eu

export REPOMEMO_MIRROR=cn
repomemo_installer_source=${REPOMEMO_INSTALLER_SOURCE:-}

if [ -n "$repomemo_installer_source" ] && [ -f "$repomemo_installer_source" ]; then
  exec sh "$repomemo_installer_source"
fi

if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  printf '%s\n' '[RepoMemo] ERROR: curl or wget is required to download the installer.' >&2
  exit 1
fi

repomemo_temp_script=$(mktemp "${TMPDIR:-/tmp}/repomemo-cn-installer.XXXXXX")
trap 'rm -f "$repomemo_temp_script"' EXIT HUP INT TERM

if [ -n "$repomemo_installer_source" ]; then
  repomemo_sources=$repomemo_installer_source
else
  repomemo_sources='https://cdn.jsdelivr.net/gh/SUN-1024/repomemo@main/install.sh https://raw.githubusercontent.com/SUN-1024/repomemo/main/install.sh'
fi

for repomemo_source in $repomemo_sources; do
  printf '%s\n' "[RepoMemo] Downloading installer from $repomemo_source"
  if command -v curl >/dev/null 2>&1; then
    if curl -fsSL --retry 3 --connect-timeout 15 "$repomemo_source" -o "$repomemo_temp_script"; then
      exec sh "$repomemo_temp_script"
    fi
  elif wget -qO "$repomemo_temp_script" "$repomemo_source"; then
    exec sh "$repomemo_temp_script"
  fi
done

printf '%s\n' '[RepoMemo] ERROR: all installer download sources failed.' >&2
exit 1
