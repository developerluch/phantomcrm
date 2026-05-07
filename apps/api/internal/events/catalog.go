// Package events defines the append-only domain event log for the CRM.
//
// LSP contract: any Publisher implementation must accept any Event defined in
// this catalog and persist it with the same semantics. Callers MUST NOT use an
// event type not declared here — add it to this catalog first so the system
// has a single source of truth for what events exist.
package events

// Event type constants — dotted naming: <subject>.<verb>.
// Payload shape for each type is documented next to the constant.
const (
	// Contacts ------------------------------------------------------------
	//
	// TypeContactCreated  payload: { source_type, source_id, contact }
	TypeContactCreated = "contact.created"
	// TypeContactUpdated  payload: { before: {...diff fields}, after: {...diff fields} }
	TypeContactUpdated = "contact.updated"
	// TypeContactTagged   payload: { tag }
	TypeContactTagged = "contact.tagged"
	// TypeContactUntagged payload: { tag }
	TypeContactUntagged = "contact.untagged"
	// TypeContactArchived  payload: {}
	TypeContactArchived = "contact.archived"
	// TypeContactRestored  payload: {}
	TypeContactRestored = "contact.restored"
	// TypeContactOwnerChanged payload: { from, to }
	TypeContactOwnerChanged = "contact.owner_changed"
	// TypeContactLifecycleChanged payload: { from, to }
	TypeContactLifecycleChanged = "contact.lifecycle_changed"
	// TypeContactDNCChanged payload: { do_not_sms, do_not_email, do_not_call }
	TypeContactDNCChanged = "contact.dnc_changed"

	// Addresses -----------------------------------------------------------
	//
	// TypeAddressCreated payload: { address }
	TypeAddressCreated = "address.created"
	// TypeAddressUpdated payload: { before, after }
	TypeAddressUpdated = "address.updated"
	// TypeAddressDeleted payload: { address_id }
	TypeAddressDeleted = "address.deleted"
	// TypeAddressPrimaryChanged payload: { from_address_id, to_address_id }
	TypeAddressPrimaryChanged = "address.primary_changed"
)

// KnownTypes is the closed set of event types a Publisher will accept.
// Publishers MAY consult this to reject unknown types — useful for early
// detection of catalog drift.
var KnownTypes = map[string]struct{}{
	TypeContactCreated:          {},
	TypeContactUpdated:          {},
	TypeContactTagged:           {},
	TypeContactUntagged:         {},
	TypeContactArchived:         {},
	TypeContactRestored:         {},
	TypeContactOwnerChanged:     {},
	TypeContactLifecycleChanged: {},
	TypeContactDNCChanged:       {},
	TypeAddressCreated:          {},
	TypeAddressUpdated:          {},
	TypeAddressDeleted:          {},
	TypeAddressPrimaryChanged:   {},
}
