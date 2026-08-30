# Contributing

## Development workflow

1. Create a focused branch from `main`.
2. Keep desktop changes under `apps/desktop` and API changes under `apps/api`.
3. Add or update tests for behavior changes.
4. Run `npm run verify` before opening a pull request.
5. Explain configuration, migration, and security impact in the pull request.

Use npm for JavaScript dependencies; the root `package-lock.json` is the only JavaScript lockfile. Use `go mod tidy` only when Go dependencies change.

## Safe test data

Do not use real client, policy, health, payment, banking, licensing, or credential data. Fixtures must be unmistakably synthetic and use reserved domains such as `example.com` and reserved phone ranges.

## Commit scope

Keep refactors separate from behavior changes when practical. Do not commit generated desktop releases, API binaries, local logs, `.env` files, or provider exports.
