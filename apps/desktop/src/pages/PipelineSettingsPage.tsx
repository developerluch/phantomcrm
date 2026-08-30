import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { StageConfig, RecruitStage } from '../types/portal'
import { RECRUIT_STAGE_COLORS, RECRUIT_STAGE_LABELS, RECRUIT_STAGES } from '../types/portal'
import { toast } from 'sonner'
import {
  IconSettings,
  IconDeviceFloppy,
  IconLoader2,
  IconPlugConnectedX,
  IconInfoCircle,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ── Stage action descriptions ──────────────────────────────────────────

const STAGE_ACTION_DESCRIPTIONS: Record<RecruitStage, string> = {
  NEW_LEAD: 'Send welcome SMS',
  PREQUALIFIED: 'Notify manager on Discord',
  INTERVIEW_SCHEDULED: 'Send calendar invite',
  INTERVIEWED: 'Schedule follow-up',
  ONBOARDING: 'Send Discord invite + meeting link',
  IN_COURSE: 'Start 30-day countdown',
  LICENSED: 'Notify manager, prompt contracting',
  CONTRACTING: 'Track carrier submission',
  ACTIVE: 'Send congratulations, add to active agents',
  REJECTED: 'Send rejection notification',
}

// ── Local row state for inline editing ──────────────────────────────────

interface RowDraft {
  smsTemplate: string
  managerName: string
  managerDiscordId: string
  notifyDiscord: boolean
  autoAssign: boolean
}

function draftFromConfig(cfg: StageConfig): RowDraft {
  return {
    smsTemplate: cfg.smsTemplate,
    managerName: cfg.managerName,
    managerDiscordId: cfg.managerDiscordId,
    notifyDiscord: cfg.notifyDiscord,
    autoAssign: cfg.autoAssign,
  }
}

// ── Stage row component ─────────────────────────────────────────────────

function StageRow({
  config,
  draft,
  onDraftChange,
  onSave,
  isSaving,
}: {
  config: StageConfig
  draft: RowDraft
  onDraftChange: (d: RowDraft) => void
  onSave: () => void
  isSaving: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const color = RECRUIT_STAGE_COLORS[config.stage as RecruitStage] ?? '#6b7280'
  const label = RECRUIT_STAGE_LABELS[config.stage as RecruitStage] ?? config.stage

  const isDirty =
    draft.smsTemplate !== config.smsTemplate ||
    draft.managerName !== config.managerName ||
    draft.managerDiscordId !== config.managerDiscordId ||
    draft.notifyDiscord !== config.notifyDiscord ||
    draft.autoAssign !== config.autoAssign

  const actionDesc = STAGE_ACTION_DESCRIPTIONS[config.stage as RecruitStage] ?? 'Manual review required'

  return (
    <tr className="border-b border-border/40 hover:bg-white/[0.02] transition-colors">
      {/* Stage badge and description */}
      <td className="py-3 px-3 align-top">
        <div className="space-y-1">
          <Badge
            className="inline-block px-2.5 py-0.5 whitespace-nowrap"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {label}
          </Badge>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <IconInfoCircle size={12} className="shrink-0" />
            {actionDesc}
          </p>
        </div>
      </td>

      {/* SMS Template */}
      <td className="py-3 px-3 align-top">
        {expanded ? (
          <Textarea
            value={draft.smsTemplate}
            onChange={(e) =>
              onDraftChange({ ...draft, smsTemplate: e.target.value })
            }
            onBlur={() => {
              if (!draft.smsTemplate) setExpanded(false)
            }}
            rows={4}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
            placeholder="SMS template text..."
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setExpanded(true)}
                className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[280px] block h-auto px-2 py-1 justify-start"
              >
                {draft.smsTemplate
                  ? draft.smsTemplate.length > 60
                    ? `${draft.smsTemplate.slice(0, 60)}...`
                    : draft.smsTemplate
                  : 'Click to edit...'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{draft.smsTemplate || 'Click to edit'}</TooltipContent>
          </Tooltip>
        )}
      </td>

      {/* Manager Name */}
      <td className="py-3 px-3 align-top">
        <Input
          value={draft.managerName}
          onChange={(e) =>
            onDraftChange({ ...draft, managerName: e.target.value })
          }
          placeholder="Manager name"
          className="text-sm h-8"
        />
      </td>

      {/* Manager Discord ID */}
      <td className="py-3 px-3 align-top">
        <Input
          value={draft.managerDiscordId}
          onChange={(e) =>
            onDraftChange({ ...draft, managerDiscordId: e.target.value })
          }
          placeholder="Discord ID"
          className="text-sm h-8 font-mono"
        />
      </td>

      {/* Notify Discord */}
      <td className="py-3 px-3 align-top text-center">
        <Switch
          checked={draft.notifyDiscord}
          onCheckedChange={(v) => onDraftChange({ ...draft, notifyDiscord: v })}
        />
      </td>

      {/* Auto-Assign */}
      <td className="py-3 px-3 align-top text-center">
        <Switch
          checked={draft.autoAssign}
          onCheckedChange={(v) => onDraftChange({ ...draft, autoAssign: v })}
        />
      </td>

      {/* Actions */}
      <td className="py-3 px-3 align-top">
        <Button
          variant="gradient"
          size="sm"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="flex items-center gap-1.5 text-xs"
        >
          {isSaving ? (
            <IconLoader2 size={13} className="animate-spin" />
          ) : (
            <IconDeviceFloppy size={13} />
          )}
          Save
        </Button>
      </td>
    </tr>
  )
}

// ── Main page component ─────────────────────────────────────────────────

export default function PipelineSettingsPage() {
  const queryClient = useQueryClient()

  const {
    data: configs,
    isLoading,
    isError,
  } = useQuery<StageConfig[]>({
    queryKey: ['stage-configs'],
    queryFn: () => api.getStageConfigs(),
  })

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const initialisedRef = useRef(false)

  // Initialise drafts when data arrives
  useEffect(() => {
    if (configs && !initialisedRef.current) {
      const initial: Record<string, RowDraft> = {}
      for (const cfg of configs) {
        initial[cfg.stage] = draftFromConfig(cfg)
      }
      setDrafts(initial)
      initialisedRef.current = true
    }
  }, [configs])

  const [savingStage, setSavingStage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: ({
      stage,
      data,
    }: {
      stage: string
      data: Partial<StageConfig>
    }) => api.updateStageConfig(stage, data),
    onSuccess: (_result, variables) => {
      toast.success(
        `Settings saved for ${
          RECRUIT_STAGE_LABELS[variables.stage as RecruitStage] ??
          variables.stage
        }`
      )
      queryClient.invalidateQueries({ queryKey: ['stage-configs'] })
      // Reset initialised so drafts refresh from server
      initialisedRef.current = false
      setSavingStage(null)
    },
    onError: (_err, variables) => {
      toast.error(
        `Failed to save settings for ${
          RECRUIT_STAGE_LABELS[variables.stage as RecruitStage] ??
          variables.stage
        }`
      )
      setSavingStage(null)
    },
  })

  function handleSave(stage: string) {
    const draft = drafts[stage]
    if (!draft) return
    setSavingStage(stage)
    mutation.mutate({
      stage,
      data: {
        smsTemplate: draft.smsTemplate,
        managerName: draft.managerName,
        managerDiscordId: draft.managerDiscordId,
        notifyDiscord: draft.notifyDiscord,
        autoAssign: draft.autoAssign,
      },
    })
  }

  // ── Loading skeleton ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-background text-foreground min-h-screen p-6 space-y-6 animate-fade-in">
        <div>
          <div
            className="h-7 w-48 animate-pulse rounded"
            style={{ background: 'hsl(var(--muted))' }}
          />
          <div
            className="h-4 w-80 animate-pulse rounded mt-2"
            style={{ background: 'hsl(var(--muted))' }}
          />
        </div>
        <div
          className="rounded-xl border border-border/50 overflow-hidden"
          style={{
            background:
              'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))',
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 px-4 py-4 border-b border-border/30"
            >
              <div
                className="h-6 w-20 rounded-full animate-pulse"
                style={{ background: 'hsl(var(--muted))' }}
              />
              <div
                className="h-6 flex-1 rounded animate-pulse"
                style={{ background: 'hsl(var(--muted))' }}
              />
              <div
                className="h-6 w-28 rounded animate-pulse"
                style={{ background: 'hsl(var(--muted))' }}
              />
              <div
                className="h-6 w-28 rounded animate-pulse"
                style={{ background: 'hsl(var(--muted))' }}
              />
              <div
                className="h-5 w-8 rounded-full animate-pulse"
                style={{ background: 'hsl(var(--muted))' }}
              />
              <div
                className="h-5 w-8 rounded-full animate-pulse"
                style={{ background: 'hsl(var(--muted))' }}
              />
              <div
                className="h-6 w-16 rounded animate-pulse"
                style={{ background: 'hsl(var(--muted))' }}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="bg-background text-foreground min-h-screen p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Pipeline Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure SMS templates and manager assignments per stage
          </p>
        </div>
        <div
          className="rounded-xl border border-border/50 p-12 text-center"
          style={{
            background:
              'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))',
          }}
        >
          <IconPlugConnectedX
            size={48}
            className="mx-auto mb-4 text-muted-foreground"
          />
          <p className="text-muted-foreground mb-2">
            Could not load pipeline stage configurations.
          </p>
          <p className="text-sm text-muted-foreground">
            Make sure your server is running and the API URL is configured
            correctly in Settings.
          </p>
        </div>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────

  return (
    <div className="bg-background text-foreground min-h-screen p-6 space-y-6 animate-fade-in pt-6">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <IconSettings size={20} className="text-purple-400" />
          Pipeline Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure SMS templates and manager assignments per stage
        </p>
      </div>

      {/* Info card with stage descriptions */}
      <Card className="bg-card/50 backdrop-blur border-border/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <IconInfoCircle size={16} className="text-blue-400" />
            Pipeline Stages & Auto-Actions
          </CardTitle>
          <CardDescription className="text-xs">
            Each stage has an associated auto-action that triggers when a recruit reaches that stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {RECRUIT_STAGES.filter(s => s !== 'REJECTED').map((stage) => (
              <div key={stage} className="rounded-lg border border-border/30 bg-muted/20 p-3">
                <p className="text-xs font-semibold text-foreground mb-1">
                  {RECRUIT_STAGE_LABELS[stage]}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {STAGE_ACTION_DESCRIPTIONS[stage]}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div
        className="rounded-xl border border-border/50 overflow-hidden"
        style={{
          background:
            'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="text-left py-3 px-3 font-medium">Stage</th>
                <th className="text-left py-3 px-3 font-medium min-w-[240px]">
                  SMS Template
                </th>
                <th className="text-left py-3 px-3 font-medium min-w-[140px]">
                  Manager Name
                </th>
                <th className="text-left py-3 px-3 font-medium min-w-[160px]">
                  Manager Discord ID
                </th>
                <th className="text-center py-3 px-3 font-medium whitespace-nowrap">
                  Notify Discord
                </th>
                <th className="text-center py-3 px-3 font-medium whitespace-nowrap">
                  Auto-Assign
                </th>
                <th className="text-left py-3 px-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs && configs.length > 0 ? (
                configs.map((cfg) => (
                  <StageRow
                    key={cfg.id}
                    config={cfg}
                    draft={drafts[cfg.stage] ?? draftFromConfig(cfg)}
                    onDraftChange={(d) =>
                      setDrafts((prev) => ({ ...prev, [cfg.stage]: d }))
                    }
                    onSave={() => handleSave(cfg.stage)}
                    isSaving={savingStage === cfg.stage}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No stage configurations found. Stage configs are created
                    automatically when the pipeline is initialised.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
