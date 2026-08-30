import type { AuthUser } from '../store'

export function getAccountAgentId(user: AuthUser | null | undefined): string {
  return user?.agentId?.trim() ?? ''
}
