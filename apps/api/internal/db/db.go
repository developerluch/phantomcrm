package db

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"phantomcrm-api/internal/config"
)

// Stage constants for the onboarding pipeline.
const (
	StageWelcome     = 1
	StageFormStart   = 2
	StageSorted      = 3
	StageStudent     = 4
	StageVerified    = 5
	StageContracting = 6
	StageSetup       = 7
	StageActive      = 8
	StageKicked      = 9
)

// StageMap maps legacy text stage values to integer stages.
var StageMap = map[string]int{
	"welcome":     StageWelcome,
	"form_start":  StageFormStart,
	"sorted":      StageSorted,
	"student":     StageStudent,
	"verified":    StageVerified,
	"contracting": StageContracting,
	"setup":       StageSetup,
	"active":      StageActive,
	"kicked":      StageKicked,
}

type DB struct {
	pool *sql.DB
}

// Pool returns the underlying sql.DB pool for direct queries.
func (d *DB) Pool() *sql.DB {
	return d.pool
}

func New(cfg *config.Config) (*DB, error) {
	dsn := cfg.DatabaseURL
	// Railway internal Postgres doesn't use SSL; ensure sslmode is set
	if !strings.Contains(dsn, "sslmode=") {
		if strings.Contains(dsn, "?") {
			dsn += "&sslmode=disable"
		} else {
			dsn += "?sslmode=disable"
		}
	}

	log.Printf("Connecting to database...")
	pool, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("db: open failed: %w", err)
	}

	pool.SetMaxOpenConns(10)
	pool.SetMaxIdleConns(5)
	pool.SetConnMaxLifetime(30 * time.Minute)
	pool.SetConnMaxIdleTime(5 * time.Minute)

	// Retry connection up to 5 times (Railway services may start before DB is ready)
	var pingErr error
	for attempt := 1; attempt <= 5; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		pingErr = pool.PingContext(ctx)
		cancel()
		if pingErr == nil {
			break
		}
		log.Printf("DB ping attempt %d/5 failed: %v", attempt, pingErr)
		time.Sleep(time.Duration(attempt) * 2 * time.Second)
	}
	if pingErr != nil {
		return nil, fmt.Errorf("db: ping failed after 5 attempts: %w", pingErr)
	}
	log.Println("Database connected successfully")

	d := &DB{pool: pool}
	migCtx, migCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer migCancel()
	if err := d.migrate(migCtx); err != nil {
		return nil, fmt.Errorf("db: migration failed: %w", err)
	}

	log.Println("Database connected and migrated")
	return d, nil
}

func (d *DB) Close() error {
	return d.pool.Close()
}

func (d *DB) migrate(ctx context.Context) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS license_checks (
            id SERIAL PRIMARY KEY,
            discord_id BIGINT NOT NULL,
            guild_id BIGINT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            state TEXT,
            npn TEXT,
            license_number TEXT,
            license_type TEXT,
            license_status TEXT,
            expiration_date TEXT,
            loas TEXT,
            found BOOLEAN DEFAULT FALSE,
            error TEXT,
            checked_at TIMESTAMPTZ DEFAULT NOW()
        )`,
		`CREATE TABLE IF NOT EXISTS onboarding_agents (
            discord_id BIGINT PRIMARY KEY,
            guild_id BIGINT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            phone_number TEXT,
            email TEXT,
            email_opt_in BOOLEAN DEFAULT FALSE,
            state TEXT,
            license_verified BOOLEAN DEFAULT FALSE,
            license_npn TEXT,
            current_stage TEXT DEFAULT 'welcome',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
		// Migration: add email_opt_in column if it doesn't exist (for existing DBs)
		`DO $$ BEGIN
            ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT FALSE;
         EXCEPTION WHEN others THEN NULL;
         END $$`,
		`CREATE TABLE IF NOT EXISTS verification_deadlines (
            discord_id BIGINT PRIMARY KEY,
            guild_id BIGINT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            home_state TEXT,
            license_status TEXT DEFAULT 'none',
            deadline_at TIMESTAMPTZ NOT NULL,
            auto_verified BOOLEAN DEFAULT FALSE,
            last_reminder_at TIMESTAMPTZ,
            admin_notified BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`,

		// Migration: convert current_stage from TEXT to INTEGER
		`DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='onboarding_agents' AND column_name='current_stage' AND data_type='text'
            ) THEN
                ALTER TABLE onboarding_agents ADD COLUMN current_stage_int INTEGER DEFAULT 1;
                UPDATE onboarding_agents SET current_stage_int = CASE
                    WHEN current_stage='welcome' THEN 1
                    WHEN current_stage='form_start' THEN 2
                    WHEN current_stage='sorted' THEN 3
                    WHEN current_stage='student' THEN 4
                    WHEN current_stage='verified' THEN 5
                    WHEN current_stage='contracting' THEN 6
                    WHEN current_stage='setup' THEN 7
                    WHEN current_stage='active' THEN 8
                    ELSE 1 END;
                ALTER TABLE onboarding_agents DROP COLUMN current_stage;
                ALTER TABLE onboarding_agents RENAME COLUMN current_stage_int TO current_stage;
            END IF;
        END $$`,

		// New columns on onboarding_agents for onboarding pipeline
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS agency TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS upline_manager TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS experience_level TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'none'`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS production_written TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS lead_source TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS vision_goals TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS comp_pct TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS show_comp BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS role_background TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS fun_hobbies TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS notification_pref TEXT DEFAULT 'discord'`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS contracting_booked BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS contracting_completed BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS form_completed_at TIMESTAMPTZ`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS sorted_at TIMESTAMPTZ`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS kicked_at TIMESTAMPTZ`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS kicked_reason TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW()`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS course_enrolled BOOLEAN DEFAULT FALSE`,

		// New tables for onboarding pipeline
		`CREATE TABLE IF NOT EXISTS agent_activity_log (
            id SERIAL PRIMARY KEY,
            discord_id BIGINT NOT NULL,
            event_type TEXT NOT NULL,
            details TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
		`CREATE INDEX IF NOT EXISTS idx_activity_discord ON agent_activity_log(discord_id)`,

		`CREATE TABLE IF NOT EXISTS agent_weekly_checkins (
            id SERIAL PRIMARY KEY,
            discord_id BIGINT NOT NULL,
            week_start DATE NOT NULL,
            sent_at TIMESTAMPTZ,
            response TEXT,
            responded_at TIMESTAMPTZ,
            UNIQUE(discord_id, week_start)
        )`,

		`CREATE TABLE IF NOT EXISTS contracting_managers (
            id SERIAL PRIMARY KEY,
            manager_name TEXT NOT NULL,
            discord_user_id BIGINT,
            calendly_url TEXT NOT NULL,
            priority INTEGER DEFAULT 1,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`,

		`CREATE TABLE IF NOT EXISTS agent_setup_progress (
            id SERIAL PRIMARY KEY,
            discord_id BIGINT NOT NULL,
            item_key TEXT NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            completed_at TIMESTAMPTZ,
            UNIQUE(discord_id, item_key)
        )`,

		// Phase 2: Recruiter nudge columns
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS upline_manager_discord_id BIGINT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS last_nudge_sent_at TIMESTAMPTZ`,

		// Phase 3: Approval flow columns
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS direct_manager_discord_id BIGINT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS direct_manager_name TEXT`,
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'none'`,
		`CREATE TABLE IF NOT EXISTS approval_requests (
			id SERIAL PRIMARY KEY,
			agent_discord_id BIGINT NOT NULL,
			guild_id BIGINT NOT NULL,
			agency TEXT NOT NULL,
			owner_discord_id BIGINT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			denial_reason TEXT,
			requested_at TIMESTAMPTZ DEFAULT NOW(),
			responded_at TIMESTAMPTZ,
			dm_message_id TEXT,
			UNIQUE(agent_discord_id, guild_id)
		)`,

		// Phase 4: GHL integration
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS ghl_contact_id TEXT`,

		// Phase 5: Activity entries for leaderboard
		`CREATE TABLE IF NOT EXISTS activity_entries (
			id SERIAL PRIMARY KEY,
			discord_id BIGINT NOT NULL,
			guild_id BIGINT NOT NULL,
			activity_type TEXT NOT NULL,
			count INT NOT NULL DEFAULT 1,
			notes TEXT,
			logged_at TIMESTAMPTZ DEFAULT NOW(),
			week_start DATE NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_activity_entries_week ON activity_entries(discord_id, week_start)`,
		`CREATE INDEX IF NOT EXISTS idx_activity_entries_type ON activity_entries(activity_type, week_start)`,

		// Phase 6: Zoom verticals
		`CREATE TABLE IF NOT EXISTS zoom_verticals (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			zoom_link TEXT,
			schedule TEXT,
			created_by BIGINT,
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS zoom_assignments (
			id SERIAL PRIMARY KEY,
			discord_id BIGINT NOT NULL,
			vertical_id INT NOT NULL REFERENCES zoom_verticals(id),
			joined_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(discord_id, vertical_id)
		)`,

		// Phase 7: Portal tables
		`CREATE TABLE IF NOT EXISTS agent_profiles (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			agent_id TEXT NOT NULL UNIQUE,
			bio TEXT,
			city TEXT,
			timezone TEXT,
			linkedin_url TEXT,
			photo_url TEXT,
			start_date DATE,
			comp_tier_id UUID,
			manager_id TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS comp_tiers (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name TEXT NOT NULL,
			percentage INT NOT NULL DEFAULT 0,
			sort_order INT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`DO $$ BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.table_constraints
				WHERE constraint_name = 'fk_agent_profiles_comp_tier'
			) THEN
				ALTER TABLE agent_profiles
				ADD CONSTRAINT fk_agent_profiles_comp_tier
				FOREIGN KEY (comp_tier_id) REFERENCES comp_tiers(id) ON DELETE SET NULL;
			END IF;
		END $$`,
		`CREATE TABLE IF NOT EXISTS agent_leads (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			agent_id TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			email TEXT,
			phone TEXT,
			source TEXT,
			status TEXT NOT NULL DEFAULT 'new',
			notes TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS agent_training_items (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			agent_id TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			due_date DATE,
			completed_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS agent_schedule_events (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			agent_id TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT,
			start_time TIMESTAMPTZ NOT NULL,
			end_time TIMESTAMPTZ NOT NULL,
			type TEXT NOT NULL DEFAULT 'other',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		// Phase 8: Org chart position persistence
		`ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS position_x DOUBLE PRECISION`,
		`ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS position_y DOUBLE PRECISION`,

		// Phase 9: WAVV production tracker
		`CREATE TABLE IF NOT EXISTS wavv_sessions (
			id SERIAL PRIMARY KEY,
			discord_id BIGINT NOT NULL,
			guild_id BIGINT NOT NULL,
			session_date DATE NOT NULL DEFAULT CURRENT_DATE,
			dials INT NOT NULL DEFAULT 0,
			connections INT NOT NULL DEFAULT 0,
			talk_time_mins INT NOT NULL DEFAULT 0,
			appointments INT NOT NULL DEFAULT 0,
			callbacks INT NOT NULL DEFAULT 0,
			policies INT NOT NULL DEFAULT 0,
			notes TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_wavv_sessions_agent ON wavv_sessions(discord_id, session_date)`,
		`CREATE INDEX IF NOT EXISTS idx_wavv_sessions_date ON wavv_sessions(session_date)`,

		`CREATE TABLE IF NOT EXISTS wavv_goals (
			id SERIAL PRIMARY KEY,
			discord_id BIGINT NOT NULL,
			guild_id BIGINT NOT NULL,
			goal_type TEXT NOT NULL DEFAULT 'weekly',
			dials INT NOT NULL DEFAULT 0,
			connections INT NOT NULL DEFAULT 0,
			talk_mins INT NOT NULL DEFAULT 0,
			appointments INT NOT NULL DEFAULT 0,
			policies INT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(discord_id, goal_type)
		)`,

		// Phase 10: WAVV API sync (auto-pull from WAVV dialer)
		`CREATE TABLE IF NOT EXISTS wavv_api_tokens (
			id SERIAL PRIMARY KEY,
			token TEXT NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS wavv_members (
			id SERIAL PRIMARY KEY,
			wavv_user_id TEXT NOT NULL,
			wavv_member_id TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			discord_id BIGINT,
			last_sync_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_wavv_members_discord ON wavv_members(discord_id)`,

		`CREATE TABLE IF NOT EXISTS wavv_day_stats (
			id SERIAL PRIMARY KEY,
			wavv_member_id TEXT NOT NULL,
			stat_date DATE NOT NULL,
			calls INT NOT NULL DEFAULT 0,
			talk_time_sec INT NOT NULL DEFAULT 0,
			conversations INT NOT NULL DEFAULT 0,
			appointments INT NOT NULL DEFAULT 0,
			dispositions JSONB DEFAULT '{}',
			UNIQUE(wavv_member_id, stat_date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_wavv_day_stats_date ON wavv_day_stats(stat_date)`,
		`CREATE INDEX IF NOT EXISTS idx_wavv_day_stats_member ON wavv_day_stats(wavv_member_id, stat_date)`,

		// Phase 11: Pending actions queue (API -> Bot)
		`CREATE TABLE IF NOT EXISTS pending_actions (
			id SERIAL PRIMARY KEY,
			action_type VARCHAR(50) NOT NULL,
			target_discord_id BIGINT NOT NULL,
			data JSONB DEFAULT '{}',
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			processed_at TIMESTAMPTZ,
			error_message TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status, created_at)`,

		// Phase 12: Organizations, Roles, Users, Refresh Tokens
		`CREATE TABLE IF NOT EXISTS organizations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS roles (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name TEXT NOT NULL UNIQUE,
			permissions TEXT[] NOT NULL DEFAULT '{}',
			is_system BOOLEAN DEFAULT FALSE,
			sort_order INT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		// Seed system roles
		`INSERT INTO roles (name, permissions, is_system, sort_order)
		 VALUES
		   ('super_admin', ARRAY['*'], true, 0),
		   ('owner', ARRAY['agents.read','agents.write','agents.kick','agents.verify','dashboard.read','wavv.read','wavv.write','users.read','users.write','roles.read','roles.write','audit.read','documents.read','documents.write','campaigns.read','campaigns.write','whatsapp.read','whatsapp.write','reports.read','settings.read','settings.write'], true, 1),
		   ('admin', ARRAY['agents.read','agents.write','agents.kick','agents.verify','dashboard.read','wavv.read','wavv.write','users.read','audit.read','documents.read','documents.write','campaigns.read','campaigns.write','whatsapp.read','whatsapp.write','reports.read'], true, 2),
		   ('manager', ARRAY['agents.read','agents.write','agents.verify','dashboard.read','wavv.read','wavv.write','documents.read','documents.write','campaigns.read','whatsapp.read','whatsapp.write','reports.read'], true, 3),
		   ('agent', ARRAY['agents.read','dashboard.read','wavv.read','documents.read'], true, 4)
		 ON CONFLICT (name) DO NOTHING`,

		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email TEXT UNIQUE,
			password_hash TEXT,
			discord_id TEXT UNIQUE,
			display_name TEXT,
			avatar_url TEXT,
			org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
			role_id UUID NOT NULL REFERENCES roles(id),
			is_active BOOLEAN DEFAULT TRUE,
			last_login_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
		`CREATE INDEX IF NOT EXISTS idx_users_discord ON users(discord_id)`,

		`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE`,
		`CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id)`,

		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`,

		// Phase 13: Audit log
		`CREATE TABLE IF NOT EXISTS audit_log (
			id SERIAL PRIMARY KEY,
			org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
			user_id UUID REFERENCES users(id) ON DELETE SET NULL,
			action TEXT NOT NULL,
			resource_type TEXT,
			resource_id TEXT,
			details JSONB DEFAULT '{}',
			ip_address TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at)`,

		// Phase 14: Documents
		`CREATE TABLE IF NOT EXISTS documents (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
			agent_discord_id TEXT,
			uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
			filename TEXT NOT NULL,
			file_url TEXT NOT NULL,
			category TEXT NOT NULL DEFAULT 'general',
			file_size BIGINT DEFAULT 0,
			mime_type TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_documents_agent ON documents(agent_discord_id)`,
		`CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category)`,

		// Phase 15: Campaigns
		`CREATE TABLE IF NOT EXISTS campaigns (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
			created_by UUID REFERENCES users(id) ON DELETE SET NULL,
			name TEXT NOT NULL,
			channel TEXT NOT NULL DEFAULT 'discord',
			target_type TEXT NOT NULL DEFAULT 'all',
			target_filter JSONB DEFAULT '{}',
			message_template TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'draft',
			scheduled_at TIMESTAMPTZ,
			sent_at TIMESTAMPTZ,
			sent_count INT DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)`,

		// Phase 16: WhatsApp
		`CREATE TABLE IF NOT EXISTS whatsapp_sessions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			va_discord_id TEXT NOT NULL,
			va_name TEXT,
			phone_number TEXT,
			status TEXT NOT NULL DEFAULT 'disconnected',
			last_connected_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_va ON whatsapp_sessions(va_discord_id)`,

		`CREATE TABLE IF NOT EXISTS whatsapp_conversations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
			contact_phone TEXT NOT NULL,
			contact_name TEXT,
			agent_discord_id TEXT,
			last_message_at TIMESTAMPTZ,
			unread_count INT DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_session ON whatsapp_conversations(session_id)`,

		`CREATE TABLE IF NOT EXISTS whatsapp_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
			sender TEXT NOT NULL,
			body TEXT NOT NULL,
			media_url TEXT,
			media_type TEXT,
			is_from_contact BOOLEAN DEFAULT FALSE,
			sent_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON whatsapp_messages(conversation_id, sent_at)`,

		// Phase 17: recruits, sales, licenses, notifications, appointments, sms_messages, servers, notification_preferences
		`CREATE TABLE IF NOT EXISTS recruits (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID,
			discord_id TEXT,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			email TEXT NOT NULL,
			phone TEXT,
			city TEXT,
			source TEXT,
			reason TEXT,
			stage TEXT NOT NULL DEFAULT 'NEW_LEAD',
			approval_status TEXT,
			rejected_reason TEXT,
			interview_type TEXT,
			interview_date TIMESTAMPTZ,
			interview_link TEXT,
			interview_notes TEXT,
			calendly_event_uri TEXT,
			assigned_manager_id TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_recruits_stage ON recruits(stage)`,
		`CREATE INDEX IF NOT EXISTS idx_recruits_org ON recruits(org_id)`,

		`CREATE TABLE IF NOT EXISTS sales (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID,
			agent_discord_id TEXT NOT NULL,
			client_name TEXT NOT NULL,
			policy_type TEXT NOT NULL,
			carrier TEXT NOT NULL,
			premium NUMERIC NOT NULL DEFAULT 0,
			commission NUMERIC DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'submitted',
			policy_number TEXT,
			submitted_at TIMESTAMPTZ DEFAULT NOW(),
			approved_at TIMESTAMPTZ,
			issued_at TIMESTAMPTZ,
			paid_at TIMESTAMPTZ,
			notes TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sales_agent ON sales(agent_discord_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status)`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_dob TEXT`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_address TEXT`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_phone TEXT`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_email TEXT`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS face_amount NUMERIC`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_mode TEXT`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS transcript TEXT`,
		// Columns referenced by sales.go salesCols / scanSale but missing
		// from the original CREATE TABLE. Added 2026-05-12 as part of the
		// backend-split error triage — without these, GET /portal/sales
		// returns 500 because the SELECT references non-existent columns.
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS product_name TEXT`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS insured_name TEXT`,
		`ALTER TABLE sales ADD COLUMN IF NOT EXISTS postcard_sent_at TIMESTAMPTZ`,

		`CREATE TABLE IF NOT EXISTS licenses (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			agent_discord_id TEXT NOT NULL,
			state CHAR(2) NOT NULL,
			license_number TEXT NOT NULL,
			npn TEXT,
			status TEXT NOT NULL DEFAULT 'PENDING',
			expiration_date DATE,
			lines_of_authority TEXT[],
			verified_by TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_licenses_agent ON licenses(agent_discord_id)`,

		`CREATE TABLE IF NOT EXISTS notifications (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID,
			type TEXT NOT NULL,
			title TEXT NOT NULL,
			message TEXT NOT NULL,
			read BOOLEAN DEFAULT FALSE,
			data JSONB,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read)`,

		`CREATE TABLE IF NOT EXISTS appointments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID,
			agent_discord_id TEXT NOT NULL,
			title TEXT NOT NULL,
			description TEXT,
			start_time TIMESTAMPTZ NOT NULL,
			end_time TIMESTAMPTZ NOT NULL,
			status TEXT NOT NULL DEFAULT 'scheduled',
			meeting_link TEXT,
			notes TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_appointments_agent ON appointments(agent_discord_id)`,
		`CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(start_time)`,

		`CREATE TABLE IF NOT EXISTS sms_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			agent_discord_id TEXT,
			recruit_id UUID,
			to_number TEXT NOT NULL,
			from_number TEXT,
			body TEXT NOT NULL,
			direction TEXT NOT NULL DEFAULT 'outbound',
			status TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sms_agent ON sms_messages(agent_discord_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sms_recruit ON sms_messages(recruit_id)`,

		`CREATE TABLE IF NOT EXISTS servers (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			discord_guild_id TEXT UNIQUE NOT NULL,
			guild_name TEXT NOT NULL,
			owner_discord_id TEXT,
			icon_url TEXT,
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS notification_preferences (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL UNIQUE,
			preferences JSONB NOT NULL DEFAULT '{}',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		// Phase 20: Bug Reports
		`CREATE TABLE IF NOT EXISTS bug_reports (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id TEXT,
			description TEXT NOT NULL,
			severity TEXT NOT NULL DEFAULT 'medium',
			page_url TEXT,
			user_agent TEXT,
			status TEXT NOT NULL DEFAULT 'open',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		// Phase 21: Pending Joins (Manager Approval Gate)
		`CREATE TABLE IF NOT EXISTS pending_joins (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			discord_id BIGINT NOT NULL,
			guild_id BIGINT NOT NULL,
			username TEXT NOT NULL,
			avatar_url TEXT,
			joined_at TIMESTAMPTZ DEFAULT NOW(),
			status TEXT NOT NULL DEFAULT 'pending',
			reviewed_by TEXT,
			reviewed_at TIMESTAMPTZ,
			UNIQUE(discord_id, guild_id)
		)`,
		// Phase 22: Purge Warnings (Inactive Agent Purge System)
		`CREATE TABLE IF NOT EXISTS purge_warnings (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			discord_id BIGINT NOT NULL,
			guild_id BIGINT NOT NULL,
			warning_type TEXT NOT NULL,
			sent_at TIMESTAMPTZ DEFAULT NOW(),
			response_deadline TIMESTAMPTZ NOT NULL,
			responded_at TIMESTAMPTZ,
			action_taken TEXT NOT NULL DEFAULT 'none',
			UNIQUE(discord_id, guild_id, warning_type)
		)`,

		// Phase 23: User Integrations (Calendar OAuth)
		`CREATE TABLE IF NOT EXISTS user_integrations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id TEXT NOT NULL,
			provider TEXT NOT NULL,
			access_token_enc TEXT NOT NULL,
			refresh_token_enc TEXT NOT NULL,
			token_expiry TIMESTAMPTZ,
			scopes TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(user_id, provider)
		)`,

		// Phase 24: Chat Conversations & Messages (AI Chatbot)
		`CREATE TABLE IF NOT EXISTS chat_conversations (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id TEXT NOT NULL,
			title TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS chat_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			tool_calls_json JSONB,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		// Phase 25: Lock-In Planner
		`CREATE TABLE IF NOT EXISTS lock_ins (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name TEXT NOT NULL,
			start_date DATE NOT NULL,
			end_date DATE NOT NULL,
			city TEXT NOT NULL,
			state TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'planning',
			created_by_org_id BIGINT NOT NULL,
			budget_target NUMERIC(12,2) DEFAULT 0,
			sales_goal NUMERIC(12,2) DEFAULT 0,
			estimated_headcount INT DEFAULT 0,
			description TEXT DEFAULT '',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS lock_in_partners (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			lock_in_id UUID NOT NULL REFERENCES lock_ins(id) ON DELETE CASCADE,
			org_id BIGINT NOT NULL,
			org_name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			invited_by BIGINT NOT NULL,
			approved_by BIGINT,
			approved_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(lock_in_id, org_id)
		)`,
		`CREATE TABLE IF NOT EXISTS lock_in_agents (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			lock_in_id UUID NOT NULL REFERENCES lock_ins(id) ON DELETE CASCADE,
			agent_discord_id BIGINT NOT NULL,
			org_id BIGINT NOT NULL,
			agent_name TEXT NOT NULL,
			flight_airline TEXT DEFAULT '',
			flight_number TEXT DEFAULT '',
			arrival_time TIMESTAMPTZ,
			departure_time TIMESTAMPTZ,
			lodging_assignment TEXT DEFAULT '',
			dietary_prefs TEXT DEFAULT '',
			roommate_pref TEXT DEFAULT '',
			status TEXT NOT NULL DEFAULT 'invited',
			created_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(lock_in_id, agent_discord_id)
		)`,
		`CREATE TABLE IF NOT EXISTS lock_in_budget (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			lock_in_id UUID NOT NULL REFERENCES lock_ins(id) ON DELETE CASCADE,
			category TEXT NOT NULL,
			description TEXT NOT NULL,
			amount NUMERIC(12,2) NOT NULL,
			paid_by_org_id BIGINT,
			split_type TEXT NOT NULL DEFAULT 'even',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS lock_in_itinerary (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			lock_in_id UUID NOT NULL REFERENCES lock_ins(id) ON DELETE CASCADE,
			day_number INT NOT NULL,
			start_time TIME NOT NULL,
			end_time TIME NOT NULL,
			title TEXT NOT NULL,
			description TEXT DEFAULT '',
			location TEXT DEFAULT '',
			category TEXT DEFAULT 'general',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS lock_in_chat_messages (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			lock_in_id UUID NOT NULL REFERENCES lock_ins(id) ON DELETE CASCADE,
			user_id BIGINT NOT NULL,
			user_name TEXT NOT NULL,
			message TEXT NOT NULL,
			ai_response TEXT DEFAULT '',
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		// Phase 26: Pipeline Automation (MVP 1) + Website CRM (MVP 2) + Finance (MVP 3)
		`ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS provider_id TEXT`,

		`CREATE TABLE IF NOT EXISTS stage_configs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			stage TEXT UNIQUE NOT NULL,
			sms_template TEXT DEFAULT '',
			manager_discord_id TEXT DEFAULT '',
			manager_name TEXT DEFAULT '',
			notify_discord BOOLEAN DEFAULT false,
			auto_assign BOOLEAN DEFAULT false,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,

		`INSERT INTO stage_configs (stage, sms_template, manager_discord_id, manager_name, notify_discord, auto_assign) VALUES
		 ('NEW_LEAD', 'Hey {{firstName}}! Thanks for your interest in VIPA. We''d love to learn more about you. Expect a call soon! - Lucky', '771166989418496022', 'Lucky', false, false),
		 ('CONTACTED', '', '771166989418496022', 'Lucky', false, false),
		 ('SCHEDULED', 'Hi {{firstName}}! Your interview is confirmed. We''ll reach out with details shortly. - VIPA Team', '771166989418496022', 'Lucky', false, false),
		 ('INTERVIEWED', '', '771166989418496022', 'Lucky', false, false),
		 ('OFFER', 'Great news {{firstName}}! We''d like to move forward with you at VIPA. Our onboarding team will be in touch. - Lucky', '', 'Isabel', true, true),
		 ('ONBOARDED', '{{firstName}}, welcome aboard! Our contracting team will reach out to get you set up. - VIPA Team', '1128817631449850026', 'Laura', true, true),
		 ('REJECTED', '', '', '', false, false)
		 ON CONFLICT (stage) DO NOTHING`,

		`CREATE INDEX IF NOT EXISTS idx_sms_from_number ON sms_messages(from_number) WHERE from_number IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_recruits_phone ON recruits(phone) WHERE phone IS NOT NULL AND phone != ''`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_recruits_email_unique ON recruits(email) WHERE email != ''`,

		`CREATE TABLE IF NOT EXISTS expenses (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id UUID,
			category TEXT NOT NULL,
			description TEXT NOT NULL,
			amount NUMERIC(10,2) NOT NULL,
			expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
			agent_discord_id TEXT,
			receipt_url TEXT,
			created_by TEXT,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(org_id)`,
		`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`,
		`CREATE INDEX IF NOT EXISTS idx_expenses_agent ON expenses(agent_discord_id)`,
		`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`,

		// Phase 27: Agent type for recruits
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS agent_type TEXT`,
		`CREATE INDEX IF NOT EXISTS idx_recruits_agent_type ON recruits(agent_type) WHERE agent_type IS NOT NULL`,

		// Phase 28: WhatsApp drip campaigns & recruit opt-out
		`DO $$ BEGIN
			ALTER TABLE whatsapp_conversations ALTER COLUMN session_id DROP NOT NULL;
		EXCEPTION WHEN others THEN NULL;
		END $$`,
		`ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS recruit_id UUID REFERENCES recruits(id) ON DELETE SET NULL`,
		`CREATE INDEX IF NOT EXISTS idx_wa_conv_recruit ON whatsapp_conversations(recruit_id)`,
		`CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON whatsapp_conversations(contact_phone)`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ`,
		`CREATE TABLE IF NOT EXISTS drip_campaigns (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name TEXT NOT NULL,
			channel TEXT NOT NULL DEFAULT 'whatsapp',
			trigger_stage TEXT NOT NULL,
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS drip_steps (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
			step_order INT NOT NULL,
			delay_minutes INT NOT NULL DEFAULT 0,
			message_template TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign ON drip_steps(campaign_id, step_order)`,
		`CREATE TABLE IF NOT EXISTS drip_executions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
			recruit_id UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
			current_step INT NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'active',
			next_send_at TIMESTAMPTZ,
			started_at TIMESTAMPTZ DEFAULT NOW(),
			completed_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_drip_exec_due ON drip_executions(status, next_send_at)`,
		`CREATE INDEX IF NOT EXISTS idx_drip_exec_recruit ON drip_executions(recruit_id)`,
		`DO $$
		DECLARE camp_id UUID;
		BEGIN
			INSERT INTO drip_campaigns (name, trigger_stage, channel)
			SELECT 'New Lead Welcome', 'NEW_LEAD', 'whatsapp'
			WHERE NOT EXISTS (SELECT 1 FROM drip_campaigns WHERE name = 'New Lead Welcome')
			RETURNING id INTO camp_id;

			IF camp_id IS NOT NULL THEN
				INSERT INTO drip_steps (campaign_id, step_order, delay_minutes, message_template) VALUES
				(camp_id, 1, 0, 'Hi {{firstName}}! This is the team at VIPA. We saw your interest in becoming a licensed insurance agent. We''d love to tell you more about our program. Are you available for a quick call? Reply STOP to unsubscribe.'),
				(camp_id, 2, 120, 'Hey {{firstName}}, just following up! Here''s a link to book a quick 15-minute call with our team: {{bookingLink}} Reply STOP to unsubscribe.'),
				(camp_id, 3, 1440, 'Hi {{firstName}}, wanted to make sure you saw our message. We have spots opening up for new agents this month. Book a call when you''re ready: {{bookingLink}} Reply STOP to unsubscribe.'),
				(camp_id, 4, 4320, '{{firstName}}, this is our last reach-out. If you''re still interested in the insurance career opportunity, let us know. We''re here when you''re ready! Reply STOP to unsubscribe.');
			END IF;
		END $$`,

		// Phase: Duplicate-reminder fix — track last warn day for unlicensed kick warnings
		`ALTER TABLE onboarding_agents ADD COLUMN IF NOT EXISTS last_unlicensed_warn_day INT`,

		// Phase 29: Expanded recruit pipeline
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS lead_source VARCHAR(50)`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS is_licensed BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS license_state VARCHAR(2)`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS license_expiry_date TIMESTAMPTZ`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS course_enrolled_date TIMESTAMPTZ`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS course_name VARCHAR(255)`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS course_progress INTEGER`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS contracting_status VARCHAR(50)`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS contracting_carrier VARCHAR(255)`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS contracting_submitted_date TIMESTAMPTZ`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS discord_joined_date TIMESTAMPTZ`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '{}'`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS state VARCHAR(2)`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS prior_experience TEXT`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS is_currently_licensed BOOLEAN`,
		`ALTER TABLE recruits ADD COLUMN IF NOT EXISTS how_heard VARCHAR(100)`,
		`CREATE INDEX IF NOT EXISTS idx_recruits_lead_source ON recruits(lead_source) WHERE lead_source IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_recruits_state_col ON recruits(state) WHERE state IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_recruits_contracting_status ON recruits(contracting_status) WHERE contracting_status IS NOT NULL`,
		`INSERT INTO stage_configs (stage, sms_template, manager_discord_id, manager_name, notify_discord, auto_assign) VALUES
		 ('PREQUALIFIED', 'Hi {{firstName}}, you have been prequalified! We will be in touch to schedule your interview.', '771166989418496022', 'Lucky', true, false),
		 ('INTERVIEW_SCHEDULED', 'Hi {{firstName}}, your interview has been scheduled. See you then!', '771166989418496022', 'Lucky', true, false),
		 ('ONBOARDING', 'Welcome to the team {{firstName}}! Check your email for your onboarding link with next steps.', '771166989418496022', 'Lucky', true, false),
		 ('IN_COURSE', 'Hi {{firstName}}, you are now enrolled in your licensing course. Good luck!', '771166989418496022', 'Lucky', true, false),
		 ('LICENSED', 'Congratulations {{firstName}}! Your license has been confirmed. We are now submitting your carrier contracting.', '771166989418496022', 'Lucky', true, false),
		 ('CONTRACTING', 'Hi {{firstName}}, your contracting has been submitted. We will notify you once approved.', '771166989418496022', 'Lucky', false, false),
		 ('ACTIVE', 'Welcome aboard {{firstName}}! You are now fully contracted and ready to start selling.', '771166989418496022', 'Lucky', true, false)
		 ON CONFLICT (stage) DO NOTHING`,

		// Phase 30: Google Calendar — add google_email to user_integrations
		`ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS google_email TEXT`,
	}

	for _, m := range migrations {
		if _, err := d.pool.ExecContext(ctx, m); err != nil {
			return err
		}
	}

	// ── Phase 40: CRM M0 foundations (contacts, addresses, events, views) ──
	if err := d.migrateCRMM0(ctx); err != nil {
		return err
	}

	// ── Phase 41: CRM M1 (shared visibility, trigram indexes, smart_lists) ──
	if err := d.migrateCRMM1(ctx); err != nil {
		return err
	}

	// ── Phase 42: CRM M2A (conversations, messages, message_templates) ──
	if err := d.migrateCRMM2(ctx); err != nil {
		return err
	}

	return nil
}

// LicenseCheck represents a row in the license_checks table.
type LicenseCheck struct {
	DiscordID      int64
	GuildID        int64
	FirstName      string
	LastName       string
	State          string
	NPN            string
	LicenseNumber  string
	LicenseType    string
	LicenseStatus  string
	ExpirationDate string
	LOAs           string
	Found          bool
	Error          string
}

func (d *DB) SaveLicenseCheck(ctx context.Context, c LicenseCheck) error {
	_, err := d.pool.ExecContext(ctx,
		`INSERT INTO license_checks
         (discord_id, guild_id, first_name, last_name, state, npn, license_number,
          license_type, license_status, expiration_date, loas, found, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		c.DiscordID, c.GuildID, c.FirstName, c.LastName, c.State, c.NPN,
		c.LicenseNumber, c.LicenseType, c.LicenseStatus, c.ExpirationDate,
		c.LOAs, c.Found, c.Error,
	)
	return err
}

// AgentUpdate holds fields to update for an agent.
type AgentUpdate struct {
	FirstName       *string
	LastName        *string
	PhoneNumber     *string
	Email           *string
	EmailOptIn      *bool
	State           *string
	LicenseVerified *bool
	LicenseNPN      *string
	CurrentStage    *int

	// Onboarding fields
	Agency               *string
	UplineManager        *string
	ExperienceLevel      *string
	LicenseStatus        *string
	ProductionWritten    *string
	LeadSource           *string
	VisionGoals          *string
	CompPct              *string
	ShowComp             *bool
	RoleBackground       *string
	FunHobbies           *string
	NotificationPref     *string
	CourseEnrolled       *bool
	ContractingBooked    *bool
	ContractingCompleted *bool
	SetupCompleted       *bool
	FormCompletedAt      *time.Time
	SortedAt             *time.Time
	ActivatedAt          *time.Time
	KickedAt                 *time.Time
	KickedReason             *string
	LastActive               *time.Time
	UplineManagerDiscordID   *int64
	LastNudgeSentAt          *time.Time
	DirectManagerDiscordID   *int64
	DirectManagerName        *string
	ApprovalStatus           *string
	GHLContactID             *string
}

func (d *DB) UpsertAgent(ctx context.Context, discordID, guildID int64, updates AgentUpdate) error {
	// Insert if not exists
	_, err := d.pool.ExecContext(ctx,
		`INSERT INTO onboarding_agents (discord_id, guild_id)
         VALUES ($1, $2)
         ON CONFLICT (discord_id) DO NOTHING`,
		discordID, guildID,
	)
	if err != nil {
		return fmt.Errorf("db: upsert insert: %w", err)
	}

	// Build dynamic UPDATE
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argN := 1

	if updates.FirstName != nil {
		sets = append(sets, fmt.Sprintf("first_name = $%d", argN))
		args = append(args, *updates.FirstName)
		argN++
	}
	if updates.LastName != nil {
		sets = append(sets, fmt.Sprintf("last_name = $%d", argN))
		args = append(args, *updates.LastName)
		argN++
	}
	if updates.PhoneNumber != nil {
		sets = append(sets, fmt.Sprintf("phone_number = $%d", argN))
		args = append(args, *updates.PhoneNumber)
		argN++
	}
	if updates.Email != nil {
		sets = append(sets, fmt.Sprintf("email = $%d", argN))
		args = append(args, *updates.Email)
		argN++
	}
	if updates.EmailOptIn != nil {
		sets = append(sets, fmt.Sprintf("email_opt_in = $%d", argN))
		args = append(args, *updates.EmailOptIn)
		argN++
	}
	if updates.State != nil {
		sets = append(sets, fmt.Sprintf("state = $%d", argN))
		args = append(args, *updates.State)
		argN++
	}
	if updates.LicenseVerified != nil {
		sets = append(sets, fmt.Sprintf("license_verified = $%d", argN))
		args = append(args, *updates.LicenseVerified)
		argN++
	}
	if updates.LicenseNPN != nil {
		sets = append(sets, fmt.Sprintf("license_npn = $%d", argN))
		args = append(args, *updates.LicenseNPN)
		argN++
	}
	if updates.CurrentStage != nil {
		sets = append(sets, fmt.Sprintf("current_stage = $%d", argN))
		args = append(args, *updates.CurrentStage)
		argN++
	}
	if updates.Agency != nil {
		sets = append(sets, fmt.Sprintf("agency = $%d", argN))
		args = append(args, *updates.Agency)
		argN++
	}
	if updates.UplineManager != nil {
		sets = append(sets, fmt.Sprintf("upline_manager = $%d", argN))
		args = append(args, *updates.UplineManager)
		argN++
	}
	if updates.ExperienceLevel != nil {
		sets = append(sets, fmt.Sprintf("experience_level = $%d", argN))
		args = append(args, *updates.ExperienceLevel)
		argN++
	}
	if updates.LicenseStatus != nil {
		sets = append(sets, fmt.Sprintf("license_status = $%d", argN))
		args = append(args, *updates.LicenseStatus)
		argN++
	}
	if updates.ProductionWritten != nil {
		sets = append(sets, fmt.Sprintf("production_written = $%d", argN))
		args = append(args, *updates.ProductionWritten)
		argN++
	}
	if updates.LeadSource != nil {
		sets = append(sets, fmt.Sprintf("lead_source = $%d", argN))
		args = append(args, *updates.LeadSource)
		argN++
	}
	if updates.VisionGoals != nil {
		sets = append(sets, fmt.Sprintf("vision_goals = $%d", argN))
		args = append(args, *updates.VisionGoals)
		argN++
	}
	if updates.CompPct != nil {
		sets = append(sets, fmt.Sprintf("comp_pct = $%d", argN))
		args = append(args, *updates.CompPct)
		argN++
	}
	if updates.ShowComp != nil {
		sets = append(sets, fmt.Sprintf("show_comp = $%d", argN))
		args = append(args, *updates.ShowComp)
		argN++
	}
	if updates.RoleBackground != nil {
		sets = append(sets, fmt.Sprintf("role_background = $%d", argN))
		args = append(args, *updates.RoleBackground)
		argN++
	}
	if updates.FunHobbies != nil {
		sets = append(sets, fmt.Sprintf("fun_hobbies = $%d", argN))
		args = append(args, *updates.FunHobbies)
		argN++
	}
	if updates.NotificationPref != nil {
		sets = append(sets, fmt.Sprintf("notification_pref = $%d", argN))
		args = append(args, *updates.NotificationPref)
		argN++
	}
	if updates.CourseEnrolled != nil {
		sets = append(sets, fmt.Sprintf("course_enrolled = $%d", argN))
		args = append(args, *updates.CourseEnrolled)
		argN++
	}
	if updates.ContractingBooked != nil {
		sets = append(sets, fmt.Sprintf("contracting_booked = $%d", argN))
		args = append(args, *updates.ContractingBooked)
		argN++
	}
	if updates.ContractingCompleted != nil {
		sets = append(sets, fmt.Sprintf("contracting_completed = $%d", argN))
		args = append(args, *updates.ContractingCompleted)
		argN++
	}
	if updates.SetupCompleted != nil {
		sets = append(sets, fmt.Sprintf("setup_completed = $%d", argN))
		args = append(args, *updates.SetupCompleted)
		argN++
	}
	if updates.FormCompletedAt != nil {
		sets = append(sets, fmt.Sprintf("form_completed_at = $%d", argN))
		args = append(args, *updates.FormCompletedAt)
		argN++
	}
	if updates.SortedAt != nil {
		sets = append(sets, fmt.Sprintf("sorted_at = $%d", argN))
		args = append(args, *updates.SortedAt)
		argN++
	}
	if updates.ActivatedAt != nil {
		sets = append(sets, fmt.Sprintf("activated_at = $%d", argN))
		args = append(args, *updates.ActivatedAt)
		argN++
	}
	if updates.KickedAt != nil {
		sets = append(sets, fmt.Sprintf("kicked_at = $%d", argN))
		args = append(args, *updates.KickedAt)
		argN++
	}
	if updates.KickedReason != nil {
		sets = append(sets, fmt.Sprintf("kicked_reason = $%d", argN))
		args = append(args, *updates.KickedReason)
		argN++
	}
	if updates.LastActive != nil {
		sets = append(sets, fmt.Sprintf("last_active = $%d", argN))
		args = append(args, *updates.LastActive)
		argN++
	}
	if updates.UplineManagerDiscordID != nil {
		sets = append(sets, fmt.Sprintf("upline_manager_discord_id = $%d", argN))
		args = append(args, *updates.UplineManagerDiscordID)
		argN++
	}
	if updates.LastNudgeSentAt != nil {
		sets = append(sets, fmt.Sprintf("last_nudge_sent_at = $%d", argN))
		args = append(args, *updates.LastNudgeSentAt)
		argN++
	}
	if updates.DirectManagerDiscordID != nil {
		sets = append(sets, fmt.Sprintf("direct_manager_discord_id = $%d", argN))
		args = append(args, *updates.DirectManagerDiscordID)
		argN++
	}
	if updates.DirectManagerName != nil {
		sets = append(sets, fmt.Sprintf("direct_manager_name = $%d", argN))
		args = append(args, *updates.DirectManagerName)
		argN++
	}
	if updates.ApprovalStatus != nil {
		sets = append(sets, fmt.Sprintf("approval_status = $%d", argN))
		args = append(args, *updates.ApprovalStatus)
		argN++
	}
	if updates.GHLContactID != nil {
		sets = append(sets, fmt.Sprintf("ghl_contact_id = $%d", argN))
		args = append(args, *updates.GHLContactID)
		argN++
	}

	if len(args) == 0 {
		return nil // Nothing to update beyond updated_at
	}

	args = append(args, discordID)
	query := fmt.Sprintf("UPDATE onboarding_agents SET %s WHERE discord_id = $%d",
		strings.Join(sets, ", "), argN)

	_, err = d.pool.ExecContext(ctx, query, args...)
	return err
}


// Agent represents a row from onboarding_agents
type Agent struct {
	DiscordID       int64
	GuildID         int64
	FirstName       string
	LastName        string
	PhoneNumber     string
	Email           string
	EmailOptIn      bool
	State           string
	LicenseVerified bool
	LicenseNPN      string
	CurrentStage    int

	// Onboarding fields
	Agency               string
	UplineManager        string
	ExperienceLevel      string
	LicenseStatus        string
	ProductionWritten    string
	LeadSource           string
	VisionGoals          string
	CompPct              string
	ShowComp             bool
	RoleBackground       string
	FunHobbies           string
	NotificationPref     string
	CourseEnrolled       bool
	ContractingBooked    bool
	ContractingCompleted bool
	SetupCompleted       bool
	FormCompletedAt      *time.Time
	SortedAt             *time.Time
	ActivatedAt          *time.Time
	KickedAt             *time.Time
	KickedReason             string
	LastActive               *time.Time
	UplineManagerDiscordID   int64
	LastNudgeSentAt          *time.Time
	DirectManagerDiscordID   int64
	DirectManagerName        string
	ApprovalStatus           string
	GHLContactID             string
	LastUnlicensedWarnDay    *int
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

// AgentRow is an alias for Agent used by the scheduler for unlicensed kick checks.
type AgentRow = Agent

// GetUnlicensedAgents returns all agents in the Student stage (stage 4) who have completed
// the onboarding form but haven't been licensed yet. Used by the 60-day kick scheduler.
func (d *DB) GetUnlicensedAgents(ctx context.Context) ([]Agent, error) {
	query := fmt.Sprintf(`SELECT %s FROM onboarding_agents
		WHERE current_stage = $1
		  AND form_completed_at IS NOT NULL
		  AND COALESCE(license_verified, false) = false
		ORDER BY form_completed_at ASC`, AgentSelectColumns(""))
	rows, err := d.pool.QueryContext(ctx, query, StageStudent)
	if err != nil {
		return nil, fmt.Errorf("db: get unlicensed agents: %w", err)
	}
	defer rows.Close()

	var result []Agent
	for rows.Next() {
		a, err := ScanAgent(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("db: scan unlicensed agent: %w", err)
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

// AgentSelectColumns returns the COALESCE'd column list for SELECT queries on onboarding_agents.
// Pass an optional table alias prefix (e.g. "a") or empty string for no prefix.
func AgentSelectColumns(prefix string) string {
	p := ""
	if prefix != "" {
		p = prefix + "."
	}
	return fmt.Sprintf(`%[1]sdiscord_id, %[1]sguild_id,
         COALESCE(%[1]sfirst_name,''), COALESCE(%[1]slast_name,''),
         COALESCE(%[1]sphone_number,''), COALESCE(%[1]semail,''),
         COALESCE(%[1]semail_opt_in, false),
         COALESCE(%[1]sstate,''), COALESCE(%[1]slicense_verified, false),
         COALESCE(%[1]slicense_npn,''), COALESCE(%[1]scurrent_stage, 1),
         COALESCE(%[1]sagency,''), COALESCE(%[1]supline_manager,''),
         COALESCE(%[1]sexperience_level,''), COALESCE(%[1]slicense_status,'none'),
         COALESCE(%[1]sproduction_written,''), COALESCE(%[1]slead_source,''),
         COALESCE(%[1]svision_goals,''), COALESCE(%[1]scomp_pct,''),
         COALESCE(%[1]sshow_comp, false),
         COALESCE(%[1]srole_background,''), COALESCE(%[1]sfun_hobbies,''),
         COALESCE(%[1]snotification_pref,'discord'),
         COALESCE(%[1]scourse_enrolled, false),
         COALESCE(%[1]scontracting_booked, false), COALESCE(%[1]scontracting_completed, false),
         COALESCE(%[1]ssetup_completed, false),
         %[1]sform_completed_at, %[1]ssorted_at, %[1]sactivated_at, %[1]skicked_at,
         COALESCE(%[1]skicked_reason,''),
         %[1]slast_active,
         COALESCE(%[1]supline_manager_discord_id, 0),
         %[1]slast_nudge_sent_at,
         COALESCE(%[1]sdirect_manager_discord_id, 0),
         COALESCE(%[1]sdirect_manager_name, ''),
         COALESCE(%[1]sapproval_status, 'none'),
         COALESCE(%[1]sghl_contact_id, ''),
         %[1]slast_unlicensed_warn_day,
         %[1]screated_at, %[1]supdated_at`, p)
}

// ScanAgent scans a row into an Agent struct. The column order must match AgentSelectColumns.
func ScanAgent(scan func(dest ...interface{}) error) (Agent, error) {
	var a Agent
	err := scan(
		&a.DiscordID, &a.GuildID, &a.FirstName, &a.LastName,
		&a.PhoneNumber, &a.Email, &a.EmailOptIn, &a.State, &a.LicenseVerified,
		&a.LicenseNPN, &a.CurrentStage,
		&a.Agency, &a.UplineManager,
		&a.ExperienceLevel, &a.LicenseStatus,
		&a.ProductionWritten, &a.LeadSource,
		&a.VisionGoals, &a.CompPct,
		&a.ShowComp,
		&a.RoleBackground, &a.FunHobbies,
		&a.NotificationPref,
		&a.CourseEnrolled,
		&a.ContractingBooked, &a.ContractingCompleted,
		&a.SetupCompleted,
		&a.FormCompletedAt, &a.SortedAt, &a.ActivatedAt, &a.KickedAt,
		&a.KickedReason,
		&a.LastActive,
		&a.UplineManagerDiscordID,
		&a.LastNudgeSentAt,
		&a.DirectManagerDiscordID,
		&a.DirectManagerName,
		&a.ApprovalStatus,
		&a.GHLContactID,
		&a.LastUnlicensedWarnDay,
		&a.CreatedAt, &a.UpdatedAt,
	)
	return a, err
}

func (d *DB) GetAgent(ctx context.Context, discordID int64) (*Agent, error) {
	query := fmt.Sprintf(`SELECT %s FROM onboarding_agents WHERE discord_id = $1`, AgentSelectColumns(""))
	row := d.pool.QueryRowContext(ctx, query, discordID)
	a, err := ScanAgent(row.Scan)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// VerificationDeadline represents a row in the verification_deadlines table.
type VerificationDeadline struct {
	DiscordID     int64
	GuildID       int64
	FirstName     string
	LastName      string
	HomeState     string
	LicenseStatus string
	DeadlineAt    time.Time
	AutoVerified  bool
	LastReminder  *time.Time
	AdminNotified bool
	CreatedAt     time.Time
}

func (d *DB) CreateDeadline(ctx context.Context, dl VerificationDeadline) error {
	_, err := d.pool.ExecContext(ctx,
		`INSERT INTO verification_deadlines
         (discord_id, guild_id, first_name, last_name, home_state, license_status, deadline_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (discord_id) DO UPDATE SET
           guild_id = $2, first_name = $3, last_name = $4, home_state = $5,
           license_status = $6, deadline_at = $7, auto_verified = FALSE,
           admin_notified = FALSE`,
		dl.DiscordID, dl.GuildID, dl.FirstName, dl.LastName,
		dl.HomeState, dl.LicenseStatus, dl.DeadlineAt,
	)
	return err
}

func (d *DB) MarkDeadlineVerified(ctx context.Context, discordID int64) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE verification_deadlines SET auto_verified = TRUE, license_status = 'verified'
         WHERE discord_id = $1`, discordID)
	return err
}

func (d *DB) MarkAdminNotified(ctx context.Context, discordID int64) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE verification_deadlines SET admin_notified = TRUE
         WHERE discord_id = $1`, discordID)
	return err
}

func (d *DB) UpdateReminderSent(ctx context.Context, discordID int64) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE verification_deadlines SET last_reminder_at = NOW()
         WHERE discord_id = $1`, discordID)
	return err
}

// ClaimReminderDeadlines atomically selects pending deadlines and marks them as
// claimed by setting last_reminder_at = NOW(). This prevents duplicate sends
// when multiple bot instances overlap during Railway deploys.
func (d *DB) ClaimReminderDeadlines(ctx context.Context, reminderInterval time.Duration) ([]VerificationDeadline, error) {
	cutoff := time.Now().Add(-reminderInterval)
	rows, err := d.pool.QueryContext(ctx,
		`WITH claimed AS (
			UPDATE verification_deadlines
			SET last_reminder_at = NOW()
			WHERE auto_verified = FALSE
			  AND deadline_at > NOW()
			  AND (last_reminder_at IS NULL OR last_reminder_at < $1)
			RETURNING discord_id, guild_id, COALESCE(first_name,''), COALESCE(last_name,''),
				COALESCE(home_state,''), COALESCE(license_status,'none'), deadline_at,
				COALESCE(auto_verified, false), last_reminder_at,
				COALESCE(admin_notified, false), created_at
		)
		SELECT * FROM claimed ORDER BY deadline_at ASC`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []VerificationDeadline
	for rows.Next() {
		var dl VerificationDeadline
		if err := rows.Scan(&dl.DiscordID, &dl.GuildID, &dl.FirstName, &dl.LastName,
			&dl.HomeState, &dl.LicenseStatus, &dl.DeadlineAt, &dl.AutoVerified,
			&dl.LastReminder, &dl.AdminNotified, &dl.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, dl)
	}
	return result, rows.Err()
}

// UpdateUnlicensedWarnDay sets the last warn day for the unlicensed kick system,
// preventing duplicate warnings on bot restart.
func (d *DB) UpdateUnlicensedWarnDay(ctx context.Context, discordID int64, warnDay int) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE onboarding_agents SET last_unlicensed_warn_day = $2
         WHERE discord_id = $1`, discordID, warnDay)
	return err
}

func (d *DB) DeleteDeadline(ctx context.Context, discordID int64) error {
	_, err := d.pool.ExecContext(ctx,
		`DELETE FROM verification_deadlines WHERE discord_id = $1`, discordID)
	return err
}

// UpdateDeadlineName updates the stored name and state on a verification deadline.
// Called when the agent provides their info via the /verify modal so the auto-verify
// scheduler has the correct name to search.
func (d *DB) UpdateDeadlineName(ctx context.Context, discordID int64, firstName, lastName, state string) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE verification_deadlines SET first_name = $2, last_name = $3, home_state = $4
         WHERE discord_id = $1`, discordID, firstName, lastName, state)
	return err
}

// GetPendingDeadlines returns non-verified deadlines that need reminders.
// It returns deadlines where the last reminder was more than `reminderInterval` ago (or never sent).
func (d *DB) GetPendingDeadlines(ctx context.Context, reminderInterval time.Duration) ([]VerificationDeadline, error) {
	cutoff := time.Now().Add(-reminderInterval)
	rows, err := d.pool.QueryContext(ctx,
		`SELECT discord_id, guild_id, COALESCE(first_name,''), COALESCE(last_name,''),
         COALESCE(home_state,''), COALESCE(license_status,'none'), deadline_at,
         COALESCE(auto_verified, false), last_reminder_at,
         COALESCE(admin_notified, false), created_at
         FROM verification_deadlines
         WHERE auto_verified = FALSE
           AND deadline_at > NOW()
           AND (last_reminder_at IS NULL OR last_reminder_at < $1)
         ORDER BY deadline_at ASC`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []VerificationDeadline
	for rows.Next() {
		var dl VerificationDeadline
		if err := rows.Scan(&dl.DiscordID, &dl.GuildID, &dl.FirstName, &dl.LastName,
			&dl.HomeState, &dl.LicenseStatus, &dl.DeadlineAt, &dl.AutoVerified,
			&dl.LastReminder, &dl.AdminNotified, &dl.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, dl)
	}
	return result, rows.Err()
}

// GetExpiredDeadlines returns deadlines that have passed without verification.
func (d *DB) GetExpiredDeadlines(ctx context.Context) ([]VerificationDeadline, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT discord_id, guild_id, COALESCE(first_name,''), COALESCE(last_name,''),
         COALESCE(home_state,''), COALESCE(license_status,'none'), deadline_at,
         COALESCE(auto_verified, false), last_reminder_at,
         COALESCE(admin_notified, false), created_at
         FROM verification_deadlines
         WHERE auto_verified = FALSE
           AND admin_notified = FALSE
           AND deadline_at <= NOW()
         ORDER BY deadline_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []VerificationDeadline
	for rows.Next() {
		var dl VerificationDeadline
		if err := rows.Scan(&dl.DiscordID, &dl.GuildID, &dl.FirstName, &dl.LastName,
			&dl.HomeState, &dl.LicenseStatus, &dl.DeadlineAt, &dl.AutoVerified,
			&dl.LastReminder, &dl.AdminNotified, &dl.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, dl)
	}
	return result, rows.Err()
}

// CheckHistoryRow represents a license check history row.
type CheckHistoryRow struct {
	State         string
	LicenseStatus string
	Found         bool
	Error         string
	CheckedAt     time.Time
}

func (d *DB) GetCheckHistory(ctx context.Context, discordID int64, limit int) ([]CheckHistoryRow, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT COALESCE(state, ''), COALESCE(license_status, ''),
         COALESCE(found, false), COALESCE(error, ''), checked_at
         FROM license_checks
         WHERE discord_id = $1
         ORDER BY checked_at DESC
         LIMIT $2`, discordID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []CheckHistoryRow
	for rows.Next() {
		var r CheckHistoryRow
		if err := rows.Scan(&r.State, &r.LicenseStatus, &r.Found, &r.Error, &r.CheckedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}
