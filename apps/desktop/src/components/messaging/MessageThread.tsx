import { useState, useRef, useEffect } from 'react'
import { IconSend, IconLoader2, IconCalendarEvent, IconLink, IconSearch, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { RECRUIT_STAGE_COLORS, RECRUIT_STAGE_LABELS, type RecruitStage, type Recruit } from '../../types/portal'

interface Message {
  id: string
  body: string | null
  direction: string
  createdAt: string
}

interface RecruitInfo {
  id: string
  name: string
  stage: RecruitStage
}

interface Props {
  title: string
  messages: Message[]
  isLoading: boolean
  isSending: boolean
  onSend: (message: string) => void
  recruitInfo?: RecruitInfo | null
  calComUrl?: string
  onInsertBookingLink?: () => void
  showLinkRecruit?: boolean
  recruits?: Recruit[]
  onLinkRecruit?: (recruitId: string) => void
  isLinking?: boolean
}

export default function MessageThread({
  title, messages, isLoading, isSending, onSend,
  recruitInfo, calComUrl, showLinkRecruit, recruits, onLinkRecruit, isLinking,
}: Props) {
  const [message, setMessage] = useState('')
  const [showRecruitSearch, setShowRecruitSearch] = useState(false)
  const [recruitSearch, setRecruitSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!message.trim()) return
    onSend(message.trim())
    setMessage('')
  }

  const handleInsertBookingLink = () => {
    if (calComUrl) {
      setMessage((prev) => prev ? `${prev} ${calComUrl}` : calComUrl)
    }
  }

  const filteredRecruits = recruits?.filter((r) => {
    if (!recruitSearch) return true
    const q = recruitSearch.toLowerCase()
    return (
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q) ||
      (r.phone && r.phone.includes(q)) ||
      r.email.toLowerCase().includes(q)
    )
  }).slice(0, 8)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            {recruitInfo && (
              <Badge
                className="text-[10px] px-2 py-0.5 shrink-0"
                style={{ backgroundColor: `${RECRUIT_STAGE_COLORS[recruitInfo.stage]}25`, color: RECRUIT_STAGE_COLORS[recruitInfo.stage] }}
              >
                {recruitInfo.name} — {RECRUIT_STAGE_LABELS[recruitInfo.stage]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {calComUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleInsertBookingLink}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <IconCalendarEvent size={14} />
                    Booking Link
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Insert booking link</TooltipContent>
              </Tooltip>
            )}
            {showLinkRecruit && onLinkRecruit && (
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRecruitSearch(!showRecruitSearch)}
                      className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <IconLink size={14} />
                      Link Recruit
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Link to recruit</TooltipContent>
                </Tooltip>
                {showRecruitSearch && (
                  <div className="absolute right-0 top-8 w-72 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                      <IconSearch size={14} className="text-muted-foreground shrink-0" />
                      <Input
                        type="text"
                        value={recruitSearch}
                        onChange={(e) => setRecruitSearch(e.target.value)}
                        placeholder="Search recruits..."
                        className="flex-1 border-0 bg-transparent px-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" onClick={() => { setShowRecruitSearch(false); setRecruitSearch('') }} className="h-6 w-6 text-muted-foreground hover:text-foreground">
                        <IconX size={14} />
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredRecruits && filteredRecruits.length > 0 ? (
                        filteredRecruits.map((r) => (
                          <Button
                            key={r.id}
                            variant="ghost"
                            onClick={() => {
                              onLinkRecruit(r.id)
                              setShowRecruitSearch(false)
                              setRecruitSearch('')
                            }}
                            disabled={isLinking}
                            className="w-full text-left px-3 py-2 h-auto justify-start hover:bg-white/[0.04] transition-colors disabled:opacity-50 flex-col items-start rounded-none"
                          >
                            <p className="text-sm text-foreground">{r.firstName} {r.lastName}</p>
                            <p className="text-[10px] text-muted-foreground">{r.phone || r.email}</p>
                          </Button>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-4">No recruits found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <IconLoader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                msg.direction === 'outbound' || msg.direction === 'sent'
                  ? 'bg-blue-500/20 text-blue-100 ml-auto'
                  : 'bg-muted text-foreground'
              }`}
            >
              <p>{msg.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Send form */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isSending || !message.trim()}
          >
            {isSending ? <IconLoader2 size={14} className="animate-spin" /> : <IconSend size={14} />}
          </Button>
        </div>
      </div>
    </div>
  )
}
