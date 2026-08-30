# Legacy repository retirement

No legacy repository was deleted, archived, or changed during consolidation.

The following repositories are candidates for removal only after deployment and release migration is complete:

- `developerluch/phantomcrm-api`
- `developerluch/phantomcrm-desktop`

`developerluch/phantom-dialer-api` is not part of this monorepo and is not a removal candidate from this consolidation.

Before deletion:

1. Mirror each legacy repository, including every branch, tag, pull-request ref, release, issue, and deployment note.
2. Reconnect Railway/API deployment to `apps/api` in the monorepo and verify the public hostname.
3. Move desktop update/release automation and create a signed test release from the monorepo.
4. Close or migrate open pull requests and update external links.
5. Disable legacy webhooks, deploy keys, Actions secrets, and provider integrations.
6. Observe at least one successful production deployment and desktop update cycle.
7. Obtain explicit final confirmation naming the exact repository immediately before each GitHub deletion.
