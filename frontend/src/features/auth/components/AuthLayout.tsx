import type { PropsWithChildren, ReactNode } from "react"
import { Link } from "react-router-dom"
import { ShipFlowLogo } from "@/components/brand/ShipFlowLogo"

interface AuthLayoutProps extends PropsWithChildren {
  description: string
  footer?: ReactNode
  title: string
}

export function AuthLayout({
  children,
  description,
  footer,
  title,
}: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(340px,0.85fr)_minmax(480px,1.15fr)]">
      <aside className="auth-technical-grid relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-sidebar-border bg-sidebar p-10 text-sidebar-foreground lg:flex xl:p-14">
        <Link to="/" className="relative z-10 flex w-fit items-center">
          <ShipFlowLogo inverse size="large" />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-sidebar-primary">
            The workspace, in order
          </p>
          <p className="font-heading text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
            Good work runs on clear systems.
          </p>
          <p className="mt-6 max-w-sm text-base leading-7 text-sidebar-foreground/70">
            Bring your people, permissions, and operations into one considered
            place.
          </p>
        </div>
        <p className="relative z-10 border-t border-sidebar-border pt-5 text-xs uppercase tracking-[0.18em] text-sidebar-foreground/50">
          Built for teams that keep things moving
        </p>
      </aside>

      <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-[440px]">
          <Link
            to="/"
            className="mb-8 flex w-fit items-center gap-2.5 text-foreground lg:hidden"
          >
            <ShipFlowLogo />
          </Link>

          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Secure workspace access
          </p>
          <section className="rounded-md border border-border bg-card p-6 sm:p-8">
            <header className="mb-6">
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </header>

            {children}

            {footer && (
              <footer className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
                {footer}
              </footer>
            )}
          </section>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            ShipFlow · A more deliberate way to run the work.
          </p>
        </div>
      </div>
    </main>
  )
}
