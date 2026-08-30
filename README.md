# Phantom CRM

Phantom CRM is an open-source desktop CRM for insurance-agency recruiting, sales operations, messaging, scheduling, and team administration. This monorepo contains the Electron/React client and the Go API it uses.

## Repository layout

```text
apps/
  api/       Go REST and WebSocket API
  desktop/   Electron, React, TypeScript, and Vite client
docs/        Architecture, deployment, and source-history notes
```

`phantom-dialer-api` is not included. The current desktop call action is a UI entry point and the separate dialer repository is only a scaffold; neither the desktop client nor API requires it at runtime.

## Prerequisites

- Node.js 22.12 or newer and npm 10.9 or newer
- Go 1.24.1 or newer
- PostgreSQL for a running API instance
- macOS and Xcode command-line tools only when building the optional Fn-key helper

## Quick start

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/desktop/.env.example apps/desktop/.env
npm run dev
```

The Vite development server proxies `/api` to `VITE_PROXY_TARGET`. The API requires PostgreSQL, a JWT secret, and Discord configuration before it can start; optional integrations remain disabled when their variables are unset.

## Verification

```bash
npm run verify
```

That command type-checks and builds the desktop app, runs its migration harness, runs API tests and vet, builds the API, and rejects high-or-critical npm advisories.

## Security and data handling

Never commit credentials, carrier/client records, exports, production environment files, or realistic policy fixtures. Use synthetic `example.com` data in tests and examples. See [SECURITY.md](SECURITY.md) for private vulnerability reporting and [docs/deployment.md](docs/deployment.md) for production caveats.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT. See [LICENSE](LICENSE).
