# Deployment

## API

Build the API with `apps/api/Dockerfile` and set the service root directory to `apps/api`. The health endpoint is `/api/v1/health`. Start from `apps/api/.env.example`, store values in the deployment provider, and never commit a populated environment file.

For Railway, reconnect the service to this repository and set the root directory before removing the legacy source repository. The existing public API hostname can remain unchanged so desktop clients do not require a URL migration.

## Desktop

Desktop builds run from the root npm workspace. `npm run build` produces the renderer bundle. Platform packaging uses the scripts in `apps/desktop/package.json`; the macOS package additionally builds the native Fn-key helper.

Do not publish unsigned production installers. Configure macOS signing/notarization and Windows code signing, then enable a release workflow with an approval gate. The GitHub updater target is this monorepo.

## Migration order

1. Connect a staging API service to this repository at `apps/api`.
2. Apply the existing database migrations against a disposable/staging database.
3. Verify health, authentication, WebSocket tickets, and provider callbacks.
4. Repoint the production service without changing its public hostname.
5. Build, sign, and smoke-test desktop installers from this repository.
6. Disable legacy repository deployment hooks and release automation.
7. Export or mirror legacy repositories, then request explicit confirmation before deletion.
