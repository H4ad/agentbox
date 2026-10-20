#!/usr/bin/env bash
# Runs the tarball's own cloud-hypervisor on try.sh's exact command line
# (chv_command), far enough to prove v50 parses and validates it, on a
# machine with no KVM: v50 opens /dev/kvm and asks KVM_GET_API_VERSION before
# it reads its options, so the run happens in a user and mount namespace whose
# /dev/kvm is an empty file, under fake-kvm, which answers that one ioctl.
# The first KVM ioctl after it (KVM_CHECK_EXTENSION, as the VM is created)
# fails, and means the options were parsed and validated. Nothing else on the
# machine sees the fake /dev/kvm, a real one included.
#
#   scripts/chv-gpu/test/chv_args_test.sh [TARBALL]   (default: out/*.tar.gz)
#
# Needs gcc, and unshare with unprivileged user namespaces.
# shellcheck disable=SC2034,SC2154 # try.sh's globals, and chv from chv_command
set -uo pipefail

tdir=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../try.sh
. "$tdir/../try.sh"
set +e

tarball=${1:-$(ls "$tdir"/../out/chv-gpu-*.tar.gz 2>/dev/null | head -n1)}
[ -f "$tarball" ] || { echo "no tarball: run build.sh first, or pass one"; exit 1; }
for c in gcc unshare; do command -v "$c" >/dev/null || { echo "needs $c"; exit 1; }; done

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
gcc -O2 -Wall -o "$tmp/fake-kvm" "$tdir/fake-kvm.c" || exit 1
mkdir -p "$tmp/bin" "$tmp/work" "$tmp/cache"
tar -xzf "$tarball" -C "$tmp/bin" --strip-components=1

# try.sh's globals, as run_guest has them; the files only need to exist.
bin=$tmp/bin work=$tmp/work cache=$tmp/cache
cp /dev/null "$cache/CLOUDHV.fd"
truncate -s 12G "$work/disk.raw"
truncate -s 2M "$work/seed.img"

# fake_kvm_run COMMAND...: COMMAND with the fake /dev/kvm, output combined.
fake_kvm_run() {
	rm -f "$work/api.sock" # each run makes its own
	# shellcheck disable=SC2016 # expanded inside the namespace
	timeout 60 unshare --user --map-root-user --mount sh -c '
		set -e
		d=$(mktemp -d)
		mount -t tmpfs tmpfs "$d"
		for n in null zero random urandom full; do
			touch "$d/$n"; mount --bind "/dev/$n" "$d/$n"
		done
		touch "$d/kvm"
		mount --move "$d" /dev
		exec "$@"' sh "$tmp/fake-kvm" "$@" 2>&1
}

failed=0
check() { # NAME OUTPUT WANT-PARSED(yes|no) [NEEDLE]
	local parsed=no
	grep -q 'fake-kvm: KVM ioctl' <<<"$2" && ! grep -q 'Error parsing config' <<<"$2" && parsed=yes
	if [ "$parsed" = "$3" ] && { [ -z "${4:-}" ] || grep -qF "$4" <<<"$2"; }; then
		echo "ok   $1"
	else
		echo "FAIL $1 (parsed: $parsed, want $3${4:+, and \"$4\"}):"
		sed 's/^/     /' <<<"$2" | tail -n 8
		failed=1
	fi
}

chv_command
echo "try.sh runs: ${chv[*]//"$tmp"\//}"
check "try.sh's command line parses and validates" "$(fake_kvm_run "${chv[@]}")" yes \
	"KVM ioctl 0xae03"

# The harness catches what it's there to catch: the image_type try.sh used
# to pass (v53's), and a config v50 parses but refuses (vhost-user needs
# shared memory).
bad=("${chv[@]}")
for i in "${!bad[@]}"; do
	case "${bad[$i]}" in path="$work/disk.raw") bad[i]+=",image_type=raw" ;; esac
done
check "image_type (v53's option) is refused" "$(fake_kvm_run "${bad[@]}")" no \
	"unknown option: image_type"
bad=("${chv[@]}")
for i in "${!bad[@]}"; do
	case "${bad[$i]}" in size=*M,shared=on) bad[i]=${bad[i]%,shared=on} ;; esac
done
check "vhost-user without shared memory is refused" "$(fake_kvm_run "${bad[@]}")" no \
	"Using vhost-user requires using shared memory"

if [ $failed -ne 0 ]; then
	echo FAILED
	exit 1
fi
echo PASS
