package db

import "context"

// migrateTelnyxSMS runs Phase 44: index for SMS provider status webhook
// lookup. Additive only: CREATE INDEX IF NOT EXISTS. No DROP, no renames.
//
// Status webhooks (Telnyx today, Twilio later) lookup messages by
// (provider, external_message_id) to update delivery state. Without this
// index the UPDATE does a sequential scan against the messages table.
func (d *DB) migrateTelnyxSMS(ctx context.Context) error {
	stmts := []string{
		`CREATE INDEX IF NOT EXISTS messages_provider_extid_idx
		 ON messages(provider, external_message_id)
		 WHERE external_message_id IS NOT NULL`,
	}
	for _, m := range stmts {
		if _, err := d.pool.ExecContext(ctx, m); err != nil {
			return err
		}
	}
	return nil
}
