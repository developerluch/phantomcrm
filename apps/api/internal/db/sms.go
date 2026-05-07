package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type SmsMessage struct {
	ID         string    `json:"id"`
	AgentID    *string   `json:"agentId"`
	RecruitID  *string   `json:"recruitId"`
	ToNumber   string    `json:"toNumber"`
	FromNumber *string   `json:"fromNumber"`
	Body       string    `json:"body"`
	Direction  string    `json:"direction"`
	Status     *string   `json:"status"`
	ProviderID *string   `json:"providerId"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (d *DB) CreateSmsMessage(ctx context.Context, m *SmsMessage) (string, error) {
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO sms_messages (agent_discord_id, recruit_id, to_number, from_number, body, direction, status, provider_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id::TEXT`,
		m.AgentID, m.RecruitID, m.ToNumber, m.FromNumber, m.Body, m.Direction, m.Status, m.ProviderID).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create sms: %w", err)
	}
	return id, nil
}

func (d *DB) ListSmsMessages(ctx context.Context, agentID, recruitID string, page, perPage int) ([]SmsMessage, int, error) {
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
	if agentID != "" {
		where += fmt.Sprintf(" AND agent_discord_id = $%d", argN)
		args = append(args, agentID)
		argN++
	}
	if recruitID != "" {
		where += fmt.Sprintf(" AND recruit_id = $%d::UUID", argN)
		args = append(args, recruitID)
		argN++
	}

	var total int
	d.pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM sms_messages WHERE "+where, args...).Scan(&total)

	args = append(args, perPage, offset)
	rows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf(`SELECT id::TEXT, agent_discord_id, recruit_id::TEXT, to_number, from_number, body, direction, status, provider_id, created_at
		 FROM sms_messages WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, argN, argN+1), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("db: list sms: %w", err)
	}
	defer rows.Close()

	var result []SmsMessage
	for rows.Next() {
		var m SmsMessage
		var agentID, recruitID, fromNum, status, providerID sql.NullString
		if err := rows.Scan(&m.ID, &agentID, &recruitID, &m.ToNumber, &fromNum, &m.Body, &m.Direction, &status, &providerID, &m.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("db: scan sms: %w", err)
		}
		m.AgentID = nullStr(agentID)
		m.RecruitID = nullStr(recruitID)
		m.FromNumber = nullStr(fromNum)
		m.Status = nullStr(status)
		m.ProviderID = nullStr(providerID)
		result = append(result, m)
	}
	return result, total, rows.Err()
}

// UpdateSmsStatus updates the status of an SMS message by Twilio provider ID.
func (d *DB) UpdateSmsStatus(ctx context.Context, providerID, status string) error {
	_, err := d.pool.ExecContext(ctx,
		`UPDATE sms_messages SET status = $1 WHERE provider_id = $2`,
		status, providerID)
	if err != nil {
		return fmt.Errorf("db: update sms status: %w", err)
	}
	return nil
}

// FindRecruitByPhone finds a recruit by phone number (tries both raw and normalized forms).
func (d *DB) FindRecruitByPhone(ctx context.Context, phone string) (*Recruit, error) {
	// Strip to digits for flexible matching
	var digits string
	for _, c := range phone {
		if c >= '0' && c <= '9' {
			digits += string(c)
		}
	}
	// Try multiple forms
	forms := []string{phone}
	if len(digits) == 10 {
		forms = append(forms, "+1"+digits, "1"+digits, digits)
	} else if len(digits) == 11 && digits[0] == '1' {
		forms = append(forms, "+"+digits, digits[1:], "+1"+digits[1:])
	}

	for _, f := range forms {
		r, err := d.findRecruitByField(ctx, "phone", f)
		if err != nil {
			return nil, err
		}
		if r != nil {
			return r, nil
		}
	}
	return nil, nil
}

// FindRecruitByEmail finds a recruit by email (case-insensitive).
func (d *DB) FindRecruitByEmail(ctx context.Context, email string) (*Recruit, error) {
	return d.findRecruitByField(ctx, "LOWER(email)", strings.ToLower(strings.TrimSpace(email)))
}

func (d *DB) findRecruitByField(ctx context.Context, field, value string) (*Recruit, error) {
	var r Recruit
	var orgID, discordID, phone, city, source, reason, agentType, approvalStatus, rejectedReason, interviewType, interviewLink, interviewNotes, calendlyURI, managerID sql.NullString
	var interviewDate, optedOutAt sql.NullTime
	var leadSource, licenseState, licenseNumber, courseName, contractingStatus, contractingCarrier, stateCol, priorExperience, howHeard sql.NullString
	var licenseExpiryDate, courseEnrolledDate, contractingSubmittedDate, discordJoinedDate sql.NullTime
	var courseProgress sql.NullInt64
	var isCurrentlyLicensed sql.NullBool
	var checklistBytes []byte
	query := fmt.Sprintf(`SELECT id::TEXT, org_id::TEXT, discord_id, first_name, last_name, email, phone, city, source, reason, agent_type,
		stage, approval_status, rejected_reason, interview_type, interview_date, interview_link,
		interview_notes, calendly_event_uri, assigned_manager_id, COALESCE(opted_out, false), opted_out_at,
		created_at, updated_at,
		lead_source, COALESCE(is_licensed, false), license_state, license_number, license_expiry_date,
		course_enrolled_date, course_name, course_progress, contracting_status, contracting_carrier,
		contracting_submitted_date, discord_joined_date, onboarding_checklist, state, prior_experience,
		is_currently_licensed, how_heard
		FROM recruits WHERE %s = $1 ORDER BY created_at DESC LIMIT 1`, field)
	err := d.pool.QueryRowContext(ctx, query, value).Scan(
		&r.ID, &orgID, &discordID, &r.FirstName, &r.LastName, &r.Email, &phone, &city, &source, &reason, &agentType,
		&r.Stage, &approvalStatus, &rejectedReason, &interviewType, &interviewDate, &interviewLink,
		&interviewNotes, &calendlyURI, &managerID, &r.OptedOut, &optedOutAt,
		&r.CreatedAt, &r.UpdatedAt,
		&leadSource, &r.IsLicensed, &licenseState, &licenseNumber, &licenseExpiryDate,
		&courseEnrolledDate, &courseName, &courseProgress, &contractingStatus, &contractingCarrier,
		&contractingSubmittedDate, &discordJoinedDate, &checklistBytes, &stateCol, &priorExperience,
		&isCurrentlyLicensed, &howHeard)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("db: find recruit by %s: %w", field, err)
	}
	r.OrgID = nullStr(orgID)
	r.DiscordID = nullStr(discordID)
	r.Phone = nullStr(phone)
	r.City = nullStr(city)
	r.Source = nullStr(source)
	r.Reason = nullStr(reason)
	r.AgentType = nullStr(agentType)
	r.ApprovalStatus = nullStr(approvalStatus)
	r.RejectedReason = nullStr(rejectedReason)
	r.InterviewType = nullStr(interviewType)
	r.InterviewLink = nullStr(interviewLink)
	r.InterviewNotes = nullStr(interviewNotes)
	r.CalendlyEventURI = nullStr(calendlyURI)
	r.AssignedManagerID = nullStr(managerID)
	if interviewDate.Valid {
		r.InterviewDate = &interviewDate.Time
	}
	if optedOutAt.Valid {
		r.OptedOutAt = &optedOutAt.Time
	}
	r.LeadSource = nullStr(leadSource)
	r.LicenseState = nullStr(licenseState)
	r.LicenseNumber = nullStr(licenseNumber)
	r.LicenseExpiryDate = nullTime(licenseExpiryDate)
	r.CourseEnrolledDate = nullTime(courseEnrolledDate)
	r.CourseName = nullStr(courseName)
	r.CourseProgress = nullInt(courseProgress)
	r.ContractingStatus = nullStr(contractingStatus)
	r.ContractingCarrier = nullStr(contractingCarrier)
	r.ContractingSubmittedDate = nullTime(contractingSubmittedDate)
	r.DiscordJoinedDate = nullTime(discordJoinedDate)
	if len(checklistBytes) > 0 {
		r.OnboardingChecklist = json.RawMessage(checklistBytes)
	}
	r.State = nullStr(stateCol)
	r.PriorExperience = nullStr(priorExperience)
	r.IsCurrentlyLicensed = nullBool(isCurrentlyLicensed)
	r.HowHeard = nullStr(howHeard)
	return &r, nil
}
