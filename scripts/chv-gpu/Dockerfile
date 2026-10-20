# syntax=docker/dockerfile:1
# Builds the GPU spike's binaries; run by build.sh, which passes every pin in
# versions.env as a build argument. The last stage is only the tarball.
ARG RUST_IMAGE
FROM ${RUST_IMAGE} AS build

ARG DEBIAN_SNAPSHOT
ARG SOURCE_DATE_EPOCH
ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH} \
    DEBIAN_FRONTEND=noninteractive \
    CARGO_TERM_PROGRESS_WHEN=never

# Debian's packages as they were on one day, so a rebuild gets the same ones.
RUN rm -f /etc/apt/sources.list.d/* /etc/apt/sources.list && \
    printf '%s\n' \
      "deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT} bookworm main" \
      "deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT} bookworm-updates main" \
      "deb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT} bookworm-security main" \
      > /etc/apt/sources.list && \
    apt-get -o Acquire::Retries=5 update && \
    apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
      bzip2 ca-certificates clang curl file git libcap-dev libclang-dev \
      libdrm-dev libegl-dev libepoxy-dev libgbm-dev libgles-dev libvulkan-dev \
      libwayland-dev libx11-dev libxext-dev make meson musl-tools ninja-build \
      patch pkg-config protobuf-compiler python3 python3-yaml \
      wayland-protocols && \
    rm -rf /var/lib/apt/lists/*

# crosvm pins Rust 1.88.0 (the image's); Cloud Hypervisor v50 needs 1.89.
ARG CHV_RUST=1.89.0
RUN rustup toolchain install "$CHV_RUST" --profile minimal --target x86_64-unknown-linux-musl
ARG CARGO_BUILD_JOBS=4
ENV CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS}
WORKDIR /src
# The install prefix inside the build; the tarball is relocatable.
ENV PREFIX=/opt/chv-gpu

# --- virglrenderer, with Venus and its render server -------------------------
ARG VIRGLRENDERER_REPO
ARG VIRGLRENDERER_COMMIT
RUN git init -q virglrenderer && cd virglrenderer && \
    git fetch -q --depth 1 "$VIRGLRENDERER_REPO" "$VIRGLRENDERER_COMMIT" && \
    git checkout -q FETCH_HEAD && \
    test "$(git rev-parse HEAD)" = "$VIRGLRENDERER_COMMIT" && \
    meson setup build --prefix="$PREFIX" --libdir=lib --buildtype=release \
      -Dvenus=true -Drender-server=true -Dplatforms=egl,glx \
      -Dtests=false -Dc_args=-ffile-prefix-map=/src/= && \
    ninja -C build install

# --- crosvm, for `crosvm device gpu` -----------------------------------------
ARG CROSVM_REPO
ARG CROSVM_COMMIT
ARG MINIJAIL_REPO
ARG MINIJAIL_COMMIT
RUN git init -q crosvm && cd crosvm && \
    git fetch -q --depth 1 "$CROSVM_REPO" "$CROSVM_COMMIT" && git checkout -q FETCH_HEAD && \
    test "$(git rev-parse HEAD)" = "$CROSVM_COMMIT" && \
    test "$(git ls-tree HEAD third_party/minijail | awk '{print $3}')" = "$MINIJAIL_COMMIT" && \
    rmdir third_party/minijail && git init -q third_party/minijail && \
    git -C third_party/minijail fetch -q --depth 1 "$MINIJAIL_REPO" "$MINIJAIL_COMMIT" && \
    git -C third_party/minijail checkout -q FETCH_HEAD
RUN cd crosvm && \
    export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" CROSVM_USE_SYSTEM_VIRGLRENDERER=1 && \
    export RUSTFLAGS='-C link-arg=-Wl,-rpath,$ORIGIN/../lib --remap-path-prefix=/src=. --remap-path-prefix=/usr/local/cargo=cargo' && \
    cargo build --release --locked --features virgl_renderer && \
    install -D -m 755 target/release/crosvm "$PREFIX/bin/crosvm"

# --- Cloud Hypervisor with Spectrum's GPU patchset ---------------------------
ARG CHV_URL
ARG CHV_SHA256
ARG VHOST_URL
ARG VHOST_SHA256
ARG SPECTRUM_PATCHES_URL
ARG SPECTRUM_PATCHES_SHA256
RUN fetch() { curl -fsSL --retry 5 -o "$1" "$2" && echo "$3  $1" | sha256sum -c --quiet; } && \
    fetch chv.tar.gz "$CHV_URL" "$CHV_SHA256" && \
    fetch vhost.tar.gz "$VHOST_URL" "$VHOST_SHA256" && \
    fetch spectrum.tar.gz "$SPECTRUM_PATCHES_URL" "$SPECTRUM_PATCHES_SHA256" && \
    mkdir cloud-hypervisor vhost spectrum && \
    tar xzf chv.tar.gz --strip-components=1 -C cloud-hypervisor && \
    tar xzf vhost.tar.gz --strip-components=1 -C vhost && \
    tar xzf spectrum.tar.gz --strip-components=1 -C spectrum && \
    patch -d vhost -p1 --no-backup-if-mismatch < spectrum/vhost.patch && \
    patch -d cloud-hypervisor -p1 --no-backup-if-mismatch < spectrum/cloud-hypervisor.patch
# Static (musl), like Cloud Hypervisor's own release binaries.
RUN cd cloud-hypervisor && \
    export RUSTFLAGS='--remap-path-prefix=/src=. --remap-path-prefix=/usr/local/cargo=cargo' && \
    cargo "+$CHV_RUST" build --release --locked --target x86_64-unknown-linux-musl \
      --bin cloud-hypervisor --bin ch-remote && \
    install -m 755 target/x86_64-unknown-linux-musl/release/cloud-hypervisor \
      target/x86_64-unknown-linux-musl/release/ch-remote "$PREFIX/bin/"

# --- the tarball --------------------------------------------------------------
COPY package.sh /package.sh
ARG CHV_VERSION
ARG VIRGLRENDERER_VERSION
RUN /package.sh /out

FROM scratch
COPY --from=build /out/ /
