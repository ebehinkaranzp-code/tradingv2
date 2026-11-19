# Full Trading V2 image: Tradoor's pinned Rust/WebAssembly/SolidJS source,
# with live exchange trading disabled by scripts/disable-live-trading.py.
FROM denoland/deno:bin-2.9.6 AS deno

FROM rust:1.95-slim-trixie AS toolchain
ARG WASM_BINDGEN=0.2.128
ARG BINARYEN=version_132
ARG CARGO_CHEF=0.1.78
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl cmake g++ make pkg-config perl golang-go python3 \
 && rm -rf /var/lib/apt/lists/*
RUN rustup target add wasm32-unknown-unknown \
 && curl -fsSL "https://github.com/wasm-bindgen/wasm-bindgen/releases/download/${WASM_BINDGEN}/wasm-bindgen-${WASM_BINDGEN}-x86_64-unknown-linux-musl.tar.gz" \
    | tar -xz -C /usr/local/bin --strip-components=1 "wasm-bindgen-${WASM_BINDGEN}-x86_64-unknown-linux-musl/wasm-bindgen" \
 && curl -fsSL "https://github.com/WebAssembly/binaryen/releases/download/${BINARYEN}/binaryen-${BINARYEN}-x86_64-linux.tar.gz" \
    | tar -xz -C /usr/local/bin --strip-components=2 "binaryen-${BINARYEN}/bin/wasm-opt"
RUN cargo install cargo-chef --version "${CARGO_CHEF}" --locked
COPY --from=deno /deno /usr/local/bin/deno
WORKDIR /src

FROM toolchain AS planner
COPY tradoor-source/Cargo.toml tradoor-source/Cargo.lock ./
COPY tradoor-source/crates crates
COPY tradoor-source/bins bins
RUN cargo chef prepare --recipe-path recipe.json

FROM toolchain AS build
COPY --from=planner /src/recipe.json recipe.json
RUN cargo chef cook --release --locked --recipe-path recipe.json -p tradoor-server -p tradoor-recorder -p tradoor-backfill \
 && cargo chef cook --profile wasm --locked --target wasm32-unknown-unknown --recipe-path recipe.json -p tradoor-wasm
COPY tradoor-source/web/package.json tradoor-source/web/deno.json tradoor-source/web/deno.lock ./web/
RUN cd web && deno install
COPY tradoor-source/Cargo.toml tradoor-source/Cargo.lock ./
COPY tradoor-source/crates crates
COPY tradoor-source/bins bins
COPY tradoor-source/migrations migrations
COPY tradoor-source/scripts scripts
COPY tradoor-source/signers signers
COPY tradoor-source/web web
COPY scripts/disable-live-trading.py /tmp/disable-live-trading.py
RUN python3 /tmp/disable-live-trading.py /src/web
RUN cargo build --release --locked -p tradoor-server -p tradoor-recorder -p tradoor-backfill
RUN ./scripts/build-wasm.sh
ARG SITE_URL=""
RUN cd web && SITE_URL="${SITE_URL}" deno task build

FROM debian:trixie-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --user-group --home-dir /nonexistent --shell /usr/sbin/nologin tradoor \
 && mkdir /data && chown tradoor:tradoor /data
COPY --from=build /src/target/release/tradoor-server /src/target/release/tradoor-recorder /src/target/release/tradoor-backfill /usr/local/bin/
COPY --from=build /src/web/dist /app/web
ENV TRADOOR_BIND=0.0.0.0:8080 \
    TRADOOR_DATA_DIR=/data \
    TRADOOR_WEB_DIR=/app/web
USER tradoor
VOLUME /data
EXPOSE 8080
CMD ["tradoor-server"]
