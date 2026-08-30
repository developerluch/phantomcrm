# Phantom CRM API

Go REST and WebSocket service backed by PostgreSQL.

```bash
cp .env.example .env
go test ./...
go run ./cmd/api
```

Only `DATABASE_URL`, `JWT_SECRET`, `DISCORD_TOKEN`, and `GUILD_ID` are required for API startup. Optional providers remain disabled when their variables are unset.
