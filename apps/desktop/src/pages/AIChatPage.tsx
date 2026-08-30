import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MOUNT_SPRING, containerVariants, itemVariants } from '@/lib/motion'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'
import { toast } from 'sonner'
import {
  useChatConversations,
  useChatMessages,
  useSendMessage,
  useDeleteConversation,
  useRenameConversation,
} from '../hooks/useChat'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useDismissAIAction, useExecuteAIAction } from '../hooks/useAIActions'
import type { VoiceChatState } from '../hooks/useVoiceChat'
import type { ChatConversation } from '../types/portal'
import type { AIAction } from '../types/ai-actions'
import CommandIsland from '../components/chat/CommandIsland'
import MessageList from '../components/chat/MessageList'
import ConversationHoverCard from '../components/chat/ConversationHoverCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconPlus,
  IconTrash,
  IconSearch,
  IconRobot,
  IconLoader2,
  IconMenu2,
  IconX,
  IconUpload,
  IconPencil,
  IconChartBar,
  IconUsers,
  IconUserPlus,
  IconAlertTriangle,
  IconSettings,
} from '@tabler/icons-react'

// ── Constants ────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    icon: IconChartBar,
    color: '#3b82f6',
    label: 'Dashboard Summary',
    description: "Get a quick overview of today's metrics",
    prompt: "Show me today's dashboard summary",
  },
  {
    icon: IconUsers,
    color: '#8b5cf6',
    label: 'Top Performers',
    description: "See who's leading this month",
    prompt: 'Who are my top performing agents?',
  },
  {
    icon: IconUserPlus,
    color: '#22c55e',
    label: 'Pipeline Status',
    description: 'Review your recruit pipeline',
    prompt: "What's my recruit pipeline status?",
  },
  {
    icon: IconAlertTriangle,
    color: '#f97316',
    label: 'Risk Alerts',
    description: 'Check agents flagged for attention',
    prompt: 'Which agents are at risk?',
  },
]

const AVATAR_STYLES: Record<VoiceChatState, { gradient: string; shadow: string }> = {
  idle: {
    gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    shadow: '0 0 20px rgba(59,130,246,0.2)',
  },
  listening: {
    gradient: 'linear-gradient(135deg, #ef4444, #f97316)',
    shadow: '0 0 30px rgba(239,68,68,0.35)',
  },
  thinking: {
    gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    shadow: '0 0 30px rgba(59,130,246,0.35)',
  },
  speaking: {
    gradient: 'linear-gradient(135deg, #22c55e, #10b981)',
    shadow: '0 0 30px rgba(34,197,94,0.35)',
  },
}

const STATE_LABELS: Record<VoiceChatState, string> = {
  idle: 'Ready',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
}

const floatUpVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { ...MOUNT_SPRING, delay: 0.3 } },
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_EXTENSIONS = ['.csv', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.webp']

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// ── Waveform Bars ────────────────────────────────────────────────────────────

function WaveformBars() {
  return (
    <div className="flex items-center gap-[2px] h-3.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="w-[2px] h-full rounded-full bg-white/80 animate-[waveform_0.8s_ease-in-out_infinite_alternate]"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  )
}

// ── Parsed File Data ─────────────────────────────────────────────────────────

interface ParsedFileData {
  headers: string[]
  rows: Record<string, string>[]
  rowCount: number
}

// ── Delete Conversation Dialog ───────────────────────────────────────────────

interface DeleteConversationDialogProps {
  conv: ChatConversation
  onDelete: (id: string) => void
}

function DeleteConversationDialog({ conv, onDelete }: DeleteConversationDialogProps) {
  const [open, setOpen] = useState(false)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  function handleTrashClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (localStorage.getItem('ai-chat.skipDeleteConfirm') === '1') {
      onDelete(conv.id)
    } else {
      setOpen(true)
    }
  }

  function handleDelete() {
    if (dontAskAgain) {
      localStorage.setItem('ai-chat.skipDeleteConfirm', '1')
    }
    onDelete(conv.id)
    setOpen(false)
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
            onClick={handleTrashClick}
          >
            <IconTrash size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete conversation</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-sm rounded-2xl bg-card/95 backdrop-blur-xl border-white/[0.08] shadow-2xl p-5 gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete this conversation?</DialogTitle>
            <DialogDescription>
              "{conv.title}" will be permanently removed. This can't be undone.
            </DialogDescription>
          </DialogHeader>

          {/* Don't ask again row */}
          <div className="flex items-center gap-2 py-1">
            <Switch
              checked={dontAskAgain}
              onCheckedChange={setDontAskAgain}
            />
            <span className="text-xs text-muted-foreground">Don't ask again</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              className="bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 hover:text-red-300"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AIChatPage() {
  const navigate = useNavigate()
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // File import state
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [fileStatus, setFileStatus] = useState<'idle' | 'parsing' | 'ready' | 'error'>('idle')
  const [fileError, setFileError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Streaming tracking
  const [lastStreamingMessageId, setLastStreamingMessageId] = useState<string | null>(null)

  // Pending title — set when user renames before the conversation exists, applied on first send
  const [pendingTitle, setPendingTitle] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data: convData } = useChatConversations()
  const { data: msgData, isLoading: messagesLoading } = useChatMessages(activeConversationId)
  const sendMessage = useSendMessage()
  const deleteConversation = useDeleteConversation()
  const renameConversation = useRenameConversation()
  const voice = useVoiceChat()

  // AI Action state
  const [actionStates, setActionStates] = useState<Map<string, AIAction>>(new Map())
  const executeAction = useExecuteAIAction()
  const dismissAction = useDismissAIAction()

  const handleConfirmAction = useCallback((action: AIAction) => {
    const actionId = action.id
    setActionStates((prev) => {
      const next = new Map(prev)
      next.set(actionId, { ...action, status: 'executing' })
      return next
    })

    executeAction.mutate(action, {
      onSuccess: (data) => {
        setActionStates((prev) => {
          const next = new Map(prev)
          next.set(actionId, data.action)
          return next
        })
      },
      onError: (err) => {
        setActionStates((prev) => {
          const next = new Map(prev)
          next.set(actionId, { ...action, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' })
          return next
        })
      },
    })
  }, [executeAction])

  const handleDismissAction = useCallback((action: AIAction) => {
    const actionId = action.id
    setActionStates((prev) => {
      const next = new Map(prev)
      next.set(actionId, { ...action, status: 'dismissed' })
      return next
    })
    dismissAction.mutate(action, {
      onSuccess: (data) => {
        setActionStates((prev) => {
          const next = new Map(prev)
          next.set(actionId, data.action)
          return next
        })
      },
      onError: (err) => {
        setActionStates((prev) => {
          const next = new Map(prev)
          next.set(actionId, { ...action, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' })
          return next
        })
      },
    })
  }, [dismissAction])

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null)
  const [sidebarRenameValue, setSidebarRenameValue] = useState('')

  const conversations: ChatConversation[] = convData?.conversations ?? []
  const messages = msgData?.messages ?? []

  // ── Voice Sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (voice.transcript && voice.state === 'thinking') {
      if (!activeConversationId && voice.conversationId) {
        setActiveConversationId(voice.conversationId)
      }
    }
  }, [voice.transcript, voice.state, voice.conversationId, activeConversationId])

  useEffect(() => {
    if (voice.aiResponse && voice.state !== 'thinking') {
      if (voice.conversationId && !activeConversationId) {
        setActiveConversationId(voice.conversationId)
      }
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] })
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
    }
  }, [voice.aiResponse, voice.state, voice.conversationId, activeConversationId, queryClient])

  // ── Conversation Search ──────────────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    let list = conversations.filter(c => c.title?.trim())
    if (searchQuery.trim()) {
      list = list.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    return list
  }, [conversations, searchQuery])

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sendMessage.isPending, voice.state])

  // ── File Parsing ─────────────────────────────────────────────────────────
  const parseFile = useCallback((file: File) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (file.type.startsWith('image/')) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error('Image must be under 10MB')
        return
      }
      setAttachedFile(file)
      setFileStatus('parsing')
      setFileError(null)
      setParsedData(null)
      const reader = new FileReader()
      reader.onload = (e) => {
        setParsedData({
          headers: ['__image__'],
          rows: [{ __image__: String(e.target?.result ?? '') }],
          rowCount: 1,
        })
        setFileStatus('ready')
      }
      reader.onerror = () => {
        setFileError('Failed to read image')
        setFileStatus('error')
        toast.error('Failed to read image')
      }
      reader.readAsDataURL(file)
      return
    }

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('Only .csv, .xls, .xlsx, and image files are supported')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File must be under 10MB')
      return
    }

    setAttachedFile(file)
    setFileStatus('parsing')
    setFileError(null)
    setParsedData(null)

    if (ext === '.csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const headers = results.meta.fields ?? []
          const rows = results.data as Record<string, string>[]
          setParsedData({ headers, rows, rowCount: rows.length })
          setFileStatus('ready')
        },
        error: (err) => {
          setFileError(err.message)
          setFileStatus('error')
          toast.error('Failed to parse CSV file')
        },
      })
    } else {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer
          const workbook = new ExcelJS.Workbook()
          await workbook.xlsx.load(buffer)
          const sheet = workbook.worksheets[0]
          if (!sheet) {
            setFileError('Spreadsheet has no worksheets')
            setFileStatus('error')
            toast.error('Failed to parse spreadsheet file')
            return
          }
          const stringify = (v: unknown): string => {
            if (v == null) return ''
            if (v instanceof Date) return v.toISOString()
            if (typeof v !== 'object') return String(v)
            const obj = v as Record<string, unknown>
            if (Array.isArray(obj.richText)) {
              return (obj.richText as Array<{ text?: string }>)
                .map((r) => r.text ?? '')
                .join('')
            }
            if ('result' in obj) return stringify(obj.result)
            if ('text' in obj) return stringify(obj.text)
            if ('hyperlink' in obj) return String(obj.hyperlink)
            if ('error' in obj) return String(obj.error)
            return String(v)
          }
          const headers: string[] = []
          const rows: Record<string, string>[] = []
          sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) {
              row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                headers[colNumber - 1] = stringify(cell.value)
              })
              return
            }
            const obj: Record<string, string> = {}
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              const key = headers[colNumber - 1]
              if (key) obj[key] = stringify(cell.value)
            })
            rows.push(obj)
          })
          setParsedData({ headers, rows, rowCount: rows.length })
          setFileStatus('ready')
        } catch {
          setFileError('Failed to parse spreadsheet')
          setFileStatus('error')
          toast.error('Failed to parse spreadsheet file')
        }
      }
      reader.onerror = () => {
        setFileError('Failed to read file')
        setFileStatus('error')
        toast.error('Failed to read file')
      }
      reader.readAsArrayBuffer(file)
    }
  }, [])

  const clearFile = useCallback(() => {
    setAttachedFile(null)
    setFileStatus('idle')
    setFileError(null)
    setParsedData(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }, [parseFile])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSend() {
    const userText = input.trim()
    if ((!userText && !parsedData) || sendMessage.isPending) return

    let messageText = userText || 'Analyze this data'

    if (parsedData && attachedFile) {
      if (attachedFile.type.startsWith('image/')) {
        // TODO: wire image to vision endpoint (currently name-only reference for backend)
        messageText = `[Image attached: ${attachedFile.name}] ${userText || 'Analyze this image'}`
      } else {
        const fileContext = [
          `[Uploaded file: ${attachedFile.name} — ${parsedData.rowCount} rows, ${parsedData.headers.length} columns]`,
          `Column headers: ${parsedData.headers.join(', ')}`,
          `First 20 rows:`,
          JSON.stringify(parsedData.rows.slice(0, 20), null, 2),
          '',
          `User message: ${userText || 'Analyze this data'}`,
        ].join('\n')
        messageText = fileContext
      }
    }

    setInput('')
    clearFile()
    sendMessage.mutate(
      { message: messageText, conversationId: activeConversationId ?? undefined },
      {
        onSuccess: (data) => {
          setActiveConversationId(data.conversationId)
          if (pendingTitle && !activeConversationId) {
            renameConversation.mutate({ id: data.conversationId, title: pendingTitle })
            setPendingTitle(null)
          }
          // Optimistic message is already in cache from useSendMessage.onSuccess
          const msgs = queryClient.getQueryData<{ messages: { id: string; role: string }[] }>(['chat-messages', data.conversationId])
          if (msgs?.messages) {
            const lastAI = [...msgs.messages].reverse().find(m => m.role === 'assistant')
            if (lastAI) setLastStreamingMessageId(lastAI.id)
          }
        },
      },
    )
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleNewChat() {
    setActiveConversationId(null)
    setInput('')
    clearFile()
    setLastStreamingMessageId(null)
    setPendingTitle(null)
    voice.resetConversation()
  }

  function handleDeleteConversation(id: string) {
    deleteConversation.mutate(id)
    if (activeConversationId === id) {
      setActiveConversationId(null)
    }
  }

  function handlePromptClick(text: string) {
    sendMessage.mutate(
      { message: text },
      {
        onSuccess: (data) => {
          setActiveConversationId(data.conversationId)
          if (pendingTitle && !activeConversationId) {
            renameConversation.mutate({ id: data.conversationId, title: pendingTitle })
            setPendingTitle(null)
          }
          // Optimistic message is already in cache from useSendMessage.onSuccess
          const msgs = queryClient.getQueryData<{ messages: { id: string; role: string }[] }>(['chat-messages', data.conversationId])
          if (msgs?.messages) {
            const lastAI = [...msgs.messages].reverse().find(m => m.role === 'assistant')
            if (lastAI) setLastStreamingMessageId(lastAI.id)
          }
        },
      },
    )
  }

  function handleMicToggle() {
    if (voice.state === 'listening') {
      voice.stopListening()
    } else if (voice.state === 'idle') {
      voice.startListening()
    }
  }

  const avatarStyle = AVATAR_STYLES[voice.state]
  const isThinking = sendMessage.isPending || voice.state === 'thinking'
  const activeTitle = conversations.find(c => c.id === activeConversationId)?.title
  const displayTitle = activeTitle ?? pendingTitle ?? 'New Conversation'
  const canSend = (input.trim() || parsedData) && !sendMessage.isPending

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="-mx-6 -mb-6 flex h-full min-h-0 overflow-hidden pt-6">
      {/* ── Inline Sidebar ─────────────────────────────────────────────── */}
      <motion.div
        className="h-full border-r border-white/[0.06] bg-card/50 backdrop-blur-sm flex flex-col overflow-hidden shrink-0"
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <motion.div
          className="w-[260px] h-full flex flex-col"
          variants={containerVariants}
          initial="hidden"
          animate={sidebarOpen ? 'visible' : 'hidden'}
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">History</span>
            <div className="flex items-center gap-1">
              {/* AI Settings button */}
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] rounded-md"
                      onClick={() => navigate('/settings?tab=ai-assistant')}
                    >
                      <IconSettings size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>AI settings</TooltipContent>
                </Tooltip>
              </motion.div>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarOpen(false)}
              >
                <IconX size={14} />
              </Button>
            </div>
          </motion.div>

          {/* Search */}
          <motion.div variants={itemVariants} className="px-3 pb-2 shrink-0">
            <div className="relative">
              <IconSearch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="h-8 pl-8 pr-3 text-xs rounded-full bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] focus-visible:ring-1 focus-visible:ring-[#7dd3fc]/30 focus-visible:border-[#7dd3fc]/30 transition-colors"
              />
            </div>
          </motion.div>

          {/* New Chat Button */}
          <motion.div variants={itemVariants} className="px-3 pb-2 shrink-0">
            <motion.div whileHover={{ y: -1 }}>
              <Button
                variant="ghost"
                className="w-full rounded-full bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-[#7dd3fc]/30 text-foreground transition-all group"
                onClick={handleNewChat}
              >
                <IconPlus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                New Chat
              </Button>
            </motion.div>
          </motion.div>

          {/* Conversations List */}
          <motion.div variants={itemVariants} className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
            {filteredConversations.map((conv) => (
              <ConversationHoverCard key={conv.id} conversation={conv}>
              <div
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                  activeConversationId === conv.id
                    ? 'bg-white/[0.06] text-foreground'
                    : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
                }`}
                onClick={() => {
                  setActiveConversationId(conv.id)
                  setLastStreamingMessageId(null)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setRenamingConvId(conv.id)
                  setSidebarRenameValue(conv.title)
                }}
              >
                <div className="flex-1 min-w-0">
                  {renamingConvId === conv.id ? (
                    <Input
                      autoFocus
                      value={sidebarRenameValue}
                      onChange={(e) => setSidebarRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const trimmed = sidebarRenameValue.trim()
                          if (trimmed && trimmed !== conv.title) {
                            renameConversation.mutate({ id: conv.id, title: trimmed })
                          }
                          setRenamingConvId(null)
                        } else if (e.key === 'Escape') {
                          setRenamingConvId(null)
                        }
                      }}
                      onBlur={() => {
                        const trimmed = sidebarRenameValue.trim()
                        if (trimmed && trimmed !== conv.title) {
                          renameConversation.mutate({ id: conv.id, title: trimmed })
                        }
                        setRenamingConvId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 bg-transparent border-0 border-b border-primary/40 rounded-none text-sm focus-visible:ring-0"
                    />
                  ) : (
                    <span className="block truncate">{conv.title}</span>
                  )}
                  <span className="block text-[10px] text-muted-foreground/60 mt-0.5">
                    {relativeTime(conv.createdAt)}
                  </span>
                </div>
                <DeleteConversationDialog conv={conv} onDelete={handleDeleteConversation} />
              </div>
              </ConversationHoverCard>
            ))}

            {filteredConversations.length === 0 && (
              <p className="text-xs text-muted-foreground/50 text-center py-6">
                {searchQuery.trim() ? 'No matches' : 'No conversations yet'}
              </p>
            )}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── Main Chat Area ──────────────────────────────────────────────── */}
      <div
        className="relative flex min-h-0 flex-1 flex-col bg-background min-w-0"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary/40 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-primary">
              <IconUpload size={40} strokeWidth={1.5} />
              <p className="text-sm font-medium">Drop file to upload</p>
            </div>
          </div>
        )}

        {/* Thinking Aura Background */}
        <motion.div
          className="absolute inset-0 pointer-events-none z-0"
          animate={{
            background: isThinking
              ? 'radial-gradient(ellipse 60% 50% at 50% 80%, rgba(125,211,252,0.08) 0%, transparent 60%)'
              : 'radial-gradient(ellipse 60% 50% at 50% 80%, rgba(125,211,252,0.02) 0%, transparent 60%)',
            scale: isThinking ? 1.05 : 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 40,
            damping: 15,
            repeat: isThinking ? Infinity : 0,
            repeatType: 'reverse',
          }}
        />

        {/* Header Bar */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0 relative z-10">
          {!sidebarOpen && (
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                onClick={() => setSidebarOpen(true)}
              >
                <IconMenu2 size={18} />
              </Button>
            </motion.div>
          )}
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 ${
              voice.state !== 'idle' ? 'animate-pulse' : ''
            }`}
            style={{ background: avatarStyle.gradient, boxShadow: avatarStyle.shadow }}
          >
            {voice.state === 'listening' ? (
              <WaveformBars />
            ) : voice.state === 'thinking' ? (
              <IconLoader2 size={16} className="text-white animate-spin" />
            ) : (
              <IconRobot size={16} className="text-white" />
            )}
          </div>
          <div className="min-w-0">
            {isRenaming ? (
              <Input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = renameValue.trim()
                    if (trimmed) {
                      if (activeConversationId && trimmed !== activeTitle) {
                        renameConversation.mutate({ id: activeConversationId, title: trimmed })
                      } else if (!activeConversationId) {
                        setPendingTitle(trimmed)
                      }
                    }
                    setIsRenaming(false)
                  } else if (e.key === 'Escape') {
                    setIsRenaming(false)
                  }
                }}
                onBlur={() => {
                  const trimmed = renameValue.trim()
                  if (trimmed) {
                    if (activeConversationId && trimmed !== activeTitle) {
                      renameConversation.mutate({ id: activeConversationId, title: trimmed })
                    } else if (!activeConversationId) {
                      setPendingTitle(trimmed)
                    }
                  }
                  setIsRenaming(false)
                }}
                className="text-sm font-semibold bg-transparent border-0 border-b border-primary/40 rounded-none w-full focus-visible:ring-0"
              />
            ) : (
              <div className="flex items-center gap-1.5 group/title">
                <h3
                  className="text-sm font-semibold text-foreground truncate cursor-pointer"
                  onClick={() => {
                    setRenameValue(activeTitle ?? pendingTitle ?? '')
                    setIsRenaming(true)
                  }}
                >
                  {displayTitle}
                </h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md opacity-0 group-hover/title:opacity-100 transition-opacity hover:bg-white/[0.08]"
                      onClick={() => {
                        setRenameValue(activeTitle ?? pendingTitle ?? '')
                        setIsRenaming(true)
                      }}
                    >
                      <IconPencil size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rename conversation</TooltipContent>
                </Tooltip>
              </div>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
              {STATE_LABELS[voice.state]}
            </Badge>
          </div>
        </div>

        {/* Messages Area */}
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto py-6 pb-4">
          {!activeConversationId && messages.length === 0 && !sendMessage.isPending ? (
            /* ── Empty State ──────────────────────────────────────────── */
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center justify-center h-full gap-6 px-4"
            >
              <motion.div variants={itemVariants}>
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">S</span>
                </div>
              </motion.div>
              <motion.div variants={itemVariants} className="text-center space-y-2">
                <h2 className="text-2xl font-medium tracking-tight text-foreground">
                  What would you like to do?
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Run reports, log transactions, manage your pipeline — powered by AI
                </p>
              </motion.div>
              <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return (
                    <Card
                      key={action.label}
                      className="group bg-card/50 backdrop-blur border-border/50 cursor-pointer transition-all duration-200 hover:bg-card/80 hover:border-border hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/5 text-left p-4"
                      style={{ ['--action-color' as string]: action.color }}
                      onClick={() => handlePromptClick(action.prompt)}
                    >
                      <div className="space-y-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200" style={{ background: `${action.color}15` }}>
                          <Icon size={16} style={{ color: action.color }} />
                        </div>
                        <p className="text-sm font-medium text-foreground">{action.label}</p>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      </div>
                    </Card>
                  )
                })}
              </motion.div>
            </motion.div>
          ) : (
            <MessageList
              ref={messagesEndRef}
              messages={messages}
              isThinking={isThinking}
              messagesLoading={messagesLoading}
              lastStreamingMessageId={lastStreamingMessageId}
              voiceError={voice.state === 'listening' ? voice.error : null}
              sendError={sendMessage.isError ? 'Message failed to send. The AI service may be unavailable.' : null}
              actionStates={actionStates}
              onConfirmAction={handleConfirmAction}
              onDismissAction={handleDismissAction}
            />
          )}
        </div>

        {/* ── Command Island ──────────────────────────────────────────── */}
        <motion.div variants={floatUpVariants} initial="hidden" animate="visible">
          <CommandIsland
            input={input}
            onInputChange={setInput}
            onKeyDown={handleKeyDown}
            onSend={handleSend}
            canSend={!!canSend}
            voiceState={voice.state}
            isSupported={voice.isSupported}
            isMuted={voice.isMuted}
            onMicToggle={handleMicToggle}
            onMuteToggle={voice.toggleMute}
            attachedFile={attachedFile}
            fileStatus={fileStatus}
            fileError={fileError}
            parsedData={parsedData}
            isDragOver={isDragOver}
            onFileClick={() => fileInputRef.current?.click()}
            onClearFile={clearFile}
            fileInputRef={fileInputRef}
            onFileInput={handleFileInput}
          />
        </motion.div>
      </div>
    </div>
  )
}
