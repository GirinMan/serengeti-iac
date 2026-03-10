#!/usr/bin/env bash

load_env_file() {
  local env_file="$1"

  if [[ ! -f "${env_file}" ]]; then
    return 0
  fi

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"

    if [[ -z "${line}" || "${line:0:1}" == "#" ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    key="${key%"${key##*[![:space:]]}"}"

    if [[ -z "${key}" ]]; then
      continue
    fi

    export "${key}=${value}"
  done < "${env_file}"
}
