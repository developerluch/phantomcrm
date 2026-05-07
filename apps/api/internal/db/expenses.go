package db

import (
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"strings"
	"time"
)

type Expense struct {
	ID             string    `json:"id"`
	OrgID          *string   `json:"orgId"`
	Category       string    `json:"category"`
	Description    string    `json:"description"`
	Amount         float64   `json:"amount"`
	ExpenseDate    string    `json:"expenseDate"`
	AgentDiscordID *string   `json:"agentDiscordId"`
	ReceiptURL     *string   `json:"receiptUrl"`
	CreatedBy      *string   `json:"createdBy"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func (d *DB) CreateExpense(ctx context.Context, e *Expense) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO expenses (org_id, category, description, amount, expense_date, agent_discord_id, receipt_url, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id::TEXT`,
		e.OrgID, e.Category, e.Description, e.Amount, e.ExpenseDate, e.AgentDiscordID, e.ReceiptURL, e.CreatedBy).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create expense: %w", err)
	}
	return id, nil
}

func (d *DB) GetExpense(ctx context.Context, id string) (*Expense, error) {
	var e Expense
	var orgID, agentID, receiptURL, createdBy sql.NullString
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, org_id::TEXT, category, description, amount, expense_date::TEXT, agent_discord_id, receipt_url, created_by, created_at, updated_at
		 FROM expenses WHERE id = $1::UUID`, id).Scan(
		&e.ID, &orgID, &e.Category, &e.Description, &e.Amount, &e.ExpenseDate,
		&agentID, &receiptURL, &createdBy, &e.CreatedAt, &e.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get expense: %w", err)
	}
	e.OrgID = nullStr(orgID)
	e.AgentDiscordID = nullStr(agentID)
	e.ReceiptURL = nullStr(receiptURL)
	e.CreatedBy = nullStr(createdBy)
	return &e, nil
}

func (d *DB) ListExpenses(ctx context.Context, category, agentID, dateFrom, dateTo string, page int) ([]Expense, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argN := 1

	if category != "" {
		where = append(where, fmt.Sprintf("category = $%d", argN))
		args = append(args, category)
		argN++
	}
	if agentID != "" {
		where = append(where, fmt.Sprintf("agent_discord_id = $%d", argN))
		args = append(args, agentID)
		argN++
	}
	if dateFrom != "" {
		where = append(where, fmt.Sprintf("expense_date >= $%d::DATE", argN))
		args = append(args, dateFrom)
		argN++
	}
	if dateTo != "" {
		where = append(where, fmt.Sprintf("expense_date <= $%d::DATE", argN))
		args = append(args, dateTo)
		argN++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	d.pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM expenses WHERE "+whereClause, args...).Scan(&total)

	if page < 1 {
		page = 1
	}
	perPage := 25
	offset := (page - 1) * perPage
	args = append(args, perPage, offset)

	rows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf(`SELECT id::TEXT, org_id::TEXT, category, description, amount, expense_date::TEXT, agent_discord_id, receipt_url, created_by, created_at, updated_at
		 FROM expenses WHERE %s ORDER BY expense_date DESC LIMIT $%d OFFSET $%d`, whereClause, argN, argN+1), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("db: list expenses: %w", err)
	}
	defer rows.Close()

	var result []Expense
	for rows.Next() {
		var e Expense
		var orgID, agentID, receiptURL, createdBy sql.NullString
		if err := rows.Scan(&e.ID, &orgID, &e.Category, &e.Description, &e.Amount, &e.ExpenseDate,
			&agentID, &receiptURL, &createdBy, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("db: scan expense: %w", err)
		}
		e.OrgID = nullStr(orgID)
		e.AgentDiscordID = nullStr(agentID)
		e.ReceiptURL = nullStr(receiptURL)
		e.CreatedBy = nullStr(createdBy)
		result = append(result, e)
	}
	return result, total, rows.Err()
}

func (d *DB) UpdateExpense(ctx context.Context, id string, updates map[string]interface{}) error {
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argN := 1

	fieldMap := map[string]string{
		"category": "category", "description": "description", "amount": "amount",
		"expenseDate": "expense_date", "agentDiscordId": "agent_discord_id",
		"receiptUrl": "receipt_url",
	}

	for jsonKey, col := range fieldMap {
		if v, ok := updates[jsonKey]; ok {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, argN))
			args = append(args, v)
			argN++
		}
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE expenses SET %s WHERE id = $%d::UUID", strings.Join(sets, ", "), argN)
	_, err := d.pool.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("db: update expense: %w", err)
	}
	return nil
}

func (d *DB) DeleteExpense(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM expenses WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: delete expense: %w", err)
	}
	return nil
}

// FinanceSummary holds revenue vs expense totals.
type FinanceSummary struct {
	TotalRevenue  float64            `json:"totalRevenue"`
	TotalExpenses float64            `json:"totalExpenses"`
	NetProfit     float64            `json:"netProfit"`
	ByCategory    map[string]float64 `json:"byCategory"`
	ByMonth       []MonthlyPL        `json:"byMonth"`
}

type MonthlyPL struct {
	Month    string  `json:"month"`
	Revenue  float64 `json:"revenue"`
	Expenses float64 `json:"expenses"`
	Net      float64 `json:"net"`
}

func (d *DB) GetFinanceSummary(ctx context.Context, dateFrom, dateTo string) (*FinanceSummary, error) {
	s := &FinanceSummary{ByCategory: map[string]float64{}}

	// Revenue from sales commissions
	dateFilter := ""
	args := []interface{}{}
	argN := 1
	if dateFrom != "" {
		dateFilter += fmt.Sprintf(" AND created_at >= $%d::DATE", argN)
		args = append(args, dateFrom)
		argN++
	}
	if dateTo != "" {
		dateFilter += fmt.Sprintf(" AND created_at <= $%d::DATE", argN)
		args = append(args, dateTo)
		argN++
	}

	d.pool.QueryRowContext(ctx,
		"SELECT COALESCE(SUM(commission), 0) FROM sales WHERE 1=1"+dateFilter, args...).Scan(&s.TotalRevenue)

	// Expenses
	expArgs := []interface{}{}
	expFilter := ""
	expN := 1
	if dateFrom != "" {
		expFilter += fmt.Sprintf(" AND expense_date >= $%d::DATE", expN)
		expArgs = append(expArgs, dateFrom)
		expN++
	}
	if dateTo != "" {
		expFilter += fmt.Sprintf(" AND expense_date <= $%d::DATE", expN)
		expArgs = append(expArgs, dateTo)
		expN++
	}

	d.pool.QueryRowContext(ctx,
		"SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE 1=1"+expFilter, expArgs...).Scan(&s.TotalExpenses)

	s.NetProfit = s.TotalRevenue - s.TotalExpenses

	// By category
	rows, err := d.pool.QueryContext(ctx,
		"SELECT category, COALESCE(SUM(amount), 0) FROM expenses WHERE 1=1"+expFilter+" GROUP BY category", expArgs...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var cat string
			var amt float64
			rows.Scan(&cat, &amt)
			s.ByCategory[cat] = amt
		}
	}

	// Monthly P&L — use date range if provided, otherwise last 12 months
	monthStart := "date_trunc('month', NOW()) - INTERVAL '11 months'"
	monthEnd := "date_trunc('month', NOW())"
	monthArgs := []interface{}{}
	monthArgN := 1
	if dateFrom != "" {
		monthStart = fmt.Sprintf("date_trunc('month', $%d::DATE)", monthArgN)
		monthArgs = append(monthArgs, dateFrom)
		monthArgN++
	}
	if dateTo != "" {
		monthEnd = fmt.Sprintf("date_trunc('month', $%d::DATE)", monthArgN)
		monthArgs = append(monthArgs, dateTo)
		monthArgN++
	}
	monthRows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf(`SELECT month, revenue, expenses FROM (
			SELECT TO_CHAR(m.month, 'YYYY-MM') AS month,
				COALESCE((SELECT SUM(commission) FROM sales WHERE date_trunc('month', created_at) = m.month), 0) AS revenue,
				COALESCE((SELECT SUM(amount) FROM expenses WHERE date_trunc('month', expense_date) = m.month), 0) AS expenses
			FROM generate_series(%s, %s, '1 month') AS m(month)
		) sub ORDER BY month`, monthStart, monthEnd), monthArgs...)
	if err == nil {
		defer monthRows.Close()
		for monthRows.Next() {
			var m MonthlyPL
			monthRows.Scan(&m.Month, &m.Revenue, &m.Expenses)
			m.Net = m.Revenue - m.Expenses
			s.ByMonth = append(s.ByMonth, m)
		}
	}
	if s.ByMonth == nil {
		s.ByMonth = []MonthlyPL{}
	}

	return s, nil
}

// AgentPL holds per-agent profit/loss data.
type AgentPL struct {
	AgentID         string  `json:"agentId"`
	TotalCommission float64 `json:"totalCommission"`
	TotalExpenses   float64 `json:"totalExpenses"`
	Net             float64 `json:"net"`
}

func (d *DB) GetAgentPL(ctx context.Context, agentID, dateFrom, dateTo string) (*AgentPL, error) {
	pl := &AgentPL{AgentID: agentID}

	// Revenue query with date filters
	revQuery := "SELECT COALESCE(SUM(commission), 0) FROM sales WHERE agent_discord_id = $1"
	revArgs := []interface{}{agentID}
	revN := 2
	if dateFrom != "" {
		revQuery += fmt.Sprintf(" AND created_at >= $%d::DATE", revN)
		revArgs = append(revArgs, dateFrom)
		revN++
	}
	if dateTo != "" {
		revQuery += fmt.Sprintf(" AND created_at <= $%d::DATE", revN)
		revArgs = append(revArgs, dateTo)
		revN++
	}
	d.pool.QueryRowContext(ctx, revQuery, revArgs...).Scan(&pl.TotalCommission)

	// Expense query with date filters
	expQuery := "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE agent_discord_id = $1"
	expArgs := []interface{}{agentID}
	expN := 2
	if dateFrom != "" {
		expQuery += fmt.Sprintf(" AND expense_date >= $%d::DATE", expN)
		expArgs = append(expArgs, dateFrom)
		expN++
	}
	if dateTo != "" {
		expQuery += fmt.Sprintf(" AND expense_date <= $%d::DATE", expN)
		expArgs = append(expArgs, dateTo)
		expN++
	}
	d.pool.QueryRowContext(ctx, expQuery, expArgs...).Scan(&pl.TotalExpenses)

	pl.Net = pl.TotalCommission - pl.TotalExpenses
	return pl, nil
}

// LeadROI holds lead source cost vs conversion data.
type LeadROI struct {
	Source            string  `json:"source"`
	Cost              float64 `json:"cost"`
	RecruitCount      int     `json:"recruitCount"`
	ConvertedCount    int     `json:"convertedCount"`
	CostPerRecruit    float64 `json:"costPerRecruit"`
	CostPerConversion float64 `json:"costPerConversion"`
}

func (d *DB) GetLeadROI(ctx context.Context) ([]LeadROI, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT COALESCE(r.source, 'unknown') AS source,
			COALESCE(e.cost, 0) AS cost,
			COUNT(*) AS recruit_count,
			COUNT(*) FILTER (WHERE r.stage = 'ONBOARDED') AS converted_count
		 FROM recruits r
		 LEFT JOIN (
			SELECT description AS source, SUM(amount) AS cost
			FROM expenses WHERE category = 'leads'
			GROUP BY description
		 ) e ON LOWER(e.source) = LOWER(COALESCE(r.source, ''))
		 GROUP BY r.source, COALESCE(e.cost, 0)
		 ORDER BY recruit_count DESC`)
	if err != nil {
		return nil, fmt.Errorf("db: lead roi: %w", err)
	}
	defer rows.Close()

	var result []LeadROI
	for rows.Next() {
		var r LeadROI
		if err := rows.Scan(&r.Source, &r.Cost, &r.RecruitCount, &r.ConvertedCount); err != nil {
			return nil, fmt.Errorf("db: scan lead roi: %w", err)
		}
		if r.RecruitCount > 0 {
			r.CostPerRecruit = r.Cost / float64(r.RecruitCount)
		}
		if r.ConvertedCount > 0 {
			r.CostPerConversion = r.Cost / float64(r.ConvertedCount)
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// WriteExpensesCsv streams expenses as CSV to the given writer.
func (d *DB) WriteExpensesCsv(ctx context.Context, w io.Writer, dateFrom, dateTo string) error {
	where := "1=1"
	args := []interface{}{}
	argN := 1
	if dateFrom != "" {
		where += fmt.Sprintf(" AND expense_date >= $%d::DATE", argN)
		args = append(args, dateFrom)
		argN++
	}
	if dateTo != "" {
		where += fmt.Sprintf(" AND expense_date <= $%d::DATE", argN)
		args = append(args, dateTo)
		argN++
	}

	rows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf(`SELECT expense_date::TEXT, category, description, amount, COALESCE(agent_discord_id, ''), COALESCE(receipt_url, '')
		 FROM expenses WHERE %s ORDER BY expense_date DESC`, where), args...)
	if err != nil {
		return fmt.Errorf("db: export expenses: %w", err)
	}
	defer rows.Close()

	cw := csv.NewWriter(w)
	cw.Write([]string{"Date", "Category", "Description", "Amount", "Agent", "Receipt URL"})

	for rows.Next() {
		var date, cat, desc, agent, receipt string
		var amount float64
		if err := rows.Scan(&date, &cat, &desc, &amount, &agent, &receipt); err != nil {
			return err
		}
		cw.Write([]string{date, cat, desc, fmt.Sprintf("%.2f", amount), agent, receipt})
	}
	cw.Flush()
	return cw.Error()
}
