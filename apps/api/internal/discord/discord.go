package discord

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/bwmarrin/discordgo"

	"phantomcrm-api/internal/api/websocket"
	"phantomcrm-api/internal/config"
	"phantomcrm-api/internal/db"
)

// DiscordAPI provides API handlers that require a Discord session.
type DiscordAPI struct {
	cfg      *config.Config
	db       *db.DB
	hub      *websocket.Hub
	discord  *discordgo.Session
}

// New creates a new DiscordAPI.
func New(cfg *config.Config, database *db.DB, hub *websocket.Hub, discord *discordgo.Session) *DiscordAPI {
	return &DiscordAPI{cfg: cfg, db: database, hub: hub, discord: discord}
}

// Register mounts bot-only routes on the given mux, protected by the given auth middleware.
func (d *DiscordAPI) Register(mux *http.ServeMux, auth func(http.HandlerFunc) http.HandlerFunc) {
	// Discord lookup
	mux.HandleFunc("GET /api/v1/discord/members/{discordID}", auth(d.handleDiscordMemberLookup))

	// Bot guild list
	mux.HandleFunc("GET /api/v1/discord/bot-guilds", auth(d.handleBotGuilds))

	// Agent creation + bulk import (need Discord for member validation)
	mux.HandleFunc("POST /api/v1/agents", auth(d.handleCreateAgent))
	mux.HandleFunc("POST /api/v1/agents/bulk-import", auth(d.handleBulkImport))
}

// handleDiscordMemberLookup looks up a Discord member by ID.
func (d *DiscordAPI) handleDiscordMemberLookup(w http.ResponseWriter, r *http.Request) {
	discordID := r.PathValue("discordID")
	if discordID == "" {
		jsonError(w, "missing discordID", http.StatusBadRequest)
		return
	}

	member, err := d.discord.GuildMember(d.cfg.GuildID, discordID)
	if err != nil || member == nil || member.User == nil {
		jsonOK(w, map[string]interface{}{
			"exists": false,
		})
		return
	}

	avatarURL := ""
	if member.User.Avatar != "" {
		avatarURL = fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", member.User.ID, member.User.Avatar)
	}

	displayName := member.Nick
	if displayName == "" {
		displayName = member.User.GlobalName
	}
	if displayName == "" {
		displayName = member.User.Username
	}

	jsonOK(w, map[string]interface{}{
		"exists":      true,
		"discordId":   member.User.ID,
		"username":    member.User.Username,
		"displayName": displayName,
		"avatarUrl":   avatarURL,
		"roles":       member.Roles,
		"joinedAt":    member.JoinedAt.Format(time.RFC3339),
	})
}

// handleBotGuilds lists all guilds the bot is currently in.
func (d *DiscordAPI) handleBotGuilds(w http.ResponseWriter, r *http.Request) {
	guilds, err := d.discord.UserGuilds(100, "", "", false)
	if err != nil {
		jsonError(w, "failed to fetch bot guilds: "+err.Error(), http.StatusInternalServerError)
		return
	}

	servers, _ := d.db.ListServers(r.Context())
	registered := make(map[string]bool)
	for _, s := range servers {
		registered[s.DiscordGuildID] = true
	}

	type guildInfo struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		Icon         string `json:"icon"`
		IsRegistered bool   `json:"isRegistered"`
	}

	result := make([]guildInfo, 0, len(guilds))
	for _, g := range guilds {
		iconURL := ""
		if g.Icon != "" {
			iconURL = fmt.Sprintf("https://cdn.discordapp.com/icons/%s/%s.png", g.ID, g.Icon)
		}
		result = append(result, guildInfo{
			ID:           g.ID,
			Name:         g.Name,
			Icon:         iconURL,
			IsRegistered: registered[g.ID],
		})
	}

	jsonOK(w, result)
}

// handleCreateAgent creates a new agent from the dashboard.
func (d *DiscordAPI) handleCreateAgent(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var req struct {
		DiscordID string `json:"discordId"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		State     string `json:"state"`
		Agency    string `json:"agency"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DiscordID == "" || req.FirstName == "" || req.LastName == "" {
		jsonError(w, "discordId, firstName, and lastName are required", http.StatusBadRequest)
		return
	}

	member, err := d.discord.GuildMember(d.cfg.GuildID, req.DiscordID)
	if err != nil || member == nil {
		jsonError(w, "Discord member not found in this server", http.StatusBadRequest)
		return
	}

	discordIDInt, err := strconv.ParseInt(req.DiscordID, 10, 64)
	if err != nil {
		jsonError(w, "invalid discordId", http.StatusBadRequest)
		return
	}
	guildIDInt, _ := strconv.ParseInt(d.cfg.GuildID, 10, 64)

	existing, _ := d.db.GetAgent(ctx, discordIDInt)
	if existing != nil {
		jsonError(w, "agent already exists", http.StatusConflict)
		return
	}

	stage := db.StageWelcome
	update := db.AgentUpdate{
		FirstName:    &req.FirstName,
		LastName:     &req.LastName,
		CurrentStage: &stage,
	}
	if req.State != "" {
		update.State = &req.State
	}
	if req.Agency != "" {
		update.Agency = &req.Agency
	}

	if err := d.db.UpsertAgent(ctx, discordIDInt, guildIDInt, update); err != nil {
		log.Printf("API: failed to create agent %s: %v", req.DiscordID, err)
		jsonError(w, "failed to create agent", http.StatusInternalServerError)
		return
	}

	d.db.GetOrCreateProfile(ctx, req.DiscordID)

	avatarURL := ""
	if member.User != nil && member.User.Avatar != "" {
		avatarURL = fmt.Sprintf("https://cdn.discordapp.com/avatars/%s/%s.png", member.User.ID, member.User.Avatar)
	}
	username := ""
	if member.User != nil {
		username = member.User.Username
	}
	displayName := member.Nick
	if displayName == "" && member.User != nil {
		displayName = member.User.GlobalName
	}
	if displayName == "" {
		displayName = username
	}

	if d.hub != nil {
		d.hub.Publish(websocket.NewEvent(websocket.EventAgentCreated, websocket.AgentCreatedData{
			DiscordID:   req.DiscordID,
			Username:    username,
			DisplayName: displayName,
			AvatarURL:   avatarURL,
			Stage:       stage,
			CreatedBy:   "admin_portal",
		}))
	}

	agent, err := d.db.GetAgent(ctx, discordIDInt)
	if err != nil || agent == nil {
		jsonError(w, "agent created but could not fetch", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(agent)
}

// handleBulkImport imports all non-bot Discord members as agents.
func (d *DiscordAPI) handleBulkImport(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	guildIDInt, _ := strconv.ParseInt(d.cfg.GuildID, 10, 64)

	imported := 0
	skipped := 0
	bots := 0
	afterID := ""

	for {
		members, err := d.discord.GuildMembers(d.cfg.GuildID, afterID, 1000)
		if err != nil {
			log.Printf("API: bulk import GuildMembers error: %v", err)
			jsonError(w, "failed to fetch guild members: "+err.Error(), http.StatusInternalServerError)
			return
		}

		for _, member := range members {
			if member.User == nil {
				continue
			}
			if member.User.Bot {
				bots++
				continue
			}

			discordIDInt, err := strconv.ParseInt(member.User.ID, 10, 64)
			if err != nil {
				continue
			}

			existing, _ := d.db.GetAgent(ctx, discordIDInt)
			if existing != nil {
				skipped++
				continue
			}

			stage := db.StageWelcome
			firstName := member.User.GlobalName
			if firstName == "" {
				firstName = member.User.Username
			}
			lastName := ""

			d.db.UpsertAgent(ctx, discordIDInt, guildIDInt, db.AgentUpdate{
				FirstName:    &firstName,
				LastName:     &lastName,
				CurrentStage: &stage,
			})
			d.db.GetOrCreateProfile(ctx, member.User.ID)
			imported++
		}

		if len(members) < 1000 {
			break
		}
		afterID = members[len(members)-1].User.ID
	}

	total := imported + skipped + bots

	if d.hub != nil {
		d.hub.Publish(websocket.NewEvent(websocket.EventBulkImport, websocket.BulkImportData{
			Imported: imported,
			Skipped:  skipped,
			Total:    total,
		}))
	}

	jsonOK(w, map[string]interface{}{
		"imported": imported,
		"skipped":  skipped,
		"bots":     bots,
		"total":    total,
	})
}

func jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
