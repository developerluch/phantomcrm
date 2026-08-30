package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Appointment struct {
	ID          string    `json:"id"`
	OrgID       *string   `json:"orgId"`
	AgentID     string    `json:"agentId"`
	Title       string    `json:"title"`
	Description *string   `json:"description"`
	StartTime   time.Time `json:"startTime"`
	EndTime     time.Time `json:"endTime"`
	Status      string    `json:"status"`
	MeetingLink *string   `json:"meetingLink"`
	Notes       *string   `json:"notes"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

const apptCols = `id::TEXT, org_id::TEXT, agent_discord_id, title, description, start_time, end_time, status, meeting_link, notes, created_at, updated_at`

func scanAppointment(scanner interface{ Scan(...interface{}) error }) (*Appointment, error) {
	var a Appointment
	var orgID, desc, link, notes sql.NullString
	err := scanner.Scan(&a.ID, &orgID, &a.AgentID, &a.Title, &desc, &a.StartTime, &a.EndTime, &a.Status, &link, &notes, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	a.OrgID = nullStr(orgID)
	a.Description = nullStr(desc)
	a.MeetingLink = nullStr(link)
	a.Notes = nullStr(notes)
	return &a, nil
}

func (d *DB) CreateAppointment(ctx context.Context, a *Appointment) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO appointments (org_id, agent_discord_id, title, description, start_time, end_time, status, meeting_link, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id::TEXT`,
		a.OrgID, a.AgentID, a.Title, a.Description, a.StartTime, a.EndTime, a.Status, a.MeetingLink, a.Notes).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create appointment: %w", err)
	}
	return id, nil
}

func (d *DB) GetAppointment(ctx context.Context, id string) (*Appointment, error) {
	a, err := scanAppointment(d.pool.QueryRowContext(ctx, "SELECT "+apptCols+" FROM appointments WHERE id = $1::UUID", id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get appointment: %w", err)
	}
	return a, nil
}

func (d *DB) ListAppointments(ctx context.Context, status string, page, perPage int) ([]Appointment, int, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 25
	}
	offset := (page - 1) * perPage

	where := "1=1"
	args := []interface{}{}
	argN := 1
	if status != "" {
		where = fmt.Sprintf("status = $%d", argN)
		args = append(args, status)
		argN++
	}

	var total int
	d.pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM appointments WHERE "+where, args...).Scan(&total)

	args = append(args, perPage, offset)
	rows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf("SELECT "+apptCols+" FROM appointments WHERE %s ORDER BY start_time DESC LIMIT $%d OFFSET $%d", where, argN, argN+1), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("db: list appointments: %w", err)
	}
	defer rows.Close()

	var result []Appointment
	for rows.Next() {
		a, err := scanAppointment(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("db: scan appointment: %w", err)
		}
		result = append(result, *a)
	}
	return result, total, rows.Err()
}

func (d *DB) ListUpcomingAppointments(ctx context.Context) ([]Appointment, error) {
	rows, err := d.pool.QueryContext(ctx,
		"SELECT "+apptCols+" FROM appointments WHERE start_time >= NOW() AND status = 'scheduled' ORDER BY start_time ASC LIMIT 50")
	if err != nil {
		return nil, fmt.Errorf("db: upcoming appointments: %w", err)
	}
	defer rows.Close()

	var result []Appointment
	for rows.Next() {
		a, err := scanAppointment(rows)
		if err != nil {
			return nil, fmt.Errorf("db: scan appointment: %w", err)
		}
		result = append(result, *a)
	}
	return result, rows.Err()
}

func (d *DB) UpdateAppointmentStatus(ctx context.Context, id, status string) error {
	_, err := d.pool.ExecContext(ctx,
		"UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2::UUID", status, id)
	if err != nil {
		return fmt.Errorf("db: update appointment status: %w", err)
	}
	return nil
}

func (d *DB) DeleteAppointment(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM appointments WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: delete appointment: %w", err)
	}
	return nil
}
