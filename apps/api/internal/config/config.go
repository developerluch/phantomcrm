package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DiscordToken          string
	GuildID               string
	DatabaseURL           string
	CapSolverAPIKey       string
	LicenseCheckChannelID      string
	LicenseVerifyLogChannelID string
	HiringLogChannelID        string
	StudentRoleID         string
	LicensedAgentRoleID   string
	LogLevel              string

	// Resend Email
	ResendAPIKey  string
	EmailFrom     string
	EmailFromName string

	// Admin notifications
	AdminNotificationChannelID string

	// Onboarding channels
	StartHereChannelID string
	GreetingsChannelID string
	RulesChannelID     string
	NewAgentChannelID  string

	// Onboarding roles
	NewRoleID         string // Assigned on join, removed after form completion
	OnboardedRoleID   string
	ActiveAgentRoleID string

	// Agency roles
	TFCRoleID          string
	RadiantRoleID      string
	GBURoleID          string
	TruLightRoleID     string
	ThriveRoleID       string
	ThePointRoleID     string
	SynergyRoleID      string
	IlluminateRoleID   string
	EliteOneRoleID     string
	UnassignedRoleID   string

	// Staff roles (comma-separated)
	StaffRoleIDs string

	// WAVV
	WAVVSubscriberRoleID string
	WAVVAPIKey           string // Future: for WAVV API integration when available

	// Scheduler config
	InactivityKickWeeks  int    // Weeks before inactive students are kicked. SAFE DEFAULT 0 = disabled.
	UnlicensedKickDays   int    // Days before unlicensed agents are kicked. SAFE DEFAULT 0 = disabled.
	UnlicensedWarnDays   string // Comma-separated warning days (e.g., "15,30,45,59")
	CheckinDay           int    // 0=Sunday, 1=Monday, ..., 6=Saturday
	CheckinHour          int    // Hour in ET (0-23)
	PurgeEnabled         bool   // Gates the 30-day automated inactivity-purge scheduler (default: false)

	// Tracker
	TrackerChannelID string
	NudgeAfterDays   int

	// Audit/logging channels
	AuditLogChannelID string

	// Ticket channels
	TicketChannelID     string
	WAVVTicketChannelID string

	// Agency owner Discord IDs (for approval flow)
	AgencyOwnerTFC       string
	AgencyOwnerRadiant   string
	AgencyOwnerGBU       string
	AgencyOwnerTruLight  string
	AgencyOwnerThrive    string
	AgencyOwnerThePoint  string
	AgencyOwnerSynergy   string
	AgencyOwnerIlluminate string
	AgencyOwnerEliteOne  string
	PendingRoleID        string
	ApprovalMode         string // "auto" (default) or "manual"

	// GoHighLevel CRM
	GHLAPIKey       string
	GHLLocationID   string
	GHLPipelineID   string
	GHLStageWelcome string
	GHLStageForm    string
	GHLStageSorted  string
	GHLStageStudent string
	GHLStageVerified    string
	GHLStageContracting string
	GHLStageSetup       string
	GHLStageActive      string
	GHLCFDiscordID  string
	GHLCFAgency     string
	GHLCFState      string

	// API Server
	APIToken      string
	APIPort       string
	AllowedOrigin string

	// Twilio SMS
	TwilioAccountSID string
	TwilioAuthToken  string
	TwilioFromNumber string

	// Twilio WhatsApp
	TwilioWhatsAppNumber string

	// Cal.com booking
	CalComURL    string
	CalComAPIKey string

	// JWT / OAuth
	JWTSecret           string
	DiscordClientID     string
	DiscordClientSecret string
	GoogleClientID      string
	GoogleClientSecret  string
}

func MustLoad() *Config {
	_ = godotenv.Load() // .env is optional (Railway injects env directly)

	cfg := &Config{
		DiscordToken:          os.Getenv("DISCORD_TOKEN"),
		GuildID:               os.Getenv("GUILD_ID"),
		DatabaseURL:           os.Getenv("DATABASE_URL"),
		CapSolverAPIKey:       os.Getenv("CAPSOLVER_API_KEY"),
		LicenseCheckChannelID:      os.Getenv("LICENSE_CHECK_CHANNEL_ID"),
		LicenseVerifyLogChannelID: os.Getenv("LICENSE_VERIFY_LOG_CHANNEL_ID"),
		HiringLogChannelID:        os.Getenv("HIRING_LOG_CHANNEL_ID"),
		StudentRoleID:         os.Getenv("STUDENT_ROLE_ID"),
		LicensedAgentRoleID:   os.Getenv("LICENSED_AGENT_ROLE_ID"),
		LogLevel:              os.Getenv("LOG_LEVEL"),

		ResendAPIKey:  os.Getenv("RESEND_API_KEY"),
		EmailFrom:     os.Getenv("EMAIL_FROM"),
		EmailFromName: os.Getenv("EMAIL_FROM_NAME"),

		AdminNotificationChannelID: os.Getenv("ADMIN_NOTIFICATION_CHANNEL_ID"),

		StartHereChannelID: os.Getenv("START_HERE_CHANNEL_ID"),
		GreetingsChannelID: os.Getenv("GREETINGS_CHANNEL_ID"),
		RulesChannelID:     os.Getenv("RULES_CHANNEL_ID"),
		NewAgentChannelID:  os.Getenv("NEW_AGENT_CHANNEL_ID"),

		NewRoleID:         os.Getenv("NEW_ROLE_ID"),
		OnboardedRoleID:   os.Getenv("ONBOARDED_ROLE_ID"),
		ActiveAgentRoleID: os.Getenv("ACTIVE_AGENT_ROLE_ID"),
		TFCRoleID:         os.Getenv("TFC_ROLE_ID"),
		RadiantRoleID:     os.Getenv("RADIANT_ROLE_ID"),
		GBURoleID:         os.Getenv("GBU_ROLE_ID"),
		TruLightRoleID:    os.Getenv("TRULIGHT_ROLE_ID"),
		ThriveRoleID:      os.Getenv("THRIVE_ROLE_ID"),
		ThePointRoleID:    os.Getenv("THE_POINT_ROLE_ID"),
		SynergyRoleID:     os.Getenv("SYNERGY_ROLE_ID"),
		IlluminateRoleID:  os.Getenv("ILLUMINATE_ROLE_ID"),
		EliteOneRoleID:    os.Getenv("ELITE_ONE_ROLE_ID"),
		UnassignedRoleID:  os.Getenv("UNASSIGNED_ROLE_ID"),

		StaffRoleIDs: os.Getenv("STAFF_ROLE_IDS"),

		WAVVSubscriberRoleID: os.Getenv("WAVV_SUBSCRIBER_ROLE_ID"),
		WAVVAPIKey:           os.Getenv("WAVV_API_KEY"),

		TrackerChannelID: os.Getenv("TRACKER_CHANNEL_ID"),

		AuditLogChannelID:   os.Getenv("AUDIT_LOG_CHANNEL_ID"),
		TicketChannelID:     os.Getenv("TICKET_CHANNEL_ID"),
		WAVVTicketChannelID: os.Getenv("WAVV_TICKET_CHANNEL_ID"),

		AgencyOwnerTFC:       os.Getenv("AGENCY_OWNER_TFC"),
		AgencyOwnerRadiant:   os.Getenv("AGENCY_OWNER_RADIANT"),
		AgencyOwnerGBU:       os.Getenv("AGENCY_OWNER_GBU"),
		AgencyOwnerTruLight:  os.Getenv("AGENCY_OWNER_TRULIGHT"),
		AgencyOwnerThrive:    os.Getenv("AGENCY_OWNER_THRIVE"),
		AgencyOwnerThePoint:  os.Getenv("AGENCY_OWNER_THE_POINT"),
		AgencyOwnerSynergy:   os.Getenv("AGENCY_OWNER_SYNERGY"),
		AgencyOwnerIlluminate: os.Getenv("AGENCY_OWNER_ILLUMINATE"),
		AgencyOwnerEliteOne:  os.Getenv("AGENCY_OWNER_ELITE_ONE"),
		PendingRoleID:        os.Getenv("PENDING_ROLE_ID"),
		ApprovalMode:         getEnvDefault("APPROVAL_MODE", "auto"),

		GHLAPIKey:           os.Getenv("GHL_API_KEY"),
		GHLLocationID:       os.Getenv("GHL_LOCATION_ID"),
		GHLPipelineID:       os.Getenv("GHL_PIPELINE_ID"),
		GHLStageWelcome:     os.Getenv("GHL_STAGE_WELCOME"),
		GHLStageForm:        os.Getenv("GHL_STAGE_FORM"),
		GHLStageSorted:      os.Getenv("GHL_STAGE_SORTED"),
		GHLStageStudent:     os.Getenv("GHL_STAGE_STUDENT"),
		GHLStageVerified:    os.Getenv("GHL_STAGE_VERIFIED"),
		GHLStageContracting: os.Getenv("GHL_STAGE_CONTRACTING"),
		GHLStageSetup:       os.Getenv("GHL_STAGE_SETUP"),
		GHLStageActive:      os.Getenv("GHL_STAGE_ACTIVE"),
		GHLCFDiscordID:      os.Getenv("GHL_CF_DISCORD_ID"),
		GHLCFAgency:         os.Getenv("GHL_CF_AGENCY"),
		GHLCFState:          os.Getenv("GHL_CF_STATE"),

		APIToken:      os.Getenv("API_TOKEN"),
		APIPort:       os.Getenv("API_PORT"),
		AllowedOrigin: os.Getenv("ALLOWED_ORIGIN"),

		TwilioAccountSID:     os.Getenv("TWILIO_ACCOUNT_SID"),
		TwilioAuthToken:      os.Getenv("TWILIO_AUTH_TOKEN"),
		TwilioFromNumber:     os.Getenv("TWILIO_FROM_NUMBER"),
		TwilioWhatsAppNumber: os.Getenv("TWILIO_WHATSAPP_NUMBER"),
		CalComURL:            getEnvDefault("CAL_COM_URL", ""),
		CalComAPIKey:         os.Getenv("CALCOM_API_KEY"),

		JWTSecret:           os.Getenv("JWT_SECRET"),
		DiscordClientID:     os.Getenv("DISCORD_CLIENT_ID"),
		DiscordClientSecret: os.Getenv("DISCORD_CLIENT_SECRET"),
		GoogleClientID:      os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:  os.Getenv("GOOGLE_CLIENT_SECRET"),
	}

	if cfg.LogLevel == "" {
		cfg.LogLevel = "INFO"
	}
	if port := os.Getenv("PORT"); port != "" {
		cfg.APIPort = port
	} else if cfg.APIPort == "" {
		cfg.APIPort = "8080"
	}

	// SAFE DEFAULT: kicks disabled when env unset. Set explicitly (e.g. =8 / =60) to enable.
	cfg.InactivityKickWeeks = getEnvInt("INACTIVITY_KICK_WEEKS", 0)
	cfg.UnlicensedKickDays = getEnvInt("UNLICENSED_KICK_DAYS", 0)
	cfg.UnlicensedWarnDays = os.Getenv("UNLICENSED_WARN_DAYS")
	if cfg.UnlicensedWarnDays == "" {
		cfg.UnlicensedWarnDays = "15,30,45,59"
	}
	cfg.CheckinDay = getEnvInt("CHECKIN_DAY", 1) // 1 = Monday
	cfg.CheckinHour = getEnvInt("CHECKIN_HOUR", 9)
	cfg.NudgeAfterDays = getEnvInt("NUDGE_AFTER_DAYS", 30)
	cfg.PurgeEnabled = getEnvBool("PURGE_ENABLED", false)

	// Validate required (database only — bot-specific validation is in MustValidateBot)
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	return cfg
}

// MustValidateBot validates bot-specific required fields. Call after MustLoad() for cmd/bot.
func (c *Config) MustValidateBot() {
	if c.DiscordToken == "" {
		log.Fatal("DISCORD_TOKEN is required")
	}
	if c.GuildID == "" {
		log.Fatal("GUILD_ID is required")
	}
}

// MustValidateAPI validates config fields required for standalone API mode.
func (c *Config) MustValidateAPI() {
	if c.JWTSecret == "" {
		log.Fatal("JWT_SECRET is required for API server")
	}
	if c.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if c.DiscordToken == "" {
		log.Fatal("DISCORD_TOKEN is required (REST-only Discord session for /api/v1/discord/*)")
	}
	if c.GuildID == "" {
		log.Fatal("GUILD_ID is required (REST-only Discord session for /api/v1/discord/*)")
	}
	if c.ResendAPIKey == "" {
		log.Println("WARNING: RESEND_API_KEY not set — email features disabled")
	}
	if os.Getenv("ANTHROPIC_API_KEY") == "" {
		log.Println("WARNING: ANTHROPIC_API_KEY not set — AI chat disabled")
	}
	if c.TwilioAccountSID == "" || c.TwilioAuthToken == "" || c.TwilioFromNumber == "" {
		log.Println("WARNING: Twilio not configured — SMS features disabled")
	}
	if c.TwilioWhatsAppNumber == "" {
		log.Println("WARNING: TWILIO_WHATSAPP_NUMBER not set — WhatsApp features disabled")
	}
	if c.WAVVAPIKey == "" {
		log.Println("WARNING: WAVV_API_KEY not set — WAVV sync disabled")
	}
	if c.CalComURL == "" || c.CalComAPIKey == "" {
		log.Println("WARNING: Cal.com not configured — booking features disabled")
	}
	if c.GHLAPIKey == "" {
		log.Println("WARNING: GHL_API_KEY not set — GoHighLevel CRM sync disabled")
	}
}

// GuildIDInt returns the guild ID as int64 for discordgo (which uses string, but we might need int for DB).
func (c *Config) GuildIDInt() int64 {
	v, _ := strconv.ParseInt(c.GuildID, 10, 64)
	return v
}

// StaffRoleIDList returns the staff role IDs as a slice.
func (c *Config) StaffRoleIDList() []string {
	if c.StaffRoleIDs == "" {
		return nil
	}
	parts := strings.Split(c.StaffRoleIDs, ",")
	var result []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}

// IsStaff returns true if any of the given role IDs match a staff role.
func (c *Config) IsStaff(memberRoles []string) bool {
	staffIDs := c.StaffRoleIDList()
	for _, roleID := range memberRoles {
		for _, staffID := range staffIDs {
			if roleID == staffID {
				return true
			}
		}
	}
	return false
}

// GetAgencyRoleID returns the Discord role ID for the given agency name.
func (c *Config) GetAgencyRoleID(agency string) string {
	switch strings.ToLower(strings.TrimSpace(agency)) {
	case "tfc", "topfloorclosers", "top floor closers":
		return c.TFCRoleID
	case "radiant", "radiant financial":
		return c.RadiantRoleID
	case "gbu":
		return c.GBURoleID
	case "trulight", "tru light", "ffl trulight":
		return c.TruLightRoleID
	case "thrive", "ffl thrive":
		return c.ThriveRoleID
	case "the point", "thepoint", "ffl the point":
		return c.ThePointRoleID
	case "synergy", "ffl synergy":
		return c.SynergyRoleID
	case "illuminate", "ffl illuminate":
		return c.IlluminateRoleID
	case "elite one", "eliteone", "elite 1", "ffl elite one":
		return c.EliteOneRoleID
	default:
		return c.UnassignedRoleID
	}
}

// GHLStageMap returns the mapping of bot stages (1-8) to GHL stage IDs.
func (c *Config) GHLStageMap() map[int]string {
	return map[int]string{
		1: c.GHLStageWelcome,
		2: c.GHLStageForm,
		3: c.GHLStageSorted,
		4: c.GHLStageStudent,
		5: c.GHLStageVerified,
		6: c.GHLStageContracting,
		7: c.GHLStageSetup,
		8: c.GHLStageActive,
	}
}

// GetAgencyOwnerID returns the Discord user ID of the agency owner for approval flow.
func (c *Config) GetAgencyOwnerID(agency string) string {
	switch strings.ToLower(strings.TrimSpace(agency)) {
	case "tfc", "topfloorclosers", "top floor closers":
		return c.AgencyOwnerTFC
	case "radiant", "radiant financial":
		return c.AgencyOwnerRadiant
	case "gbu":
		return c.AgencyOwnerGBU
	case "trulight", "tru light":
		return c.AgencyOwnerTruLight
	case "thrive":
		return c.AgencyOwnerThrive
	case "the point", "thepoint":
		return c.AgencyOwnerThePoint
	case "synergy":
		return c.AgencyOwnerSynergy
	case "illuminate":
		return c.AgencyOwnerIlluminate
	case "elite one", "eliteone", "elite 1":
		return c.AgencyOwnerEliteOne
	default:
		return ""
	}
}

// UnlicensedWarnDaysList returns the warning days as a slice of ints.
func (c *Config) UnlicensedWarnDaysList() []int {
	if c.UnlicensedWarnDays == "" {
		return []int{15, 30, 45, 59}
	}
	parts := strings.Split(c.UnlicensedWarnDays, ",")
	var result []int
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if n, err := strconv.Atoi(p); err == nil {
			result = append(result, n)
		}
	}
	return result
}

func getEnvDefault(key, defaultVal string) string {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	return v
}

func getEnvInt(key string, defaultVal int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return n
}

func getEnvBool(key string, defaultVal bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return defaultVal
	}
}
