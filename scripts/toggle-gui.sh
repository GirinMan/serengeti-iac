#!/usr/bin/env bash
# Toggle between GUI (graphical.target) and headless (multi-user.target) mode.
# Stopping GUI frees GPU VRAM for compute workloads.
#
# Usage:
#   sudo ./toggle-gui.sh on    # Start GUI + set default
#   sudo ./toggle-gui.sh off   # Stop GUI + set default
#   sudo ./toggle-gui.sh       # Toggle current state

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Error: must run as root (sudo)." >&2
    exit 1
fi

current_target=$(systemctl get-default)

case "${1:-}" in
    on)  action="on" ;;
    off) action="off" ;;
    "")
        if [[ "$current_target" == "graphical.target" ]]; then
            action="off"
        else
            action="on"
        fi
        ;;
    *)
        echo "Usage: $0 [on|off]" >&2
        exit 1
        ;;
esac

if [[ "$action" == "off" ]]; then
    echo "Switching to headless mode (multi-user.target)..."
    systemctl set-default multi-user.target
    systemctl isolate multi-user.target
    echo "GUI stopped. GPU VRAM freed."
    echo "Reconnect via SSH if your terminal session was on the desktop."
else
    echo "Switching to GUI mode (graphical.target)..."
    systemctl set-default graphical.target
    systemctl isolate graphical.target
    echo "GUI started."
fi

echo "Default target: $(systemctl get-default)"
