package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/ledongthuc/pdf"

	"github.com/developerluch/phantomcrm/apps/api/internal/db"
)

type parseSalesCSVRowsRequest struct {
	Rows []map[string]string `json:"rows"`
}

type parseSalesCSVRowsResponse struct {
	Rows       []saleImportFields   `json:"rows"`
	Confidence []map[string]float64 `json:"confidence"`
}

type parseSalesDocumentResponse struct {
	Fields         saleImportFields   `json:"fields"`
	Confidence     map[string]float64 `json:"confidence"`
	RawTextExcerpt string             `json:"raw_text_excerpt"`
}

type bulkSalesImportRequest struct {
	Sales []saleImportFields `json:"sales"`
}

type bulkSalesImportResponse struct {
	Created    int                   `json:"created"`
	Skipped    int                   `json:"skipped"`
	Duplicates []saleImportDuplicate `json:"duplicates"`
}

type saleImportDuplicate struct {
	PolicyNumber string `json:"policyNumber"`
	ClientName   string `json:"clientName"`
}

type saleImportRowError struct {
	Row     int    `json:"row"`
	Field   string `json:"field"`
	Message string `json:"message"`
}

type saleImportFields struct {
	AgentID       string   `json:"agentId,omitempty"`
	ClientName    string   `json:"clientName,omitempty"`
	PolicyType    string   `json:"policyType,omitempty"`
	Carrier       string   `json:"carrier,omitempty"`
	Premium       *float64 `json:"premium,omitempty"`
	Commission    *float64 `json:"commission,omitempty"`
	Status        string   `json:"status,omitempty"`
	PolicyNumber  *string  `json:"policyNumber,omitempty"`
	Notes         *string  `json:"notes,omitempty"`
	ClientDOB     *string  `json:"clientDOB,omitempty"`
	ClientAddress *string  `json:"clientAddress,omitempty"`
	ClientPhone   *string  `json:"clientPhone,omitempty"`
	ClientEmail   *string  `json:"clientEmail,omitempty"`
	FaceAmount    *float64 `json:"faceAmount,omitempty"`
	PaymentMode   *string  `json:"paymentMode,omitempty"`
	ProductName   *string  `json:"productName,omitempty"`
	InsuredName   *string  `json:"insuredName,omitempty"`
}

func (s *Server) handleParseSalesCSVRows(w http.ResponseWriter, r *http.Request) {
	defaultAgentID, ok := s.resolveSaleAgentID(w, r, "")
	if !ok {
		return
	}

	var req parseSalesCSVRowsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.Rows) == 0 {
		jsonOK(w, parseSalesCSVRowsResponse{Rows: []saleImportFields{}, Confidence: []map[string]float64{}})
		return
	}

	rows := make([]saleImportFields, 0, len(req.Rows))
	confidence := make([]map[string]float64, 0, len(req.Rows))
	for _, raw := range req.Rows {
		row, conf := normalizeSalesCSVRow(raw, defaultAgentID)
		rows = append(rows, row)
		confidence = append(confidence, conf)
	}

	jsonOK(w, parseSalesCSVRowsResponse{Rows: rows, Confidence: confidence})
}

func (s *Server) handleParseSalesDocument(w http.ResponseWriter, r *http.Request) {
	defaultAgentID, ok := s.resolveSaleAgentID(w, r, "")
	if !ok {
		return
	}
	if err := r.ParseMultipartForm(12 << 20); err != nil {
		jsonError(w, "invalid multipart form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	contentType := strings.ToLower(header.Header.Get("Content-Type"))
	var text string
	switch {
	case ext == ".pdf" || strings.Contains(contentType, "pdf"):
		text, err = extractPDFText(file)
	case ext == ".txt" || strings.HasPrefix(contentType, "text/"):
		var b []byte
		b, err = io.ReadAll(io.LimitReader(file, 2<<20))
		text = string(b)
	default:
		jsonError(w, "unsupported document type", http.StatusUnsupportedMediaType)
		return
	}
	if err != nil {
		log.Printf("sales-import: document parse error: %v", err)
		jsonError(w, "failed to parse document", http.StatusInternalServerError)
		return
	}

	text = strings.TrimSpace(text)
	if text == "" {
		writeJSONStatus(w, http.StatusUnprocessableEntity, map[string]string{
			"error": "No embedded text was found in this PDF. Scanned PDFs require OCR, which is not supported yet.",
		})
		return
	}

	fields, confidence := normalizeSalesText(text, defaultAgentID)
	jsonOK(w, parseSalesDocumentResponse{
		Fields:         fields,
		Confidence:     confidence,
		RawTextExcerpt: excerpt(text, 1200),
	})
}

func (s *Server) handleBulkImportSales(w http.ResponseWriter, r *http.Request) {
	defaultAgentID, ok := s.resolveSaleAgentID(w, r, "")
	if !ok {
		return
	}

	var req bulkSalesImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.Sales) == 0 {
		jsonError(w, "sales are required", http.StatusBadRequest)
		return
	}

	normalized, rowErrors, err := s.validateSalesImportRows(r, req.Sales, defaultAgentID)
	if err != nil {
		log.Printf("sales-import: validate rows: %v", err)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if len(rowErrors) > 0 {
		writeJSONStatus(w, http.StatusBadRequest, map[string]interface{}{
			"error":  "validation failed",
			"errors": rowErrors,
		})
		return
	}

	resp := bulkSalesImportResponse{Duplicates: []saleImportDuplicate{}}
	for i := range normalized {
		row := normalized[i]
		policyNumber := derefImportString(row.PolicyNumber)
		if policyNumber != "" {
			duplicate, err := s.db.SalePolicyDuplicateExists(r.Context(), row.AgentID, policyNumber)
			if err != nil {
				log.Printf("sales-import: duplicate check: %v", err)
				jsonError(w, "database error", http.StatusInternalServerError)
				return
			}
			if duplicate {
				resp.Skipped++
				resp.Duplicates = append(resp.Duplicates, saleImportDuplicate{
					PolicyNumber: policyNumber,
					ClientName:   row.ClientName,
				})
				continue
			}
		}

		if _, err := s.db.CreateSale(r.Context(), &row); err != nil {
			log.Printf("sales-import: create sale: %v", err)
			jsonError(w, "database error", http.StatusInternalServerError)
			return
		}
		resp.Created++
	}

	jsonOK(w, resp)
}

func (s *Server) validateSalesImportRows(r *http.Request, rows []saleImportFields, defaultAgentID string) ([]db.Sale, []saleImportRowError, error) {
	agentCache := map[string]bool{}
	out := make([]db.Sale, 0, len(rows))
	rowErrors := []saleImportRowError{}

	for i, raw := range rows {
		rowNumber := i + 1
		raw.AgentID = strings.TrimSpace(raw.AgentID)
		if raw.AgentID == "" {
			raw.AgentID = defaultAgentID
		}

		if raw.AgentID == "" {
			rowErrors = append(rowErrors, saleImportRowError{Row: rowNumber, Field: "agentId", Message: "Agent ID is required"})
		} else {
			valid, ok := agentCache[raw.AgentID]
			if !ok {
				exists, err := s.db.AgentIDExists(r.Context(), raw.AgentID)
				if err != nil {
					return nil, nil, err
				}
				valid = exists
				agentCache[raw.AgentID] = valid
			}
			if !valid {
				rowErrors = append(rowErrors, saleImportRowError{Row: rowNumber, Field: "agentId", Message: "Unknown Agent ID"})
			}
		}

		raw.ClientName = strings.TrimSpace(raw.ClientName)
		raw.PolicyType = strings.TrimSpace(raw.PolicyType)
		raw.Carrier = strings.TrimSpace(raw.Carrier)
		if raw.ClientName == "" {
			rowErrors = append(rowErrors, saleImportRowError{Row: rowNumber, Field: "clientName", Message: "Client name is required"})
		}
		if raw.PolicyType == "" {
			rowErrors = append(rowErrors, saleImportRowError{Row: rowNumber, Field: "policyType", Message: "Policy type is required"})
		}
		if raw.Carrier == "" {
			rowErrors = append(rowErrors, saleImportRowError{Row: rowNumber, Field: "carrier", Message: "Carrier is required"})
		}
		if raw.Premium == nil || *raw.Premium <= 0 {
			rowErrors = append(rowErrors, saleImportRowError{Row: rowNumber, Field: "premium", Message: "Premium must be greater than 0"})
		}

		sale := raw.toDBSale()
		if sale.Status == "" {
			sale.Status = "submitted"
		}
		if au := GetAuthUser(r); au != nil && au.OrgID != "" {
			sale.OrgID = &au.OrgID
		}
		out = append(out, sale)
	}

	return out, rowErrors, nil
}

func (f saleImportFields) toDBSale() db.Sale {
	premium := 0.0
	if f.Premium != nil {
		premium = *f.Premium
	}
	return db.Sale{
		AgentID:       strings.TrimSpace(f.AgentID),
		ClientName:    strings.TrimSpace(f.ClientName),
		PolicyType:    strings.TrimSpace(f.PolicyType),
		Carrier:       strings.TrimSpace(f.Carrier),
		Premium:       premium,
		Commission:    f.Commission,
		Status:        strings.TrimSpace(f.Status),
		PolicyNumber:  cleanStringPtr(f.PolicyNumber),
		Notes:         cleanStringPtr(f.Notes),
		ClientDOB:     cleanStringPtr(f.ClientDOB),
		ClientAddress: cleanStringPtr(f.ClientAddress),
		ClientPhone:   cleanStringPtr(f.ClientPhone),
		ClientEmail:   cleanStringPtr(f.ClientEmail),
		FaceAmount:    f.FaceAmount,
		PaymentMode:   cleanStringPtr(f.PaymentMode),
		ProductName:   cleanStringPtr(f.ProductName),
		InsuredName:   cleanStringPtr(f.InsuredName),
	}
}

func normalizeSalesCSVRow(raw map[string]string, defaultAgentID string) (saleImportFields, map[string]float64) {
	row := saleImportFields{AgentID: defaultAgentID, Status: "submitted"}
	confidence := map[string]float64{}

	for header, value := range raw {
		field := salesImportFieldForHeader(header)
		if field == "" {
			continue
		}
		applySalesImportValue(&row, confidence, field, value, 0.9)
	}
	if strings.TrimSpace(row.AgentID) == "" {
		row.AgentID = defaultAgentID
	}
	if row.AgentID == defaultAgentID && defaultAgentID != "" {
		confidence["agentId"] = 0.65
	}
	return row, confidence
}

func normalizeSalesText(text, defaultAgentID string) (saleImportFields, map[string]float64) {
	row := saleImportFields{AgentID: defaultAgentID, Status: "submitted"}
	confidence := map[string]float64{"agentId": 0.65}
	for _, line := range strings.Split(text, "\n") {
		parts := regexp.MustCompile(`[:=\t]`).Split(line, 2)
		if len(parts) != 2 {
			continue
		}
		field := salesImportFieldForHeader(parts[0])
		if field == "" {
			continue
		}
		applySalesImportValue(&row, confidence, field, parts[1], 0.75)
	}

	if row.ClientEmail == nil {
		if match := regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`).FindString(text); match != "" {
			row.ClientEmail = saleImportStringPtr(match)
			confidence["clientEmail"] = 0.7
		}
	}
	if row.ClientPhone == nil {
		if match := regexp.MustCompile(`\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}`).FindString(text); match != "" {
			row.ClientPhone = saleImportStringPtr(match)
			confidence["clientPhone"] = 0.65
		}
	}
	if row.Premium == nil {
		if match := regexp.MustCompile(`(?i)(premium|ap|annual premium)\D{0,12}(\$?[0-9][0-9,]*(?:\.[0-9]{1,2})?)`).FindStringSubmatch(text); len(match) == 3 {
			if amount, ok := parseImportAmount(match[2]); ok {
				row.Premium = &amount
				confidence["premium"] = 0.6
			}
		}
	}
	return row, confidence
}

func applySalesImportValue(row *saleImportFields, confidence map[string]float64, field, raw string, score float64) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return
	}
	switch field {
	case "agentId":
		row.AgentID = value
	case "clientName":
		row.ClientName = value
	case "policyType":
		row.PolicyType = normalizePolicyType(value)
	case "carrier":
		row.Carrier = value
	case "premium":
		if amount, ok := parseImportAmount(value); ok {
			row.Premium = &amount
		} else {
			return
		}
	case "commission":
		if amount, ok := parseImportAmount(value); ok {
			row.Commission = &amount
		} else {
			return
		}
	case "status":
		row.Status = strings.ToLower(strings.ReplaceAll(value, " ", "_"))
	case "policyNumber":
		row.PolicyNumber = saleImportStringPtr(value)
	case "notes":
		row.Notes = saleImportStringPtr(value)
	case "clientDOB":
		row.ClientDOB = saleImportStringPtr(value)
	case "clientAddress":
		row.ClientAddress = saleImportStringPtr(value)
	case "clientPhone":
		row.ClientPhone = saleImportStringPtr(value)
	case "clientEmail":
		row.ClientEmail = saleImportStringPtr(value)
	case "faceAmount":
		if amount, ok := parseImportAmount(value); ok {
			row.FaceAmount = &amount
		} else {
			return
		}
	case "paymentMode":
		mode := normalizePaymentMode(value)
		row.PaymentMode = &mode
	case "productName":
		row.ProductName = saleImportStringPtr(value)
	case "insuredName":
		row.InsuredName = saleImportStringPtr(value)
	}
	confidence[field] = score
}

func salesImportFieldForHeader(header string) string {
	switch normalizeImportHeader(header) {
	case "agentid", "agent", "writingagent", "producer", "producerid", "advisor", "advisorid":
		return "agentId"
	case "client", "clientname", "customername", "policyholder", "applicant", "insured", "insuredname":
		return "clientName"
	case "dob", "dateofbirth", "clientdob", "birthdate":
		return "clientDOB"
	case "phone", "clientphone", "telephone", "mobile", "cell":
		return "clientPhone"
	case "email", "clientemail":
		return "clientEmail"
	case "address", "clientaddress", "mailingaddress":
		return "clientAddress"
	case "policytype", "type", "lineofbusiness", "lob", "producttype":
		return "policyType"
	case "carrier", "insurancecompany", "company", "insurer":
		return "carrier"
	case "premium", "annualpremium", "ap", "modalpremium":
		return "premium"
	case "commission", "commissiondollars", "commissionamount":
		return "commission"
	case "status", "salestatus", "policystatus":
		return "status"
	case "policynumber", "policy", "policyid", "contractnumber":
		return "policyNumber"
	case "faceamount", "coverageamount", "deathbenefit", "benefitamount":
		return "faceAmount"
	case "paymentmode", "mode", "billingmode", "frequency":
		return "paymentMode"
	case "product", "productname", "plan":
		return "productName"
	case "notes", "note", "comments":
		return "notes"
	default:
		return ""
	}
}

func normalizeImportHeader(header string) string {
	return regexp.MustCompile(`[^a-z0-9]+`).ReplaceAllString(strings.ToLower(strings.TrimSpace(header)), "")
}

func parseImportAmount(value string) (float64, bool) {
	cleaned := strings.TrimSpace(value)
	cleaned = strings.ReplaceAll(cleaned, "$", "")
	cleaned = strings.ReplaceAll(cleaned, ",", "")
	cleaned = strings.ReplaceAll(cleaned, "%", "")
	amount, err := strconv.ParseFloat(cleaned, 64)
	return amount, err == nil
}

func normalizePolicyType(value string) string {
	key := normalizeImportHeader(value)
	switch key {
	case "life", "lifefinalexpense", "termlife", "wholelife", "universallife":
		return "life"
	case "finalexpense", "fe":
		return "final_expense"
	case "health", "medical":
		return "health"
	case "medicare", "medicareadvantage", "mapd", "supplement", "medsupp":
		return "medicare"
	case "auto":
		return "auto"
	case "home", "homeowners":
		return "home"
	case "annuity", "annuities":
		return "annuity"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func normalizePaymentMode(value string) string {
	key := normalizeImportHeader(value)
	switch key {
	case "monthly", "month", "m":
		return "monthly"
	case "annual", "annually", "yearly", "year", "a":
		return "annual"
	case "quarterly", "quarter", "q":
		return "quarterly"
	case "semiannual", "semiannually", "semiannualy", "semi", "s":
		return "semi-annual"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func extractPDFText(src io.Reader) (string, error) {
	tmp, err := os.CreateTemp("", "phantomcrm-sale-import-*.pdf")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	if _, err := io.Copy(tmp, io.LimitReader(src, 10<<20)); err != nil {
		return "", err
	}
	if _, err := tmp.Seek(0, io.SeekStart); err != nil {
		return "", err
	}

	file, reader, err := pdf.Open(tmp.Name())
	if err != nil {
		return "", err
	}
	defer file.Close()

	plain, err := reader.GetPlainText()
	if err != nil {
		return "", err
	}
	b, err := io.ReadAll(io.LimitReader(plain, 2<<20))
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func writeJSONStatus(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func cleanStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	cleaned := strings.TrimSpace(*value)
	if cleaned == "" {
		return nil
	}
	return &cleaned
}

func derefImportString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func saleImportStringPtr(value string) *string {
	value = strings.TrimSpace(value)
	return &value
}

func excerpt(value string, max int) string {
	value = strings.TrimSpace(value)
	if len(value) <= max {
		return value
	}
	return value[:max]
}
