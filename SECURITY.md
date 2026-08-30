# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting for this repository. If that feature is unavailable, contact the repository owner privately and include the affected commit, impact, and a minimal reproduction without live credentials or customer data.

## Supported versions

Security fixes target the latest `main` revision until versioned releases begin.

## Deployment warning

The repository is safe to inspect and develop in public, but operators are responsible for tenant authorization, provider webhook verification, secret management, database isolation, signed desktop releases, and deployment-specific review. Do not expose a development deployment to real customer data.

Long-lived bearer tokens must not be placed in URLs. The desktop client obtains a short-lived, single-use WebSocket ticket over authenticated HTTPS. Provider keys belong in the API environment and must never use a `VITE_` variable or browser storage.
