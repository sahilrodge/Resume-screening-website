/** Shared resume upload validation + accept attributes. */

export const RESUME_MAX_SIZE_MB = 10
export const RESUME_MAX_SIZE_BYTES = RESUME_MAX_SIZE_MB * 1024 * 1024

export const RESUME_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".rtf"] as const

export const RESUME_ACCEPT = ".pdf,.doc,.docx,.txt,.rtf"

export const RESUME_FORMAT_LABEL = "PDF, DOC, DOCX, TXT, or RTF"

export function resumeExtension(fileName: string): string {
  const lower = fileName.toLowerCase()
  const idx = lower.lastIndexOf(".")
  return idx >= 0 ? lower.slice(idx) : ""
}

export function validateResumeFile(file: File): string | null {
  const ext = resumeExtension(file.name)
  const type = (file.type || "").toLowerCase()
  const allowedType =
    type === "application/pdf" ||
    type === "application/msword" ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "text/plain" ||
    type === "application/rtf" ||
    type === "text/rtf" ||
    type === ""

  if (
    !RESUME_EXTENSIONS.includes(ext as (typeof RESUME_EXTENSIONS)[number]) &&
    !allowedType
  ) {
    return `Unsupported file type. Allowed formats: ${RESUME_FORMAT_LABEL}.`
  }
  if (
    ext &&
    !RESUME_EXTENSIONS.includes(ext as (typeof RESUME_EXTENSIONS)[number])
  ) {
    return `Unsupported file type. Allowed formats: ${RESUME_FORMAT_LABEL}.`
  }
  if (file.size <= 0) {
    return "Uploaded file is empty."
  }
  if (file.size > RESUME_MAX_SIZE_BYTES) {
    return `File exceeds the ${RESUME_MAX_SIZE_MB}MB size limit.`
  }
  return null
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
