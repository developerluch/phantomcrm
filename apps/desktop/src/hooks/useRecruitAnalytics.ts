import { useMemo } from 'react'
import type { Recruit, RecruitStage } from '../types/portal'
import { RECRUIT_STAGES, RECRUIT_STAGE_COLORS, RECRUIT_STAGE_LABELS } from '../types/portal'

const ACTIVE_PIPELINE_STAGES = RECRUIT_STAGES.filter(s => s !== 'REJECTED')

export interface FunnelDataPoint {
  stage: string
  label: string
  count: number
  color: string
  conversionFromPrev: number | null
}

export interface TimeInStagePoint {
  stage: string
  label: string
  avgDays: number
  color: string
  severity: 'normal' | 'warning' | 'critical'
}

export interface SourceComparisonPoint {
  stage: string
  label: string
  adsCount: number
  inPersonCount: number
}

export interface LicenseTrackerEntry {
  id: string
  name: string
  daysInCourse: number
  daysRemaining: number
  source: string | null
  urgency: 'on-track' | 'warning' | 'critical'
}

export interface BottleneckEntry {
  stage: string
  label: string
  avgDays: number
  recruitCount: number
  color: string
}

export interface RecruitAnalyticsData {
  funnelData: FunnelDataPoint[]
  timeInStage: TimeInStagePoint[]
  sourceComparison: SourceComparisonPoint[]
  licenseTracker: LicenseTrackerEntry[]
  bottlenecks: BottleneckEntry[]
}

function categorizeSource(source: string | null, leadSource: string | null): 'ads' | 'in_person' | 'other' {
  if (leadSource === 'facebook_ads') return 'ads'
  if (leadSource === 'in_person') return 'in_person'
  if (leadSource === 'referral') return 'other'
  if (!source) return 'other'
  const s = source.toLowerCase()
  if (s.includes('facebook') || s.includes('instagram') || s.includes('google') || s.includes('ad')) return 'ads'
  if (s.includes('person') || s.includes('irl') || s.includes('walk') || s.includes('referral')) return 'in_person'
  return 'other'
}

export function useRecruitAnalytics(
  recruits: Recruit[],
  sourceFilter: 'all' | 'ads' | 'in_person' = 'all'
): RecruitAnalyticsData {
  return useMemo(() => {
    // Filter by source if needed
    const filtered = sourceFilter === 'all'
      ? recruits
      : recruits.filter(r => categorizeSource(r.source, r.leadSource) === sourceFilter)

    // 1. Funnel data — count recruits at or past each stage
    const stageIndex = Object.fromEntries(ACTIVE_PIPELINE_STAGES.map((s, i) => [s, i]))
    const stageCounts: Record<string, number> = {}
    for (const stage of ACTIVE_PIPELINE_STAGES) {
      stageCounts[stage] = filtered.filter(r => r.stage !== 'REJECTED' && stageIndex[r.stage] !== undefined && stageIndex[r.stage] >= stageIndex[stage]).length
    }
    // Actually, the funnel should show how many recruits are currently IN each stage (not "at or past")
    const currentStageCounts: Record<string, number> = {}
    for (const stage of ACTIVE_PIPELINE_STAGES) {
      currentStageCounts[stage] = filtered.filter(r => r.stage === stage).length
    }

    const funnelData: FunnelDataPoint[] = ACTIVE_PIPELINE_STAGES.map((stage, i) => ({
      stage: stage.toLowerCase(),
      label: RECRUIT_STAGE_LABELS[stage],
      count: currentStageCounts[stage] || 0,
      color: RECRUIT_STAGE_COLORS[stage],
      conversionFromPrev: i === 0 ? null : (
        currentStageCounts[ACTIVE_PIPELINE_STAGES[i - 1]] > 0
          ? ((currentStageCounts[stage] || 0) / currentStageCounts[ACTIVE_PIPELINE_STAGES[i - 1]]) * 100
          : 0
      ),
    }))

    // 2. Time in stage — avg days in current stage based on updatedAt
    const stageGroups: Record<string, number[]> = {}
    for (const stage of ACTIVE_PIPELINE_STAGES) stageGroups[stage] = []
    for (const r of filtered) {
      if (r.stage !== 'REJECTED' && stageGroups[r.stage]) {
        const days = (Date.now() - new Date(r.updatedAt).getTime()) / 86400000
        stageGroups[r.stage].push(days)
      }
    }

    const timeInStage: TimeInStagePoint[] = ACTIVE_PIPELINE_STAGES.map(stage => {
      const days = stageGroups[stage]
      const avg = days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : 0
      return {
        stage: stage.toLowerCase(),
        label: RECRUIT_STAGE_LABELS[stage],
        avgDays: Math.round(avg * 10) / 10,
        color: RECRUIT_STAGE_COLORS[stage],
        severity: avg > 14 ? 'critical' as const : avg > 7 ? 'warning' as const : 'normal' as const,
      }
    })

    // 3. Source comparison — ads vs in-person counts per stage
    const adsRecruits = recruits.filter(r => categorizeSource(r.source, r.leadSource) === 'ads')
    const inPersonRecruits = recruits.filter(r => categorizeSource(r.source, r.leadSource) === 'in_person')

    const sourceComparison: SourceComparisonPoint[] = ACTIVE_PIPELINE_STAGES.map(stage => ({
      stage: stage.toLowerCase(),
      label: RECRUIT_STAGE_LABELS[stage],
      adsCount: adsRecruits.filter(r => r.stage === stage).length,
      inPersonCount: inPersonRecruits.filter(r => r.stage === stage).length,
    }))

    // 4. License tracker — IN_COURSE recruits with 30-day countdown
    const licenseTracker: LicenseTrackerEntry[] = filtered
      .filter(r => r.stage === 'IN_COURSE')
      .map(r => {
        const enrolledDate = r.courseEnrolledDate ? new Date(r.courseEnrolledDate) : new Date(r.updatedAt)
        const daysInCourse = Math.floor((Date.now() - enrolledDate.getTime()) / 86400000)
        const daysRemaining = Math.max(0, 30 - daysInCourse)
        return {
          id: r.id,
          name: `${r.firstName} ${r.lastName}`,
          daysInCourse,
          daysRemaining,
          source: r.source,
          urgency: daysRemaining <= 5 ? 'critical' as const : daysRemaining <= 10 ? 'warning' as const : 'on-track' as const,
        }
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)

    // 5. Bottleneck detection — stages with avg > 7 days and >= 3 recruits
    const bottlenecks: BottleneckEntry[] = timeInStage
      .filter(s => s.avgDays > 7 && (stageGroups[s.stage.toUpperCase() as RecruitStage]?.length ?? 0) >= 3)
      .map(s => ({
        stage: s.stage,
        label: s.label,
        avgDays: s.avgDays,
        recruitCount: stageGroups[s.stage.toUpperCase() as RecruitStage]?.length ?? 0,
        color: s.color,
      }))
      .sort((a, b) => b.avgDays - a.avgDays)

    return { funnelData, timeInStage, sourceComparison, licenseTracker, bottlenecks }
  }, [recruits, sourceFilter])
}
