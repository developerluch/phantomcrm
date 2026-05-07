package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/lib/pq"
)

type License struct {
	ID               string    `json:"id"`
	AgentID          string    `json:"agentId"`
	State            string    `json:"state"`
	LicenseNumber    string    `json:"licenseNumber"`
	NPN              *string   `json:"npn"`
	Status           string    `json:"status"`
	ExpirationDate   *string   `json:"expirationDate"`
	LinesOfAuthority []string  `json:"linesOfAuthority"`
	VerifiedBy       *string   `json:"verifiedBy"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

func (d *DB) CreateLicense(ctx context.Context, l *License) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO licenses (agent_discord_id, state, license_number, npn, status, expiration_date, lines_of_authority)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id::TEXT`,
		l.AgentID, l.State, l.LicenseNumber, l.NPN, l.Status, l.ExpirationDate, pq.Array(l.LinesOfAuthority)).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create license: %w", err)
	}
	return id, nil
}

func (d *DB) GetLicense(ctx context.Context, id string) (*License, error) {
	var l License
	var npn, expDate, verifiedBy sql.NullString
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, agent_discord_id, state, license_number, npn, status, expiration_date::TEXT, lines_of_authority, verified_by, created_at, updated_at
		 FROM licenses WHERE id = $1::UUID`, id).Scan(
		&l.ID, &l.AgentID, &l.State, &l.LicenseNumber, &npn, &l.Status, &expDate, pq.Array(&l.LinesOfAuthority), &verifiedBy, &l.CreatedAt, &l.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: get license: %w", err)
	}
	l.NPN = nullStr(npn)
	l.ExpirationDate = nullStr(expDate)
	l.VerifiedBy = nullStr(verifiedBy)
	return &l, nil
}

func (d *DB) ListLicenses(ctx context.Context, agentID, state, status string) ([]License, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argN := 1

	if agentID != "" {
		where = append(where, fmt.Sprintf("agent_discord_id = $%d", argN))
		args = append(args, agentID)
		argN++
	}
	if state != "" {
		where = append(where, fmt.Sprintf("state = $%d", argN))
		args = append(args, state)
		argN++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argN))
		args = append(args, status)
		argN++
	}

	rows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf(`SELECT id::TEXT, agent_discord_id, state, license_number, npn, status, expiration_date::TEXT, lines_of_authority, verified_by, created_at, updated_at
		 FROM licenses WHERE %s ORDER BY created_at DESC`, strings.Join(where, " AND ")), args...)
	if err != nil {
		return nil, fmt.Errorf("db: list licenses: %w", err)
	}
	defer rows.Close()

	var result []License
	for rows.Next() {
		var l License
		var npn, expDate, verifiedBy sql.NullString
		if err := rows.Scan(&l.ID, &l.AgentID, &l.State, &l.LicenseNumber, &npn, &l.Status, &expDate, pq.Array(&l.LinesOfAuthority), &verifiedBy, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, fmt.Errorf("db: scan license: %w", err)
		}
		l.NPN = nullStr(npn)
		l.ExpirationDate = nullStr(expDate)
		l.VerifiedBy = nullStr(verifiedBy)
		result = append(result, l)
	}
	return result, rows.Err()
}

func (d *DB) UpdateLicense(ctx context.Context, id string, updates map[string]interface{}) error {
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argN := 1

	fieldMap := map[string]string{
		"status": "status", "expirationDate": "expiration_date", "verifiedBy": "verified_by",
	}

	for jsonKey, col := range fieldMap {
		if v, ok := updates[jsonKey]; ok {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, argN))
			args = append(args, v)
			argN++
		}
	}
	if v, ok := updates["linesOfAuthority"]; ok {
		if arr, ok2 := v.([]string); ok2 {
			sets = append(sets, fmt.Sprintf("lines_of_authority = $%d", argN))
			args = append(args, pq.Array(arr))
			argN++
		}
	}

	args = append(args, id)
	_, err := d.pool.ExecContext(ctx,
		fmt.Sprintf("UPDATE licenses SET %s WHERE id = $%d::UUID", strings.Join(sets, ", "), argN), args...)
	if err != nil {
		return fmt.Errorf("db: update license: %w", err)
	}
	return nil
}

func (d *DB) DeleteLicense(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM licenses WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: delete license: %w", err)
	}
	return nil
}
