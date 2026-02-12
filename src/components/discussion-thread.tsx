"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { MessageSquare, Send, Paperclip, X, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { formatDateTime } from "@/lib/utils"

interface DiscussionUser {
  id: string
  name: string
  email: string
  role?: string
  department?: string
}

interface Discussion {
  id: string
  message: string
  attachmentUrl: string | null
  attachmentName: string | null
  createdAt: string
  user: DiscussionUser
  mentionedUsers: DiscussionUser[]
}

interface DiscussionThreadProps {
  requestId: string
  referenceNumber: string
}

const roleDisplayNames: Record<string, string> = {
  ADMIN: "Admin",
  MD: "Managing Director",
  DIRECTOR: "Director",
  FINANCE_CONTROLLER: "Finance Controller",
  FINANCE_PLANNER: "Finance Planner",
  FINANCE_TEAM: "Finance Team",
  EMPLOYEE: "Employee",
}

export function DiscussionThread({ requestId, referenceNumber }: DiscussionThreadProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionUsers, setMentionUsers] = useState<DiscussionUser[]>([])
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [selectedMentions, setSelectedMentions] = useState<DiscussionUser[]>([])
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch discussions
  const fetchDiscussions = useCallback(async () => {
    try {
      const response = await fetch(`/api/discussions?requestId=${requestId}`)
      if (response.ok) {
        const data = await response.json()
        setDiscussions(data.discussions)
      }
    } catch (error) {
      console.error("Failed to fetch discussions:", error)
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    fetchDiscussions()
    // Poll for new discussions every 30 seconds when expanded
    let interval: NodeJS.Timeout
    if (isExpanded) {
      interval = setInterval(fetchDiscussions, 30000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [fetchDiscussions, isExpanded])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [discussions, isExpanded])

  // Fetch users for @mention
  const fetchMentionUsers = async (query: string) => {
    try {
      const response = await fetch(
        `/api/discussions/users?q=${encodeURIComponent(query)}&requestId=${requestId}`
      )
      if (response.ok) {
        const data = await response.json()
        setMentionUsers(data.users)
      }
    } catch (error) {
      console.error("Failed to fetch mention users:", error)
    }
  }

  // Handle message input change
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)
    setCursorPosition(e.target.selectionStart || 0)

    // Check for @mention trigger
    const textBeforeCursor = value.substring(0, e.target.selectionStart || 0)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      const query = mentionMatch[1]
      setMentionQuery(query)
      setShowMentionDropdown(true)
      fetchMentionUsers(query)
    } else {
      setShowMentionDropdown(false)
      setMentionQuery("")
    }
  }

  // Handle mention selection
  const handleSelectMention = (user: DiscussionUser) => {
    const textBeforeCursor = message.substring(0, cursorPosition)
    const textAfterCursor = message.substring(cursorPosition)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${user.name} `)
      setMessage(newTextBefore + textAfterCursor)
      
      // Add to selected mentions if not already there
      if (!selectedMentions.find(m => m.id === user.id)) {
        setSelectedMentions([...selectedMentions, user])
      }
    }

    setShowMentionDropdown(false)
    setMentionQuery("")
    textareaRef.current?.focus()
  }

  // Remove a selected mention
  const removeMention = (userId: string) => {
    setSelectedMentions(selectedMentions.filter(m => m.id !== userId))
  }

  // Send message
  const handleSendMessage = async () => {
    if (!message.trim()) return

    setSending(true)
    try {
      const response = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          message: message.trim(),
          mentionedUserIds: selectedMentions.map(m => m.id),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDiscussions([...discussions, data.discussion])
        setMessage("")
        setSelectedMentions([])
        toast({
          title: "Comment posted",
          description: "Your comment has been added to the discussion.",
        })
      } else {
        const error = await response.json()
        toast({
          title: "Error",
          description: error.error || "Failed to post comment",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  // Handle Enter key to send (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-blue-600" />
          Discussion
          {discussions.length > 0 && (
            <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {discussions.length}
            </span>
          )}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {isExpanded ? "Click to collapse" : "Click to expand"}
          </span>
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Messages */}
          <div className="max-h-96 overflow-y-auto space-y-4 mb-4 pr-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : discussions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No comments yet. Start the discussion!</p>
              </div>
            ) : (
              discussions.map((discussion) => (
                <div
                  key={discussion.id}
                  className={`flex gap-3 ${
                    discussion.user.id === session?.user?.id
                      ? "flex-row-reverse"
                      : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      discussion.user.id === session?.user?.id
                        ? "bg-blue-600"
                        : "bg-gray-500"
                    }`}>
                      {discussion.user.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`max-w-[75%] ${
                      discussion.user.id === session?.user?.id
                        ? "bg-blue-600 text-white rounded-l-lg rounded-br-lg"
                        : "bg-gray-100 text-gray-900 rounded-r-lg rounded-bl-lg"
                    } px-4 py-2`}
                  >
                    <div className={`text-xs font-medium mb-1 ${
                      discussion.user.id === session?.user?.id
                        ? "text-blue-200"
                        : "text-gray-600"
                    }`}>
                      {discussion.user.name}
                      <span className="ml-1 opacity-75">
                        ({roleDisplayNames[discussion.user.role || "EMPLOYEE"]})
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {discussion.message}
                    </p>
                    {discussion.attachmentUrl && (
                      <a
                        href={discussion.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-xs mt-2 underline ${
                          discussion.user.id === session?.user?.id
                            ? "text-blue-200"
                            : "text-blue-600"
                        }`}
                      >
                        <Paperclip className="h-3 w-3" />
                        {discussion.attachmentName || "Attachment"}
                      </a>
                    )}
                    <div className={`text-xs mt-1 ${
                      discussion.user.id === session?.user?.id
                        ? "text-blue-200"
                        : "text-gray-500"
                    }`}>
                      {formatDateTime(discussion.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Selected mentions */}
          {selectedMentions.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedMentions.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                >
                  @{user.name}
                  <button
                    onClick={() => removeMention(user.id)}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  placeholder="Type your message... Use @ to mention users"
                  value={message}
                  onChange={handleMessageChange}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  maxLength={1000}
                  className="resize-none pr-12"
                />
                <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                  {message.length}/1000
                </span>

                {/* Mention dropdown */}
                {showMentionDropdown && mentionUsers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {mentionUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectMention(user)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                      >
                        <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{user.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {roleDisplayNames[user.role || "EMPLOYEE"]}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || sending}
                className="px-4"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
