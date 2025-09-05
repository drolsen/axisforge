# Asset Convention (No Raw Binaries in PRs)

- Do not commit raw image binaries (e.g., .png) for goldens.
- Commit **base64 text** files with `.png.b64` (no `data:image/...` prefix).
- Place goldens near tests (e.g., `examples/foo/golden.png.b64`) or in `assets/_incoming/` for general assets.
- CI will decode `assets/_incoming/*.b64` into real binaries and open a PR.
- The visual test harness reads `.png` or `.png.b64` seamlessly.
