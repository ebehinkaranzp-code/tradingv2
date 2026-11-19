# Tradoor Upstream Pin

- Repository: https://github.com/tradoor-terminal/tradoor
- Pinned branch at inspection: `main`
- Exact inspected commit: `dcfe34a0ee840c97104da6d62b0d6e34773b117c`
- Commit date: 2026-11-19
- Tree: `cea623ade977cd085efd98fb2b29798dac456412`
- Tree inventory: 472 files, 522 tree entries, approximately 16.0 MB of file content.
- Required upstream license: AGPL-3.0-only.

## Verification

The pinned upstream tree contains the expected `crates/`, `bins/`, `web/`, `scripts/`, `migrations/`, and `docs/` directories. This confirms that the full source tree is available upstream, while it is not yet present in this Trading V2 repository.

## Import decision

Do not copy the upstream `main` branch by a floating reference. Use the exact commit above for the first import. Keep it isolated under a clearly named integration boundary and preserve all upstream license and attribution files.

The tree includes large binary screenshots and generated/static assets. A future import should preserve source files and required runtime assets, while avoiding duplicate demo screenshots where possible only if their removal is documented and does not break upstream build/docs.

## Build prerequisites from upstream documentation

- Rust 1.95 and `wasm32-unknown-unknown`
- `wasm-bindgen-cli` 0.2.128
- Deno 2
- Docker / PostgreSQL 18 for the self-hosted database configuration

A successful source import is not a successful build. Build and test the pinned upstream project independently before making Trading V2 integration changes.
