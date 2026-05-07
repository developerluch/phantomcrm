# VIPA — Backend Architecture

> **Product Name:** VIPA
> **Repo:** `vipa-backend` (Go monorepo)
> **Binaries:** `cmd/bot` (Discord bot) + `cmd/api` (standalone REST API)

---

## Directory Structure

```
vipa-backend/
├── cmd/
│   ├── api/main.go          # Standalone API server entry point
│   └── bot/main.go          # Discord bot entry point
├── bot/                     # Discord bot handlers (package bot)
│   └── apiext/              # API extension handlers (package apiext)
├── internal/
│   ├── api/                 # REST API handlers + routing
│   │   └── websocket/       # WebSocket hub/client
│   ├── config/              # Environment config
│   ├── db/                  # Database layer (all CRUD)
│   ├── email/               # Resend email client
│   ├── tlsclient/           # TLS HTTP client
│   └── wavv/                # WAVV API client + sync
├── ghl/                     # GoHighLevel CRM client
├── scrapers/                # License verification scrapers
│   └── captcha/             # Captcha solving
├── Dockerfile.api
├── Dockerfile.bot
└── railway.toml
```

---

## Bot File Map (`bot/`)

All 126 files use `package bot` with methods on `*Bot`. Grouped by domain:

### Core & Routing (6 files)
| File | Purpose |
|------|---------|
| `bot_core.go` | `Bot` struct, `ModalTempData`, initialization |
| `bot_run.go` | Bot startup and event registration |
| `bot_interactions.go` | Main interaction router (commands → components → modals) |
| `bot_commands.go` | Slash command dispatcher (20+ commands) |
| `bot_components.go` | Button/select menu dispatcher (11+ patterns) |
| `bot_modals.go` | Modal submission dispatcher |
| `bot_messages.go` | Message handler (auto-delete in #start-here) |
| `bot_utilities.go` | Shared helpers: `parseDiscordID()`, `publishEvent()`, `cleanupModalState()` |

### Intake / Onboarding Flow (15 files)
The new agent intake pipeline — Step 1 → Step 2 → Approval → Role Assignment.

| File | Purpose |
|------|---------|
| `intake_get_started.go` | Initial onboarding trigger |
| `intake_step1.go` | Step 1 modal (name, agency, license) |
| `intake_step1_responses.go` | Step 1 response handling |
| `intake_step2.go` | Step 2 form initiation |
| `intake_step2_response.go` | Step 2 response processing |
| `intake_step2_submit.go` | Step 2 submission handler |
| `intake_step2_async.go` | **KEY JUNCTION** — triggers roles, approval, GHL sync |
| `intake_step2_save.go` | Database persistence |
| `intake_step2b.go` | Extended info collection |
| `intake_step2b_submit.go` | Extended info submission |
| `intake_upline.go` | Upline/manager resolution |
| `intake_course_enrollment.go` | Course enrollment prompt |
| `intake_hiring_log.go` | Post hiring log to channel |
| `intake_normalize.go` | Agency/license normalization |
| `intake_sort.go` | Agency sorting logic |
| `intake_utils.go` | `getModalValue()`, `normalizeAgency()`, helpers |
| `intake_restart.go` | Restart intake flow |

### Verification (10 files)
License verification via state scrapers.

| File | Purpose |
|------|---------|
| `verify_handler.go` | `/verify` command entry point |
| `verify_lookup.go` | Calls scraper registry for license lookup |
| `verify_perform.go` | Core `performVerification()` — reused by scheduler + auto-verify |
| `verify_result.go` | Process verification results |
| `verify_roles.go` | `sortAndAssignRoles()` — reused by intake, approval, scheduler |
| `verify_dm.go` | DM notification to agent |
| `verify_channel.go` | Channel notification |
| `verify_fields.go` | Field extraction helpers |
| `verify_utils.go` | `cleanPhoneNumber()`, `nvl()` |
| `verify_followup.go` | Follow-up messaging |

### Auto-Verification (7 files)
Automatic verification on member join/role changes.

| File | Purpose |
|------|---------|
| `auto_verify_member_update.go` | Triggered on Discord member update |
| `auto_verify_licensed.go` | Auto-verify for licensed agents |
| `auto_verify_student.go` | Auto-verify for students |
| `auto_verify_dm.go` | DM prompting |
| `auto_verify_channel.go` | Channel-based prompts |
| `auto_verify_fail.go` | Failure handling |
| `auto_verify_utils.go` | Shared helpers |

### Approval (6 files)
Agency owner approval for new agents.

| File | Purpose |
|------|---------|
| `approval_trigger.go` | Initiates approval (called from intake) |
| `approval_button.go` | Approval button display |
| `approval_button_handlers.go` | Approve/deny button logic |
| `approval_channel.go` | Channel-based approval messages |
| `approval_dm.go` | DM to agency owner |
| `approval_deny.go` | Denial flow |

### Activation / Setup (5 files)
Final activation when agent completes setup checklist.

| File | Purpose |
|------|---------|
| `activation_activate.go` | Core `activateAgent()` function |
| `activation_setup.go` | `/setup` command — checklist display |
| `activation_setup_item.go` | Individual setup item handler |
| `activation_buttons.go` | Setup checklist buttons |
| `activation_contract.go` | Contract signing flow |

### Admin Commands (10 files)
Staff/admin operations.

| File | Purpose |
|------|---------|
| `admin_agent_info.go` | Agent detail lookup |
| `admin_agent_kick.go` | Remove agent from server |
| `admin_agent_list.go` | List agents by criteria |
| `admin_agent_nudge.go` | Send reminder DMs |
| `admin_agent_promote.go` | Promote to Licensed/Active |
| `admin_agent_stats.go` | Agent statistics |
| `admin_assign_manager.go` | Set upline manager |
| `admin_contracting.go` | Contracting management |
| `admin_contracting_list.go` | List contracting status |
| `admin_onboarding_setup.go` | Configure onboarding |
| `admin_rules_setup.go` | Configure rules |

### Scheduler (10 files)
Background jobs running on timers.

| File | Purpose |
|------|---------|
| `scheduler_main.go` | Entry point — daily cycle orchestrator |
| `scheduler_verify.go` | Auto-verify retry logic |
| `scheduler_deadlines.go` | Deadline management |
| `scheduler_reminders.go` | Send reminders |
| `scheduler_nudge.go` | Agent nudges |
| `scheduler_pending.go` | Pending status handling |
| `scheduler_tracker.go` | Auto-post daily tracker |
| `scheduler_channel_post.go` | Channel posting utilities |
| `scheduler_unlicensed.go` | Unlicensed agent handling |
| `scheduler_unlicensed_kick.go` | 60-day unlicensed kick |

### Tickets (7 files)
Support ticket system.

| File | Purpose |
|------|---------|
| `ticket_open.go` | Open ticket modal |
| `ticket_submit.go` | Submit ticket form |
| `ticket_submit_post.go` | Post to support channel |
| `ticket_close.go` | Close ticket |
| `ticket_setup.go` | Admin ticket setup |
| `ticket_setup_wavv.go` | WAVV-specific ticket setup |
| `ticket_utils.go` | Ticket helpers |

### Check-ins (4 files)
Weekly check-in system.

| File | Purpose |
|------|---------|
| `checkins_weekly.go` | Send weekly check-ins |
| `checkins_response.go` | Handle responses |
| `checkins_alert.go` | Alert on missed check-ins |
| `checkins_inactivity.go` | Inactivity detection |

### Embeds / UI (9 files)
Discord embed builders — pure presentation, no business logic.

| File | Purpose |
|------|---------|
| `embeds_activation.go` | Activation complete embed |
| `embeds_checkin.go` | Check-in message embed |
| `embeds_greetings.go` | Greeting card embed |
| `embeds_hiring.go` | Hiring log embed |
| `embeds_profile.go` | Agent profile embed |
| `embeds_rules.go` | Rules display embed |
| `embeds_setup.go` | Setup checklist embed |
| `embeds_utils.go` | Embed helpers |
| `embeds_welcome.go` | Welcome message embed |

### GHL CRM Integration (2 files)
GoHighLevel pipeline sync.

| File | Purpose |
|------|---------|
| `ghl_sync.go` | `syncAgentToGHL()` — sync agent to CRM |
| `ghl_stage.go` | `syncGHLStage()`, `markGHLLost()` — pipeline stage management |

### Tracker (4 files)
Recruitment tracker.

| File | Purpose |
|------|---------|
| `tracker_command.go` | `/tracker` command handler |
| `tracker_overview.go` | Overview stats |
| `tracker_agency.go` | Agency breakdown |
| `tracker_recruiter.go` | Recruiter stats |

### Leaderboard (2 files)
| File | Purpose |
|------|---------|
| `leaderboard.go` | Leaderboard command handler |
| `leaderboard_embed.go` | Leaderboard embed builder |

### NPN Search (4 files)
National Producer Number lookup.

| File | Purpose |
|------|---------|
| `npn_handler.go` | Entry point |
| `npn_search.go` | Single NPN search |
| `npn_search_multi.go` | Multi-state search |
| `npn_results.go` | Results display |

### WAVV (2 files)
| File | Purpose |
|------|---------|
| `wavv_log.go` | Manual WAVV session logging |
| `wavv_stats.go` | WAVV stats command |

### Zoom (5 files)
| File | Purpose |
|------|---------|
| `zoom_command.go` | `/zoom` command handler |
| `zoom_create_delete.go` | Create/delete zoom rooms |
| `zoom_join_leave.go` | Join/leave tracking |
| `zoom_list.go` | List zoom rooms |
| `zoom_role_audit.go` | Zoom role audit |

### Other (7 files)
| File | Purpose |
|------|---------|
| `commands_activity.go` | `/activity` command registration |
| `commands_admin.go` | Admin command registration |
| `commands_misc.go` | Misc commands |
| `commands_onboarding.go` | Onboarding command registration |
| `commands_register.go` | Main command registration |
| `commands_staff.go` | Staff command registration |
| `commands_tickets.go` | Ticket command registration |
| `commands_verify.go` | Verify command registration |
| `commands_wavv.go` | WAVV command registration |
| `commands_zoom.go` | Zoom command registration |
| `email_prefs.go` | Email opt-in/out |
| `history.go` | License history lookup |
| `onboarding.go` | Onboarding state management |
| `onboarding_welcome.go` | Welcome flow |
| `role_audit_helpers.go` | Role audit utilities |
| `role_helpers.go` | Role assignment helpers |
| `activity_log.go` | Activity logging |
| `activity_log_response.go` | Activity log display |

### API Extensions (`bot/apiext/` — package apiext)
| File | Purpose |
|------|---------|
| `apiext/discord.go` | Discord-specific API endpoints served by bot |
| `apiext/verify.go` | Verification API endpoint served by bot |

---

## API Layer (`internal/api/`)

### 145 Routes — Handler File Map

| File | Domain | Routes |
|------|--------|--------|
| `server.go` | Routing + server lifecycle | — |
| `middleware.go` | Auth + CORS middleware | — |
| `auth.go` | Login/register/refresh | 4 |
| `auth_jwt.go` | JWT token utilities | — |
| `agents.go` | Agent CRUD | 2 |
| `actions.go` | Kick/nudge/role/message (pending_actions queue) | 6 |
| `dashboard.go` | Funnel/summary/at-risk | 3 |
| `dashboard_extra.go` | Stats/revenue/leaderboard/pipeline | 4 |
| `tracker.go` | Overview/agencies/recruiters | 3 |
| `leaderboard.go` | Weekly/monthly | 2 |
| `approval.go` | Approval CRUD | 2 |
| `portal.go` | Profile/leads/training/schedule/org-chart/comp-tiers | 20 |
| `sidebar.go` | Composite sidebar data | 1 |
| `recruits_handler.go` | Recruit CRUD + pipeline | 10 |
| `sales_handler.go` | Sales CRUD + stats | 6 |
| `licenses_handler.go` | License CRUD | 5 |
| `notifications_handler.go` | Notifications + unread count | 4 |
| `appointments_handler.go` | Appointment CRUD | 5 |
| `sms_handler.go` | SMS send/campaign/history | 3 |
| `servers_handler.go` | Server management | 4 |
| `analytics_handler.go` | Conversion/sources/trends | 5 |
| `activity_handler.go` | Activity feed | 2 |
| `stages_handler.go` | Stage list | 1 |
| `notification_prefs_handler.go` | Notification preferences | 2 |
| `audit_handler.go` | Audit log | 2 |
| `campaigns_handler.go` | Campaign CRUD | 4 |
| `documents_handler.go` | Document vault CRUD | 4 |
| `reports.go` | Production/agent reports | 2 |
| `roles.go` | RBAC role management | 4 |
| `users.go` | User management | 3 |
| `wavv.go` | WAVV overview/teams/leaderboard | 3 |
| `wavv_agent.go` | WAVV per-agent stats | 3 |
| `wavv_goals.go` | WAVV goal get/set | 3 |
| `wavv_helpers.go` | WAVV shared utilities | — |
| `wavv_sync.go` | WAVV sync token/force/status | 6 |
| `whatsapp_handler.go` | WhatsApp sessions/conversations/messages | 5 |
| `websocket/hub.go` | WebSocket hub | — |
| `websocket/client.go` | WebSocket client | — |
| `websocket/events.go` | Event types + constructors | — |

---

## Database Layer (`internal/db/`)

| File | Tables | Methods |
|------|--------|---------|
| `db.go` | Schema migrations (17 phases) | `New()`, `Pool()` |
| `setup.go` | Guild/config setup | Config CRUD |
| `agents.go` | `onboarding_agents` | UpsertAgent, GetAgent, ListAgents, LogActivity |
| `approval.go` | `approvals` | Create, Get, List, Approve, Deny |
| `audit.go` | `audit_log` | Create, List |
| `campaigns.go` | `campaigns` | CRUD |
| `checkins.go` | `checkins` | Create, List, GetPending |
| `contracting.go` | `contracting` | CRUD |
| `documents.go` | `documents` | CRUD |
| `leaderboard.go` | — (aggregation queries) | Weekly, Monthly |
| `licenses_crud.go` | `licenses` | CRUD |
| `notifications.go` | `notifications` | Create, List, MarkRead |
| `organizations.go` | `organizations` | CRUD |
| `pending_actions.go` | `pending_actions` | Create, Get, Complete |
| `portal.go` | Profile/leads/training/schedule/org-chart | 20+ methods |
| `recruits.go` | `recruits` | CRUD + Stats |
| `refresh_tokens.go` | `refresh_tokens` | Create, Validate, Revoke |
| `roles.go` | `roles`, `user_roles` | CRUD + assignment |
| `sales.go` | `sales` | CRUD + AgentStats |
| `servers.go` | `servers` | CRUD |
| `sidebar.go` | — (composite queries) | GetSidebarData |
| `sms.go` | `sms_messages` | Create, List |
| `tracker.go` | — (aggregation) | Overview, Agencies, Recruiters |
| `users.go` | `users` | CRUD + auth |
| `wavv.go` | `wavv_sessions` | Create, List, Stats |
| `wavv_goals.go` | `wavv_goals` | Get, Set |
| `wavv_leaderboard.go` | — (aggregation) | Team rankings |
| `wavv_sync.go` | `wavv_sync_*` | Token, Sync, Members |
| `whatsapp.go` | `whatsapp_*` | Sessions, Conversations, Messages |
| `zoom.go` | `zoom_rooms` | CRUD |

---

## External Integrations

| Package | Purpose | Files |
|---------|---------|-------|
| `ghl/` | GoHighLevel CRM | `client.go`, `contacts.go`, `pipeline.go` |
| `scrapers/` | State license verification | CA, FL, TX, NAIC + `registry.go` |
| `scrapers/captcha/` | Captcha solving | `capsolver.go` |
| `internal/email/` | Transactional email | `resend.go` |
| `internal/tlsclient/` | TLS HTTP client | `client.go` |
| `internal/wavv/` | WAVV dialer API | `client.go`, `sync.go` |

---

## Key Cross-Cutting Functions

These functions are called from 5+ different files — touch them carefully:

| Function | Defined In | Called From |
|----------|-----------|-------------|
| `parseDiscordID()` | `bot_utilities.go` | 20+ files |
| `publishEvent()` | `bot_utilities.go` | 15+ files |
| `performVerification()` | `verify_perform.go` | verify, scheduler, auto_verify |
| `sortAndAssignRoles()` | `verify_roles.go` | intake, approval, scheduler |
| `syncGHLStage()` | `ghl_stage.go` | activation, scheduler, auto_verify, admin |
| `syncAgentToGHL()` | `ghl_sync.go` | intake |
| `activateAgent()` | `activation_activate.go` | activation, admin |
| `dmUser()` | `bot_utilities.go` | 13+ files |
| `triggerApprovalFlow()` | `approval_trigger.go` | intake |
