import { useState, useMemo } from 'react'
import { useRecruit, useRecruitMessages, useUpdateRecruit, useSendRecruitSms, useScheduleInterview, useOnboardRecruit, useUpdateOnboardingChecklist } from '../../hooks/useRecruits'
import { RECRUIT_STAGE_COLORS, RECRUIT_STAGE_LABELS } from '../../types/portal'
import type { RecruitStage, OnboardingChecklist } from '../../types/portal'
import OnboardingProgress from './OnboardingProgress'
import { toast } from 'sonner'
import {
  IconX,
  IconPhone,
  IconMail,
  IconMapPin,
  IconSend,
  IconCalendar,
  IconUserCheck,
  IconBan,
  IconLoader2,
  IconMessageCircle,
  IconUserPlus,
  IconClock,
} from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { useGoogleCalendarStatus, useCreateGoogleEvent } from '../../hooks/useGoogleCalendar'
import { useCreateAppointment } from '../../hooks/useAppointments'

interface Props {
  recruitId: string
  onClose: () => void
}

interface TimelineEvent {
  id: string
  type: 'sms_in' | 'sms_out' | 'created' | 'interview' | 'stage'
  label: string
  detail: string
  date: Date
}

export default function RecruitDetailPanel({ recruitId, onClose }: Props) {
  const { data: recruit, isLoading } = useRecruit(recruitId)
  const { data: messages } = useRecruitMessages(recruitId)
  const updateRecruit = useUpdateRecruit()
  const sendSms = useSendRecruitSms()
  const scheduleInterview = useScheduleInterview()
  const onboardRecruit = useOnboardRecruit()
  const updateChecklist = useUpdateOnboardingChecklist()

  const [smsBody, setSmsBody] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewType, setInterviewType] = useState('GOOGLE_MEET')
  const [interviewDuration, setInterviewDuration] = useState('30')
  const [addGoogleMeet, setAddGoogleMeet] = useState(true)
  const [rejectReason, setRejectReason] = useState('')

  const { data: googleStatus } = useGoogleCalendarStatus()
  const googleConnected = googleStatus?.connected ?? false
  const createGoogleEvent = useCreateGoogleEvent()
  const createAppointment = useCreateAppointment()

  // Build activity timeline
  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!recruit) return []
    const events: TimelineEvent[] = []

    // Created event
    events.push({
      id: 'created',
      type: 'created',
      label: 'Lead Created',
      detail: `${recruit.firstName} ${recruit.lastName} added to pipeline`,
      date: new Date(recruit.createdAt),
    })

    // Current stage
    events.push({
      id: 'stage',
      type: 'stage',
      label: RECRUIT_STAGE_LABELS[recruit.stage],
      detail: `Current stage: ${RECRUIT_STAGE_LABELS[recruit.stage]}`,
      date: new Date(recruit.updatedAt),
    })

    // Interview date
    if (recruit.interviewDate) {
      events.push({
        id: 'interview',
        type: 'interview',
        label: 'Interview',
        detail: `${recruit.interviewType ?? 'Interview'} scheduled`,
        date: new Date(recruit.interviewDate),
      })
    }

    // SMS messages
    if (messages) {
      for (const msg of messages) {
        events.push({
          id: msg.id,
          type: msg.direction === 'outbound' ? 'sms_out' : 'sms_in',
          label: msg.direction === 'outbound' ? 'SMS Sent' : 'SMS Received',
          detail: msg.body.length > 80 ? msg.body.slice(0, 80) + '...' : msg.body,
          date: new Date(msg.createdAt),
        })
      }
    }

    events.sort((a, b) => b.date.getTime() - a.date.getTime())
    return events
  }, [recruit, messages])

  const handleSendSms = () => {
    if (!recruit?.phone || !smsBody.trim()) return
    sendSms.mutate(
      { id: recruitId, body: smsBody.trim(), toNumber: recruit.phone },
      {
        onSuccess: () => {
          toast.success('SMS sent')
          setSmsBody('')
        },
        onError: () => toast.error('Failed to send SMS'),
      }
    )
  }

  const handleSchedule = async () => {
    if (!interviewDate || !recruit) return
    try {
      await scheduleInterview.mutateAsync({ id: recruitId, interviewType, date: interviewDate })

      // Create local calendar appointment
      const startISO = new Date(interviewDate).toISOString()
      const endISO = new Date(new Date(interviewDate).getTime() + parseInt(interviewDuration) * 60000).toISOString()

      try {
        await createAppointment.mutateAsync({
          title: `Interview: ${recruit.firstName} ${recruit.lastName}`,
          startTime: startISO,
          endTime: endISO,
          agentId: recruit.assignedManagerId ?? '',
        })
      } catch { /* appointment creation is best-effort */ }

      // Push to Google Calendar if connected
      if (googleConnected) {
        try {
          await createGoogleEvent.mutateAsync({
            summary: `Interview: ${recruit.firstName} ${recruit.lastName}`,
            description: `Recruit interview\nEmail: ${recruit.email}\nPhone: ${recruit.phone ?? 'N/A'}`,
            startTime: startISO,
            endTime: endISO,
            attendeeEmails: recruit.email ? [recruit.email] : undefined,
            addGoogleMeet: addGoogleMeet && interviewType === 'GOOGLE_MEET',
          })
        } catch {
          toast.error('Calendar sync to Google failed')
        }
      }

      toast.success('Interview scheduled')
      setInterviewDate('')
    } catch {
      toast.error('Failed to schedule interview')
    }
  }

  const handleOnboard = () => {
    onboardRecruit.mutate(recruitId, {
      onSuccess: () => toast.success('Recruit onboarded as agent'),
      onError: () => toast.error('Failed to onboard recruit'),
    })
  }

  const handleReject = () => {
    updateRecruit.mutate(
      { id: recruitId, data: { stage: 'REJECTED' as RecruitStage, rejectedReason: rejectReason || undefined } },
      {
        onSuccess: () => {
          toast.success('Recruit rejected')
          setRejectReason('')
        },
        onError: () => toast.error('Failed to reject recruit'),
      }
    )
  }

  const timelineIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'sms_in':
      case 'sms_out':
        return <IconMessageCircle size={12} />
      case 'created':
        return <IconUserPlus size={12} />
      case 'interview':
        return <IconCalendar size={12} />
      case 'stage':
        return <IconClock size={12} />
    }
  }

  const timelineColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'sms_out': return '#3b82f6'
      case 'sms_in': return '#22c55e'
      case 'created': return '#8b5cf6'
      case 'interview': return '#f59e0b'
      case 'stage': return '#06b6d4'
    }
  }

  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-[440px] sm:w-[440px] sm:max-w-[90vw] p-0 flex flex-col border-l border-border bg-card/98 backdrop-blur-md shadow-2xl gap-0">
      {isLoading || !recruit ? (
        <div className="flex items-center justify-center h-full">
          <IconLoader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Fixed Header */}
          <SheetHeader className="shrink-0 px-5 pt-5 pb-4 border-b border-border/50 text-left space-y-0 relative">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-xl font-bold text-foreground">
                  {recruit.firstName} {recruit.lastName}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    className="text-[11px] font-semibold"
                    style={{
                      background: `${RECRUIT_STAGE_COLORS[recruit.stage]}20`,
                      color: RECRUIT_STAGE_COLORS[recruit.stage],
                      border: 'none',
                    }}
                  >
                    {RECRUIT_STAGE_LABELS[recruit.stage]}
                  </Badge>
                  {recruit.source && (
                    <Badge variant="secondary" className="text-[11px] font-normal">
                      via {recruit.source}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">

          {/* Contact Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <IconMail size={14} className="text-muted-foreground" />
                {recruit.email}
              </div>
              {recruit.phone && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <IconPhone size={14} className="text-muted-foreground" />
                  {recruit.phone}
                </div>
              )}
              {recruit.city && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <IconMapPin size={14} className="text-muted-foreground" />
                  {recruit.city}
                </div>
              )}
            </div>
          </div>

          {/* Onboarding Progress */}
          {recruit.stage === 'ONBOARDING' || recruit.stage === 'IN_COURSE' || recruit.stage === 'LICENSED' || recruit.stage === 'CONTRACTING' ? (
            <OnboardingProgress
              recruit={recruit}
              onToggleItem={(key: keyof OnboardingChecklist, value: boolean) => {
                updateChecklist.mutate({
                  id: recruitId,
                  updates: { [key]: value },
                }, {
                  onSuccess: () => toast.success('Checklist updated'),
                  onError: () => toast.error('Failed to update checklist'),
                })
              }}
            />
          ) : null}

          {/* SMS Thread */}
          {recruit.phone && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SMS</h3>
              {messages && messages.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {messages.map((msg: { id: string; body: string; direction: string; createdAt: string }) => (
                    <div
                      key={msg.id}
                      className={`text-xs px-3 py-2 rounded-lg max-w-[85%] ${
                        msg.direction === 'outbound'
                          ? 'bg-blue-500/20 text-blue-200 ml-auto'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {msg.body}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(msg.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendSms()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendSms}
                  disabled={sendSms.isPending || !smsBody.trim()}
                >
                  <IconSend size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {timeline.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</h3>
              <div className="relative pl-5">
                {/* Vertical connector line */}
                <div className="absolute left-[7px] top-1 bottom-1 w-[2px] bg-border/40" />
                <div className="space-y-3">
                  {timeline.slice(0, 20).map((event) => (
                    <div key={event.id} className="relative flex items-start gap-3">
                      {/* Dot */}
                      <div
                        className="absolute -left-5 top-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-card"
                        style={{ backgroundColor: timelineColor(event.type) }}
                      >
                        <span className="text-white">{timelineIcon(event.type)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">{event.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{event.detail}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {event.date.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Schedule Interview */}
          {recruit.stage !== 'ACTIVE' && recruit.stage !== 'REJECTED' && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule Interview</h3>
              <div className="flex gap-2">
                <Select value={interviewType} onValueChange={setInterviewType}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOOGLE_MEET">Google Meet</SelectItem>
                    <SelectItem value="CALENDLY">Calendly</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={interviewDuration} onValueChange={setInterviewDuration}>
                  <SelectTrigger className="w-[90px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSchedule}
                  disabled={scheduleInterview.isPending || createGoogleEvent.isPending || !interviewDate}
                >
                  {scheduleInterview.isPending || createGoogleEvent.isPending ? (
                    <IconLoader2 size={14} className="animate-spin" />
                  ) : (
                    <IconCalendar size={14} />
                  )}
                </Button>
              </div>
              {googleConnected && interviewType === 'GOOGLE_MEET' && (
                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-card/30 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Add Google Meet link</span>
                  <Switch checked={addGoogleMeet} onCheckedChange={setAddGoogleMeet} />
                </div>
              )}
              {recruit.interviewDate && (
                <p className="text-xs text-muted-foreground">
                  Scheduled: {new Date(recruit.interviewDate).toLocaleString()} ({recruit.interviewType})
                </p>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="text-[11px] text-muted-foreground space-y-0.5 pt-2 border-t border-border">
            <p>Created: {new Date(recruit.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(recruit.updatedAt).toLocaleString()}</p>
          </div>
          </div>

          {/* Fixed Footer — Actions */}
          {recruit.stage !== 'ACTIVE' && recruit.stage !== 'REJECTED' && (
            <div className="shrink-0 border-t border-border/50 px-5 py-4 space-y-3">
              {recruit.stage === 'CONTRACTING' ? (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleOnboard}
                  disabled={onboardRecruit.isPending}
                >
                  {onboardRecruit.isPending ? (
                    <IconLoader2 size={14} className="animate-spin mr-2" />
                  ) : (
                    <IconUserCheck size={14} className="mr-2" />
                  )}
                  Activate as Agent
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleOnboard}
                  disabled={onboardRecruit.isPending}
                >
                  {onboardRecruit.isPending ? (
                    <IconLoader2 size={14} className="animate-spin mr-2" />
                  ) : (
                    <IconUserCheck size={14} className="mr-2" />
                  )}
                  Onboard as Agent
                </Button>
              )}
              <div className="flex gap-2">
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason (optional)"
                  className="flex-1 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReject}
                  disabled={updateRecruit.isPending}
                  className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                >
                  <IconBan size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      </SheetContent>
    </Sheet>
  )
}
