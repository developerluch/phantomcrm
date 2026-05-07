package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type Recruit struct {
	ID                string     `json:"id"`
	OrgID             *string    `json:"orgId"`
	DiscordID         *string    `json:"discordId"`
	FirstName         string     `json:"firstName"`
	LastName          string     `json:"lastName"`
	Email             string     `json:"email"`
	Phone             *string    `json:"phone"`
	City              *string    `json:"city"`
	Source            *string    `json:"source"`
	Reason            *string    `json:"reason"`
	AgentType         *string    `json:"agentType"`
	Stage             string     `json:"stage"`
	ApprovalStatus    *string    `json:"approvalStatus"`
	RejectedReason    *string    `json:"rejectedReason"`
	InterviewType     *string    `json:"interviewType"`
	InterviewDate     *time.Time `json:"interviewDate"`
	InterviewLink     *string    `json:"interviewLink"`
	InterviewNotes    *string    `json:"interviewNotes"`
	CalendlyEventURI  *string    `json:"calendlyEventUri"`
	AssignedManagerID *string    `json:"assignedManagerId"`
	OptedOut          bool       `json:"optedOut"`
	OptedOutAt        *time.Time `json:"optedOutAt"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`

	// Expanded pipeline fields
	LeadSource               *string          `json:"leadSource"`
	IsLicensed               bool             `json:"isLicensed"`
	LicenseState             *string          `json:"licenseState"`
	LicenseNumber            *string          `json:"licenseNumber"`
	LicenseExpiryDate        *time.Time       `json:"licenseExpiryDate"`
	CourseEnrolledDate       *time.Time       `json:"courseEnrolledDate"`
	CourseName               *string          `json:"courseName"`
	CourseProgress           *int             `json:"courseProgress"`
	ContractingStatus        *string          `json:"contractingStatus"`
	ContractingCarrier       *string          `json:"contractingCarrier"`
	ContractingSubmittedDate *time.Time       `json:"contractingSubmittedDate"`
	DiscordJoinedDate        *time.Time       `json:"discordJoinedDate"`
	OnboardingChecklist      json.RawMessage  `json:"onboardingChecklist"`
	State                    *string          `json:"state"`
	PriorExperience          *string          `json:"priorExperience"`
	IsCurrentlyLicensed      *bool            `json:"isCurrentlyLicensed"`
	HowHeard                 *string          `json:"howHeard"`
}

type RecruitStats struct {
	ByStage           map[string]int `json:"byStage"`
	Total             int            `json:"total"`
	ThisWeek          int            `json:"thisWeek"`
	ConversionRate    float64        `json:"conversionRate"`
	AvgDaysInPipeline float64        `json:"avgDaysInPipeline"`
}

func (d *DB) CreateRecruit(ctx context.Context, r *Recruit) (string, error) {
	var checklistBytes []byte
	if r.OnboardingChecklist != nil {
		checklistBytes = []byte(r.OnboardingChecklist)
	}
	var id string
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO recruits (org_id, discord_id, first_name, last_name, email, phone, city, source, reason, agent_type, stage, assigned_manager_id,
		  lead_source, is_licensed, license_state, license_number, license_expiry_date,
		  course_enrolled_date, course_name, course_progress, contracting_status, contracting_carrier,
		  contracting_submitted_date, discord_joined_date, onboarding_checklist, state, prior_experience,
		  is_currently_licensed, how_heard)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
		 RETURNING id::TEXT`,
		r.OrgID, r.DiscordID, r.FirstName, r.LastName, r.Email, r.Phone, r.City, r.Source, r.Reason, r.AgentType, r.Stage, r.AssignedManagerID,
		r.LeadSource, r.IsLicensed, r.LicenseState, r.LicenseNumber, r.LicenseExpiryDate,
		r.CourseEnrolledDate, r.CourseName, r.CourseProgress, r.ContractingStatus, r.ContractingCarrier,
		r.ContractingSubmittedDate, r.DiscordJoinedDate, checklistBytes, r.State, r.PriorExperience,
		r.IsCurrentlyLicensed, r.HowHeard).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("db: create recruit: %w", err)
	}

	// CRM M0 sync (post-commit). Non-fatal on error.
	d.crmSyncAfterCreate("recruits", id, SourceRow{
		Kind:         "recruit",
		SourceID:     id,
		FirstName:    r.FirstName,
		LastName:     r.LastName,
		Email:        r.Email,
		Phone:        derefOr(r.Phone, ""),
		OwnerAgentID: derefOr(r.AssignedManagerID, ""),
		City:         derefOr(r.City, ""),
		State:        derefOr(r.State, ""),
	})

	return id, nil
}

func (d *DB) GetRecruit(ctx context.Context, id string) (*Recruit, error) {
	var r Recruit
	var orgID, discordID, phone, city, source, reason, agentType, approvalStatus, rejectedReason, interviewType, interviewLink, interviewNotes, calendlyURI, managerID sql.NullString
	var interviewDate, optedOutAt sql.NullTime
	// Expanded pipeline scan vars
	var leadSource, licenseState, licenseNumber, courseName, contractingStatus, contractingCarrier, stateCol, priorExperience, howHeard sql.NullString
	var licenseExpiryDate, courseEnrolledDate, contractingSubmittedDate, discordJoinedDate sql.NullTime
	var courseProgress sql.NullInt64
	var isCurrentlyLicensed sql.NullBool
	var checklistBytes []byte
	err := d.pool.QueryRowContext(ctx,
		`SELECT id::TEXT, org_id::TEXT, discord_id, first_name, last_name, email, phone, city, source, reason, agent_type,
		        stage, approval_status, rejected_reason, interview_type, interview_date, interview_link,
		        interview_notes, calendly_event_uri, assigned_manager_id, COALESCE(opted_out, false), opted_out_at,
		        created_at, updated_at,
		        lead_source, COALESCE(is_licensed, false), license_state, license_number, license_expiry_date,
		        course_enrolled_date, course_name, course_progress, contracting_status, contracting_carrier,
		        contracting_submitted_date, discord_joined_date, onboarding_checklist, state, prior_experience,
		        is_currently_licensed, how_heard
		 FROM recruits WHERE id = $1::UUID`, id).Scan(
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
		return nil, fmt.Errorf("db: get recruit: %w", err)
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
	// Expanded pipeline assignments
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

func (d *DB) ListRecruits(ctx context.Context, search, stage string, page, perPage int) ([]Recruit, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argN := 1

	if search != "" {
		where = append(where, fmt.Sprintf("(first_name ILIKE $%d ESCAPE '\\' OR last_name ILIKE $%d ESCAPE '\\' OR email ILIKE $%d ESCAPE '\\')", argN, argN, argN))
		args = append(args, "%"+SanitizeLike(search)+"%")
		argN++
	}
	if stage != "" {
		where = append(where, fmt.Sprintf("stage = $%d", argN))
		args = append(args, stage)
		argN++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	err := d.pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM recruits WHERE "+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("db: count recruits: %w", err)
	}

	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 25
	}
	offset := (page - 1) * perPage
	args = append(args, perPage, offset)

	rows, err := d.pool.QueryContext(ctx,
		fmt.Sprintf(`SELECT id::TEXT, org_id::TEXT, discord_id, first_name, last_name, email, phone, city, source, reason, agent_type,
		        stage, approval_status, rejected_reason, interview_type, interview_date, interview_link,
		        interview_notes, calendly_event_uri, assigned_manager_id, COALESCE(opted_out, false), opted_out_at,
		        created_at, updated_at,
		        lead_source, COALESCE(is_licensed, false), license_state, license_number, license_expiry_date,
		        course_enrolled_date, course_name, course_progress, contracting_status, contracting_carrier,
		        contracting_submitted_date, discord_joined_date, onboarding_checklist, state, prior_experience,
		        is_currently_licensed, how_heard
		 FROM recruits WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, whereClause, argN, argN+1), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("db: list recruits: %w", err)
	}
	defer rows.Close()

	var result []Recruit
	for rows.Next() {
		var r Recruit
		var orgID, discordID, phone, city, source, reason, agentType, approvalStatus, rejectedReason, interviewType, interviewLink, interviewNotes, calendlyURI, managerID sql.NullString
		var interviewDate, optedOutAt sql.NullTime
		var leadSource, licenseState, licenseNumber, courseName, contractingStatus, contractingCarrier, stateCol, priorExperience, howHeard sql.NullString
		var licenseExpiryDate, courseEnrolledDate, contractingSubmittedDate, discordJoinedDate sql.NullTime
		var courseProgress sql.NullInt64
		var isCurrentlyLicensed sql.NullBool
		var checklistBytes []byte
		if err := rows.Scan(&r.ID, &orgID, &discordID, &r.FirstName, &r.LastName, &r.Email, &phone, &city, &source, &reason, &agentType,
			&r.Stage, &approvalStatus, &rejectedReason, &interviewType, &interviewDate, &interviewLink,
			&interviewNotes, &calendlyURI, &managerID, &r.OptedOut, &optedOutAt,
			&r.CreatedAt, &r.UpdatedAt,
			&leadSource, &r.IsLicensed, &licenseState, &licenseNumber, &licenseExpiryDate,
			&courseEnrolledDate, &courseName, &courseProgress, &contractingStatus, &contractingCarrier,
			&contractingSubmittedDate, &discordJoinedDate, &checklistBytes, &stateCol, &priorExperience,
			&isCurrentlyLicensed, &howHeard); err != nil {
			return nil, 0, fmt.Errorf("db: scan recruit: %w", err)
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
		result = append(result, r)
	}
	return result, total, rows.Err()
}

func (d *DB) UpdateRecruit(ctx context.Context, id string, updates map[string]interface{}) error {
	sets := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argN := 1

	fieldMap := map[string]string{
		"stage": "stage", "rejectedReason": "rejected_reason", "interviewType": "interview_type",
		"interviewDate": "interview_date", "interviewLink": "interview_link", "interviewNotes": "interview_notes",
		"calendlyEventUri": "calendly_event_uri", "assignedManagerId": "assigned_manager_id",
		"approvalStatus": "approval_status", "firstName": "first_name", "lastName": "last_name",
		"email": "email", "phone": "phone", "city": "city", "source": "source", "reason": "reason", "agentType": "agent_type",
		"optedOut": "opted_out", "optedOutAt": "opted_out_at",
		"discordId": "discord_id",
		// Expanded pipeline fields
		"leadSource": "lead_source", "isLicensed": "is_licensed", "licenseState": "license_state",
		"licenseNumber": "license_number", "licenseExpiryDate": "license_expiry_date",
		"courseEnrolledDate": "course_enrolled_date", "courseName": "course_name", "courseProgress": "course_progress",
		"contractingStatus": "contracting_status", "contractingCarrier": "contracting_carrier",
		"contractingSubmittedDate": "contracting_submitted_date", "discordJoinedDate": "discord_joined_date",
		"onboardingChecklist": "onboarding_checklist", "state": "state", "priorExperience": "prior_experience",
		"isCurrentlyLicensed": "is_currently_licensed", "howHeard": "how_heard",
	}

	for jsonKey, col := range fieldMap {
		if v, ok := updates[jsonKey]; ok {
			sets = append(sets, fmt.Sprintf("%s = $%d", col, argN))
			args = append(args, v)
			argN++
		}
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE recruits SET %s WHERE id = $%d::UUID", strings.Join(sets, ", "), argN)
	_, err := d.pool.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("db: update recruit: %w", err)
	}
	return nil
}

func (d *DB) DeleteRecruit(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM recruits WHERE id = $1::UUID", id)
	if err != nil {
		return fmt.Errorf("db: delete recruit: %w", err)
	}
	return nil
}

func (d *DB) GetRecruitStats(ctx context.Context) (*RecruitStats, error) {
	stats := &RecruitStats{ByStage: map[string]int{}}

	rows, err := d.pool.QueryContext(ctx, "SELECT stage, COUNT(*) FROM recruits GROUP BY stage")
	if err != nil {
		return nil, fmt.Errorf("db: recruit stats: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var stage string
		var count int
		if err := rows.Scan(&stage, &count); err != nil {
			return nil, fmt.Errorf("db: scan recruit stats: %w", err)
		}
		stats.ByStage[stage] = count
		stats.Total += count
	}

	d.pool.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM recruits WHERE created_at >= NOW() - INTERVAL '7 days'").Scan(&stats.ThisWeek)

	if stats.Total > 0 {
		var onboarded int
		d.pool.QueryRowContext(ctx, "SELECT COUNT(*) FROM recruits WHERE stage = 'ONBOARDED'").Scan(&onboarded)
		stats.ConversionRate = float64(onboarded) / float64(stats.Total) * 100
	}

	d.pool.QueryRowContext(ctx,
		"SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400), 0) FROM recruits WHERE stage != 'NEW_LEAD'").Scan(&stats.AvgDaysInPipeline)

	return stats, rows.Err()
}
