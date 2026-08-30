import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IconUsers, IconArrowRight } from '@tabler/icons-react'

export default function TeamRolesSettings() {
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => api.getUsers() })
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => api.getRoles() })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Team & Roles</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your team members and their roles</p>
      </div>

      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconUsers size={15} className="text-purple-400" />
            Team Summary
          </CardTitle>
          <CardDescription className="text-xs">Quick overview of your organization members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/20 border border-border/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
            <div className="rounded-lg bg-muted/20 border border-border/50 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{roles.length}</p>
              <p className="text-xs text-muted-foreground">Roles Defined</p>
            </div>
          </div>

          {roles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {roles.map((role: { id: string; name: string }) => (
                <Badge key={role.id} variant="outline" className="text-xs">{role.name}</Badge>
              ))}
            </div>
          )}

          <a
            href="#/users-roles"
            className="flex items-center gap-2 text-sm text-primary hover:underline pt-1"
          >
            Manage all users and roles
            <IconArrowRight size={14} />
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
