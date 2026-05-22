package db

import "context"

// migrateUserNPN runs Phase 43: NPN verification fields on users.
// Additive only: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
// No DROP, no renames.
func (d *DB) migrateUserNPN(ctx context.Context) error {
	stmts := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS npn TEXT`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS canonical_name TEXT`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS npn_verified_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_users_npn ON users(npn) WHERE npn IS NOT NULL`,
	}
	for _, m := range stmts {
		if _, err := d.pool.ExecContext(ctx, m); err != nil {
			return err
		}
	}
	return nil
}
