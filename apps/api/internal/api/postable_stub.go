package api

import "github.com/developerluch/phantomcrm/apps/api/internal/db"

// maybePostcard is a temporary no-op stub to unblock the build on feat/crm-m0-foundations.
// The real implementation lives on another branch (postable integration). Remove this file
// when the postable handler lands on main. Referenced from sales_handler.go:108.
func (s *Server) maybePostcard(_ *db.Sale, _ string) {}
