# shellcheck shell=bash
# Parsing for try.sh: what the guest printed on its serial console, and what
# the host's own tools say. Sourced, never run; test/parse_test.sh tests it.
# Every function reads a file (or stdin with "-") once and prints plain text.

# results SERIAL_LOG: the guest's results, from between its two markers, with
# the serial console's carriage returns taken out. Nothing when the guest
# never got to the end marker.
results() {
	[ -r "$1" ] || return 1
	tr -d '\r' < "$1" | awk '
		/^CHVGPU-BEGIN$/ { on = 1; buf = ""; next }
		/^CHVGPU-END$/   { if (on) { printf "%s", buf; done = 1 } on = 0; next }
		on               { buf = buf $0 "\n" }
		END              { exit !done }'
}

# section RESULTS NAME: one command's output, as the guest script framed it
# ("### section NAME" ... "### end NAME rc=N seconds=N").
section() {
	awk -v name="$2" '
		$0 == "### section " name { on = 1; next }
		on && index($0, "### end " name " ") == 1 { exit }
		on { print }' "$1"
}

# section_rc RESULTS NAME: the command's exit status, or "missing".
section_rc() {
	local rc
	rc=$(awk -v name="$2" 'index($0, "### end " name " rc=") == 1 {
		sub(/.* rc=/, ""); sub(/ .*/, ""); print; exit }' "$1")
	echo "${rc:-missing}"
}

# kv FILE KEY: the value after "KEY:" on the first line that starts with it
# (leading blanks ignored), trimmed.
kv() {
	awk -v key="$2" '{
		line = $0; sub(/^[ \t]+/, "", line)
		if (index(line, key ":") == 1) {
			v = substr(line, length(key) + 2); gsub(/^[ \t]+|[ \t]+$/, "", v); print v; exit
		}
	}' "$1"
}

# glxinfo FILE: "renderer|version|accelerated" from `glxinfo -B`. The version
# is the core profile's when there is one (the compatibility one is often
# lower), else the plain "OpenGL version string".
glxinfo_summary() {
	local in renderer version accel
	in=$(cat -- "$1")
	renderer=$(kv - "OpenGL renderer string" <<<"$in")
	version=$(kv - "OpenGL core profile version string" <<<"$in")
	[ -n "$version" ] || version=$(kv - "OpenGL version string" <<<"$in")
	accel=$(kv - "Accelerated" <<<"$in")
	echo "${renderer}|${version}|${accel}"
}

# eglinfo FILE: "renderer|version" of the first OpenGL (or else GLES) profile
# that `eglinfo -B` lists.
eglinfo_summary() {
	local in renderer version
	in=$(cat -- "$1")
	renderer=$(kv - "OpenGL core profile renderer" <<<"$in")
	version=$(kv - "OpenGL core profile version" <<<"$in")
	if [ -z "$renderer" ]; then
		renderer=$(kv - "OpenGL ES profile renderer" <<<"$in")
		version=$(kv - "OpenGL ES profile version" <<<"$in")
	fi
	echo "${renderer}|${version}"
}

# vulkan_devices FILE: one line per device in `vulkaninfo --summary`,
# "GPUn|deviceType|deviceName|driverName|apiVersion|driverInfo", with the
# type shortened (PHYSICAL_DEVICE_TYPE_DISCRETE_GPU -> discrete_gpu).
vulkan_devices() {
	awk '
		function flush() {
			if (gpu != "") print gpu "|" f["deviceType"] "|" f["deviceName"] "|" f["driverName"] "|" f["apiVersion"] "|" f["driverInfo"]
			gpu = ""; split("", f)
		}
		/^GPU[0-9]+:[ \t]*$/ { flush(); gpu = $0; sub(/:.*/, "", gpu); next }
		gpu != "" && /^[ \t]+[A-Za-z]+[ \t]*=/ {
			k = $0; sub(/^[ \t]+/, "", k); sub(/[ \t]*=.*/, "", k)
			v = $0; sub(/^[^=]*=[ \t]*/, "", v); sub(/[ \t]+$/, "", v)
			if (k == "deviceType") { sub(/^PHYSICAL_DEVICE_TYPE_/, "", v); v = tolower(v) }
			f[k] = v; next
		}
		gpu != "" && /^[^ \t]/ { flush() }
		END { flush() }' "$1"
}

# vulkan_best FILE: the first device that isn't the CPU (lavapipe), or the
# first device when that's all there is.
vulkan_best() {
	local devices
	devices=$(vulkan_devices "$1")
	[ -n "$devices" ] || return 0
	{ grep -v '^[^|]*|cpu|' <<<"$devices"; echo "$devices"; } | grep -m1 . || true
}

# score FILE TOOL: the score glmark2 or vkmark printed at the end
# ("glmark2 Score: 4381"), or nothing.
score() {
	sed -n "s/.*$2 Score: *\([0-9][0-9]*\).*/\1/p" "$1" | tail -n1
}

# bench_renderer FILE: what glmark2 (GL_RENDERER) or vkmark (Device Name) ran on.
bench_renderer() {
	local in r
	in=$(cat -- "$1")
	r=$(kv - "GL_RENDERER" <<<"$in")
	[ -n "$r" ] || r=$(kv - "Device Name" <<<"$in")
	echo "$r"
}

# drm_features FILE: the virtio-gpu features the guest's kernel found, from
# its "[drm] features: +virgl +edid ..." lines (it prints them over two).
drm_features() {
	sed -n 's/.*\[drm\] features: *//p' "$1" | tr -s ' \t\n' ' ' | sed 's/^ //; s/ $//'
}

# ratio A B: A/B to one decimal, or "?" when either is missing or B is 0.
ratio() {
	awk -v a="$1" -v b="$2" 'BEGIN {
		if (a !~ /^[0-9]+$/ || b !~ /^[0-9]+$/ || b == 0) { print "?"; exit }
		printf "%.1f\n", a / b }'
}

# is_software RENDERER: whether a GL renderer or Vulkan device is Mesa's
# software one (llvmpipe, softpipe, lavapipe), i.e. no GPU was used.
is_software() {
	case "$1" in
	*llvmpipe* | *softpipe* | *lavapipe* | *"SwiftShader"*) return 0 ;;
	*) return 1 ;;
	esac
}

# mesa_version TEXT: the Mesa version in a glxinfo/vulkaninfo string
# ("4.6 (Core Profile) Mesa 24.0.5-1ubuntu1" -> 24.0.5-1ubuntu1).
mesa_version() {
	sed -n 's/.*Mesa \([0-9][^ )]*\).*/\1/p' <<<"$1" | head -n1
}
