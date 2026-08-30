import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'
import {
  IconSearch, IconPlus, IconTrash, IconCheck, IconX, IconShield, IconUsers,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import EmptyState from '../components/EmptyState'

const ALL_PERMISSIONS = [
  'agents.view', 'agents.edit', 'agents.kick', 'agents.nudge',
  'dashboard.view', 'reports.view', 'reports.export',
  'campaigns.view', 'campaigns.create', 'campaigns.delete',
  'documents.view', 'documents.upload', 'documents.delete',
  'users.view', 'users.edit', 'roles.manage',
  'audit.view', 'settings.manage', 'wavv.view', 'wavv.manage',
]

const DONUT_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4']

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

export default function UsersRolesPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  const [search, setSearch] = useState('')

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5 pt-6">
      <motion.div variants={itemVariants}>
        <h1 className="text-xl font-bold text-foreground">Users & Roles</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage team members and permission roles</p>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'users' | 'roles'); setSearch('') }}>
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </motion.div>

      {tab === 'users' ? (
        <UsersTab search={search} queryClient={queryClient} />
      ) : (
        <RolesTab search={search} queryClient={queryClient} />
      )}
    </motion.div>
  )
}

function UsersTab({ search, queryClient }: { search: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers(),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.getRoles(),
  })

  const filtered = search
    ? users.filter(
        (u) =>
          u.displayName.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users

  const roleChartData = useMemo(
    () =>
      roles
        .map((r) => ({ name: r.name, count: users.filter((u) => u.roleId === r.id).length }))
        .filter((d) => d.count > 0),
    [users, roles]
  )

  const roleChartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {}
    roleChartData.forEach((d, i) => {
      config[d.name] = { label: d.name, color: DONUT_COLORS[i % DONUT_COLORS.length] }
    })
    return config
  }, [roleChartData])

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      await api.updateUser(id, { isActive: !isActive })
      toast.success(isActive ? 'User deactivated' : 'User activated')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  async function handleRoleChange(id: string, roleId: string) {
    try {
      await api.updateUser(id, { roleId })
      toast.success('Role updated')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[60vh] bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <>
      {roleChartData.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Role Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ChartContainer config={roleChartConfig} className="h-[160px] w-[160px] aspect-square">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie
                    data={roleChartData}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {roleChartData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-wrap gap-3">
                {roleChartData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-medium text-foreground">{d.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <EmptyState
                icon={IconUsers}
                title="No users found"
                description="Try adjusting your search or invite new team members."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2">User</th>
                      <th className="text-left py-2">Email</th>
                      <th className="text-left py-2">Role</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Last Login</th>
                      <th className="text-right py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} className="w-6 h-6 rounded-full" alt="" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-foreground">
                                {u.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-foreground">{u.displayName || '—'}</span>
                          </div>
                        </td>
                        <td className="py-2 text-muted-foreground">{u.email || '—'}</td>
                        <td className="py-2">
                          <Select value={u.roleId} onValueChange={(value) => handleRoleChange(u.id, value)}>
                            <SelectTrigger className="h-7 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((r) => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                            u.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {u.isActive ? <><IconCheck size={10} /> Active</> : <><IconX size={10} /> Inactive</>}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(u.id, u.isActive)}
                            className="text-xs"
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}

function RolesTab({ search, queryClient }: { search: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPerms, setNewPerms] = useState<string[]>([])

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.getRoles(),
  })

  const filtered = search
    ? roles.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : roles

  async function handleCreate() {
    if (!newName.trim()) { toast.error('Role name is required'); return }
    try {
      await api.createRole({ name: newName.trim(), permissions: newPerms })
      toast.success('Role created')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowCreate(false)
      setNewName('')
      setNewPerms([])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteRole(id)
      toast.success('Role deleted')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  function togglePerm(perm: string) {
    setNewPerms((p) => p.includes(perm) ? p.filter((x) => x !== perm) : [...p, perm])
  }

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[60vh] bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <>
      <motion.div variants={itemVariants} className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <IconPlus size={14} className="mr-1" />
          New Role
        </Button>
      </motion.div>

      {showCreate && (
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Create Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Role name"
                className="h-8 text-xs max-w-xs"
              />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Permissions</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-white/[0.02]"
                    >
                      <Checkbox
                        checked={newPerms.includes(perm)}
                        onCheckedChange={() => togglePerm(perm)}
                      />
                      <span className="text-foreground">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreate}>Create</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{filtered.length} role{filtered.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <EmptyState
                icon={IconShield}
                title="No roles yet"
                description="Create your first role to manage permissions."
                action={{ label: 'New Role', onClick: () => setShowCreate(true) }}
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border hover:bg-white/[0.02] transition-colors"
                  >
                    <IconShield size={18} className="text-blue-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{role.name}</p>
                        {role.isSystem && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-500/10 text-muted-foreground">System</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {role.permissions.slice(0, 8).map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px]">
                            {p}
                          </span>
                        ))}
                        {role.permissions.length > 8 && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-500/10 text-muted-foreground text-[10px]">
                            +{role.permissions.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(role.id)}
                        className="text-muted-foreground hover:text-red-400 transition-colors mt-1 h-auto p-1"
                      >
                        <IconTrash size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
