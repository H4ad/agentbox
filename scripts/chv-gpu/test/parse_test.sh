#!/usr/bin/env bash
# Tests lib/parse.sh and try.sh's summary against tool output in fixtures/.
#
#   scripts/chv-gpu/test/parse_test.sh
# shellcheck disable=SC2034 # try.sh's globals, set here for its summary
set -uo pipefail

tdir=$(cd "$(dirname "$0")" && pwd)
fx=$tdir/fixtures
# try.sh only defines its functions when sourced.
# shellcheck source=../try.sh
. "$tdir/../try.sh"
set +e

failed=0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

eq() { # NAME GOT WANT
	if [ "$2" == "$3" ]; then
		echo "ok   $1"
	else
		echo "FAIL $1"
		echo "     got:  $2"
		echo "     want: $3"
		failed=1
	fi
}
has() { # NAME TEXT NEEDLE
	if [[ $2 == *"$3"* ]]; then
		echo "ok   $1"
	else
		echo "FAIL $1: no \"$3\" in:"
		sed 's/^/     /' <<<"$2"
		failed=1
	fi
}
hasnt() { # NAME TEXT NEEDLE
	if [[ $2 != *"$3"* ]]; then
		echo "ok   $1"
	else
		echo "FAIL $1: \"$3\" in:"
		sed 's/^/     /' <<<"$2"
		failed=1
	fi
}

# --- the tools' own output ---------------------------------------------------

eq "glxinfo llvmpipe" "$(glxinfo_summary "$fx/glxinfo-sw.txt")" \
	"llvmpipe (LLVM 19.1.7, 256 bits)|4.5 (Core Profile) Mesa 25.0.7-2+deb13u1|no"
eq "glxinfo virgl" "$(glxinfo_summary "$fx/glxinfo-virgl.txt")" \
	"virgl (AMD Radeon RX 6600 (radeonsi, navi23, LLVM 19.1.7, DRM 3.59, 6.12.48))|4.3 (Core Profile) Mesa 25.0.7-2+deb13u1|yes"
eq "glxinfo from stdin" "$(glxinfo_summary - < "$fx/glxinfo-sw.txt" | cut -d'|' -f3)" "no"
eq "glxinfo of nothing" "$(glxinfo_summary /dev/null)" "||"
printf 'OpenGL renderer string: foo\nOpenGL version string: 2.1 Mesa 22.3.6\n' > "$tmp/old"
eq "glxinfo with no core profile" "$(glxinfo_summary "$tmp/old")" "foo|2.1 Mesa 22.3.6|"

eq "eglinfo surfaceless" "$(eglinfo_summary "$fx/eglinfo-sw.txt")" \
	"llvmpipe (LLVM 19.1.7, 256 bits)|4.5 (Core Profile) Mesa 25.0.7-2+deb13u1"
grep -v 'core profile\|compatibility profile' "$fx/eglinfo-sw.txt" > "$tmp/gles"
eq "eglinfo with only GLES" "$(eglinfo_summary "$tmp/gles")" \
	"llvmpipe (LLVM 19.1.7, 256 bits)|OpenGL ES 3.2 Mesa 25.0.7-2+deb13u1"

eq "vulkan lavapipe" "$(vulkan_devices "$fx/vulkaninfo-sw.txt")" \
	"GPU0|cpu|llvmpipe (LLVM 19.1.7, 256 bits)|llvmpipe|1.4.305|Mesa 25.0.7-2+deb13u1 (LLVM 19.1.7)"
eq "vulkan venus and lavapipe: two devices" "$(vulkan_devices "$fx/vulkaninfo-venus.txt" | wc -l)" "2"
eq "vulkan best is venus, not the CPU" "$(vulkan_best "$fx/vulkaninfo-venus.txt")" \
	"GPU0|discrete_gpu|Virtio-GPU Venus (AMD Radeon RX 6600 (RADV NAVI23))|venus|1.3.296|Mesa 25.0.7-2+deb13u1"
# The CPU listed first, as hosts with lavapipe installed sometimes do.
awk '/^GPU0:/{g=1} /^GPU1:/{g=2} g==1{a=a $0 "\n"; next} g==2{b=b $0 "\n"; next} {print} END{gsub(/GPU1:/,"GPU0:",b); gsub(/GPU0:/,"GPU1:",a); printf "%s%s", b, a}' \
	"$fx/vulkaninfo-venus.txt" > "$tmp/cpu-first"
eq "vulkan best skips a CPU listed first" "$(vulkan_best "$tmp/cpu-first" | cut -d'|' -f1-4)" \
	"GPU1|discrete_gpu|Virtio-GPU Venus (AMD Radeon RX 6600 (RADV NAVI23))|venus"
eq "vulkan best of only a CPU is the CPU" "$(vulkan_best "$fx/vulkaninfo-sw.txt" | cut -d'|' -f2)" "cpu"
eq "vulkan failed: no devices" "$(vulkan_best "$fx/vulkaninfo-fail.txt")" ""

eq "glmark2 score" "$(score "$fx/glmark2-sw.txt" glmark2)" "4381"
eq "glmark2 score virgl" "$(score "$fx/glmark2-virgl.txt" glmark2)" "8015"
eq "vkmark score" "$(score "$fx/vkmark-sw.txt" vkmark)" "3124"
eq "no score" "$(score "$fx/glxinfo-sw.txt" glmark2)" ""
eq "glmark2 renderer" "$(bench_renderer "$fx/glmark2-sw.txt")" "llvmpipe (LLVM 19.1.7, 256 bits)"
eq "vkmark device" "$(bench_renderer "$fx/vkmark-venus.txt")" "Virtio-GPU Venus (AMD Radeon RX 6600 (RADV NAVI23))"

eq "drm features" "$(drm_features "$fx/guest-info.txt")" "+virgl +edid +resource_blob +host_visible +context_init"
eq "drm features over two lines" "$(section "$fx/results-qemu.txt" guest | drm_features -)" \
	"-virgl +edid -resource_blob -host_visible -context_init"
eq "ratio" "$(ratio 8015 4381)" "1.8"
eq "ratio, nothing to divide" "$(ratio "" 4381)" "?"
eq "ratio by zero" "$(ratio 5 0)" "?"
is_software "llvmpipe (LLVM 19.1.7, 256 bits)" && eq "llvmpipe is software" yes yes || eq "llvmpipe is software" no yes
is_software "virgl (AMD Radeon RX 6600)" && eq "virgl isn't software" yes no || eq "virgl isn't software" no no
eq "mesa version" "$(mesa_version "OpenGL version string: 4.6 (Compatibility Profile) Mesa 24.0.5-1ubuntu1")" "24.0.5-1ubuntu1"
eq "mesa version, none" "$(mesa_version "4.6.0 NVIDIA 550.120")" ""

# --- the serial log ----------------------------------------------------------

# serial NAME:FILE:RC...: (FILE in fixtures/, or absolute) a serial console log the way the guest writes one,
# CRLF line ends and the kernel and cloud-init around the results.
serial() {
	{
		printf '[    0.000000] Linux version 6.12.48+deb13-amd64\r\n'
		printf '[   12.120000] cloud-init[512]: Cloud-init v. 25.1.4 running '"'"'modules:final'"'"'\r\n'
		echo CHVGPU-BEGIN
		local s name file rc
		for s; do
			IFS=: read -r name file rc <<<"$s"
			echo "### section $name"
			case "$file" in
			"") ;;
			/*) cat "$file" ;;
			*) cat "$fx/$file" ;;
			esac
			echo "### end $name rc=$rc seconds=3"
		done
		echo CHVGPU-END
		printf '[  301.000000] reboot: Power down\r\n'
	} | sed 's/$/\r/'
}

all_good=(guest:guest-info.txt:0 glxinfo-gpu:glxinfo-virgl.txt:0 eglinfo-gpu:eglinfo-sw.txt:0
	vulkaninfo-gpu:vulkaninfo-venus.txt:0 glmark2-gpu:glmark2-virgl.txt:0 vkmark-gpu:vkmark-venus.txt:0
	glxinfo-sw:glxinfo-sw.txt:0 vulkaninfo-sw:vulkaninfo-sw.txt:0 glmark2-sw:glmark2-sw.txt:0
	vkmark-sw:vkmark-sw.txt:0 dmesg-tail::0)
serial "${all_good[@]}" > "$tmp/serial"

results "$tmp/serial" > "$tmp/results"
eq "results: found" "$?" "0"
hasnt "results: no carriage returns" "$(cat -A "$tmp/results")" '^M'
eq "results: start at the first section" "$(head -n1 "$tmp/results")" "### section guest"
eq "results: nothing after the end" "$(tail -n1 "$tmp/results")" "### end dmesg-tail rc=0 seconds=3"
eq "section: whole output" "$(section "$tmp/results" glmark2-sw)" "$(cat "$fx/glmark2-sw.txt")"
eq "section: a name that prefixes another" "$(section "$tmp/results" glxinfo-gpu | glxinfo_summary - | cut -d'|' -f3)" "yes"
eq "section: missing" "$(section "$tmp/results" nope)" ""
eq "section rc" "$(section_rc "$tmp/results" vkmark-sw)" "0"
eq "section rc, missing" "$(section_rc "$tmp/results" nope)" "missing"
eq "guest kv" "$(kv "$tmp/results" kernel)" "6.12.48+deb13-amd64"

head -n 40 "$tmp/serial" > "$tmp/cut"
results "$tmp/cut" > /dev/null
eq "results: no end marker" "$?" "1"
# A guest that started printing twice (it rebooted): the last complete block wins.
{ echo CHVGPU-BEGIN; echo "### section guest"; echo old; cat "$tmp/serial"; } > "$tmp/twice"
eq "results: restarted block" "$(results "$tmp/twice" | head -n 2 | tail -n 1)" "os: Debian GNU/Linux 13 (trixie)"

# --- the summary -------------------------------------------------------------

host_os="Ubuntu 24.04.3 LTS" host_kernel=6.14.0 host_cpu="AMD Ryzen 7 5800X"
host_gpu_driver=amdgpu host_gpu_ids=1002:73ff host_mesa_v=25.0.7 host_virgl_v="not installed"
host_vulkan_v="AMD Radeon RX 6600 (RADV NAVI23) (radv, discrete_gpu, Vulkan 1.4.305)"
binaries="cloud-hypervisor 50.0 + Spectrum OS GPU patchset 50.0-spectrum0 (static, musl)"

problems=()
out=$(summary "$tmp/serial")
has "summary: header" "$out" "----- chv-gpu try.sh summary (paste this back) -----"
has "summary: host" "$out" "host:        Ubuntu 24.04.3 LTS, kernel 6.14.0, AMD Ryzen 7 5800X"
has "summary: guest" "$out" "guest:       Debian GNU/Linux 13 (trixie), kernel 6.12.48+deb13-amd64, Mesa 25.0.7-2+deb13u1"
has "summary: features" "$out" "virtio-gpu:  +virgl +edid +resource_blob +host_visible +context_init"
has "summary: GL GPU" "$out" "GL (GPU):         virgl (AMD Radeon RX 6600 (radeonsi, navi23, LLVM 19.1.7, DRM 3.59, 6.12.48)); 4.3 (Core Profile) Mesa 25.0.7-2+deb13u1; accelerated: yes"
has "summary: GL software" "$out" "GL (software):    llvmpipe (LLVM 19.1.7, 256 bits); 4.5 (Core Profile) Mesa 25.0.7-2+deb13u1; accelerated: no"
has "summary: Vulkan GPU" "$out" "Vulkan (GPU):     Virtio-GPU Venus (AMD Radeon RX 6600 (RADV NAVI23)); venus (discrete_gpu), Vulkan 1.3.296"
has "summary: Vulkan software" "$out" "Vulkan (software): llvmpipe (LLVM 19.1.7, 256 bits); llvmpipe (cpu), Vulkan 1.4.305"
has "summary: glmark2" "$out" "glmark2:         GPU 8015, software 4381 (x1.8)"
has "summary: vkmark" "$out" "vkmark:          GPU 21544, software 3124 (x6.9)"
has "summary: no problems" "$out" "problems:        none"
eq "summary: ends with its rule" "$(tail -n1 <<<"$out")" "-----"

# Venus failing, glmark2 on the GPU falling back to llvmpipe.
serial guest:guest-info.txt:0 glxinfo-gpu:glxinfo-sw.txt:0 eglinfo-gpu:eglinfo-sw.txt:0 \
	vulkaninfo-gpu:vulkaninfo-fail.txt:1 glmark2-gpu:glmark2-sw.txt:0 vkmark-gpu:vulkaninfo-fail.txt:1 \
	glxinfo-sw:glxinfo-sw.txt:0 vulkaninfo-sw:vulkaninfo-sw.txt:0 glmark2-sw:glmark2-sw.txt:0 \
	vkmark-sw:vkmark-sw.txt:0 > "$tmp/bad"
problems=()
out=$(summary "$tmp/bad")
has "failure: Vulkan GPU failed" "$out" "Vulkan (GPU):     failed"
has "failure: vkmark GPU failed" "$out" "vkmark:          GPU failed, software 3124 (x?)"
has "failure: vulkaninfo's error" "$out" "  - vulkaninfo-gpu: exit 1: "
has "failure: names the error" "$out" "ERROR_INITIALIZATION_FAILED"
has "failure: GL fell back" "$out" "  - GL with the GPU fell back to software (llvmpipe (LLVM 19.1.7, 256 bits))"
has "failure: Xorg wasn't asked about" "$(hasnt x "$out" "Xorg didn't start")" "ok"

# Xorg didn't start; dmesg tail shown.
printf '[    5.1] (EE) no screens found(EE)\n[    5.2] (EE) Fatal server error:\n' > "$tmp/xorg.txt"
printf '[ 10.0] virtio_gpu_dequeue_ctrl_func: response 0x1203 (command 0x10c)\n' > "$tmp/dmesg.txt"
serial guest:guest-info.txt:0 "xorg:$tmp/xorg.txt:0" "dmesg-tail:$tmp/dmesg.txt:0" > "$tmp/noxorg"
problems=()
out=$(summary "$tmp/noxorg")
has "no X: says so" "$out" "Xorg didn't start: [    5.1] (EE) no screens found(EE)"
has "no X: GL failed" "$out" "GL (GPU):         failed"
has "no X: the runs that never happened" "$out" "  - glmark2-gpu: didn't run"
has "no X: guest kernel lines" "$out" "  [ 10.0] virtio_gpu_dequeue_ctrl_func: response 0x1203 (command 0x10c)"

# A real run: QEMU's 2D virtio GPU (test/guest-in-qemu.sh), so no virgl or Venus.
{ echo CHVGPU-BEGIN; cat "$fx/results-qemu.txt"; echo CHVGPU-END; } > "$tmp/qemu"
problems=()
out=$(summary "$tmp/qemu")
has "qemu: guest" "$out" "kernel 6.12.107+deb13-amd64, Mesa 25.0.7-2+deb13u1"
has "qemu: Venus failed" "$out" "  - vulkaninfo-gpu: exit 1: ERROR at ./vulkaninfo/./vulkaninfo.h:247:vkEnumeratePhysicalDevices failed with ERROR_INITIALIZATION_FAILED"
has "qemu: GL fell back" "$out" "  - GL with the GPU fell back to software"
has "qemu: software Vulkan" "$out" "Vulkan (software): llvmpipe (LLVM 19.1.7, 256 bits); llvmpipe (cpu), Vulkan 1.4.305"
has "qemu: scores" "$out" "glmark2:         GPU 23, software 29 (x0.8)"

# The guest never finished.
problems=()
out=$(summary "$tmp/cut")
has "no results: says so" "$out" "  - no results from the guest (see the serial log with --keep)"
hasnt "no results: no per-run noise" "$out" "didn't run"
has "no results: guest" "$out" "guest:       no results"
problems=()
out=$(summary "$tmp/nonexistent" 2>&1)
has "no serial log at all" "$out" "  - no results from the guest"
hasnt "no serial log: no shell errors" "$out" "No such file"

# --- the guest's user-data ---------------------------------------------------

user_data > "$tmp/user-data"
eq "user-data: cloud-config" "$(head -n1 "$tmp/user-data")" "#cloud-config"
if command -v python3 >/dev/null && python3 -c 'import yaml' 2>/dev/null; then
	got=$(python3 -I -c '
import base64, sys, yaml
d = yaml.safe_load(open(sys.argv[1]))
f = d["write_files"][0]
print(" ".join(d["packages"]))
print(base64.b64decode(f["content"]).decode() == open(sys.argv[2]).read(), d["runcmd"][0][0] == f["path"])
' "$tmp/user-data" "$tdir/../guest/run-tests.sh")
	has "user-data: packages" "$got" "mesa-vulkan-drivers"
	has "user-data: script round-trips and runs" "$got" "True True"
else
	echo "skip user-data YAML (no python3 yaml)"
fi
bash -n "$tdir/../guest/run-tests.sh" && eq "guest script parses" 0 0 || eq "guest script parses" 1 0

if [ $failed -ne 0 ]; then
	echo "FAILED"
	exit 1
fi
echo "PASS"
