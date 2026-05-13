package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type Sale struct {
	ID           string     `json:"id"`
	OrgID        *string    `json:"orgId"`
	AgentID      string     `json:"agentId"`
	ClientName   string     `json:"clientName"`
	PolicyType   string     `json:"policyType"`
	Carrier      string     `json:"carrier"`
	Premium      float64    `json:"premium"`
	Commission   *float64   `json:"commission"`
	Status       string     `json:"status"`
	PolicyNumber *string    `json:"policyNumber"`
	SubmittedAt  time.Time  `json:"submittedAt"`
	ApprovedAt   *time.Time `json:"approvedAt"`
	IssuedAt     *time.Time `json:"issuedAt"`
	PaidAt       *time.Time `json:"paidAt"`
	Notes         *string    `json:"notes"`
	ClientDOB     *string    `json:"clientDOB"`
	ClientAddress *string    `json:"clientAddress"`
	ClientPhone   *string    `json:"clientPhone"`
	ClientEmail   *string    `json:"clientEmail"`
	FaceAmount    *float64   `json:"faceAmount"`
	PaymentMode   *string    `json:"paymentMode"`
	Transcript    *string    `json:"transcript"`
	ProductName    *string    `json:"productName"`
	InsuredName    *string    `json:"insuredName"`
	PostcardSentAt *time.Time `json:"postcardSentAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	AgentFirstName string     `json:"agentFirstName"`
	AgentLastName  string     `json:"agentLastName"`
}

type SaleStats struct {
	TotalSales      int             `json:"totalSales"`
	TotalPremium    float64         `json:"totalPremium"`
	TotalCommission float64         `json:"totalCommission"`
	ByStatus        map[string]int  `json:"byStatus"`
	ByPolicyType    map[string]int  `json:"byPolicyType"`
	ThisMonth       SaleStatsPeriod `json:"thisMonth"`
	LastMonth       SaleStatsPeriod `json:"lastMonth"`
}

type SaleStatsPeriod struct {
	Count   int     `json:"count"`
	Premium float64 `json:"premium"`
}

func scanSale(scanner interface{ Scan(...interface{}) error }) (*Sale, error) {
	var s Sale
	var orgID, policyNumber, notes sql.NullString
	var clientDOB, clientAddress, clientPhone, clientEmail, paymentMode, transcript, productName sql.NullString
	var insuredName sql.NullString
	var commission sql.NullFloat64
	var faceAmount sql.NullFloat64
	var approvedAt, issuedAt, paidAt sql.NullTime
	var postcardSentAt sql.NullTime
	err := scanner.Scan(&s.ID, &orgID, &s.AgentID, &s.ClientName, &s.PolicyType, &s.Carrier,
		&s.Premium, &commission, &s.Status, &policyNumber,
		&s.SubmittedAt, &approvedAt, &issuedAt, &paidAt, &notes,
		&clientDOB, &clientAddress, &clientPhone, &clientEmail, &faceAmount, &paymentMode, &transcript, &productName,
		&insuredName, &postcardSentAt,
		&s.CreatedAt, &s.UpdatedAt,
		&s.AgentFirstName, &s.AgentLastName)
	if err != nil {
		return nil, err
	}
	s.OrgID = nullStr(orgID)
	s.PolicyNumber = nullStr(policyNumber)
	s.Notes = nullStr(notes)
	s.ClientDOB = nullStr(clientDOB)
	s.ClientAddress = nullStr(clientAddress)
	s.ClientPhone = nullStr(clientPhone)
	s.ClientEmail = nullStr(clientEmail)
	s.PaymentMode = nullStr(paymentMode)
	s.Transcript = nullStr(transcript)
	s.ProductName = nullStr(productName)
	s.InsuredName = nullStr(insuredName)
	if commission.Valid {
		s.Commission = &commission.Float64
	}
	if faceAmount.Valid {
		s.FaceAmount = &faceAmount.Float64
	}
	if approvedAt.Valid {
		s.ApprovedAt = &approvedAt.Time
	}
	if issuedAt.Valid {
		s.IssuedAt = &issuedAt.Time
	}
	if paidAt.Valid {
		s.PaidAt = &paidAt.Time
	}
	if postcardSentAt.Valid {
		s.PostcardSentAt = &postcardSentAt.Time
	}
	return &s, nil
}

const salesCols = `s.id::TEXT, s.org_id::TEXT, s.agent_discord_id, s.client_name, s.policy_type, s.carrier,
		s.premium, s.commission, s.status, s.policy_number,
		s.submitted_at, s.approved_at, s.issued_at, s.paid_at, s.notes,
		s.client_dob, s.client_address, s.client_phone, s.client_email, s.face_amount, s.payment_mode, s.transcript, s.product_name,
		s.insured_name, s.postcard_sent_at,
		s.created_at, s.updated_at,
		COALESCE(oa.first_name, '') AS agent_first_name,
		COALESCE(oa.last_name, '') AS agent_last_name`

const salesFrom = `FROM sales s LEFT JOIN onboarding_agents oa ON oa.discord_id::TEXT = s.agent_discord_id`

func (d *DB) CreateSale(ctx context.Context, s *Sale) (string, error) {
	var id string
	if !s.CreatedAt.IsZero() {
		// Use provided created_at (e.g. policy issue date from bulk import)
		err := d.pool.QueryRowContext(ctx,
			`INSERT INTO sales (org_id, agent_discord_id, client_name, policy_type, carrier, premium, commission, status, policy_number, notes,
			 client_dob, client_address, client_phone, client_email, face_amount, payment_mode, transcript, product_name, insured_name, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20)
			 RETURNING id::TEXT`,
			s.OrgID, s.AgentID, s.ClientName, s.PolicyType, s.Carrier, s.Premium, s.Commission, s.Status, s.PolicyNumber, s.Notes,
			s.ClientDOB, s.ClientAddress, s.ClientPhone, s.ClientEmail, s.FaceAmount, s.PaymentMode, s.Transcript, s.ProductName, s.InsuredName, s.CreatedAt).Scan(&id)
		if err != nil {
			return "", fmt.Errorf("db: create sale: %w", err)
		}
	} else {
		err := d.pool.QueryRowContext(ctx,
			`INSERT INTO sales (org_id, agent_discord_id, client_name, policy_type, carrier, premium, commission, status, policy_number, notes,
			 client_dob, client_address, client_phone, client_email, face_amount, payment_mode, transcript, product_name, insured_name)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
			 RETURNING id::TEXT`,
			s.OrgID, s.AgentID, s.ClientName, s.PolicyType, s.Carrier, s.Premium, s.Commission, s.Status, s.PolicyNumber, s.Notes,
			s.ClientDOB, s.ClientAddress, s.ClientPhone, s.ClientEmail, s.FaceAmount, s.PaymentMode, s.Transcript, s.ProductName, s.InsuredName).Scan(&id)
		if err != nil {
			return "", fmt.Errorf("db: create sale: %w", err)
		}
	}

	// CRM M0 sync (post-commit). Non-fatal on error.
	first, last := SplitClientName(s.ClientName)
	d.crmSyncAfterCreate("sales", id, SourceRow{
		Kind:           "sale",
		SourceID:       id,
		FirstName:      first,
		LastName:       last,
		Email:          derefOr(s.ClientEmail, ""),
		Phone:          derefOr(s.ClientPhone, ""),
		OwnerAgentID:   s.AgentID,
		LifecycleStage: "customer",
		DOB:            derefOr(s.ClientDOB, ""),
		AddressLine1:   derefOr(s.ClientAddress, ""),
	})

	return id, nil
}

func (d *DB) GetSale(ctx context.Context, id string) (*Sale, error) {
	s, err := scanSale(d.pool.QueryRowContext(ctx,
		`SELECT `+salesCols+` `+salesFrom+` WHERE s.id = $1::UUID`, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get sale: %w", err)
	}
	return s, nil
}

type SalesAgg struct {
	TotalPremium float64 `json:"totalPremium"`
	ActiveCount  int     `json:"activeCount"`
}

func (d *DB) ListSales(ctx context.Context, status, agentID, policyType, dateFrom, dateTo string, page int) ([]Sale, int, SalesAgg, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argN := 1

	if status != "" {
		where = append(where, fmt.Sprintf("s.status = $%d", argN))
		args = append(args, status)
		argN++
	}
	if agentID != "" {
		where = append(where, fmt.Sprintf("s.agent_discord_id = $%d", argN))
		args = append(args, agentID)
		argN++
	}
	if policyType != "" {
		where = append(where, fmt.Sprintf("s.policy_type = $%d", argN))
		args = append(args, policyType)
		argN++
	}
	if dateFrom != "" {
		where = append(where, fmt.Sprintf("s.created_at >= $%d", argN))
		args = append(args, dateFrom)
		argN++
	}
	if dateTo != "" {
		where = append(where, fmt.Sprintf("s.created_at <= $%d", argN))
		args = append(args, dateTo+"T23:59:59Z")
		argN++
	}

	whereClause := strings.Join(where, " AND ")
	var total int
	var totalPremium float64
	var activeCount int
	d.pool.QueryRowContext(ctx, "SELECT COUNT(*), COALESCE(SUM(s.premium),0) FROM sales s WHERE "+whereClause, args...).Scan(&total, &totalPremium)
	d.pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM sales s WHERE "+whereClause+" AND LOWER(s.status) IN ('issued','paid','placed','active')", args...).Scan(&activeCount)

	if page < 1 {
		page = 1
	}
	perPage := 25
	offset := (page - 1) * perPage
	args = append(args, perPage, offset)

	agg := SalesAgg{TotalPremium: totalPremium, ActiveCount: activeCount}

	rows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf("SELECT "+salesCols+" "+salesFrom+" WHERE %s ORDER BY s.created_at DESC LIMIT $%d OFFSET $%d",
			whereClause, argN, argN+1), args...)
	if err != nil {
		return nil, 0, agg, fmt.Errorf("db: list sales: %w", err)
	}
	defer rows.Close()

	var result []Sale
	for rows.Next() {
		s, err := scanSale(rows)
		if err != nil {
			return nil, 0, agg, fmt.Errorf("db: scan sale: %w", err)
		}
		result = append(result, *s)
	}
	return result, total, agg, rows.Err()
}

func (d *DB) ListSalesByAgent(ctx context.Context, agentID string, status string) ([]Sale, error) {
	where := "s.agent_discord_id = $1"
	args := []interface{}{agentID}
	if status != "" {
		where += " AND s.status = $2"
		args = append(args, status)
	}

	rows, err := d.pool.QueryContext(ctx,
		"SELECT "+salesCols+" "+salesFrom+" WHERE "+where+" ORDER BY s.created_at DESC", args...)
	if err != nil {
		return nil, fmt.Errorf("db: list agent sales: %w", err)
	}
	defer rows.Close()

	var result []Sale
	for rows.Next() {
		s, err := scanSale(rows)
		if err != nil {
			return nil, fmt.Errorf("db: scan sale: %w", err)
		}
		result = append(result, *s)
	}
	return result, rows.Err()
}

func (d *DB) GetAgentSaleStats(ctx context.Context, agentID string) (*SaleStats, error) {
	stats := &SaleStats{ByStatus: map[string]int{}, ByPolicyType: map[string]int{}}

	d.pool.QueryRowContext(ctx,
		"SELECT COUNT(*), COALESCE(SUM(premium),0), COALESCE(SUM(commission),0) FROM sales WHERE agent_discord_id = $1",
		agentID).Scan(&stats.TotalSales, &stats.TotalPremium, &stats.TotalCommission)

	rows, err := d.pool.QueryContext(ctx, "SELECT status, COUNT(*) FROM sales WHERE agent_discord_id = $1 GROUP BY status", agentID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var k string
			var v int
			rows.Scan(&k, &v)
			stats.ByStatus[k] = v
		}
	}

	rows2, err := d.pool.QueryContext(ctx, "SELECT policy_type, COUNT(*) FROM sales WHERE agent_discord_id = $1 GROUP BY policy_type", agentID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var k string
			var v int
			rows2.Scan(&k, &v)
			stats.ByPolicyType[k] = v
		}
	}

	d.pool.QueryRowContext(ctx,
		"SELECT COUNT(*), COALESCE(SUM(premium),0) FROM sales WHERE agent_discord_id = $1 AND created_at >= date_trunc('month', NOW())",
		agentID).Scan(&stats.ThisMonth.Count, &stats.ThisMonth.Premium)

	d.pool.QueryRowContext(ctx,
		"SELECT COUNT(*), COALESCE(SUM(premium),0) FROM sales WHERE agent_discord_id = $1 AND created_at >= date_trunc('month', NOW()) - INTERVAL '1 month' AND created_at < date_trunc('month', NOW())",
		agentID).Scan(&stats.LastMonth.Count, &stats.LastMonth.Premium)

	return stats, nil
}

func (d *DB) UpdateSale(ctx context.Context, id string, updates map[string]interface{}) error {
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argN := 1

	fieldMap := map[string]string{
		"clientName": "client_name", "policyType": "policy_type", "carrier": "carrier",
		"premium": "premium", "commission": "commission", "status": "status",
		"policyNumber": "policy_number", "notes": "notes",
		"clientDOB": "client_dob", "clientAddress": "client_address", "clientPhone": "client_phone",
		"clientEmail": "client_email", "faceAmount": "face_amount", "paymentMode": "payment_mode",
		"productName": "product_name", "insuredName": "insured_name",
		"submittedAt": "submitted_at", "approvedAt": "approved_at", "issuedAt": "issued_at", "paidAt": "paid_at",
		"postcardSentAt": "postcard_sent_at",
	}

	for jsonKey, col := range fieldMap {
		if v, ok := updates[jsonKey]; ok {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, argN))
			args = append(args, v)
			argN++
		}
	}

	args = append(args, id)
	_, err := d.pool.ExecContext(ctx,
		fmt.Sprintf("UPDATE sales SET %s WHERE id = $%d::UUID", strings.Join(sets, ", "), argN), args...)
	if err != nil {
		return fmt.Errorf("db: update sale: %w", err)
	}
	return nil
}

func (d *DB) DeleteSale(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM sales WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: delete sale: %w", err)
	}
	return nil
}

// PipelineBucket is one row in the PipelineSummary contract.
type PipelineBucket struct {
	Count   int     `json:"count"`
	TotalAP float64 `json:"totalAP"`
}

// PipelineSummary aggregates sales by status and computes derived ratios.
// Matches the frontend src/types/portal.ts:PipelineSummary contract.
type PipelineSummary struct {
	Submitted        PipelineBucket `json:"submitted"`
	Approved         PipelineBucket `json:"approved"`
	Issued           PipelineBucket `json:"issued"`
	OnBooks          PipelineBucket `json:"onBooks"`
	Paid             PipelineBucket `json:"paid"`
	Cancelled        PipelineBucket `json:"cancelled"`
	CloseRate        float64        `json:"closeRate"`
	PersistencyRate  float64        `json:"persistencyRate"`
}

// GetSalesPipelineSummary returns count + total premium grouped by status,
// optionally scoped to a specific agent and/or date range.
func (d *DB) GetSalesPipelineSummary(ctx context.Context, agentID, dateFrom, dateTo string) (*PipelineSummary, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argN := 1
	if agentID != "" {
		where = append(where, fmt.Sprintf("agent_discord_id = $%d", argN))
		args = append(args, agentID)
		argN++
	}
	if dateFrom != "" {
		where = append(where, fmt.Sprintf("created_at >= $%d", argN))
		args = append(args, dateFrom)
		argN++
	}
	if dateTo != "" {
		where = append(where, fmt.Sprintf("created_at <= $%d", argN))
		args = append(args, dateTo+"T23:59:59Z")
		argN++
	}
	whereClause := strings.Join(where, " AND ")

	rows, err := d.pool.QueryContext(ctx,
		"SELECT LOWER(status), COUNT(*), COALESCE(SUM(premium),0) FROM sales WHERE "+whereClause+" GROUP BY LOWER(status)", args...)
	if err != nil {
		return nil, fmt.Errorf("db: sales pipeline: %w", err)
	}
	defer rows.Close()

	summary := &PipelineSummary{}
	for rows.Next() {
		var status string
		var b PipelineBucket
		if err := rows.Scan(&status, &b.Count, &b.TotalAP); err != nil {
			return nil, fmt.Errorf("db: sales pipeline scan: %w", err)
		}
		switch status {
		case "submitted":
			summary.Submitted = b
		case "approved":
			summary.Approved = b
		case "issued":
			summary.Issued = b
		case "active", "placed", "on_books", "on-books":
			// Treat "active"/"placed" as on-books.
			summary.OnBooks.Count += b.Count
			summary.OnBooks.TotalAP += b.TotalAP
		case "paid":
			summary.Paid = b
		case "cancelled", "canceled":
			summary.Cancelled.Count += b.Count
			summary.Cancelled.TotalAP += b.TotalAP
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("db: sales pipeline rows: %w", err)
	}

	// closeRate = issued / submitted (when submitted > 0)
	if summary.Submitted.Count > 0 {
		summary.CloseRate = float64(summary.Issued.Count) / float64(summary.Submitted.Count)
	}
	// persistencyRate = on-books / issued (when issued > 0)
	if summary.Issued.Count > 0 {
		summary.PersistencyRate = float64(summary.OnBooks.Count) / float64(summary.Issued.Count)
	}
	return summary, nil
}

// SalesAnalyticsByPolicyType is one row of the by-policy-type slice.
type SalesAnalyticsByPolicyType struct {
	Type    string  `json:"type"`
	Count   int     `json:"count"`
	Premium float64 `json:"premium"`
}

// SalesAnalyticsByMonth is one row of the by-month slice.
type SalesAnalyticsByMonth struct {
	Month     string  `json:"month"`
	Submitted int     `json:"submitted"`
	Approved  int     `json:"approved"`
	Issued    int     `json:"issued"`
	PremiumAP float64 `json:"premiumAP"`
}

// SalesAnalyticsByLeadSource — stub; sales table has no lead_source column yet.
type SalesAnalyticsByLeadSource struct {
	Source     string  `json:"source"`
	Count      int     `json:"count"`
	CloseRate  float64 `json:"closeRate"`
	AvgPremium float64 `json:"avgPremium"`
}

// SalesAnalyticsTopAgent — top agents by issued AP.
type SalesAnalyticsTopAgent struct {
	AgentID    string  `json:"agentId"`
	AgentName  string  `json:"agentName"`
	IssuedAP   float64 `json:"issuedAP"`
	Commission float64 `json:"commission"`
}

// SalesAnalytics is the response shape for GET /portal/sales/analytics.
// Matches the frontend src/types/portal.ts:SalesAnalytics contract.
type SalesAnalytics struct {
	ByPolicyType []SalesAnalyticsByPolicyType `json:"byPolicyType"`
	ByMonth      []SalesAnalyticsByMonth      `json:"byMonth"`
	ByLeadSource []SalesAnalyticsByLeadSource `json:"byLeadSource"`
	TopAgents    []SalesAnalyticsTopAgent     `json:"topAgents"`
}

// GetSalesAnalytics returns the aggregated analytics payload. ByLeadSource is
// returned empty until the sales schema gets a lead_source column.
func (d *DB) GetSalesAnalytics(ctx context.Context, agentID, dateFrom, dateTo string) (*SalesAnalytics, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argN := 1
	if agentID != "" {
		where = append(where, fmt.Sprintf("s.agent_discord_id = $%d", argN))
		args = append(args, agentID)
		argN++
	}
	if dateFrom != "" {
		where = append(where, fmt.Sprintf("s.created_at >= $%d", argN))
		args = append(args, dateFrom)
		argN++
	}
	if dateTo != "" {
		where = append(where, fmt.Sprintf("s.created_at <= $%d", argN))
		args = append(args, dateTo+"T23:59:59Z")
		argN++
	}
	whereClause := strings.Join(where, " AND ")

	result := &SalesAnalytics{
		ByPolicyType: []SalesAnalyticsByPolicyType{},
		ByMonth:      []SalesAnalyticsByMonth{},
		ByLeadSource: []SalesAnalyticsByLeadSource{},
		TopAgents:    []SalesAnalyticsTopAgent{},
	}

	// By policy type
	rows, err := d.pool.QueryContext(ctx,
		"SELECT policy_type, COUNT(*), COALESCE(SUM(premium),0) FROM sales s WHERE "+whereClause+" GROUP BY policy_type ORDER BY 2 DESC", args...)
	if err != nil {
		return nil, fmt.Errorf("db: analytics by policy type: %w", err)
	}
	for rows.Next() {
		var r SalesAnalyticsByPolicyType
		if err := rows.Scan(&r.Type, &r.Count, &r.Premium); err == nil {
			result.ByPolicyType = append(result.ByPolicyType, r)
		}
	}
	rows.Close()

	// By month (last 12 months)
	rows, err = d.pool.QueryContext(ctx,
		"SELECT TO_CHAR(date_trunc('month', s.created_at), 'YYYY-MM') AS m, "+
			"COUNT(*) FILTER (WHERE LOWER(s.status) = 'submitted'), "+
			"COUNT(*) FILTER (WHERE LOWER(s.status) = 'approved'), "+
			"COUNT(*) FILTER (WHERE LOWER(s.status) = 'issued'), "+
			"COALESCE(SUM(s.premium),0) "+
			"FROM sales s WHERE "+whereClause+" GROUP BY 1 ORDER BY 1 DESC LIMIT 12", args...)
	if err != nil {
		return nil, fmt.Errorf("db: analytics by month: %w", err)
	}
	for rows.Next() {
		var r SalesAnalyticsByMonth
		if err := rows.Scan(&r.Month, &r.Submitted, &r.Approved, &r.Issued, &r.PremiumAP); err == nil {
			result.ByMonth = append(result.ByMonth, r)
		}
	}
	rows.Close()

	// Top agents (by issued AP)
	rows, err = d.pool.QueryContext(ctx,
		"SELECT s.agent_discord_id, "+
			"COALESCE(oa.first_name || ' ' || oa.last_name, s.agent_discord_id) AS agent_name, "+
			"COALESCE(SUM(s.premium) FILTER (WHERE LOWER(s.status) IN ('issued','paid','active','placed')), 0), "+
			"COALESCE(SUM(s.commission), 0) "+
			"FROM sales s LEFT JOIN onboarding_agents oa ON oa.discord_id::TEXT = s.agent_discord_id "+
			"WHERE "+whereClause+" GROUP BY s.agent_discord_id, oa.first_name, oa.last_name "+
			"ORDER BY 3 DESC LIMIT 10", args...)
	if err != nil {
		return nil, fmt.Errorf("db: analytics top agents: %w", err)
	}
	for rows.Next() {
		var r SalesAnalyticsTopAgent
		if err := rows.Scan(&r.AgentID, &r.AgentName, &r.IssuedAP, &r.Commission); err == nil {
			result.TopAgents = append(result.TopAgents, r)
		}
	}
	rows.Close()

	return result, nil
}
