#!/bin/sh
# Runs inside the build (Dockerfile): fetches one commit of a git repository
# into DIR, from the first URL that serves it, and checks it out.
#
#   fetch-git.sh DIR COMMIT URL [MIRROR...]
#
# chromium.googlesource.com answers 503 now and then, so each URL gets five
# tries, 2, 4, 8 and 16 seconds apart, before the next URL (a mirror) is
# tried. Whichever serves it, the commit checked out must be COMMIT.
set -eu
dir=$1 commit=$2
shift 2

git init -q "$dir"
for url; do
	delay=2
	for try in 1 2 3 4 5; do
		if git -C "$dir" fetch -q --depth 1 "$url" "$commit"; then
			git -C "$dir" checkout -q FETCH_HEAD
			got=$(git -C "$dir" rev-parse HEAD)
			if [ "$got" != "$commit" ]; then
				echo "fetch-git: $url gave $got, not $commit" >&2
				exit 1
			fi
			exit 0
		fi
		[ "$try" -lt 5 ] || break
		echo "fetch-git: $url failed (try $try of 5); again in ${delay}s" >&2
		sleep "$delay"
		delay=$((delay * 2))
	done
	echo "fetch-git: giving up on $url" >&2
done
echo "fetch-git: no URL served $commit" >&2
exit 1
