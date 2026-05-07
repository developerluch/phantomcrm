package db

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ── Structs ─────────────────────────────────────────────────────────────────

type LockIn struct {
	ID                string     `json:"id"`
	Name              string     `json:"name"`
	StartDate         string     `json:"startDate"`
	EndDate           string     `json:"endDate"`
	City              string     `json:"city"`
	State             string     `json:"state"`
	Status            string     `json:"status"`
	CreatedByOrgID    int64      `json:"createdByOrgId"`
	BudgetTarget      float64    `json:"budgetTarget"`
	SalesGoal         float64    `json:"salesGoal"`
	EstimatedHeadcount int       `json:"estimatedHeadcount"`
	Description       string     `json:"description"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
	// Joined fields
	Partners    []LockInPartner `json:"partners,omitempty"`
	AgentCount  int             `json:"agentCount,omitempty"`
	BudgetTotal float64         `json:"budgetTotal,omitempty"`
}

type LockInPartner struct {
	ID         string     `json:"id"`
	LockInID   string     `json:"lockInId"`
	OrgID      int64      `json:"orgId"`
	OrgName    string     `json:"orgName"`
	Status     string     `json:"status"`
	InvitedBy  int64      `json:"invitedBy"`
	ApprovedBy *int64     `json:"approvedBy,omitempty"`
	ApprovedAt *time.Time `json:"approvedAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type LockInAgent struct {
	ID               string     `json:"id"`
	LockInID         string     `json:"lockInId"`
	AgentDiscordID   int64      `json:"agentDiscordId"`
	OrgID            int64      `json:"orgId"`
	AgentName        string     `json:"agentName"`
	FlightAirline    string     `json:"flightAirline"`
	FlightNumber     string     `json:"flightNumber"`
	ArrivalTime      *time.Time `json:"arrivalTime,omitempty"`
	DepartureTime    *time.Time `json:"departureTime,omitempty"`
	LodgingAssignment string   `json:"lodgingAssignment"`
	DietaryPrefs     string     `json:"dietaryPrefs"`
	RoommatePref     string     `json:"roommatePref"`
	Status           string     `json:"status"`
	CreatedAt        time.Time  `json:"createdAt"`
}

type LockInBudgetItem struct {
	ID          string    `json:"id"`
	LockInID    string    `json:"lockInId"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	PaidByOrgID *int64    `json:"paidByOrgId,omitempty"`
	SplitType   string    `json:"splitType"`
	CreatedAt   time.Time `json:"createdAt"`
}

type LockInItineraryItem struct {
	ID          string    `json:"id"`
	LockInID    string    `json:"lockInId"`
	DayNumber   int       `json:"dayNumber"`
	StartTime   string    `json:"startTime"`
	EndTime     string    `json:"endTime"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Location    string    `json:"location"`
	Category    string    `json:"category"`
	CreatedAt   time.Time `json:"createdAt"`
}

type LockInChatMessage struct {
	ID         string    `json:"id"`
	LockInID   string    `json:"lockInId"`
	UserID     int64     `json:"userId"`
	UserName   string    `json:"userName"`
	Message    string    `json:"message"`
	AIResponse string    `json:"aiResponse"`
	CreatedAt  time.Time `json:"createdAt"`
}

type BudgetSummary struct {
	Total       float64            `json:"total"`
	ByCategory  map[string]float64 `json:"byCategory"`
	PerOrgSplit map[string]float64 `json:"perOrgSplit"`
	PerAgentCost float64           `json:"perAgentCost"`
}

// ── Lock-In CRUD ────────────────────────────────────────────────────────────

func (d *DB) CreateLockIn(ctx context.Context, li LockIn) (*LockIn, error) {
	var result LockIn
	err := d.pool.QueryRowContext(ctx, `INSERT INTO lock_ins (name, start_date, end_date, city, state, status, created_by_org_id, budget_target, sales_goal, estimated_headcount, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, name, start_date, end_date, city, state, status, created_by_org_id, budget_target, sales_goal, estimated_headcount, description, created_at, updated_at`,
		li.Name, li.StartDate, li.EndDate, li.City, li.State, li.Status, li.CreatedByOrgID,
		li.BudgetTarget, li.SalesGoal, li.EstimatedHeadcount, li.Description,
	).Scan(&result.ID, &result.Name, &result.StartDate, &result.EndDate, &result.City, &result.State,
		&result.Status, &result.CreatedByOrgID, &result.BudgetTarget, &result.SalesGoal,
		&result.EstimatedHeadcount, &result.Description, &result.CreatedAt, &result.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (d *DB) GetLockIn(ctx context.Context, id string) (*LockIn, error) {
	var li LockIn
	err := d.pool.QueryRowContext(ctx, `SELECT id, name, start_date, end_date, city, state, status, created_by_org_id,
		budget_target, sales_goal, estimated_headcount, description, created_at, updated_at,
		(SELECT COUNT(*) FROM lock_in_agents WHERE lock_in_id = lock_ins.id),
		(SELECT COALESCE(SUM(amount),0) FROM lock_in_budget WHERE lock_in_id = lock_ins.id)
		FROM lock_ins WHERE id = $1`, id,
	).Scan(&li.ID, &li.Name, &li.StartDate, &li.EndDate, &li.City, &li.State,
		&li.Status, &li.CreatedByOrgID, &li.BudgetTarget, &li.SalesGoal,
		&li.EstimatedHeadcount, &li.Description, &li.CreatedAt, &li.UpdatedAt,
		&li.AgentCount, &li.BudgetTotal)
	if err != nil {
		return nil, err
	}
	// Fetch partners
	partners, err := d.ListPartners(ctx, id)
	if err == nil {
		li.Partners = partners
	}
	return &li, nil
}

func (d *DB) ListLockIns(ctx context.Context, orgID int64) ([]LockIn, error) {
	query := `SELECT l.id, l.name, l.start_date, l.end_date, l.city, l.state, l.status, l.created_by_org_id,
		l.budget_target, l.sales_goal, l.estimated_headcount, l.description, l.created_at, l.updated_at,
		(SELECT COUNT(*) FROM lock_in_agents WHERE lock_in_id = l.id),
		(SELECT COALESCE(SUM(amount),0) FROM lock_in_budget WHERE lock_in_id = l.id)
		FROM lock_ins l
		WHERE l.created_by_org_id = $1
		OR EXISTS (SELECT 1 FROM lock_in_partners p WHERE p.lock_in_id = l.id AND p.org_id = $1 AND p.status = 'approved')
		ORDER BY l.start_date DESC`
	rows, err := d.pool.QueryContext(ctx, query, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []LockIn
	for rows.Next() {
		var li LockIn
		if err := rows.Scan(&li.ID, &li.Name, &li.StartDate, &li.EndDate, &li.City, &li.State,
			&li.Status, &li.CreatedByOrgID, &li.BudgetTarget, &li.SalesGoal,
			&li.EstimatedHeadcount, &li.Description, &li.CreatedAt, &li.UpdatedAt,
			&li.AgentCount, &li.BudgetTotal); err != nil {
			return nil, err
		}
		result = append(result, li)
	}
	return result, rows.Err()
}

func (d *DB) UpdateLockIn(ctx context.Context, id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	setClauses := []string{}
	args := []any{}
	i := 1
	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now())
	i++
	args = append(args, id)
	query := fmt.Sprintf("UPDATE lock_ins SET %s WHERE id = $%d", strings.Join(setClauses, ", "), i)
	_, err := d.pool.ExecContext(ctx, query, args...)
	return err
}

func (d *DB) DeleteLockIn(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, `DELETE FROM lock_ins WHERE id = $1`, id)
	return err
}

// ── Partners ────────────────────────────────────────────────────────────────

func (d *DB) InvitePartner(ctx context.Context, lockInID string, orgID int64, orgName string, invitedBy int64) (*LockInPartner, error) {
	var p LockInPartner
	err := d.pool.QueryRowContext(ctx, `INSERT INTO lock_in_partners (lock_in_id, org_id, org_name, invited_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (lock_in_id, org_id) DO NOTHING
		RETURNING id, lock_in_id, org_id, org_name, status, invited_by, approved_by, approved_at, created_at`,
		lockInID, orgID, orgName, invitedBy,
	).Scan(&p.ID, &p.LockInID, &p.OrgID, &p.OrgName, &p.Status, &p.InvitedBy, &p.ApprovedBy, &p.ApprovedAt, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (d *DB) RespondPartnerInvite(ctx context.Context, partnerID, status string, approvedBy int64) error {
	_, err := d.pool.ExecContext(ctx, `UPDATE lock_in_partners SET status = $2, approved_by = $3, approved_at = NOW()
		WHERE id = $1`, partnerID, status, approvedBy)
	return err
}

func (d *DB) ListPartners(ctx context.Context, lockInID string) ([]LockInPartner, error) {
	rows, err := d.pool.QueryContext(ctx, `SELECT id, lock_in_id, org_id, org_name, status, invited_by, approved_by, approved_at, created_at
		FROM lock_in_partners WHERE lock_in_id = $1 ORDER BY created_at ASC`, lockInID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []LockInPartner
	for rows.Next() {
		var p LockInPartner
		if err := rows.Scan(&p.ID, &p.LockInID, &p.OrgID, &p.OrgName, &p.Status, &p.InvitedBy, &p.ApprovedBy, &p.ApprovedAt, &p.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

// ── Agents ──────────────────────────────────────────────────────────────────

func (d *DB) AddLockInAgent(ctx context.Context, agent LockInAgent) (*LockInAgent, error) {
	var a LockInAgent
	err := d.pool.QueryRowContext(ctx, `INSERT INTO lock_in_agents (lock_in_id, agent_discord_id, org_id, agent_name, flight_airline, flight_number, arrival_time, departure_time, lodging_assignment, dietary_prefs, roommate_pref, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (lock_in_id, agent_discord_id) DO UPDATE SET agent_name = EXCLUDED.agent_name, org_id = EXCLUDED.org_id
		RETURNING id, lock_in_id, agent_discord_id, org_id, agent_name, flight_airline, flight_number, arrival_time, departure_time, lodging_assignment, dietary_prefs, roommate_pref, status, created_at`,
		agent.LockInID, agent.AgentDiscordID, agent.OrgID, agent.AgentName, agent.FlightAirline, agent.FlightNumber,
		agent.ArrivalTime, agent.DepartureTime, agent.LodgingAssignment, agent.DietaryPrefs, agent.RoommatePref, agent.Status,
	).Scan(&a.ID, &a.LockInID, &a.AgentDiscordID, &a.OrgID, &a.AgentName, &a.FlightAirline, &a.FlightNumber,
		&a.ArrivalTime, &a.DepartureTime, &a.LodgingAssignment, &a.DietaryPrefs, &a.RoommatePref, &a.Status, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (d *DB) UpdateLockInAgent(ctx context.Context, agentID string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	setClauses := []string{}
	args := []any{}
	i := 1
	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	args = append(args, agentID)
	query := fmt.Sprintf("UPDATE lock_in_agents SET %s WHERE id = $%d", strings.Join(setClauses, ", "), i)
	_, err := d.pool.ExecContext(ctx, query, args...)
	return err
}

func (d *DB) ListLockInAgents(ctx context.Context, lockInID string) ([]LockInAgent, error) {
	rows, err := d.pool.QueryContext(ctx, `SELECT id, lock_in_id, agent_discord_id, org_id, agent_name, flight_airline, flight_number, arrival_time, departure_time, lodging_assignment, dietary_prefs, roommate_pref, status, created_at
		FROM lock_in_agents WHERE lock_in_id = $1 ORDER BY org_id, agent_name`, lockInID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []LockInAgent
	for rows.Next() {
		var a LockInAgent
		if err := rows.Scan(&a.ID, &a.LockInID, &a.AgentDiscordID, &a.OrgID, &a.AgentName, &a.FlightAirline, &a.FlightNumber,
			&a.ArrivalTime, &a.DepartureTime, &a.LodgingAssignment, &a.DietaryPrefs, &a.RoommatePref, &a.Status, &a.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, a)
	}
	return result, rows.Err()
}

// ── Budget ──────────────────────────────────────────────────────────────────

func (d *DB) AddBudgetItem(ctx context.Context, item LockInBudgetItem) (*LockInBudgetItem, error) {
	var b LockInBudgetItem
	err := d.pool.QueryRowContext(ctx, `INSERT INTO lock_in_budget (lock_in_id, category, description, amount, paid_by_org_id, split_type)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, lock_in_id, category, description, amount, paid_by_org_id, split_type, created_at`,
		item.LockInID, item.Category, item.Description, item.Amount, item.PaidByOrgID, item.SplitType,
	).Scan(&b.ID, &b.LockInID, &b.Category, &b.Description, &b.Amount, &b.PaidByOrgID, &b.SplitType, &b.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (d *DB) UpdateBudgetItem(ctx context.Context, id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	setClauses := []string{}
	args := []any{}
	i := 1
	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	args = append(args, id)
	query := fmt.Sprintf("UPDATE lock_in_budget SET %s WHERE id = $%d", strings.Join(setClauses, ", "), i)
	_, err := d.pool.ExecContext(ctx, query, args...)
	return err
}

func (d *DB) DeleteBudgetItem(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, `DELETE FROM lock_in_budget WHERE id = $1`, id)
	return err
}

func (d *DB) ListBudgetItems(ctx context.Context, lockInID string) ([]LockInBudgetItem, error) {
	rows, err := d.pool.QueryContext(ctx, `SELECT id, lock_in_id, category, description, amount, paid_by_org_id, split_type, created_at
		FROM lock_in_budget WHERE lock_in_id = $1 ORDER BY created_at ASC`, lockInID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []LockInBudgetItem
	for rows.Next() {
		var b LockInBudgetItem
		if err := rows.Scan(&b.ID, &b.LockInID, &b.Category, &b.Description, &b.Amount, &b.PaidByOrgID, &b.SplitType, &b.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, b)
	}
	return result, rows.Err()
}

func (d *DB) GetBudgetSummary(ctx context.Context, lockInID string) (*BudgetSummary, error) {
	summary := &BudgetSummary{
		ByCategory:  make(map[string]float64),
		PerOrgSplit: make(map[string]float64),
	}

	// Total
	d.pool.QueryRowContext(ctx, `SELECT COALESCE(SUM(amount),0) FROM lock_in_budget WHERE lock_in_id = $1`, lockInID).Scan(&summary.Total)

	// By category
	rows, err := d.pool.QueryContext(ctx, `SELECT category, SUM(amount) FROM lock_in_budget WHERE lock_in_id = $1 GROUP BY category`, lockInID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var cat string
			var amt float64
			rows.Scan(&cat, &amt)
			summary.ByCategory[cat] = amt
		}
	}

	// Per-org split: sum by paid_by_org_id
	rows2, err := d.pool.QueryContext(ctx, `SELECT COALESCE(paid_by_org_id, 0), SUM(amount) FROM lock_in_budget WHERE lock_in_id = $1 GROUP BY paid_by_org_id`, lockInID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var orgID int64
			var amt float64
			rows2.Scan(&orgID, &amt)
			summary.PerOrgSplit[fmt.Sprintf("%d", orgID)] = amt
		}
	}

	// Per-agent cost
	var agentCount int
	d.pool.QueryRowContext(ctx, `SELECT COUNT(*) FROM lock_in_agents WHERE lock_in_id = $1`, lockInID).Scan(&agentCount)
	if agentCount > 0 {
		summary.PerAgentCost = summary.Total / float64(agentCount)
	}

	return summary, nil
}

// ── Itinerary ───────────────────────────────────────────────────────────────

func (d *DB) AddItineraryItem(ctx context.Context, item LockInItineraryItem) (*LockInItineraryItem, error) {
	var it LockInItineraryItem
	err := d.pool.QueryRowContext(ctx, `INSERT INTO lock_in_itinerary (lock_in_id, day_number, start_time, end_time, title, description, location, category)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, lock_in_id, day_number, start_time, end_time, title, description, location, category, created_at`,
		item.LockInID, item.DayNumber, item.StartTime, item.EndTime, item.Title, item.Description, item.Location, item.Category,
	).Scan(&it.ID, &it.LockInID, &it.DayNumber, &it.StartTime, &it.EndTime, &it.Title, &it.Description, &it.Location, &it.Category, &it.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &it, nil
}

func (d *DB) UpdateItineraryItem(ctx context.Context, id string, updates map[string]any) error {
	if len(updates) == 0 {
		return nil
	}
	setClauses := []string{}
	args := []any{}
	i := 1
	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	args = append(args, id)
	query := fmt.Sprintf("UPDATE lock_in_itinerary SET %s WHERE id = $%d", strings.Join(setClauses, ", "), i)
	_, err := d.pool.ExecContext(ctx, query, args...)
	return err
}

func (d *DB) DeleteItineraryItem(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, `DELETE FROM lock_in_itinerary WHERE id = $1`, id)
	return err
}

func (d *DB) ListItinerary(ctx context.Context, lockInID string) ([]LockInItineraryItem, error) {
	rows, err := d.pool.QueryContext(ctx, `SELECT id, lock_in_id, day_number, start_time, end_time, title, description, location, category, created_at
		FROM lock_in_itinerary WHERE lock_in_id = $1 ORDER BY day_number, start_time`, lockInID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []LockInItineraryItem
	for rows.Next() {
		var it LockInItineraryItem
		if err := rows.Scan(&it.ID, &it.LockInID, &it.DayNumber, &it.StartTime, &it.EndTime, &it.Title, &it.Description, &it.Location, &it.Category, &it.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, it)
	}
	return result, rows.Err()
}

// ── Chat ────────────────────────────────────────────────────────────────────

func (d *DB) AddLockInChatMessage(ctx context.Context, msg LockInChatMessage) (*LockInChatMessage, error) {
	var m LockInChatMessage
	err := d.pool.QueryRowContext(ctx, `INSERT INTO lock_in_chat_messages (lock_in_id, user_id, user_name, message, ai_response)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, lock_in_id, user_id, user_name, message, ai_response, created_at`,
		msg.LockInID, msg.UserID, msg.UserName, msg.Message, msg.AIResponse,
	).Scan(&m.ID, &m.LockInID, &m.UserID, &m.UserName, &m.Message, &m.AIResponse, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (d *DB) ListLockInChatMessages(ctx context.Context, lockInID string, limit int) ([]LockInChatMessage, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := d.pool.QueryContext(ctx, `SELECT id, lock_in_id, user_id, user_name, message, ai_response, created_at
		FROM lock_in_chat_messages WHERE lock_in_id = $1 ORDER BY created_at DESC LIMIT $2`, lockInID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []LockInChatMessage
	for rows.Next() {
		var m LockInChatMessage
		if err := rows.Scan(&m.ID, &m.LockInID, &m.UserID, &m.UserName, &m.Message, &m.AIResponse, &m.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}
