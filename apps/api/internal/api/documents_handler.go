package api

import (
	"encoding/json"
	"log"
	"net/http"

	"phantomcrm-api/internal/db"
)

type createDocumentRequest struct {
	OrgID          string `json:"orgId"`
	AgentDiscordID string `json:"agentDiscordId"`
	UploadedBy     string `json:"uploadedBy"`
	Filename       string `json:"filename"`
	FileURL        string `json:"fileUrl"`
	Category       string `json:"category"`
	FileSize       int64  `json:"fileSize"`
	MimeType       string `json:"mimeType"`
}

func (s *Server) handleListDocuments(w http.ResponseWriter, r *http.Request) {
	agentFilter := r.URL.Query().Get("agent")

	docs, err := s.db.ListDocuments(r.Context(), agentFilter)
	if err != nil {
		log.Printf("API: failed to list documents: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if docs == nil {
		docs = []db.Document{}
	}
	jsonOK(w, docs)
}

func (s *Server) handleCreateDocument(w http.ResponseWriter, r *http.Request) {
	var req createDocumentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Filename == "" || req.FileURL == "" {
		jsonError(w, "filename and fileUrl are required", http.StatusBadRequest)
		return
	}

	doc := db.Document{
		OrgID:          req.OrgID,
		AgentDiscordID: req.AgentDiscordID,
		UploadedBy:     req.UploadedBy,
		Filename:       req.Filename,
		FileURL:        req.FileURL,
		Category:       req.Category,
		FileSize:       req.FileSize,
		MimeType:       req.MimeType,
	}

	id, err := s.db.CreateDocument(r.Context(), doc)
	if err != nil {
		log.Printf("API: failed to create document: %v", err)
		jsonError(w, "failed to create document", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": id, "status": "created"})
}

func (s *Server) handleGetDocument(w http.ResponseWriter, r *http.Request) {
	documentID := r.PathValue("documentID")
	if documentID == "" {
		jsonError(w, "missing documentID", http.StatusBadRequest)
		return
	}

	doc, err := s.db.GetDocument(r.Context(), documentID)
	if err != nil {
		log.Printf("API: failed to get document %s: %v", documentID, err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if doc == nil {
		jsonError(w, "document not found", http.StatusNotFound)
		return
	}

	jsonOK(w, doc)
}

func (s *Server) handleDeleteDocument(w http.ResponseWriter, r *http.Request) {
	documentID := r.PathValue("documentID")
	if documentID == "" {
		jsonError(w, "missing documentID", http.StatusBadRequest)
		return
	}

	if err := s.db.DeleteDocument(r.Context(), documentID); err != nil {
		log.Printf("API: failed to delete document %s: %v", documentID, err)
		jsonError(w, "failed to delete document", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"id": documentID, "status": "deleted"})
}
