package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/bwmarrin/discordgo"

	"github.com/developerluch/phantomcrm/apps/api/internal/api"
	"github.com/developerluch/phantomcrm/apps/api/internal/api/websocket"
	"github.com/developerluch/phantomcrm/apps/api/internal/config"
	"github.com/developerluch/phantomcrm/apps/api/internal/db"
	"github.com/developerluch/phantomcrm/apps/api/internal/discord"
	"github.com/developerluch/phantomcrm/apps/api/internal/wavv"
)

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	log.Println("Starting phantomCRM API (standalone)...")

	cfg := config.MustLoad()
	cfg.MustValidateAPI()
	log.Printf("Config loaded — port: %s", cfg.APIPort)

	database, err := db.New(cfg)
	if err != nil {
		log.Fatalf("Database init failed: %v", err)
	}
	defer database.Close()
	log.Println("Database ready")

	hub := websocket.NewHub()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go hub.Run(ctx)

	// Start WAVV sync service
	wavvSyncInterval := 15 * time.Minute
	if v := os.Getenv("WAVV_SYNC_INTERVAL_MIN"); v != "" {
		if mins, err := time.ParseDuration(v + "m"); err == nil {
			wavvSyncInterval = mins
		}
	}
	wavvSvc := wavv.NewSyncService(database, wavvSyncInterval)
	wavvSvc.Start()
	defer wavvSvc.Stop()
	api.SetWavvSync(wavvSvc)
	log.Printf("WAVV sync service started (interval: %s)", wavvSyncInterval)

	// Start API server
	apiServer := api.NewServer(cfg, database, hub)

	// If Discord token is available, register bot-only routes (bulk-import, create agent, etc.)
	if cfg.DiscordToken != "" && cfg.GuildID != "" {
		discordSession, err := discordgo.New("Bot " + cfg.DiscordToken)
		if err != nil {
			log.Printf("WARNING: could not create Discord session for API routes: %v", err)
		} else {
			// We only need REST calls, no gateway connection
			discordAPI := discord.New(cfg, database, hub, discordSession)
			discordAPI.Register(apiServer.Mux(), apiServer.AuthMiddleware())
			log.Println("Discord API routes registered (bulk-import, create agent, member lookup)")
		}
	} else {
		log.Println("DISCORD_TOKEN or GUILD_ID not set — Discord features disabled; using Discord-free agent creation")
		apiServer.RegisterNoDiscordRoutes()
	}

	apiServer.Start(ctx)

	<-ctx.Done()
	log.Println("Shutdown complete")
}
