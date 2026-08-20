import {
  FileArchive,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  Presentation,
} from "lucide-react"

export function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const className = "h-5 w-5"
  if (mimeType.startsWith("image/")) return <FileImage className={className} />
  if (mimeType === "application/json") return <FileJson className={className} />
  if (mimeType.includes("spreadsheet") || mimeType === "text/csv") {
    return <FileSpreadsheet className={className} />
  }
  if (mimeType.includes("presentation")) {
    return <Presentation className={className} />
  }
  if (mimeType.includes("wordprocessing")) {
    return <FileArchive className={className} />
  }
  return <FileText className={className} />
}
