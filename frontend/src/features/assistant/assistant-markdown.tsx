import { Fragment, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type AssistantMarkdownProps = {
  content: string
  className?: string
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let match: RegExpExecArray | null
  let idx = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${idx++}`}>
          {text.slice(last, match.index)}
        </Fragment>
      )
    }
    const token = match[0]
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${idx++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={`${keyPrefix}-i-${idx++}`} className="italic">
          {token.slice(1, -1)}
        </em>
      )
    } else {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${idx++}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }
    last = match.index + token.length
  }

  if (last < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-t-${idx++}`}>{text.slice(last)}</Fragment>
    )
  }
  return nodes
}

type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "quote"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (/^---+$/.test(trimmed) || /^—+$/.test(trimmed)) {
      blocks.push({ type: "hr" })
      i += 1
      continue
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() })
      i += 1
      continue
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() })
      i += 1
      continue
    }

    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""))
        i += 1
      }
      blocks.push({ type: "quote", text: quoteLines.join(" ") })
      continue
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""))
        i += 1
      }
      blocks.push({ type: "ul", items })
      continue
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""))
        i += 1
      }
      blocks.push({ type: "ol", items })
      continue
    }

    const para: string[] = [trimmed]
    i += 1
    while (i < lines.length) {
      const next = lines[i].trim()
      if (
        !next ||
        next.startsWith("## ") ||
        next.startsWith("### ") ||
        next.startsWith("> ") ||
        /^[-*•]\s+/.test(next) ||
        /^\d+[.)]\s+/.test(next) ||
        /^---+$/.test(next)
      ) {
        break
      }
      para.push(next)
      i += 1
    }
    blocks.push({ type: "p", text: para.join(" ") })
  }

  return blocks
}

export function AssistantMarkdown({ content, className }: AssistantMarkdownProps) {
  const blocks = parseBlocks(content)

  return (
    <div className={cn("space-y-2.5 text-sm leading-relaxed", className)}>
      {blocks.map((block, index) => {
        const key = `block-${index}`
        if (block.type === "hr") {
          return <hr key={key} className="border-border/50" />
        }
        if (block.type === "h2") {
          return (
            <h3
              key={key}
              className="font-heading text-[0.95rem] font-semibold tracking-tight"
            >
              {renderInline(block.text, key)}
            </h3>
          )
        }
        if (block.type === "h3") {
          return (
            <h4 key={key} className="text-[0.9rem] font-semibold">
              {renderInline(block.text, key)}
            </h4>
          )
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={key}
              className="border-l-2 border-border/70 pl-3 text-muted-foreground"
            >
              {renderInline(block.text, key)}
            </blockquote>
          )
        }
        if (block.type === "ul") {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ul>
          )
        }
        if (block.type === "ol") {
          return (
            <ol key={key} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
              ))}
            </ol>
          )
        }
        // block.type === "p"
        return <p key={key}>{renderInline(block.text, key)}</p>
      })}
    </div>
  )
}
