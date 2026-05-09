package api

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"time"

	gorillaws "github.com/gorilla/websocket"

	"phantomcrm-api/internal/api/websocket"
	"phantomcrm-api/internal/channels"
	"phantomcrm-api/internal/config"
	"phantomcrm-api/internal/db"
	"phantomcrm-api/internal/repo"
	"phantomcrm-api/internal/sms"
)

// WebSocket upgrader
var upgrader = gorillaws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Server is the standalone REST API server.
type Server struct {
	cfg       *config.Config
	db        *db.DB
	hub       *websocket.Hub
	smsClient *sms.Client
	mux       *http.ServeMux
	srv       *http.Server

	// CRM M1 repos. Constructed once in NewServer and shared across requests.
	contactRepo   *repo.ContactRepo
	tagRepo       *repo.TagRepo
	smartListRepo *repo.SmartListRepo

	// CRM M2A: outbound channel registry. Senders register at startup,
	// handlers route by (channel, provider) at request time.
	channelRegistry *channels.Registry
}

// NewServer creates a new API server (no Discord session needed).
func NewServer(cfg *config.Config, database *db.DB, hub *websocket.Hub) *Server {
	s := &Server{cfg: cfg, db: database, hub: hub}
	s.contactRepo = repo.NewContactRepo(database.Pool())
	s.tagRepo = repo.NewTagRepo(database.Pool())
	s.smartListRepo = repo.NewSmartListRepo(database.Pool())
	s.smsClient = sms.NewClient(cfg.TwilioAccountSID, cfg.TwilioAuthToken, cfg.TwilioFromNumber)
	if s.smsClient != nil {
		log.Println("Twilio SMS client initialized")
		if cfg.TwilioWhatsAppNumber != "" {
			s.smsClient.SetWhatsAppNumber(cfg.TwilioWhatsAppNumber)
			log.Println("Twilio WhatsApp number configured")
		}
	}

	// Channel registry: register Twilio senders when configured. Stub
	// senders (Meta WA, Voice) are always registered so the registry can
	// surface ErrUnsupported with a known provider name.
	s.channelRegistry = channels.NewRegistry()
	if s.smsClient != nil {
		s.channelRegistry.Register(channels.NewTwilioSMSSender(s.smsClient))
		s.channelRegistry.Register(channels.NewTwilioWhatsAppSender(s.smsClient))
		log.Println("Channel senders registered: twilio sms, twilio whatsapp")
	}
	s.channelRegistry.Register(channels.NewMetaWhatsAppSender())
	s.channelRegistry.Register(channels.NewVoiceStubSender("twilio"))

	mux := http.NewServeMux()
	s.mux = mux

	// Health check (unauthenticated)
	mux.HandleFunc("GET /api/v1/health", s.handleHealth)

	// Twilio webhooks (unauthenticated — Twilio calls these directly)
	mux.HandleFunc("POST /api/v1/sms/webhook", s.handleTwilioWebhook)
	mux.HandleFunc("POST /api/v1/sms/status", s.handleTwilioStatusCallback)

	// WhatsApp Twilio webhooks (unauthenticated — Twilio calls these directly)
	mux.HandleFunc("POST /api/v1/whatsapp/webhook", s.handleWhatsAppWebhook)
	mux.HandleFunc("POST /api/v1/whatsapp/status-wa", s.handleWhatsAppStatusCallback)

	// Inbound recruit from website (service-to-service auth in handler)
	mux.HandleFunc("POST /api/v1/recruits/inbound", s.handleInboundRecruit)

	// Public recruit application (no auth — website form)
	mux.HandleFunc("POST /api/v1/recruits/apply", s.handlePublicApply)

	// Auth routes (unauthenticated)
	mux.HandleFunc("POST /api/v1/auth/discord", s.handleDiscordAuth)
	mux.HandleFunc("POST /api/v1/auth/google", s.handleGoogleAuth)
	mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/v1/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/v1/auth/refresh", s.handleRefresh)
	mux.HandleFunc("POST /api/v1/auth/logout", s.handleLogout)

	// Google OAuth callback (unauthenticated — Google redirects here without a JWT)
	mux.HandleFunc("GET /api/v1/integrations/google/callback", s.handleGoogleCallback)

	// WebSocket endpoint (token via query param)
	mux.HandleFunc("GET /api/v1/ws", s.handleWebSocket)

	// Authenticated routes
	auth := s.authMiddleware

	// Auth: current user (authenticated)
	mux.HandleFunc("GET /api/v1/auth/me", auth(s.handleMe))
	mux.HandleFunc("PATCH /api/v1/auth/me", auth(s.handleUpdateMe))

	// Agent endpoints (read + delete-all)
	mux.HandleFunc("GET /api/v1/agents", auth(s.handleListAgents))
	mux.HandleFunc("DELETE /api/v1/agents", auth(s.handleDeleteAllAgents))
	mux.HandleFunc("GET /api/v1/agents/{discordID}", auth(s.handleGetAgent))

	// Dashboard endpoints (read)
	mux.HandleFunc("GET /api/v1/dashboard/funnel", auth(s.handleFunnel))
	mux.HandleFunc("GET /api/v1/dashboard/summary", auth(s.handleSummary))
	mux.HandleFunc("GET /api/v1/dashboard/at-risk", auth(s.handleAtRisk))

	// Tracker endpoints (read)
	mux.HandleFunc("GET /api/v1/tracker/overview", auth(s.handleTrackerOverview))
	mux.HandleFunc("GET /api/v1/tracker/agencies", auth(s.handleTrackerAgencies))
	mux.HandleFunc("GET /api/v1/tracker/recruiters", auth(s.handleTrackerRecruiters))

	// Leaderboard endpoints (read)
	mux.HandleFunc("GET /api/v1/leaderboard/weekly", auth(s.handleWeeklyLeaderboard))
	mux.HandleFunc("GET /api/v1/leaderboard/monthly", auth(s.handleMonthlyLeaderboard))

	// Approval endpoints (read + write)
	mux.HandleFunc("GET /api/v1/approvals/{id}", auth(s.handleGetApproval))
	mux.HandleFunc("PUT /api/v1/approvals/{id}", auth(s.handleApprovalAction))

	// Admin action endpoints (queued via pending_actions)
	mux.HandleFunc("POST /api/v1/agents/{discordID}/kick", auth(s.handleKickAgent))
	mux.HandleFunc("POST /api/v1/agents/{discordID}/nudge", auth(s.handleNudgeAgent))
	mux.HandleFunc("POST /api/v1/agents/{discordID}/role", auth(s.handleRoleAgent))
	mux.HandleFunc("POST /api/v1/agents/{discordID}/message", auth(s.handleMessageAgent))
	mux.HandleFunc("POST /api/v1/agents/{discordID}/stage", auth(s.handleStageAgent))

	// Portal: Profile
	mux.HandleFunc("GET /api/v1/portal/profile/{discordID}", auth(s.handleGetProfile))
	mux.HandleFunc("PUT /api/v1/portal/profile/{discordID}", auth(s.handleUpdateProfile))
	mux.HandleFunc("PUT /api/v1/portal/profile/{discordID}/manager", auth(s.handleSetManager))
	mux.HandleFunc("PUT /api/v1/portal/profile/{discordID}/comp-tier", auth(s.handleSetCompTier))

	// Portal: Leads
	mux.HandleFunc("GET /api/v1/portal/agents/{discordID}/leads", auth(s.handleListAgentLeads))
	mux.HandleFunc("POST /api/v1/portal/agents/{discordID}/leads", auth(s.handleCreateAgentLead))
	mux.HandleFunc("PUT /api/v1/portal/agents/{discordID}/leads/{leadID}", auth(s.handleUpdateAgentLead))
	mux.HandleFunc("DELETE /api/v1/portal/agents/{discordID}/leads/{leadID}", auth(s.handleDeleteAgentLead))

	// Portal: Training
	mux.HandleFunc("GET /api/v1/portal/agents/{discordID}/training", auth(s.handleListTrainingItems))
	mux.HandleFunc("POST /api/v1/portal/agents/{discordID}/training", auth(s.handleCreateTrainingItem))
	mux.HandleFunc("PUT /api/v1/portal/agents/{discordID}/training/{itemID}", auth(s.handleUpdateTrainingItem))
	mux.HandleFunc("DELETE /api/v1/portal/agents/{discordID}/training/{itemID}", auth(s.handleDeleteTrainingItem))

	// Portal: Schedule
	mux.HandleFunc("GET /api/v1/portal/agents/{discordID}/schedule", auth(s.handleListScheduleEvents))
	mux.HandleFunc("POST /api/v1/portal/agents/{discordID}/schedule", auth(s.handleCreateScheduleEvent))
	mux.HandleFunc("PUT /api/v1/portal/agents/{discordID}/schedule/{eventID}", auth(s.handleUpdateScheduleEvent))
	mux.HandleFunc("DELETE /api/v1/portal/agents/{discordID}/schedule/{eventID}", auth(s.handleDeleteScheduleEvent))

	// Portal: Org Chart
	mux.HandleFunc("GET /api/v1/portal/org-chart", auth(s.handleGetOrgChart))
	mux.HandleFunc("GET /api/v1/portal/org-chart/my-team", auth(s.handleGetMyTeam))
	mux.HandleFunc("PUT /api/v1/portal/org-chart/assign-manager", auth(s.handleAssignManager))
	mux.HandleFunc("PUT /api/v1/portal/org-chart/positions", auth(s.handleSavePositions))
	mux.HandleFunc("DELETE /api/v1/portal/org-chart/positions", auth(s.handleResetPositions))

	// Portal: Comp Tiers
	mux.HandleFunc("GET /api/v1/portal/comp-tiers", auth(s.handleListCompTiers))
	mux.HandleFunc("POST /api/v1/portal/comp-tiers", auth(s.handleCreateCompTier))
	mux.HandleFunc("PUT /api/v1/portal/comp-tiers/{tierID}", auth(s.handleUpdateCompTier))
	mux.HandleFunc("DELETE /api/v1/portal/comp-tiers/{tierID}", auth(s.handleDeleteCompTier))
	mux.HandleFunc("PUT /api/v1/portal/comp-tiers/reorder", auth(s.handleReorderCompTiers))

	// WAVV Production Tracker
	mux.HandleFunc("GET /api/v1/wavv/overview", auth(s.handleWavvOverview))
	mux.HandleFunc("GET /api/v1/wavv/teams", auth(s.handleWavvTeams))
	mux.HandleFunc("GET /api/v1/wavv/leaderboard", auth(s.handleWavvLeaderboard))
	mux.HandleFunc("GET /api/v1/wavv/agents/{discordID}/stats", auth(s.handleWavvAgentStats))
	mux.HandleFunc("GET /api/v1/wavv/agents/{discordID}/sessions", auth(s.handleWavvAgentSessions))
	mux.HandleFunc("GET /api/v1/wavv/agents/{discordID}/daily", auth(s.handleWavvAgentDaily))
	mux.HandleFunc("GET /api/v1/wavv/agents/{discordID}/goal", auth(s.handleWavvGetGoal))
	mux.HandleFunc("PUT /api/v1/wavv/agents/{discordID}/goal", auth(s.handleWavvSetGoal))
	mux.HandleFunc("POST /api/v1/wavv/agents/{discordID}/sessions", auth(s.handleWavvLogSession))

	// WAVV Sync (auto-sync from WAVV API)
	mux.HandleFunc("POST /api/v1/wavv/sync/token", auth(s.handleWavvSyncSetToken))
	mux.HandleFunc("POST /api/v1/wavv/sync/force", auth(s.handleWavvSyncForce))
	mux.HandleFunc("GET /api/v1/wavv/sync/status", auth(s.handleWavvSyncStatus))
	mux.HandleFunc("GET /api/v1/wavv/sync/leaderboard", auth(s.handleWavvSyncLeaderboard))
	mux.HandleFunc("GET /api/v1/wavv/sync/members", auth(s.handleWavvSyncMembers))
	mux.HandleFunc("POST /api/v1/wavv/sync/members/link", auth(s.handleWavvSyncLinkMember))

	// Internal endpoints (bot consumes pending actions)
	mux.HandleFunc("GET /api/v1/internal/pending-actions", auth(s.handleGetPendingActions))
	mux.HandleFunc("POST /api/v1/internal/actions/{id}/complete", auth(s.handleCompleteAction))

	// Role management
	mux.HandleFunc("GET /api/v1/roles", auth(s.handleListRoles))
	mux.HandleFunc("POST /api/v1/roles", auth(s.handleCreateRole))
	mux.HandleFunc("PUT /api/v1/roles/{roleID}", auth(s.handleUpdateRole))
	mux.HandleFunc("DELETE /api/v1/roles/{roleID}", auth(s.handleDeleteRole))

	// User management
	mux.HandleFunc("GET /api/v1/users", auth(s.handleListUsers))
	mux.HandleFunc("GET /api/v1/users/{userID}", auth(s.handleGetUser))
	mux.HandleFunc("PUT /api/v1/users/{userID}", auth(s.handleUpdateUser))

	// Agent sidebar (composite endpoint)
	mux.HandleFunc("GET /api/v1/agents/{discordID}/sidebar", auth(s.handleAgentSidebar))

	// Document management
	mux.HandleFunc("GET /api/v1/documents", auth(s.handleListDocuments))
	mux.HandleFunc("POST /api/v1/documents", auth(s.handleCreateDocument))
	mux.HandleFunc("GET /api/v1/documents/{documentID}", auth(s.handleGetDocument))
	mux.HandleFunc("DELETE /api/v1/documents/{documentID}", auth(s.handleDeleteDocument))

	// Campaign management
	mux.HandleFunc("GET /api/v1/campaigns", auth(s.handleListCampaigns))
	mux.HandleFunc("POST /api/v1/campaigns", auth(s.handleCreateCampaign))
	mux.HandleFunc("GET /api/v1/campaigns/{campaignID}", auth(s.handleGetCampaign))
	mux.HandleFunc("PUT /api/v1/campaigns/{campaignID}/status", auth(s.handleUpdateCampaignStatus))
	mux.HandleFunc("DELETE /api/v1/campaigns/{campaignID}", auth(s.handleDeleteCampaign))

	// Audit log
	mux.HandleFunc("GET /api/v1/audit", auth(s.handleListAuditEntries))

	// WhatsApp
	mux.HandleFunc("GET /api/v1/whatsapp/sessions", auth(s.handleListWhatsAppSessions))
	mux.HandleFunc("POST /api/v1/whatsapp/sessions", auth(s.handleUpsertWhatsAppSession))
	mux.HandleFunc("GET /api/v1/whatsapp/sessions/{sessionID}/conversations", auth(s.handleListWhatsAppConversations))
	mux.HandleFunc("POST /api/v1/whatsapp/messages", auth(s.handleCreateWhatsAppMessage))
	mux.HandleFunc("GET /api/v1/whatsapp/conversations/{conversationID}/messages", auth(s.handleListWhatsAppMessages))
	mux.HandleFunc("GET /api/v1/whatsapp/conversations", auth(s.handleListAllWhatsAppConversations))
	mux.HandleFunc("PUT /api/v1/whatsapp/conversations/{conversationID}/link", auth(s.handleLinkConversationToRecruit))

	// Drip Campaigns
	mux.HandleFunc("GET /api/v1/drip-campaigns", auth(s.handleListDripCampaigns))
	mux.HandleFunc("POST /api/v1/drip-campaigns", auth(s.handleCreateDripCampaign))
	mux.HandleFunc("GET /api/v1/drip-campaigns/{id}", auth(s.handleGetDripCampaign))
	mux.HandleFunc("PUT /api/v1/drip-campaigns/{id}", auth(s.handleUpdateDripCampaign))
	mux.HandleFunc("DELETE /api/v1/drip-campaigns/{id}", auth(s.handleDeleteDripCampaign))
	mux.HandleFunc("GET /api/v1/drip-campaigns/{id}/steps", auth(s.handleListDripSteps))
	mux.HandleFunc("POST /api/v1/drip-campaigns/{id}/steps", auth(s.handleCreateDripStep))
	mux.HandleFunc("PUT /api/v1/drip-campaigns/{id}/steps/{stepID}", auth(s.handleUpdateDripStep))
	mux.HandleFunc("DELETE /api/v1/drip-campaigns/{id}/steps/{stepID}", auth(s.handleDeleteDripStep))
	mux.HandleFunc("GET /api/v1/drip-campaigns/{id}/executions", auth(s.handleListDripExecutions))

	// AI Import
	mux.HandleFunc("POST /api/v1/recruits/ai-import/parse", auth(s.handleAIImportParse))
	mux.HandleFunc("POST /api/v1/recruits/ai-import/confirm", auth(s.handleAIImportConfirm))

	// Reports
	mux.HandleFunc("GET /api/v1/reports/agents", auth(s.handleAgentReport))
	mux.HandleFunc("GET /api/v1/reports/production", auth(s.handleProductionReport))

	// Recruits
	mux.HandleFunc("GET /api/v1/recruits", auth(s.handleListRecruits))
	mux.HandleFunc("POST /api/v1/recruits", auth(s.handleCreateRecruit))
	mux.HandleFunc("GET /api/v1/recruits/stats", auth(s.handleRecruitStats))
	mux.HandleFunc("POST /api/v1/recruits/bulk-import", auth(s.handleBulkImportRecruits))
	mux.HandleFunc("GET /api/v1/recruits/{recruitID}", auth(s.handleGetRecruit))
	mux.HandleFunc("PUT /api/v1/recruits/{recruitID}", auth(s.handleUpdateRecruit))
	mux.HandleFunc("DELETE /api/v1/recruits/{recruitID}", auth(s.handleDeleteRecruit))
	mux.HandleFunc("POST /api/v1/recruits/{recruitID}/sms", auth(s.handleRecruitSms))
	mux.HandleFunc("POST /api/v1/recruits/{recruitID}/schedule", auth(s.handleScheduleRecruitInterview))
	mux.HandleFunc("POST /api/v1/recruits/{recruitID}/onboard", auth(s.handleOnboardRecruit))
	mux.HandleFunc("GET /api/v1/recruits/{recruitID}/messages", auth(s.handleRecruitMessages))

	// Sales
	mux.HandleFunc("GET /api/v1/portal/sales", auth(s.handleListSales))
	mux.HandleFunc("POST /api/v1/portal/sales", auth(s.handleCreateSale))
	mux.HandleFunc("GET /api/v1/portal/sales/agent/{discordID}", auth(s.handleGetAgentSales))
	mux.HandleFunc("GET /api/v1/portal/sales/agent/{discordID}/stats", auth(s.handleGetAgentSaleStats))
	mux.HandleFunc("PUT /api/v1/portal/sales/{saleID}", auth(s.handleUpdateSale))
	mux.HandleFunc("DELETE /api/v1/portal/sales/{saleID}", auth(s.handleDeleteSale))
	mux.HandleFunc("POST /api/v1/portal/sales/parse-transcript", auth(s.handleParseTranscript))

	// Licenses
	mux.HandleFunc("GET /api/v1/licenses", auth(s.handleListLicenses))
	mux.HandleFunc("POST /api/v1/licenses", auth(s.handleCreateLicense))
	mux.HandleFunc("GET /api/v1/licenses/{licenseID}", auth(s.handleGetLicense))
	mux.HandleFunc("PUT /api/v1/licenses/{licenseID}", auth(s.handleUpdateLicense))
	mux.HandleFunc("DELETE /api/v1/licenses/{licenseID}", auth(s.handleDeleteLicense))

	// Notifications
	mux.HandleFunc("GET /api/v1/notifications", auth(s.handleListNotifications))
	mux.HandleFunc("GET /api/v1/notifications/unread-count", auth(s.handleUnreadNotificationCount))
	mux.HandleFunc("POST /api/v1/notifications/{notificationID}/read", auth(s.handleMarkNotificationRead))
	mux.HandleFunc("POST /api/v1/notifications/read-all", auth(s.handleMarkAllNotificationsRead))

	// Appointments
	mux.HandleFunc("GET /api/v1/appointments", auth(s.handleListAppointments))
	mux.HandleFunc("GET /api/v1/appointments/upcoming", auth(s.handleListUpcomingAppointments))
	mux.HandleFunc("POST /api/v1/appointments", auth(s.handleCreateAppointment))
	mux.HandleFunc("PUT /api/v1/appointments/{appointmentID}/status", auth(s.handleUpdateAppointmentStatus))
	mux.HandleFunc("DELETE /api/v1/appointments/{appointmentID}", auth(s.handleDeleteAppointment))

	// SMS
	mux.HandleFunc("POST /api/v1/sms/send", auth(s.handleSendSms))
	mux.HandleFunc("POST /api/v1/sms/campaign", auth(s.handleSmsCampaign))
	mux.HandleFunc("GET /api/v1/sms/history", auth(s.handleSmsHistory))

	// Servers
	mux.HandleFunc("GET /api/v1/servers/bot-invite", auth(s.handleBotInviteLink))
	mux.HandleFunc("GET /api/v1/servers", auth(s.handleListServers))
	mux.HandleFunc("POST /api/v1/servers", auth(s.handleCreateServer))
	mux.HandleFunc("DELETE /api/v1/servers/{serverID}", auth(s.handleDeleteServer))


	// Analytics
	mux.HandleFunc("GET /api/v1/analytics/conversion", auth(s.handleConversionAnalytics))
	mux.HandleFunc("GET /api/v1/analytics/sources", auth(s.handleSourceAnalytics))
	mux.HandleFunc("GET /api/v1/analytics/trends", auth(s.handleTrendsAnalytics))
	mux.HandleFunc("GET /api/v1/analytics/stage-duration", auth(s.handleStageDurationAnalytics))
	mux.HandleFunc("GET /api/v1/analytics/export/csv", auth(s.handleExportCsv))

	// Dashboard Enhanced
	mux.HandleFunc("GET /api/v1/dashboard/stats", auth(s.handleDashboardStats))
	mux.HandleFunc("GET /api/v1/dashboard/revenue-chart", auth(s.handleRevenueChart))
	mux.HandleFunc("GET /api/v1/dashboard/leaderboard", auth(s.handleDashboardLeaderboard))
	mux.HandleFunc("GET /api/v1/dashboard/pipeline-value", auth(s.handlePipelineValue))

	// Activity Log
	mux.HandleFunc("GET /api/v1/activity", auth(s.handleActivityLog))
	mux.HandleFunc("POST /api/v1/activity/announce", auth(s.handleAnnouncement))

	// Stages
	mux.HandleFunc("GET /api/v1/stages", auth(s.handleStages))

	// Notification Preferences
	mux.HandleFunc("GET /api/v1/notifications/preferences", auth(s.handleGetNotificationPrefs))
	mux.HandleFunc("PUT /api/v1/notifications/preferences", auth(s.handleUpdateNotificationPrefs))

	// Bug Reports
	mux.HandleFunc("POST /api/v1/bug-reports", auth(s.handleCreateBugReport))
	mux.HandleFunc("GET /api/v1/bug-reports", auth(s.handleListBugReports))

	// Stage Configs (Pipeline Settings)
	mux.HandleFunc("GET /api/v1/recruits/stage-configs", auth(s.handleListStageConfigs))
	mux.HandleFunc("PUT /api/v1/recruits/stage-configs/{stage}", auth(s.handleUpdateStageConfig))

	// Expenses
	mux.HandleFunc("GET /api/v1/portal/expenses", auth(s.handleListExpenses))
	mux.HandleFunc("POST /api/v1/portal/expenses", auth(s.handleCreateExpense))
	mux.HandleFunc("PUT /api/v1/portal/expenses/{expenseID}", auth(s.handleUpdateExpense))
	mux.HandleFunc("DELETE /api/v1/portal/expenses/{expenseID}", auth(s.handleDeleteExpense))

	// Finance
	mux.HandleFunc("GET /api/v1/portal/finance/summary", auth(s.handleFinanceSummary))
	mux.HandleFunc("GET /api/v1/portal/finance/agent/{discordID}", auth(s.handleAgentPL))
	mux.HandleFunc("GET /api/v1/portal/finance/lead-roi", auth(s.handleLeadROI))
	mux.HandleFunc("GET /api/v1/portal/finance/export", auth(s.handleFinanceExport))

	// Portal: Stage Change (alias for existing POST stage handler)
	mux.HandleFunc("PUT /api/v1/portal/agents/{discordID}/stage", auth(s.handleStageAgent))

	// Portal: Org Chart — set comp tier (alias for existing handler)
	mux.HandleFunc("PUT /api/v1/portal/org-chart/set-comp-tier", auth(s.handleSetCompTier))

	// Pending Joins (Manager Approval Gate)
	mux.HandleFunc("GET /api/v1/pending-joins", auth(s.handleListPendingJoins))
	mux.HandleFunc("POST /api/v1/pending-joins/{id}/approve", auth(s.handleApprovePendingJoin))
	mux.HandleFunc("POST /api/v1/pending-joins/{id}/reject", auth(s.handleRejectPendingJoin))
	mux.HandleFunc("POST /api/v1/pending-joins/bulk", auth(s.handleBulkPendingJoins))

	// Purge Management (Inactive Agent Purge)
	mux.HandleFunc("GET /api/v1/purge/status", auth(s.handlePurgeStatus))
	mux.HandleFunc("GET /api/v1/purge/warnings", auth(s.handleListPurgeWarnings))
	mux.HandleFunc("POST /api/v1/purge/warnings/{id}/respond", s.handleRespondPurgeWarning) // public, no auth
	mux.HandleFunc("POST /api/v1/purge/execute", auth(s.handleExecutePurge))
	mux.HandleFunc("PUT /api/v1/purge/settings", auth(s.handleUpdatePurgeSettings))

	// Google Calendar Integration
	mux.HandleFunc("GET /api/v1/integrations/google/authorize", auth(s.handleGoogleAuthorize))
	mux.HandleFunc("GET /api/v1/integrations/google/status", auth(s.handleGoogleStatus))
	mux.HandleFunc("GET /api/v1/integrations/google/events", auth(s.handleGoogleEvents))
	mux.HandleFunc("POST /api/v1/integrations/google/events", auth(s.handleGoogleCreateEvent))
	mux.HandleFunc("PUT /api/v1/integrations/google/events/{eventId}", auth(s.handleGoogleUpdateEvent))
	mux.HandleFunc("DELETE /api/v1/integrations/google/events/{eventId}", auth(s.handleGoogleDeleteEvent))
	mux.HandleFunc("POST /api/v1/integrations/google/sync", auth(s.handleGoogleSync))
	mux.HandleFunc("DELETE /api/v1/integrations/google", auth(s.handleGoogleDisconnect))

	// Microsoft Calendar Integration
	mux.HandleFunc("GET /api/v1/integrations/microsoft/authorize", auth(s.handleMicrosoftAuthorize))
	mux.HandleFunc("GET /api/v1/integrations/microsoft/callback", auth(s.handleMicrosoftCallback))
	mux.HandleFunc("GET /api/v1/integrations/microsoft/events", auth(s.handleMicrosoftEvents))
	mux.HandleFunc("POST /api/v1/integrations/microsoft/sync", auth(s.handleMicrosoftSync))
	mux.HandleFunc("DELETE /api/v1/integrations/microsoft", auth(s.handleMicrosoftDisconnect))
	mux.HandleFunc("GET /api/v1/integrations/microsoft/status", auth(s.handleMicrosoftStatus))

	// Cal.com v2 Proxy
	mux.HandleFunc("GET /api/v1/calcom/status", auth(s.handleCalcomStatus))
	mux.HandleFunc("GET /api/v1/calcom/event-types", auth(s.handleCalcomEventTypes))
	mux.HandleFunc("GET /api/v1/calcom/bookings", auth(s.handleCalcomBookings))
	mux.HandleFunc("GET /api/v1/calcom/bookings/{uid}", auth(s.handleCalcomBookingDetail))
	mux.HandleFunc("GET /api/v1/calcom/slots", auth(s.handleCalcomSlots))

	// AI Chat
	mux.HandleFunc("POST /api/v1/chat", auth(s.handleChat))
	mux.HandleFunc("GET /api/v1/chat/conversations", auth(s.handleListConversations))
	mux.HandleFunc("GET /api/v1/chat/conversations/{conversationID}/messages", auth(s.handleGetConversationMessages))
	mux.HandleFunc("DELETE /api/v1/chat/conversations/{conversationID}", auth(s.handleDeleteConversation))
	mux.HandleFunc("PATCH /api/v1/chat/conversations/{conversationID}", auth(s.handleRenameConversation))

	// Organizations
	mux.HandleFunc("GET /api/v1/organizations", auth(s.handleListOrganizations))
	mux.HandleFunc("POST /api/v1/organizations", auth(s.handleCreateOrganization))
	mux.HandleFunc("GET /api/v1/organizations/{id}", auth(s.handleGetOrganization))
	mux.HandleFunc("PUT /api/v1/organizations/{id}", auth(s.handleUpdateOrganization))
	mux.HandleFunc("DELETE /api/v1/organizations/{id}", auth(s.handleDeleteOrganization))

	// Lock-In Planner
	mux.HandleFunc("POST /api/v1/lock-ins", auth(s.handleCreateLockIn))
	mux.HandleFunc("GET /api/v1/lock-ins", auth(s.handleListLockIns))
	mux.HandleFunc("GET /api/v1/lock-ins/{id}", auth(s.handleGetLockIn))
	mux.HandleFunc("PUT /api/v1/lock-ins/{id}", auth(s.handleUpdateLockIn))
	mux.HandleFunc("DELETE /api/v1/lock-ins/{id}", auth(s.handleDeleteLockIn))
	mux.HandleFunc("POST /api/v1/lock-ins/{id}/invite", auth(s.handleInvitePartner))
	mux.HandleFunc("PUT /api/v1/lock-ins/{id}/partners/{partnerID}", auth(s.handleRespondPartnerInvite))
	mux.HandleFunc("GET /api/v1/lock-ins/{id}/agents", auth(s.handleListLockInAgents))
	mux.HandleFunc("POST /api/v1/lock-ins/{id}/agents", auth(s.handleAddLockInAgent))
	mux.HandleFunc("PUT /api/v1/lock-ins/{id}/agents/{agentID}", auth(s.handleUpdateLockInAgent))
	mux.HandleFunc("GET /api/v1/lock-ins/{id}/budget", auth(s.handleGetLockInBudget))
	mux.HandleFunc("POST /api/v1/lock-ins/{id}/budget", auth(s.handleAddBudgetItem))
	mux.HandleFunc("GET /api/v1/lock-ins/{id}/itinerary", auth(s.handleGetLockInItinerary))
	mux.HandleFunc("POST /api/v1/lock-ins/{id}/itinerary", auth(s.handleAddItineraryItem))
	mux.HandleFunc("POST /api/v1/lock-ins/{id}/chat", auth(s.handleLockInChat))

	// CRM M0 admin — backfill contacts from existing recruits/sales/agent_leads.
	// Requires "*" (super admin) or explicit "crm.admin" permission. Dry-run by default.
	mux.HandleFunc("POST /api/v1/crm/admin/backfill", auth(requirePermission("crm.admin")(s.handleCRMBackfill)))

	// ── CRM M1: contacts (9) ──────────────────────────────────────────
	mux.HandleFunc("GET    /api/v1/crm/contacts", auth(s.handleCRMListContacts))
	mux.HandleFunc("POST   /api/v1/crm/contacts", auth(s.handleCRMCreateContact))
	mux.HandleFunc("GET    /api/v1/crm/contacts/{id}", auth(s.handleCRMGetContact))
	mux.HandleFunc("PATCH  /api/v1/crm/contacts/{id}", auth(s.handleCRMUpdateContact))
	mux.HandleFunc("POST   /api/v1/crm/contacts/{id}/archive", auth(s.handleCRMArchiveContact))
	mux.HandleFunc("POST   /api/v1/crm/contacts/{id}/restore", auth(requirePermission("crm.admin")(s.handleCRMRestoreContact)))
	mux.HandleFunc("POST   /api/v1/crm/contacts/{id}/tags", auth(s.handleCRMAddTag))
	mux.HandleFunc("DELETE /api/v1/crm/contacts/{id}/tags/{tag}", auth(s.handleCRMRemoveTag))
	mux.HandleFunc("POST   /api/v1/crm/contacts/bulk", auth(s.handleCRMBulkContacts))

	// ── CRM M1: smart lists (7) ───────────────────────────────────────
	mux.HandleFunc("GET    /api/v1/crm/smartlists", auth(s.handleCRMListSmartLists))
	mux.HandleFunc("POST   /api/v1/crm/smartlists", auth(s.handleCRMCreateSmartList))
	mux.HandleFunc("GET    /api/v1/crm/smartlists/{id}", auth(s.handleCRMGetSmartList))
	mux.HandleFunc("PATCH  /api/v1/crm/smartlists/{id}", auth(s.handleCRMUpdateSmartList))
	mux.HandleFunc("DELETE /api/v1/crm/smartlists/{id}", auth(s.handleCRMDeleteSmartList))
	mux.HandleFunc("POST   /api/v1/crm/smartlists/{id}/pin", auth(s.handleCRMPinSmartList))
	mux.HandleFunc("POST   /api/v1/crm/smartlists/{id}/execute", auth(s.handleCRMExecuteSmartList))

	// Rate limiting: 500 requests per minute per IP (auth, health, ws are exempt)
	limiter := newRateLimiter(500, time.Minute)
	// CORS must wrap rate limiter so 429 responses still include CORS headers
	handler := s.corsMiddleware(limiter.middleware(mux))

	s.srv = &http.Server{
		Addr:              ":" + cfg.APIPort,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return s
}

// Hub returns the WebSocket hub for external event publishing.
func (s *Server) Hub() *websocket.Hub {
	return s.hub
}

// Mux returns the underlying ServeMux so external packages can register additional routes.
func (s *Server) Mux() *http.ServeMux {
	return s.mux
}

// AuthMiddleware returns the auth middleware function for use by external route registrars.
func (s *Server) AuthMiddleware() func(http.HandlerFunc) http.HandlerFunc {
	return s.authMiddleware
}

// handleWebSocket upgrades the HTTP connection to a WebSocket.
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Check legacy API token first
	authorized := s.cfg.APIToken != "" && subtle.ConstantTimeCompare([]byte(token), []byte(s.cfg.APIToken)) == 1

	// Then try JWT validation
	if !authorized && s.cfg.JWTSecret != "" {
		user, err := ValidateAccessToken(s.cfg.JWTSecret, token)
		if err == nil && user != nil {
			authorized = true
		}
	}

	if !authorized {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := websocket.NewClient(s.hub, conn)
	go client.WritePump()
	go client.ReadPump()
}

// Start runs the API server.
func (s *Server) Start(ctx context.Context) {
	log.Printf("API server starting on :%s", s.cfg.APIPort)

	// Start drip campaign processor
	go s.startDripProcessor(ctx)

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		s.srv.Shutdown(shutdownCtx)
	}()

	if err := s.srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("API server error: %v", err)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","service":"vipa-backend"}`))
}
