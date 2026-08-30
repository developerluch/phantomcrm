import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createLicenseSchema, type CreateLicenseFormData } from '../lib/schemas'
import { useLicenses, useCreateLicense, useDeleteLicense } from '../hooks/useLicenses'
import {
  LICENSE_STATUSES,
  LICENSE_STATUS_COLORS,
  LICENSE_STATUS_LABELS,
  type License,
  type LicenseStatus,
} from '../types/portal'
import { toast } from 'sonner'
import {
  IconLicense,
  IconPlus,
  IconTrash,
  IconAlertTriangle,
  IconLoader2,
  IconCheck,
  IconX as IconXMark,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'
import { DateField, formatDateString, parseDateString } from '@/components/DateField'
import { LicenseDetailSheet } from '@/components/licenses/LicenseDetailSheet'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { motion } from 'framer-motion'

// ── Animation variants ─────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 },
  },
}

// ── Chart config ───────────────────────────────────────────────

const licenseChartConfig = {
  active: { label: 'Active', color: LICENSE_STATUS_COLORS.active },
  pending: { label: 'Pending', color: LICENSE_STATUS_COLORS.pending },
  expired: { label: 'Expired', color: LICENSE_STATUS_COLORS.expired },
  revoked: { label: 'Revoked', color: LICENSE_STATUS_COLORS.revoked },
} satisfies ChartConfig

const expirationChartConfig = {
  count: { label: 'Expiring', color: '#3b82f6' },
} satisfies ChartConfig

// ── Component ──────────────────────────────────────────────────

export default function LicensesPage() {
  const [agentFilter, setAgentFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null)

  const {
    register: registerLicense,
    handleSubmit: handleLicenseSubmit,
    reset: resetLicense,
    control,
    formState: { errors: licenseErrors, isValid: licenseIsValid },
  } = useForm<CreateLicenseFormData>({
    resolver: zodResolver(createLicenseSchema),
    mode: 'onChange',
    defaultValues: {
      isResident: false,
    },
  })

  const { data: licenses = [], isLoading, isError } = useLicenses({
    agentId: agentFilter || undefined,
    state: stateFilter || undefined,
    status: statusFilter || undefined,
  })

  const createLicense = useCreateLicense()
  const deleteLicense = useDeleteLicense()

  const onLicenseValid = (data: CreateLicenseFormData) => {
    const loas = data.linesOfAuthority?.length
      ? data.linesOfAuthority
      : undefined
    createLicense.mutate(
      {
        agentId: data.agentId.trim(),
        state: data.state.trim().toUpperCase(),
        licenseNumber: data.licenseNumber.trim(),
        npn: data.npn?.trim() || undefined,
        licenseType: data.licenseType?.trim() || undefined,
        isResident: data.isResident ?? false,
        issueDate: data.issueDate || undefined,
        expirationDate: data.expirationDate || undefined,
        ceRequired: data.ceRequired || undefined,
        ceDueDate: data.ceDueDate || undefined,
        notes: data.notes?.trim() || undefined,
        linesOfAuthority: loas,
      },
      {
        onSuccess: () => {
          toast.success('License added')
          setShowCreate(false)
          resetLicense()
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to add license'),
      },
    )
  }

  const isExpiringSoon = (date: string | null | undefined) => {
    if (!date) return false
    const days = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days > 0 && days <= 30
  }

  // ── Computed metrics ─────────────────────────────────────────

  const metrics = useMemo(() => {
    const total = licenses.length
    const active = licenses.filter((l) => l.status === 'active').length
    const expired = licenses.filter((l) => l.status === 'expired').length
    const expiringSoon = licenses.filter((l) => {
      if (!l.expirationDate) return false
      const days = (new Date(l.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      return days > 0 && days <= 90
    }).length
    return { total, active, expired, expiringSoon }
  }, [licenses])

  // ── Status donut data ────────────────────────────────────────

  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of licenses) {
      counts[l.status] = (counts[l.status] || 0) + 1
    }
    return Object.entries(counts).map(([status, value]) => ({
      status,
      value,
      fill:
        LICENSE_STATUS_COLORS[status as LicenseStatus] ?? '#6b7280',
    }))
  }, [licenses])

  // ── Expiration timeline data ─────────────────────────────────

  const expirationData = useMemo(() => {
    const months: { month: string; count: number }[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' })
      const count = licenses.filter((l) => l.expirationDate?.startsWith(key)).length
      months.push({ month: label, count })
    }
    return months
  }, [licenses])

  const expirationSparkline = useMemo(
    () => expirationData.map((p) => p.count),
    [expirationData],
  )

  // ── Loading skeleton ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="h-7 w-36 bg-muted rounded animate-pulse" />
          <div className="h-9 w-32 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card/50 backdrop-blur p-4 space-y-2"
            >
              <div className="h-3 w-1/3 bg-muted/70 rounded animate-pulse" />
              <div className="h-6 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load licenses.</p>
      </div>
    )
  }

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5 pt-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Licenses</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Agent insurance licenses and verification status
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <IconPlus size={16} className="mr-1.5" />
            Add License
          </Button>
        </motion.div>

        {/* Metric Cards Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Total Licenses"
            value={metrics.total}
            icon={<IconLicense size={18} />}
            color="#3b82f6"
            sparklineData={expirationSparkline}
          />
          <MetricCard
            label="Active"
            value={metrics.active}
            icon={<IconCheck size={18} />}
            color="#22c55e"
            sparklineData={expirationSparkline}
          />
          <MetricCard
            label="Expiring Soon"
            value={metrics.expiringSoon}
            icon={<IconAlertTriangle size={18} />}
            color="#f59e0b"
            subtitle="Within 90 days"
            sparklineData={expirationSparkline}
          />
          <MetricCard
            label="Expired"
            value={metrics.expired}
            icon={<IconXMark size={18} />}
            color="#ef4444"
            sparklineData={expirationSparkline}
          />
        </motion.div>

        {/* Charts Row */}
        {licenses.length > 0 && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* License Status Donut */}
            <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
              <p className="text-xs font-semibold text-foreground mb-3">License Status</p>
              <ChartContainer
                config={licenseChartConfig}
                className="mx-auto aspect-square h-[180px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
                  <Pie
                    data={statusChartData}
                    dataKey="value"
                    nameKey="status"
                    innerRadius={50}
                    outerRadius={80}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                  >
                    {statusChartData.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex items-center justify-center gap-3 mt-2">
                {statusChartData.map((entry) => (
                  <div
                    key={entry.status}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
                    {LICENSE_STATUS_LABELS[entry.status as LicenseStatus] ?? entry.status} ({entry.value})
                  </div>
                ))}
              </div>
            </Card>

            {/* Expiration Timeline */}
            <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
              <p className="text-xs font-semibold text-foreground mb-3">Expiration Timeline</p>
              <ChartContainer config={expirationChartConfig} className="h-[200px] w-full">
                <AreaChart data={expirationData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="expirationFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                    fill="url(#expirationFill)"
                  />
                </AreaChart>
              </ChartContainer>
            </Card>
          </motion.div>
        )}

        {/* Filters */}
        <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
          <Input
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            placeholder="Filter by agent ID..."
            className="w-48"
          />
          <Input
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            placeholder="State (e.g. FL)"
            className="w-28"
          />
          <Select
            value={statusFilter || '_all'}
            onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              {LICENSE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LICENSE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Create form */}
        {showCreate && (
          <motion.form
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            onSubmit={handleLicenseSubmit(onLicenseValid)}
            className="rounded-xl border border-border/50 bg-card/50 backdrop-blur p-4 space-y-3"
          >
            <p className="text-sm font-semibold text-foreground">New License</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Agent ID *</label>
                <Input {...registerLicense('agentId')} placeholder="Discord ID" />
                {licenseErrors.agentId ? (
                  <p className="text-[11px] text-red-400 mt-1">{licenseErrors.agentId.message}</p>
                ) : null}
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">State *</label>
                <Input {...registerLicense('state')} placeholder="FL" maxLength={2} />
                {licenseErrors.state ? (
                  <p className="text-[11px] text-red-400 mt-1">{licenseErrors.state.message}</p>
                ) : null}
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">License # *</label>
                <Input {...registerLicense('licenseNumber')} placeholder="W123456" />
                {licenseErrors.licenseNumber ? (
                  <p className="text-[11px] text-red-400 mt-1">
                    {licenseErrors.licenseNumber.message}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">NPN</label>
                <Input {...registerLicense('npn')} placeholder="1234567" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">License type</label>
                <Input
                  {...registerLicense('licenseType')}
                  placeholder="Life, Health, P&amp;C"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Issue date</label>
                <Controller
                  control={control}
                  name="issueDate"
                  render={({ field }) => (
                    <DateField
                      value={parseDateString(field.value)}
                      onChange={(d) => field.onChange(formatDateString(d))}
                    />
                  )}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Expiration date</label>
                <Controller
                  control={control}
                  name="expirationDate"
                  render={({ field }) => (
                    <DateField
                      value={parseDateString(field.value)}
                      onChange={(d) => field.onChange(formatDateString(d))}
                    />
                  )}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">CE due</label>
                <Controller
                  control={control}
                  name="ceDueDate"
                  render={({ field }) => (
                    <DateField
                      value={parseDateString(field.value)}
                      onChange={(d) => field.onChange(formatDateString(d))}
                    />
                  )}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">CE required (hrs)</label>
                <Input
                  type="number"
                  min={0}
                  {...registerLicense('ceRequired', { valueAsNumber: true })}
                  placeholder="24"
                />
              </div>
              <div className="flex items-end gap-2">
                <Controller
                  control={control}
                  name="isResident"
                  render={({ field }) => (
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={(v) => field.onChange(v)}
                      />
                      <span className="text-xs text-muted-foreground">Resident</span>
                    </div>
                  )}
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Notes</label>
              <Textarea
                {...registerLicense('notes')}
                rows={2}
                placeholder="Optional notes"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={!licenseIsValid || createLicense.isPending}
              >
                {createLicense.isPending ? (
                  <IconLoader2 size={14} className="animate-spin mr-1" />
                ) : null}
                Add License
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreate(false)
                  resetLicense()
                }}
              >
                Cancel
              </Button>
            </div>
          </motion.form>
        )}

        {/* License Cards */}
        {licenses.length === 0 ? (
          <motion.div variants={itemVariants}>
            <EmptyState
              icon={IconLicense}
              title="No licenses found"
              description="Add agent licenses to track their insurance certifications."
              action={{ label: 'Add License', onClick: () => setShowCreate(true) }}
            />
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {licenses.map((license) => {
              const statusColor =
                LICENSE_STATUS_COLORS[license.status as LicenseStatus] ?? '#6b7280'
              const statusLabel =
                LICENSE_STATUS_LABELS[license.status as LicenseStatus] ?? license.status
              return (
                <motion.div
                  key={license.id}
                  variants={itemVariants}
                  onClick={() => setSelectedLicense(license)}
                  className="rounded-xl border border-border/50 bg-card/50 backdrop-blur p-4 relative cursor-pointer hover:border-border transition-colors"
                >
                  {isExpiringSoon(license.expirationDate) && (
                    <div className="absolute top-3 right-3">
                      <IconAlertTriangle size={16} className="text-amber-400" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <IconLicense size={16} className="text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      {license.agent
                        ? `${license.agent.firstName} ${license.agent.lastName}`
                        : license.agentId.slice(0, 8)}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">State</span>
                      <span className="text-foreground font-medium">{license.state}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">License #</span>
                      <span className="text-foreground font-mono">{license.licenseNumber}</span>
                    </div>
                    {license.npn ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">NPN</span>
                        <span className="text-foreground font-mono">{license.npn}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge
                        className="px-2 py-0.5"
                        style={{ background: `${statusColor}20`, color: statusColor }}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    {license.expirationDate ? (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expires</span>
                        <span
                          className={`text-foreground ${isExpiringSoon(license.expirationDate) ? 'text-amber-400 font-semibold' : ''}`}
                        >
                          {new Date(license.expirationDate).toLocaleDateString()}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 pt-2 border-t border-border flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteLicense.mutate(license.id, {
                          onSuccess: () => toast.success('License deleted'),
                          onError: () => toast.error('Failed to delete'),
                        })
                      }}
                    >
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </motion.div>

      <LicenseDetailSheet
        licenseId={selectedLicense?.id ?? null}
        fallbackLicense={selectedLicense ?? undefined}
        open={!!selectedLicense}
        onOpenChange={(v) => {
          if (!v) setSelectedLicense(null)
        }}
      />
    </>
  )
}
