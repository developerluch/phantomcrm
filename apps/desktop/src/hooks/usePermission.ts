import { useAuthStore } from '../store'

export function usePermission(permission: string): boolean {
  const user = useAuthStore((s) => s.user)
  if (!user) return false
  if (user.permissions.includes('*')) return true
  return user.permissions.includes(permission)
}

export function usePermissions(...permissions: string[]): boolean[] {
  const user = useAuthStore((s) => s.user)
  if (!user) return permissions.map(() => false)
  if (user.permissions.includes('*')) return permissions.map(() => true)
  return permissions.map((p) => user.permissions.includes(p))
}
