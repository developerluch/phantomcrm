# Source history and provenance

This public repository was consolidated from two private repositories:

- `developerluch/phantomcrm-api`, source revision `4036c3c8dfbff7445a97776e06c90e682c4f63eb`
- `developerluch/phantomcrm-desktop`, source revision `ac44950c36ba8c5bb026f6daf4d2b3bbf9044dd3`

The API's reachable source history was retained after removing the tracked build binary, internal commit-message files, and personal author email. The desktop was imported as a reviewed snapshot because its private history contains a revoked credential literal, production configuration, internal planning material, privacy-like fixtures, and cloud-offloaded objects that could not be safely exported. The complete desktop history remains in the untouched legacy repository.

The unrelated `phantomcrm-desktop/main` web/Hono lineage was not imported. The selected desktop source is the modern Electron lineage used by `master` and the coordinated stabilization branch.

`phantom-dialer-api` was reviewed and excluded because it is a future scaffold, not a runtime dependency.
