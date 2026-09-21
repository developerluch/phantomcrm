# Phantom CRM API

Go REST and WebSocket service backed by PostgreSQL.

```bash
cp .env.example .env
go test ./...
go run ./cmd/api
```

Only `DATABASE_URL` and `JWT_SECRET` are required for API startup. Discord (`DISCORD_TOKEN`, `GUILD_ID`, `DISCORD_CLIENT_ID`/`_SECRET`) and the other providers are optional and stay disabled when their variables are unset.
