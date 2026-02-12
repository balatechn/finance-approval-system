"use client"

import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import {
  MessageSquare,
  Plus,
  Send,
  Paperclip,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  X,
  Loader2,
  Upload,
  File,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, formatRelativeTime } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Attachment {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  fileUrl: string
}

interface Message {
  id: string
  content: string
  isStaffReply: boolean
  createdAt: string
  sender: {
    id: string
    name: string
    email: string
    role: string
  }
  attachments: Attachment[]
}

interface Ticket {
  id: string
  ticketNumber: string
  subject: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  createdBy: {
    id: string
    name: string
    email: string
    role: string
    department?: string
  }
  assignedTo?: {
    id: string
    name: string
    email: string
  }
  messages: Message[]
  attachments: Attachment[]
  _count?: {
    messages: number
    attachments: number
  }
}

const statusConfig = {
  OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Clock },
  RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-700', icon: CheckCircle },
}

const priorityConfig = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-600' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-600' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-600' },
}

export default function SupportPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('ALL')
  const [counts, setCounts] = useState({ ALL: 0, OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 })
  const [newMessage, setNewMessage] = useState('')
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'MEDIUM' })
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
  const [messageFiles, setMessageFiles] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'FINANCE_TEAM'

  useEffect(() => {
    fetchTickets()
  }, [activeFilter])

  useEffect(() => {
    if (selectedTicket) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedTicket?.messages])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (activeFilter !== 'ALL') params.set('status', activeFilter)
      
      const res = await fetch(`/api/support?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
        setCounts(data.counts || { ALL: 0, OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 })
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTicketDetail = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/support/${ticketId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedTicket(data)
      }
    } catch (error) {
      console.error('Failed to fetch ticket:', error)
    }
  }

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('category', 'SUPPORT')

    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const data = await res.json()
        return {
          id: data.id,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          fileUrl: data.fileUrl,
        }
      }
    } catch (error) {
      console.error('Upload failed:', error)
    }
    return null
  }

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast({ title: 'Error', description: 'Subject and description are required', variant: 'destructive' })
      return
    }

    try {
      setCreating(true)

      // Upload attachments first
      const uploadedAttachments: Attachment[] = []
      for (const file of uploadingFiles) {
        const att = await uploadFile(file)
        if (att) uploadedAttachments.push(att)
      }

      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTicket,
          attachments: uploadedAttachments,
        }),
      })

      if (res.ok) {
        toast({ title: 'Success', description: 'Support ticket created successfully' })
        setShowNewTicketDialog(false)
        setNewTicket({ subject: '', description: '', priority: 'MEDIUM' })
        setUploadingFiles([])
        fetchTickets()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Failed to create ticket', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create ticket', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return

    try {
      setSending(true)

      // Upload message attachments first
      const uploadedAttachments: Attachment[] = []
      for (const file of messageFiles) {
        const att = await uploadFile(file)
        if (att) uploadedAttachments.push(att)
      }

      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newMessage,
          attachments: uploadedAttachments,
        }),
      })

      if (res.ok) {
        setNewMessage('')
        setMessageFiles([])
        fetchTicketDetail(selectedTicket.id)
        fetchTickets() // Refresh list to update timestamp
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Failed to send message', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    if (!selectedTicket) return

    try {
      const res = await fetch(`/api/support/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (res.ok) {
        toast({ title: 'Success', description: 'Ticket status updated' })
        fetchTicketDetail(selectedTicket.id)
        fetchTickets()
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
    }
  }

  const filterTabs = [
    { key: 'ALL', label: 'All' },
    { key: 'OPEN', label: 'Open' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'RESOLVED', label: 'Resolved' },
  ]

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-orange-500" />
            Support Chat
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage support tickets from all users' : 'Get help from our support team'}
          </p>
        </div>
        <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600">
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>
                Describe your issue and we'll get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Subject</Label>
                <Input
                  placeholder="Brief description of your issue"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  maxLength={200}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Provide more details about your issue..."
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  rows={4}
                  maxLength={2000}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={newTicket.priority}
                  onValueChange={(v) => setNewTicket({ ...newTicket, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Attachments (optional)</Label>
                <div className="mt-2">
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setUploadingFiles(Array.from(e.target.files))
                      }
                    }}
                  />
                  {uploadingFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadingFiles.map((f, i) => (
                        <div key={i} className="text-xs flex items-center gap-2 text-muted-foreground">
                          <File className="h-3 w-3" />
                          {f.name}
                          <button onClick={() => setUploadingFiles(uploadingFiles.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowNewTicketDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTicket} disabled={creating} className="bg-orange-500 hover:bg-orange-600">
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Ticket
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 grid grid-cols-[400px_1fr] gap-4 min-h-0">
        {/* Left Panel - Ticket List */}
        <Card className="flex flex-col overflow-hidden">
          {/* Filter Tabs */}
          <div className="p-3 border-b flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-full transition-colors",
                  activeFilter === tab.key
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {tab.label} ({counts[tab.key as keyof typeof counts] || 0})
              </button>
            ))}
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                <p>No tickets found</p>
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((ticket) => {
                  const StatusIcon = statusConfig[ticket.status].icon
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => fetchTicketDetail(ticket.id)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-gray-50 transition-colors",
                        selectedTicket?.id === ticket.id && "bg-orange-50 border-l-4 border-orange-500"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ticket.ticketNumber} • {ticket.createdBy.name}
                          </p>
                        </div>
                        <Badge className={cn("text-xs shrink-0", statusConfig[ticket.status].color)}>
                          {statusConfig[ticket.status].label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {ticket.messages?.[0]?.content || ticket.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{formatRelativeTime(ticket.updatedAt)}</span>
                        {ticket._count && ticket._count.messages > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket._count.messages}
                          </span>
                        )}
                        {ticket._count && ticket._count.attachments > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {ticket._count.attachments}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Right Panel - Ticket Detail */}
        <Card className="flex flex-col overflow-hidden">
          {!selectedTicket ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">Select a ticket to view</p>
              <p className="text-sm">or create a new support ticket</p>
            </div>
          ) : (
            <>
              {/* Ticket Header */}
              <div className="p-4 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-lg">{selectedTicket.subject}</h2>
                      <Badge className={cn("text-xs", priorityConfig[selectedTicket.priority].color)}>
                        {priorityConfig[selectedTicket.priority].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedTicket.ticketNumber} • Created by {selectedTicket.createdBy.name}
                      {selectedTicket.createdBy.department && ` (${selectedTicket.createdBy.department})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <Select
                        value={selectedTicket.status}
                        onValueChange={handleStatusChange}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="RESOLVED">Resolved</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {!isAdmin && (
                      <Badge className={cn("text-sm", statusConfig[selectedTicket.status].color)}>
                        {statusConfig[selectedTicket.status].label}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedTicket(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Initial Description */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                  {selectedTicket.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTicket.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                        >
                          <Paperclip className="h-3 w-3" />
                          {att.fileName}
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedTicket.messages.map((msg) => {
                  const isMe = msg.sender.id === session?.user?.id
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        isMe && "flex-row-reverse"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-medium",
                        msg.isStaffReply ? "bg-orange-500" : "bg-blue-500"
                      )}>
                        {msg.sender.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={cn(
                        "max-w-[70%] rounded-lg p-3",
                        isMe
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100"
                      )}>
                        <p className={cn(
                          "text-xs font-medium mb-1",
                          isMe ? "text-orange-100" : "text-muted-foreground"
                        )}>
                          {msg.sender.name}
                          {msg.isStaffReply && !isMe && " (Staff)"}
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {msg.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-1 text-xs hover:underline",
                                  isMe ? "text-orange-100" : "text-blue-600"
                                )}
                              >
                                <Paperclip className="h-3 w-3" />
                                {att.fileName}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className={cn(
                          "text-xs mt-1",
                          isMe ? "text-orange-200" : "text-muted-foreground"
                        )}>
                          {formatRelativeTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedTicket.status !== 'CLOSED' && (
                <div className="p-4 border-t">
                  {messageFiles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {messageFiles.map((f, i) => (
                        <div key={i} className="text-xs flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                          <File className="h-3 w-3" />
                          {f.name}
                          <button onClick={() => setMessageFiles(messageFiles.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          if (e.target.files) {
                            setMessageFiles([...messageFiles, ...Array.from(e.target.files)])
                          }
                        }}
                      />
                      <Button variant="outline" size="icon" type="button">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendMessage()
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {selectedTicket.status === 'CLOSED' && (
                <div className="p-4 border-t bg-gray-50 text-center text-sm text-muted-foreground">
                  This ticket is closed. Create a new ticket if you need further assistance.
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
