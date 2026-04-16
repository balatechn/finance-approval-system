"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  BarChart3,
  Users,
  Circle,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Lock,
  MessageSquare,
  Target,
  Headphones,
  PlusCircle,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getRoleLabel } from "@/lib/auth/permissions"
import { SessionProvider } from "next-auth/react"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Requests", href: "/dashboard/requests", icon: FileText },
  { name: "Approvals", href: "/dashboard/approvals", icon: CheckSquare, roles: ["FINANCE_TEAM", "FINANCE_PLANNER", "FINANCE_CONTROLLER", "FINANCE_COORDINATOR", "DIRECTOR", "MD", "ADMIN"] },
  { name: "Forecast", href: "/dashboard/forecast", icon: Target, roles: ["FINANCE_TEAM", "FINANCE_PLANNER", "FINANCE_CONTROLLER", "FINANCE_COORDINATOR", "DIRECTOR", "MD", "ADMIN"] },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3, roles: ["FINANCE_TEAM", "FINANCE_PLANNER", "FINANCE_CONTROLLER", "FINANCE_COORDINATOR", "DIRECTOR", "MD", "ADMIN"] },
  { name: "Support", href: "/dashboard/support", icon: Headphones, highlight: true },
  { name: "Users", href: "/dashboard/users", icon: Users, roles: ["ADMIN"] },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["ADMIN"] },
]

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(true)

  // Track tab visibility to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Database keep-alive: ping every 1 hour to prevent cold starts
  useEffect(() => {
    if (status !== 'authenticated') return
    const keepAlive = () => {
      fetch('/api/notifications?limit=1').catch(() => {})
    }
    const interval = setInterval(keepAlive, 60 * 60 * 1000) // 1 hour
    return () => clearInterval(interval)
  }, [status])

  // Hydrate sidebar state from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setSidebarCollapsed(true)
  }, [])
  const [onlineUsers, setOnlineUsers] = useState<{ count: number; users: { id: string; name: string; role: string; department: string | null }[] }>({ count: 0, users: [] })
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadDiscussionCount, setUnreadDiscussionCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  const user = session?.user
  const userRole = user?.role

  // Persist sidebar state
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }, [])

  // Heartbeat: update last active timestamp every 5 minutes (paused when tab hidden)
  useEffect(() => {
    if (status !== 'authenticated') return
    const sendHeartbeat = () => {
      if (!isTabVisible) return // Skip if tab is hidden
      fetch('/api/users/online', { method: 'POST' }).catch(() => {})
    }
    sendHeartbeat() // Send immediately on mount
    const interval = setInterval(sendHeartbeat, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [status, isTabVisible])

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=10')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
        // Count unread discussion notifications (MENTION or DISCUSSION type)
        const discussionNotifs = (data.notifications || []).filter(
          (n: any) => !n.isRead && (n.type === 'MENTION' || n.type === 'DISCUSSION')
        )
        setUnreadDiscussionCount(discussionNotifs.length)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchNotifications()
    // Poll every 60s, but only when tab is visible
    const interval = setInterval(() => {
      if (isTabVisible) fetchNotifications()
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchNotifications, status, isTabVisible])

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {}
  }

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-notifications]')) setShowNotifications(false)
      if (!target.closest('[data-online]')) setShowOnlineDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch online users for admins
  const fetchOnlineUsers = useCallback(async () => {
    if (userRole !== 'ADMIN') return
    try {
      const res = await fetch('/api/users/online')
      if (res.ok) {
        const data = await res.json()
        setOnlineUsers(data)
      }
    } catch {}
  }, [userRole])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchOnlineUsers()
    if (userRole === 'ADMIN') {
      // Poll every 60s, but only when tab is visible
      const interval = setInterval(() => {
        if (isTabVisible) fetchOnlineUsers()
      }, 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [fetchOnlineUsers, userRole, status, isTabVisible])

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    redirect("/login")
  }

  // Force password change for new users
  const mustChangePassword = (session.user as any)?.mustChangePassword === true
  if (mustChangePassword && pathname !== "/dashboard/change-password") {
    redirect("/dashboard/change-password")
  }

  const filteredNavigation = navigation.filter((item) => {
    if (!item.roles) return true
    return userRole ? item.roles.includes(userRole) : false
  })

  const userInitials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U"

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 transform glass-sidebar transition-all duration-200 lg:static lg:translate-x-0",
            sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full",
            sidebarCollapsed ? "lg:w-[68px]" : "lg:w-64"
          )}
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className={cn(
              "flex h-16 items-center border-b border-white/[0.1]",
              sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
            )}>
              <Link href="/dashboard" className={cn(
                "flex items-center",
                sidebarCollapsed ? "justify-center" : "gap-3"
              )}>
                <img
                  src="/national-logo.webp"
                  alt="National Group India"
                  className={cn(
                    "rounded-lg object-contain",
                    sidebarCollapsed ? "h-9 w-9" : "h-10 w-10"
                  )}
                />
                {!sidebarCollapsed && (
                  <div className="flex flex-col">
                    <span className="font-semibold text-white">Finance</span>
                    <span className="text-[10px] text-white/50 leading-tight">National Group India</span>
                  </div>
                )}
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-md p-1 hover:bg-white/[0.1] text-white/60 lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className={cn(
              "flex-1 space-y-1 overflow-y-auto",
              sidebarCollapsed ? "p-2" : "p-4"
            )}>
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                const isHighlight = (item as any).highlight
                const linkContent = (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                      sidebarCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2",
                      isActive
                        ? isHighlight
                          ? "bg-orange-500/80 text-white shadow-lg shadow-orange-500/20"
                          : "bg-white/[0.15] text-white shadow-lg shadow-white/5"
                        : isHighlight
                          ? "text-orange-300 hover:bg-orange-500/20"
                          : "text-white/60 hover:bg-white/[0.08] hover:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!sidebarCollapsed && item.name}
                  </Link>
                )

                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return linkContent
              })}
            </nav>

            {/* Collapse toggle (desktop only) */}
            <div className={cn(
              "hidden lg:flex border-t border-white/[0.1]",
              sidebarCollapsed ? "justify-center p-2" : "px-4 py-2"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSidebar}
                    className={cn(
                      "flex items-center rounded-lg text-sm text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-colors",
                      sidebarCollapsed ? "p-3 justify-center" : "gap-3 px-3 py-2 w-full"
                    )}
                  >
                    {sidebarCollapsed ? (
                      <ChevronsRight className="h-5 w-5" />
                    ) : (
                      <>
                        <ChevronsLeft className="h-5 w-5" />
                        <span>Collapse</span>
                      </>
                    )}
                  </button>
                </TooltipTrigger>
                {sidebarCollapsed && (
                  <TooltipContent side="right">Expand sidebar</TooltipContent>
                )}
              </Tooltip>
            </div>

            {/* User info at bottom */}
            <div className={cn(
              "border-t border-white/[0.1]",
              sidebarCollapsed ? "p-2" : "p-4"
            )}>
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-center">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-white/[0.15] text-white">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-white/50">{getRoleLabel(userRole as any)}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-white/[0.15] text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                    <p className="truncate text-xs text-white/50">
                      {getRoleLabel(userRole as any)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top header */}
          <header className="flex h-16 items-center justify-between glass-header px-4 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 hover:bg-white/[0.1] text-white/70 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-4 ml-auto">
              {/* Online Users - Admin only */}
              {userRole === 'ADMIN' && (
                <div className="relative">
                  <button
                    onClick={() => setShowOnlineDropdown(!showOnlineDropdown)}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5 hover:bg-white/[0.1] transition-colors"
                    title="Online users"
                  >
                    <Circle className="h-2.5 w-2.5 fill-green-400 text-green-400" />
                    <span className="text-sm font-medium text-white/70">
                      {onlineUsers.count} Online
                    </span>
                  </button>
                  {showOnlineDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowOnlineDropdown(false)} />
                      <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl backdrop-blur-xl bg-[#0a0f4a]/95 border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                        <div className="border-b border-white/[0.1] px-4 py-3">
                          <p className="text-sm font-semibold text-white">Online Users</p>
                          <p className="text-xs text-white/50">{onlineUsers.count} user{onlineUsers.count !== 1 ? 's' : ''} active now</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1">
                          {onlineUsers.users.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-white/40">No users online</p>
                          ) : (
                            onlineUsers.users.map((u) => (
                              <div key={u.id} className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.08]">
                                <div className="relative">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-white/[0.1] text-white/80 text-xs">
                                      {u.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-green-400 text-green-400 border-2 border-[#0a0f4a] rounded-full" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{u.name}</p>
                                  <p className="text-xs text-white/50 truncate">{u.department || u.role}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Discussion Alerts */}
              {unreadDiscussionCount > 0 && (
                <div className="relative">
                  <button
                    className="relative rounded-full p-2 hover:bg-white/[0.1]"
                    onClick={() => { setShowNotifications(true); setShowOnlineDropdown(false) }}
                    title="New discussion messages"
                  >
                    <MessageSquare className="h-5 w-5 text-red-400 animate-pulse" />
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white animate-pulse">
                      {unreadDiscussionCount > 9 ? '9+' : unreadDiscussionCount}
                    </span>
                  </button>
                </div>
              )}

              {/* Notifications */}
              <div className="relative" data-notifications>
                <button
                  className="relative rounded-full p-2 hover:bg-white/[0.1]"
                  onClick={() => { setShowNotifications(!showNotifications); setShowOnlineDropdown(false) }}
                >
                  <Bell className="h-5 w-5 text-white/60" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-12 z-50 w-80 rounded-xl backdrop-blur-xl bg-[#0a0f4a]/95 border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between border-b border-white/[0.1] px-4 py-3">
                      <h3 className="font-semibold text-sm text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-white/40">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              "border-b border-white/[0.06] px-4 py-3 text-sm hover:bg-white/[0.06] cursor-pointer",
                              !n.isRead && "bg-blue-500/10"
                            )}
                            onClick={async () => {
                              if (!n.isRead) {
                                await fetch('/api/notifications', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ notificationIds: [n.id] }),
                                })
                                setUnreadCount((c) => Math.max(0, c - 1))
                                setNotifications((prev) =>
                                  prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x)
                                )
                              }
                              if (n.financeRequest?.referenceNumber) {
                                setShowNotifications(false)
                                window.location.href = `/dashboard/requests/${n.financeRequest.referenceNumber}`
                              }
                            }}
                          >
                            <div className="flex items-start gap-2">
                              {!n.isRead && (
                                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                              )}
                              <div className={cn(!n.isRead ? "" : "ml-4")}>
                                <p className="font-medium text-white">{n.title}</p>
                                <p className="text-white/50 line-clamp-2">{n.message}</p>
                                <p className="mt-1 text-xs text-white/30">
                                  {new Date(n.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-1 hover:bg-white/[0.1]">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-white/[0.15] text-white text-sm">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-4 w-4 text-white/60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 backdrop-blur-xl bg-[#0a0f4a]/95 border-white/[0.12]">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-white">{user?.name}</span>
                      <span className="text-xs font-normal text-white/50">
                        {user?.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Badge variant="secondary" className="mr-2">
                      {getRoleLabel(userRole as any)}
                    </Badge>
                    {user?.department && (
                      <span className="text-xs text-white/50">
                        {user?.department}
                      </span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => window.location.href = '/dashboard/change-password'}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#070B47]/85 border-t border-white/[0.1] lg:hidden">
          <div className="flex items-center justify-around h-16">
            {[
              { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
              { name: "Requests", href: "/dashboard/requests", icon: FileText },
              { name: "New", href: "/dashboard/requests/new", icon: PlusCircle, accent: true },
              { name: "Approvals", href: "/dashboard/approvals", icon: CheckSquare },
              { name: "More", href: "#more", icon: MoreHorizontal, isMore: true },
            ].map((item) => {
              const isActive = item.isMore
                ? !["/dashboard", "/dashboard/requests", "/dashboard/requests/new", "/dashboard/approvals"].includes(pathname)
                : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
              
              if (item.isMore) {
                return (
                  <button
                    key={item.name}
                    onClick={() => setSidebarOpen(true)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors",
                      isActive ? "text-white" : "text-white/40"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </button>
                )
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors",
                    item.accent && !isActive
                      ? "text-blue-300"
                      : isActive
                      ? "text-white"
                      : "text-white/40"
                  )}
                >
                  {item.accent ? (
                    <div className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-full -mt-4 shadow-lg",
                      "bg-white/[0.2] text-white backdrop-blur-sm border border-white/[0.2]"
                    )}>
                      <item.icon className="h-5 w-5" />
                    </div>
                  ) : (
                    <item.icon className="h-5 w-5" />
                  )}
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SessionProvider>
  )
}
