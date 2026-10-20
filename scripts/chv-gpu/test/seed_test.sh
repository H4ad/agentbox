#!/usr/bin/env bash
# Writes try.sh's cloud-init seed with each tool it can use that this
# machine has (cloud-localds, genisoimage, mkisofs, xorriso,
# mkfs.vfat+mcopy), and checks what cloud-init's NoCloud looks for: a
# filesystem labelled cidata holding user-data and meta-data as written.
#
#   scripts/chv-gpu/test/seed_test.sh
set -uo pipefail

tdir=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../try.sh
. "$tdir/../try.sh"
set +e

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/seed"
user_data > "$tmp/seed/user-data"
printf 'instance-id: chv-gpu-test\nlocal-hostname: chv-gpu\n' > "$tmp/seed/meta-data"

blkid=$(tool blkid) || { echo "needs blkid"; exit 1; }
failed=0 ran=0
for t in cloud-localds genisoimage mkisofs xorriso mkfs.vfat; do
	if ! CHVGPU_SEED_TOOL=$t seed_tool >/dev/null; then
		echo "skip $t (not installed)"
		continue
	fi
	ran=$((ran + 1))
	out=$tmp/$t.img
	if ! CHVGPU_SEED_TOOL=$t make_seed "$tmp/seed" "$out" 2>"$tmp/err"; then
		echo "FAIL $t: $(cat "$tmp/err")"
		failed=1
		continue
	fi
	label=$("$blkid" -o value -s LABEL "$out")
	type=$("$blkid" -o value -s TYPE "$out")
	ok=yes
	for f in user-data meta-data; do
		case "$type" in
		iso9660) xorriso -osirrox on -indev "$out" -extract "/$f" "$tmp/got" >/dev/null 2>&1 ||
			isoinfo -i "$out" -R -x "/$f" > "$tmp/got" 2>/dev/null ;;
		vfat) mtype -i "$out" "::$f" > "$tmp/got" 2>/dev/null ;;
		*) : > "$tmp/got" ;;
		esac
		cmp -s "$tmp/got" "$tmp/seed/$f" || ok="no ($f differs or is missing)"
		rm -f "$tmp/got"
	done
	# NoCloud matches the label in any case.
	[ "${label,,}" = cidata ] || ok="no (label \"$label\")"
	if [ "$ok" = yes ]; then
		echo "ok   $t: $type labelled $label, user-data and meta-data intact"
	else
		echo "FAIL $t: $ok"
		failed=1
	fi
done
[ $ran -gt 0 ] || { echo "no seed tool here to test"; exit 1; }
[ $failed -eq 0 ] && echo PASS || { echo FAILED; exit 1; }
