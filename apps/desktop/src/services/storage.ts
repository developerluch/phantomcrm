// User profile, logo, and agency storage for Phantom CRM Dashboard.
// Multi-server ServerAccount abstraction was removed when phantomcrm-api became
// the single canonical backend — see src/services/config.ts:CANONICAL_API_URL.

export interface UserProfile {
  name: string
  role: string
  avatar: string | null // base64 data URL
}

export interface Agency {
  id: string
  name: string
}

const PROFILE_KEY       = 'vipa-profile'
const LOGO_KEY          = 'vipa-logo'
const AGENCIES_KEY      = 'vipa-agencies'
const ACTIVE_AGENCY_KEY = 'vipa-active-agency'

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

// ── User Profile ─────────────────────────────────────────────────────────────

export function getProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) return JSON.parse(raw) as UserProfile
  } catch { /* ignore */ }
  return { name: '', role: '', avatar: null }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

// ── Logo ─────────────────────────────────────────────────────────────────────

export function getLogo(): string | null {
  return localStorage.getItem(LOGO_KEY)
}

export function saveLogo(dataUrl: string | null): void {
  if (dataUrl) localStorage.setItem(LOGO_KEY, dataUrl)
  else localStorage.removeItem(LOGO_KEY)
}

// ── Agencies ─────────────────────────────────────────────────────────────────

export function getAgencies(): Agency[] {
  try {
    const raw = localStorage.getItem(AGENCIES_KEY)
    if (raw) return JSON.parse(raw) as Agency[]
  } catch { /* ignore */ }
  return []
}

function persistAgencies(agencies: Agency[]): void {
  localStorage.setItem(AGENCIES_KEY, JSON.stringify(agencies))
}

export function getActiveAgencyId(): string | null {
  return localStorage.getItem(ACTIVE_AGENCY_KEY)
}

export function getActiveAgency(): Agency | null {
  const agencies = getAgencies()
  const id = getActiveAgencyId()
  return agencies.find((a) => a.id === id) ?? agencies[0] ?? null
}

export function addAgency(name: string): Agency {
  const agencies = getAgencies()
  const agency: Agency = { id: generateId(), name: name.trim() }
  persistAgencies([...agencies, agency])
  localStorage.setItem(ACTIVE_AGENCY_KEY, agency.id)
  return agency
}

export function setActiveAgency(id: string): void {
  localStorage.setItem(ACTIVE_AGENCY_KEY, id)
}

export function removeAgency(id: string): void {
  const agencies = getAgencies().filter((a) => a.id !== id)
  persistAgencies(agencies)
  if (getActiveAgencyId() === id) {
    localStorage.setItem(ACTIVE_AGENCY_KEY, agencies[0]?.id ?? '')
  }
}
