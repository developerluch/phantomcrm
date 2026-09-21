# Phantom CRM desktop

Electron 44, React 18, TypeScript, and Vite desktop client.

```bash
npm install
npm run dev --workspace=@phantomcrm/desktop
```

Use `VITE_PROXY_TARGET` for the development API. Browser-visible variables are public configuration; never place provider secrets in a `VITE_` variable.

## Hosted web build (staging preview)

`Dockerfile.web` builds the renderer with `VITE_WEB_MODE=true` and serves `dist/` with Caddy. Web mode keeps auth tokens in `sessionStorage` instead of Electron's secure storage, so it is for staging previews only — never set `VITE_WEB_MODE` for a packaged Electron build. Build from the repo root:

```bash
docker build -f apps/desktop/Dockerfile.web --build-arg VITE_API_URL=https://<api-host> .
```

On Railway: root directory `/`, Dockerfile path `apps/desktop/Dockerfile.web`, and a `VITE_API_URL` service variable (exposed to the build as a build arg).

