import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  IconBrandDiscord,
  IconCheck,
  IconCalendar,
  IconUserCheck,
  IconBook,
  IconCertificate,
  IconAward,
  IconLicense,
  IconFileText,
  IconCircleCheck,
  IconClock,
} from '@tabler/icons-react'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import type { TablerIcon } from '@tabler/icons-react'
import type { Recruit, OnboardingChecklist } from '../../types/portal'

interface OnboardingProgressProps {
  recruit: Recruit
  onToggleItem: (key: keyof OnboardingChecklist, value: boolean) => void
}

const DEFAULT_CHECKLIST: OnboardingChecklist = {
  discordInviteSent: false,
  discordJoined: false,
  jessicaMeetingScheduled: false,
  jessicaMeetingCompleted: false,
  courseEnrolled: false,
  courseCompleted: false,
  examPassed: false,
  licenseObtained: false,
  contractingSubmitted: false,
  contractingApproved: false,
}

const CHECKLIST_STEPS: {
  key: keyof OnboardingChecklist
  label: string
  icon: TablerIcon
}[] = [
  { key: 'discordInviteSent', label: 'Discord Invite Sent', icon: IconBrandDiscord },
  { key: 'discordJoined', label: 'Joined Discord Server', icon: IconCheck },
  { key: 'jessicaMeetingScheduled', label: 'Meeting with Jessica Scheduled', icon: IconCalendar },
  { key: 'jessicaMeetingCompleted', label: 'Meeting with Jessica Completed', icon: IconUserCheck },
  { key: 'courseEnrolled', label: 'Enrolled in Licensing Course', icon: IconBook },
  { key: 'courseCompleted', label: 'Course Completed', icon: IconCertificate },
  { key: 'examPassed', label: 'License Exam Passed', icon: IconAward },
  { key: 'licenseObtained', label: 'License Obtained', icon: IconLicense },
  { key: 'contractingSubmitted', label: 'Contracting Submitted', icon: IconFileText },
  { key: 'contractingApproved', label: 'Contracting Approved', icon: IconCircleCheck },
]

export default function OnboardingProgress({ recruit, onToggleItem }: OnboardingProgressProps) {
  const checklist = recruit.onboardingChecklist ?? DEFAULT_CHECKLIST

  const { completed, total, percentage } = useMemo(() => {
    const keys = Object.keys(checklist) as (keyof OnboardingChecklist)[]
    const done = keys.filter((k) => checklist[k]).length
    return { completed: done, total: keys.length, percentage: Math.round((done / keys.length) * 100) }
  }, [checklist])

  // 30-day license countdown for IN_COURSE stage
  const countdown = useMemo(() => {
    if (recruit.stage !== 'IN_COURSE') return null
    const startDate = recruit.courseEnrolledDate
      ? new Date(recruit.courseEnrolledDate)
      : new Date(recruit.updatedAt)
    const deadline = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const now = new Date()
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { daysRemaining, deadline }
  }, [recruit.stage, recruit.courseEnrolledDate, recruit.updatedAt])

  const getCountdownVariant = (days: number) => {
    if (days > 10) return 'success' as const
    if (days >= 5) return 'warning' as const
    return 'destructive' as const
  }

  const getCountdownColor = (days: number) => {
    if (days > 10) return 'text-emerald-400'
    if (days >= 5) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-card/50 backdrop-blur border-border/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Onboarding Progress</CardTitle>
          <Badge variant={completed === total ? 'success' : 'secondary'}>
            {completed}/{total}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Overall progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Overall completion</span>
              <span>{percentage}%</span>
            </div>
            <Progress
              value={percentage}
              className="h-2 bg-muted/50 [&>div]:bg-gradient-to-r [&>div]:from-lime-400 [&>div]:to-emerald-400"
            />
          </div>

          {/* Checklist rows */}
          <div className="space-y-2">
            {CHECKLIST_STEPS.map((step, index) => {
              const isChecked = checklist[step.key]
              const StepIcon = step.icon
              return (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <StepIcon
                      size={16}
                      className={isChecked ? 'text-emerald-400 shrink-0' : 'text-muted-foreground shrink-0'}
                    />
                    <span
                      className={`text-sm ${
                        isChecked ? 'line-through opacity-60 text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  <Switch
                    checked={isChecked}
                    onCheckedChange={(val) => onToggleItem(step.key, val)}
                  />
                </motion.div>
              )
            })}
          </div>

          {/* 30-Day License Countdown */}
          {countdown && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-border/30 bg-muted/20 p-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <IconClock size={14} />
                30-Day License Countdown
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-3xl font-bold tabular-nums ${getCountdownColor(countdown.daysRemaining)}`}>
                  {countdown.daysRemaining > 0 ? countdown.daysRemaining : 0}
                </span>
                <div className="text-right space-y-1">
                  <Badge variant={getCountdownVariant(countdown.daysRemaining)}>
                    {countdown.daysRemaining > 10
                      ? 'On Track'
                      : countdown.daysRemaining >= 5
                        ? 'Warning'
                        : 'Critical'}
                  </Badge>
                  <p className="text-[11px] text-muted-foreground">
                    days remaining
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Deadline: {countdown.deadline.toLocaleDateString()}
              </p>
            </motion.div>
          )}

          {/* Course progress bar */}
          {recruit.courseProgress != null && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Course Progress{recruit.courseName ? ` — ${recruit.courseName}` : ''}</span>
                <span>{recruit.courseProgress}%</span>
              </div>
              <Progress
                value={recruit.courseProgress}
                className="h-2 bg-muted/50 [&>div]:bg-gradient-to-r [&>div]:from-blue-400 [&>div]:to-purple-400"
              />
            </div>
          )}

          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleItem('discordInviteSent', true)}
              disabled={checklist.discordInviteSent}
            >
              <IconBrandDiscord size={14} />
              Send Discord Invite
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleItem('licenseObtained', true)}
              disabled={checklist.licenseObtained}
            >
              <IconLicense size={14} />
              Mark Licensed
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleItem('contractingSubmitted', true)}
              disabled={checklist.contractingSubmitted}
            >
              <IconFileText size={14} />
              Submit Contracting
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
