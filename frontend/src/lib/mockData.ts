export const currentUser = {
  name: "Sarah Mitchell",
  initials: "SM",
  email: "sarah.mitchell@example.com",
  role: "Admin" as const,
  avatar: "https://i.pravatar.cc/150?img=5",
}

export const currentOrganization = {
  name: "Acme Inc",
  plan: "Free Plan",
  initial: "A",
}

export const teamMembers = [
  {
    id: 1,
    name: "Sarah Mitchell",
    email: "sarah.mitchell@example.com",
    role: "Owner",
    status: "Active",
    joined: "Jan 12, 2024",
    lastActive: "Just now",
    avatar: "https://i.pravatar.cc/150?img=5",
  },
  {
    id: 2,
    name: "James Harrington",
    email: "james.h@acmeinc.com",
    role: "Admin",
    status: "Active",
    joined: "Jan 15, 2024",
    lastActive: "2 hours ago",
    avatar: "https://i.pravatar.cc/150?img=11",
  },
  {
    id: 3,
    name: "Priya Sharma",
    email: "priya.s@acmeinc.com",
    role: "Admin",
    status: "Active",
    joined: "Feb 3, 2024",
    lastActive: "5 hours ago",
    avatar: "https://i.pravatar.cc/150?img=4",
  },
  {
    id: 4,
    name: "Carlos Medina",
    email: "carlos.m@acmeinc.com",
    role: "Member",
    status: "Active",
    joined: "Feb 18, 2024",
    lastActive: "1 day ago",
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: 5,
    name: "Yuki Tanaka",
    email: "yuki.t@acmeinc.com",
    role: "Viewer",
    status: "Inactive",
    joined: "Mar 5, 2024",
    lastActive: "4 days ago",
    avatar: "https://i.pravatar.cc/150?img=9",
  },
  {
    id: 6,
    name: "Amara Osei",
    email: "amara.o@acmeinc.com",
    role: "Member",
    status: "Active",
    joined: "Mar 22, 2024",
    lastActive: "3 hours ago",
    avatar: "https://i.pravatar.cc/150?img=10",
  },
]

export function getRoleBadgeClasses(role: string) {
  switch (role) {
    case "Owner":
      return "border-primary text-primary bg-primary/10"
    case "Admin":
      return "border-warning text-warning bg-warning/10"
    default:
      return "border-muted-foreground text-muted-foreground bg-muted"
  }
}

export function getStatusDotClass(status: string) {
  if (status === "Active") return "bg-success"
  if (status === "Invited") return "bg-warning"
  return "bg-muted-foreground"
}

export type NotificationType = "user" | "billing" | "security" | "system"

export interface MockNotification {
  id: string
  type: NotificationType
  title: string
  description?: string
  time: string
  isRead: boolean
  link?: string
}

export const mockNotifications: MockNotification[] = [
  {
    id: "notif-1",
    type: "user",
    title: "James Harrington joined the team",
    description: "Invited by Sarah Mitchell",
    time: "2 hours ago",
    isRead: false,
    link: "/team",
  },
  {
    id: "notif-2",
    type: "billing",
    title: "Payment successful",
    description: "Invoice #INV-2024-001 for $299.00 has been paid.",
    time: "5 hours ago",
    isRead: false,
    link: "/billing",
  },
  {
    id: "notif-3",
    type: "security",
    title: "New sign-in detected",
    description: "Chrome on macOS in San Francisco, CA",
    time: "Yesterday",
    isRead: true,
  },
  {
    id: "notif-4",
    type: "system",
    title: "Platform maintenance scheduled",
    description: "Expected downtime of 15 minutes on Sunday at 2 AM UTC.",
    time: "2 days ago",
    isRead: true,
  },
  {
    id: "notif-5",
    type: "user",
    title: "Priya Sharma updated her profile",
    time: "Last week",
    isRead: true,
  },
]
