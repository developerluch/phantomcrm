# Architecture

The Electron main process owns native capabilities, external-link policy, secure token storage, deep links, updates, and the optional macOS Fn-key helper. The sandboxed React renderer communicates with it through the narrow preload bridge and uses React Query for API state.

The Go service exposes REST endpoints under `/api/v1`, an authenticated WebSocket, provider webhooks, background processors, and PostgreSQL repositories. Provider credentials and OAuth secrets stay server-side.

```text
Electron main + secure storage
            |
      preload IPC bridge
            |
React renderer -- HTTPS / WebSocket ticket --> Go API --> PostgreSQL
                                                  |
                                   optional provider integrations
```

The desktop and API are versioned together so client/API contract changes can be reviewed and tested in one pull request.
