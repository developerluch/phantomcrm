import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IconSend,
  IconMicrophone,
  IconMicrophoneOff,
  IconVolume,
  IconVolumeOff,
  IconPaperclip,
  IconFileSpreadsheet,
  IconLoader2,
  IconX,
  IconReceipt,
  IconFileDollar,
  IconChartBar,
  IconMessage,
  IconSpeakerphone,
  IconUserPlus,
  IconCalendarEvent,
  IconReportMoney,
  IconUsers,
  IconCash,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { VoiceChatState } from '../../hooks/useVoiceChat'

interface ParsedFileData {
  headers: string[]
  rows: Record<string, string>[]
  rowCount: number
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const QUICK_ACTION_GROUPS = [
  {
    label: 'Finance',
    icon: IconCash,
    actions: [
      { icon: IconReceipt, label: 'Log Expense', prompt: 'I need to log an expense: ' },
      { icon: IconFileDollar, label: 'Record Sale', prompt: 'Record a sale for ' },
      { icon: IconChartBar, label: 'P&L Summary', prompt: "What's my current P&L?" },
    ],
  },
  {
    label: 'Messaging',
    icon: IconMessage,
    actions: [
      { icon: IconMessage, label: 'Send SMS', prompt: 'Send an SMS to ' },
      { icon: IconSpeakerphone, label: 'Announcement', prompt: 'Send an announcement: ' },
    ],
  },
  {
    label: 'Recruits',
    icon: IconUserPlus,
    actions: [
      { icon: IconUserPlus, label: 'Add Recruit', prompt: 'Create a new recruit: ' },
      { icon: IconChartBar, label: 'Pipeline Status', prompt: "What's the current recruitment pipeline status?" },
    ],
  },
  {
    label: 'Lock-Ins',
    icon: IconCalendarEvent,
    actions: [
      { icon: IconCalendarEvent, label: 'Create Lock-In', prompt: 'Create a new lock-in event: ' },
      { icon: IconReportMoney, label: 'Lock-In Budget', prompt: 'Add a budget item to lock-in: ' },
    ],
  },
  {
    label: 'Reports',
    icon: IconUsers,
    actions: [
      { icon: IconUsers, label: 'Agent Report', prompt: 'Show me the agent performance report' },
      { icon: IconChartBar, label: 'Production Report', prompt: "What's the current production report?" },
    ],
  },
]

interface CommandIslandProps {
  input: string
  onInputChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  canSend: boolean
  voiceState: VoiceChatState
  isSupported: boolean
  isMuted: boolean
  onMicToggle: () => void
  onMuteToggle: () => void
  attachedFile: File | null
  fileStatus: 'idle' | 'parsing' | 'ready' | 'error'
  fileError: string | null
  parsedData: ParsedFileData | null
  isDragOver: boolean
  onFileClick: () => void
  onClearFile: () => void
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function CommandIsland({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  canSend,
  voiceState,
  isSupported,
  isMuted,
  onMicToggle,
  onMuteToggle,
  attachedFile,
  fileStatus,
  fileError,
  parsedData,
  isDragOver,
  onFileClick,
  onClearFile,
  fileInputRef,
  onFileInput,
}: CommandIslandProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)

  const isExpanded = !!attachedFile || isDragOver

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  const fileChipBorder = {
    idle: 'border-border',
    parsing: 'border-blue-400',
    ready: 'border-green-400',
    error: 'border-red-400',
  }[fileStatus]

  return (
    <div className="w-full max-w-3xl mx-auto pb-3 pt-2 px-4">
      {/* Quick-action pills */}
      <AnimatePresence>
        {!input && !attachedFile && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="space-y-3 mb-3"
          >
            {/* Category selector pills */}
            <div className="flex items-center justify-center gap-1.5">
              {QUICK_ACTION_GROUPS.map((group, idx) => {
                const CatIcon = group.icon
                const isActive = activeCategory === idx
                return (
                  <Button
                    key={group.label}
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={`h-7 rounded-full px-3 text-[10px] transition-all ${
                      isActive
                        ? 'bg-[#7dd3fc]/15 text-[#7dd3fc] border border-[#7dd3fc]/30 shadow-sm'
                        : 'bg-white/[0.03] border border-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                    }`}
                    onClick={() => setActiveCategory(idx)}
                  >
                    <CatIcon size={12} className="mr-1" />
                    {group.label}
                  </Button>
                )
              })}
            </div>

            {/* Active category's action buttons */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex flex-wrap gap-1.5 justify-center"
              >
                {QUICK_ACTION_GROUPS[activeCategory].actions.map((qa) => {
                  const Icon = qa.icon
                  return (
                    <Button
                      key={qa.label}
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-4 text-xs bg-white/[0.04] border border-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.08]"
                      onClick={() => {
                        onInputChange(qa.prompt)
                        textareaRef.current?.focus()
                      }}
                    >
                      <Icon size={14} className="mr-1.5" />
                      {qa.label}
                    </Button>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        initial={false}
        animate={{
          y: !focused && hovered ? -1 : 0,
          boxShadow: focused
            ? '0 0 0 1.5px rgba(125,211,252,0.4), 0 0 24px rgba(125,211,252,0.06), 0 25px 50px -12px rgba(0,0,0,0.25)'
            : hovered
              ? '0 0 0 1px hsl(var(--border)), 0 0 16px rgba(125,211,252,0.04), 0 25px 50px -12px rgba(0,0,0,0.25)'
              : '0 0 0 1px hsl(var(--border) / 0.5), 0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        transition={{
          layout: { type: 'spring', stiffness: 300, damping: 30 },
          default: { duration: 0.2, ease: 'easeOut' },
        }}
        className={`bg-card/80 backdrop-blur-xl border border-transparent ${
          isExpanded ? 'rounded-3xl' : 'rounded-full'
        } px-4 py-3`}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xls,.xlsx,image/*"
          onChange={onFileInput}
          className="hidden"
        />

        {/* Drop zone — expands upward */}
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="overflow-hidden mb-2"
            >
              <div className="border-2 border-dashed border-[#7dd3fc]/40 rounded-2xl px-4 py-6 flex items-center justify-center text-[#7dd3fc]/60 text-sm">
                Drop file or image here
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File chip row */}
        <AnimatePresence>
          {attachedFile && !isDragOver && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="overflow-hidden mb-2 ml-8"
            >
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${fileChipBorder} bg-muted/30 text-xs`}>
                {attachedFile.type.startsWith('image/') && parsedData?.rows[0]?.__image__ ? (
                  <img src={parsedData.rows[0].__image__} className="h-8 w-8 rounded object-cover shrink-0" alt={attachedFile.name} />
                ) : (
                  <IconFileSpreadsheet size={14} className="text-muted-foreground shrink-0" />
                )}
                <span className="truncate max-w-[200px] text-foreground">{attachedFile.name}</span>
                <span className="text-muted-foreground shrink-0">{formatFileSize(attachedFile.size)}</span>
                {fileStatus === 'parsing' && (
                  <IconLoader2 size={12} className="text-blue-400 animate-spin shrink-0" />
                )}
                {fileStatus === 'ready' && parsedData && !attachedFile.type.startsWith('image/') && (
                  <span className="text-green-400 shrink-0">{parsedData.rowCount} rows</span>
                )}
                {fileStatus === 'ready' && attachedFile.type.startsWith('image/') && (
                  <span className="text-green-400 shrink-0">image</span>
                )}
                {fileStatus === 'error' && fileError && (
                  <span className="text-red-400 shrink-0">{fileError}</span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={onClearFile}
                    >
                      <IconX size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove file</TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input row */}
        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }} className="shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                  onClick={onFileClick}
                >
                  <IconPaperclip size={18} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach spreadsheet (.csv, .xls, .xlsx)</TooltipContent>
            </Tooltip>
          </motion.div>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={voiceState === 'listening' ? 'Listening... or type here' : 'Type a message...'}
            rows={1}
            disabled={voiceState === 'thinking'}
            className="flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:opacity-50 max-h-[120px]"
          />

          {/* Mic Toggle */}
          <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }} className="shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-lg ${
                    voiceState === 'listening'
                      ? 'bg-red-500/20 text-red-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                  }`}
                  onClick={onMicToggle}
                  disabled={!isSupported || voiceState === 'thinking' || voiceState === 'speaking'}
                >
                  {voiceState === 'listening' ? <IconMicrophoneOff size={16} /> : <IconMicrophone size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{voiceState === 'listening' ? 'Stop listening' : 'Start voice input'}</TooltipContent>
            </Tooltip>
          </motion.div>

          {/* Mute Toggle */}
          <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }} className="shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                  onClick={onMuteToggle}
                >
                  {isMuted ? <IconVolumeOff size={13} /> : <IconVolume size={13} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isMuted ? 'Unmute TTS' : 'Mute TTS'}</TooltipContent>
            </Tooltip>
          </motion.div>

          {/* Send */}
          <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 400, damping: 17 }} className="shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-[#7dd3fc]/15 text-[#7dd3fc] hover:bg-[#7dd3fc]/25 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={onSend}
                  disabled={!canSend}
                >
                  <IconSend size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send message</TooltipContent>
            </Tooltip>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
