import { LoaderCircle } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { AssignableRole } from "./types"

interface InviteMemberModalProps {
  actorRole: "OWNER" | "ADMIN"
  error?: string | null
  isOpen: boolean
  isPending: boolean
  onClose: () => void
  onSubmit: (emails: string[], role: AssignableRole) => void
}

export function InviteMemberModal({
  actorRole,
  error,
  isOpen,
  isPending,
  onClose,
  onSubmit,
}: InviteMemberModalProps) {
  const [emails, setEmails] = useState("")
  const [role, setRole] = useState<AssignableRole>("MEMBER")
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleClose = () => {
    setEmails("")
    setRole("MEMBER")
    setValidationError(null)
    onClose()
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const emailList = [
      ...new Set(
        emails
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      ),
    ]
    const invalidEmail = emailList.find(
      (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )

    if (emailList.length === 0) {
      setValidationError("Enter at least one email address.")
      return
    }

    if (invalidEmail) {
      setValidationError(`${invalidEmail} is not a valid email address.`)
      return
    }

    setValidationError(null)
    onSubmit(emailList, role)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite team members</DialogTitle>
          <DialogDescription>
            Send invitations to join the active organization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="invite-emails" className="text-xs font-semibold">
              Email addresses
            </label>
            <Input
              id="invite-emails"
              value={emails}
              placeholder="colleague@company.com, partner@company.com"
              onChange={(event) => {
                setEmails(event.target.value)
                setValidationError(null)
              }}
              aria-invalid={Boolean(validationError || error)}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple addresses with commas.
            </p>
            {(validationError || error) && (
              <p className="text-xs text-danger">{validationError || error}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="text-xs font-semibold">
              Role
            </label>
            <Select
              value={role}
              onValueChange={(value) =>
                value && setRole(value as AssignableRole)
              }
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {actorRole === "OWNER" && (
                  <SelectItem value="ADMIN">Admin</SelectItem>
                )}
                <SelectItem value="MEMBER">Member</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="animate-spin" />}
              Send {emails.includes(",") ? "invitations" : "invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
