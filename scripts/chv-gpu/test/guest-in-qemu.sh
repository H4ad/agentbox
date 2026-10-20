#!/usr/bin/env bash
# Checks try.sh's guest half on a machine with no GPU (and no KVM if need be):
# the same Debian image, seed and guest script, booted by QEMU with its own
# 2D virtio GPU instead of Cloud Hypervisor and crosvm, then try.sh's summary
# of what it printed. The GPU runs fall back or fail; everything around them
# (cloud-init, the packages, Xorg, the framing, the parsing) is what's checked.
#
#   scripts/chv-gpu/test/guest-in-qemu.sh [--keep]
# shellcheck disable=SC2034,SC2154 # try.sh's globals
set -euo pipefail

tdir=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../try.sh
. "$tdir/../try.sh"

[ "${1:-}" = --keep ] && keep=true
command -v qemu-system-x86_64 >/dev/null || die "needs qemu-system-x86_64"
accel=tcg
[ -w /dev/kvm ] && accel=kvm

mkdir -p "$cache"
work=$(mktemp -d "$cache/qemu.XXXXXX")
trap cleanup EXIT
trap 'exit 130' INT TERM
prepare_guest

say "Booting under QEMU ($accel)"
start qemu qemu-system-x86_64 -accel "$accel" -m 2048 -smp 4 -cpu max \
	-drive "file=$work/disk.raw,format=raw,if=virtio" \
	-drive "file=$work/seed.img,format=raw,if=virtio,readonly=on" \
	-nic user,model=virtio-net-pci -device virtio-gpu-pci \
	-display none -serial "file:$work/serial.log" -monitor none
deadline=$((SECONDS + 90 * 60))
while [ $SECONDS -lt $deadline ] && alive "${pid[qemu]}"; do
	grep -q '^CHVGPU-END' "$work/serial.log" 2>/dev/null && break
	sleep 10
done
render_node=none binaries="QEMU $accel, virtio-gpu-pci (2D): no crosvm, no Cloud Hypervisor"
summary "$work/serial.log"
