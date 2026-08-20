import { Users, UserCheck, UserPlus, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Member } from "./types"

interface TeamStatsProps {
  members: Member[]
}

export function TeamStats({ members }: TeamStatsProps) {
  const activeCount = members.length
  const totalSeats = 10
  const availableSeats = Math.max(0, totalSeats - members.length)
  const activePercentage =
    members.length > 0 ? Math.round((activeCount / members.length) * 100) : 0
  const capacityPercentage = Math.round((members.length / totalSeats) * 100)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Total Members */}
      <Card className="relative overflow-hidden border border-border bg-card hover:shadow-md transition-all duration-200">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
              {totalSeats} Seats Max
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Total Members
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-bold text-foreground">
                {members.length}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                members enrolled
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
              <span>Capacity used</span>
              <span>{capacityPercentage}%</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${capacityPercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Members */}
      <Card className="relative overflow-hidden border border-border bg-card hover:shadow-md transition-all duration-200">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-success/10 text-success border border-success/20">
              <UserCheck className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {activePercentage}% Active
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Active Members
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-bold text-foreground">
                {activeCount}
              </span>
              <span className="text-xs text-muted-foreground font-medium font-normal">
                active now
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
              <span>Activity rate</span>
              <span>
                {activeCount} of {members.length}
              </span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-300"
                style={{ width: `${activePercentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seats Available */}
      <Card className="relative overflow-hidden border border-border bg-card hover:shadow-md transition-all duration-200">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-warning/10 text-warning border border-warning/20">
              <UserPlus className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Pro Plan
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Seats Available
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-heading font-bold text-foreground">
                {availableSeats}
              </span>
              <span className="text-xs text-muted-foreground font-medium font-normal">
                open slots remaining
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
              <span>Available slots</span>
              <span>{availableSeats} left</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-warning rounded-full transition-all duration-300"
                style={{ width: `${(availableSeats / totalSeats) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
