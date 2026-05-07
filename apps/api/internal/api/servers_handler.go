package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"phantomcrm-api/internal/db"
)

func (s *Server) handleListServers(w http.ResponseWriter, r *http.Request) {
	servers, err := s.db.ListServers(r.Context())
	if err != nil {
		log.Printf("API: list servers: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if servers == nil {
		servers = []db.Server{}
	}
	jsonOK(w, servers)
}

func (s *Server) handleCreateServer(w http.ResponseWriter, r *http.Request) {
	var req db.Server
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.DiscordGuildID == "" || req.GuildName == "" {
		jsonError(w, "discordGuildId and guildName are required", http.StatusBadRequest)
		return
	}

	id, err := s.db.CreateServer(r.Context(), &req)
	if err != nil {
		log.Printf("API: create server: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	server, _ := s.db.GetServer(r.Context(), id)
	if server != nil {
		jsonOK(w, server)
	} else {
		jsonOK(w, map[string]string{"id": id})
	}
}

func (s *Server) handleDeleteServer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("serverID")
	if err := s.db.DeleteServer(r.Context(), id); err != nil {
		log.Printf("API: delete server: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleBotInviteLink(w http.ResponseWriter, r *http.Request) {
	clientID := s.cfg.DiscordClientID
	if clientID == "" {
		jsonError(w, "DISCORD_CLIENT_ID not configured", http.StatusServiceUnavailable)
		return
	}
	url := fmt.Sprintf("https://discord.com/api/oauth2/authorize?client_id=%s&scope=bot+applications.commands&permissions=268437574", clientID)
	jsonOK(w, map[string]string{"url": url})
}
