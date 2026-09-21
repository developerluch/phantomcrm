# Changelog

All notable changes will be documented here after the first public release.

## Unreleased

- Discord is now optional: the API starts without `DISCORD_TOKEN`/`GUILD_ID` (Discord-only routes and the sign-in membership check are disabled), and `POST /api/v1/auth/discord` returns 503 when OAuth credentials are not configured.
- Consolidated the Phantom CRM desktop and API sources into one monorepo.
- Added public documentation, governance, CI, dependency automation, and deployment guidance.
- Removed private/internal artifacts, production environment snapshots, a revoked credential literal, and a tracked API binary from the public source boundary.
