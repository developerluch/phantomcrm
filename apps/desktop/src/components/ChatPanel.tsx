import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChatConversations, useChatMessages, useSendMessage, useDeleteConversation } from '../hooks/useChat'
import {
  IconX,
  IconSend,
  IconPlus,
  IconExternalLink,
  IconTrash,
  IconMessage,
  IconLoader2,
} from '@tabler/icons-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [showConvos, setShowConvos] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: convosData } = useChatConversations()
  const { data: msgsData, isLoading: msgsLoading } = useChatMessages(conversationId)
  const sendMessage = useSendMessage()
  const deleteConvo = useDeleteConversation()

  const conversations = convosData?.conversations ?? []
  const messages = msgsData?.messages ?? []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sendMessage.isPending) return
    const msg = input.trim()
    setInput('')
    try {
      const result = await sendMessage.mutateAsync({
        message: msg,
        conversationId: conversationId ?? undefined,
      })
      if (!conversationId) setConversationId(result.conversationId)
    } catch {
      setInput(msg)
    }
  }

  const handlePopOut = () => {
    if (window.electronAPI) {
      window.electronAPI.openExternal(window.location.origin + '?chat=detached')
    }
  }

  const handleNewConvo = () => {
    setConversationId(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <IconMessage size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground text-sm">AI Assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleNewConvo}>
                <IconPlus size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New conversation</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConvos(!showConvos)}
              >
                <IconMessage size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Conversations</TooltipContent>
          </Tooltip>
          {window.electronAPI && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handlePopOut}>
                  <IconExternalLink size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pop out</TooltipContent>
            </Tooltip>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            <IconX size={16} />
          </Button>
        </div>
      </div>

      {/* Conversation list */}
      {showConvos && (
        <div className="border-b border-border max-h-48 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  setConversationId(c.id)
                  setShowConvos(false)
                }}
                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm ${
                  c.id === conversationId ? 'bg-muted' : ''
                }`}
              >
                <span className="truncate text-foreground">{c.title || 'Untitled'}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConvo.mutate(c.id)
                    if (conversationId === c.id) setConversationId(null)
                  }}
                >
                  <IconTrash size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgsLoading && (
          <div className="flex items-center justify-center py-8">
            <IconLoader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {!msgsLoading && messages.length === 0 && !sendMessage.isPending && (
          <div className="text-center text-muted-foreground text-sm mt-8">
            <p>Ask me anything about your dashboard!</p>
            <p className="text-xs mt-2">Try: "How many active agents do we have?"</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            disabled={sendMessage.isPending}
          />
          <Button type="submit" size="sm" disabled={!input.trim() || sendMessage.isPending}>
            <IconSend size={16} />
          </Button>
        </form>
      </div>
    </div>
  )
}
