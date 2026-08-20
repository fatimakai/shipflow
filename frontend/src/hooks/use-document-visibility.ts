import { useEffect, useState } from "react"

export function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(
    () => document.visibilityState === "visible"
  )

  useEffect(() => {
    const updateVisibility = () =>
      setIsVisible(document.visibilityState === "visible")

    document.addEventListener("visibilitychange", updateVisibility)
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility)
  }, [])

  return isVisible
}
