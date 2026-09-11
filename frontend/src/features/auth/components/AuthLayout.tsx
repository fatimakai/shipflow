import { Hexagon } from "lucide-react"
import type { PropsWithChildren, ReactNode } from "react"
import { Link } from "react-router-dom"

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
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4 py-10 sm:px-6">
      <div className="w-full max-w-[420px]">
        <Link
          to="/"
          className="mx-auto mb-6 flex w-fit items-center gap-2.5 text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Hexagon className="h-4 w-4 fill-primary-foreground text-primary-foreground" />
          </span>
          <span className="font-heading text-xl font-bold">ShipFlow</span>
        </Link>

        <section className="rounded-lg border border-border bg-background p-6 shadow-sm sm:p-7">
          <header className="mb-6">
            <h1 className="font-heading text-xl font-semibold text-foreground">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
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
      </div>
    </main>
  )
}
