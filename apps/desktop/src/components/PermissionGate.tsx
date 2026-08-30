import type { ReactNode } from 'react'
import { usePermission } from '../hooks/usePermission'

interface PermissionGateProps {
  require: string
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ require, children, fallback = null }: PermissionGateProps) {
  const hasPermission = usePermission(require)
  return hasPermission ? <>{children}</> : <>{fallback}</>
}
