interface ShipFlowLogoProps {
  inverse?: boolean
  size?: "default" | "large"
}

export function ShipFlowLogo({
  inverse = false,
  size = "default",
}: ShipFlowLogoProps) {
  const markSize = size === "large" ? "h-10 w-20" : "h-8 w-16"

  return (
    <span
      className={`inline-flex items-center gap-2.5 ${inverse ? "text-sidebar-foreground" : "text-foreground"}`}
    >
      <img
        src="/shipflow-mark-dark.png"
        alt=""
        aria-hidden="true"
        className={`${markSize} shrink-0 object-contain ${inverse ? "" : "hidden dark:block"}`}
      />
      {!inverse && (
        <img
          src="/shipflow-mark.png"
          alt=""
          aria-hidden="true"
          className={`${markSize} shrink-0 object-contain dark:hidden`}
        />
      )}
      <span
        className={`font-heading font-semibold tracking-[-0.045em] ${size === "large" ? "text-2xl" : "text-xl"}`}
      >
        Ship<span className="font-bold">Flow</span>
      </span>
    </span>
  )
}
