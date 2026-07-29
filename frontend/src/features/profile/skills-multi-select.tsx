"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SKILL_CATEGORIES } from "@/data/skill-catalog"
import { cn } from "@/lib/utils"

type SkillsMultiSelectProps = {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

/** List viewport — taller than the old max-h-64, but not full-screen tall. */
const LIST_HEIGHT_CLASS =
  "h-[min(42dvh,18rem)] sm:h-[min(44dvh,20rem)]"

export function SkillsMultiSelect({
  value,
  onChange,
  disabled = false,
}: SkillsMultiSelectProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = useMemo(
    () => Array.from(new Set(value.map((s) => s.trim()).filter(Boolean))),
    [value]
  )
  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.toLowerCase())),
    [selected]
  )

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SKILL_CATEGORIES.map((category) => ({
      ...category,
      skills: category.skills.filter((skill) => {
        if (!q) return true
        return (
          skill.toLowerCase().includes(q) ||
          category.name.toLowerCase().includes(q)
        )
      }),
    })).filter((category) => category.skills.length > 0)
  }, [query])

  const totalVisible = useMemo(
    () => filteredCategories.reduce((sum, c) => sum + c.skills.length, 0),
    [filteredCategories]
  )

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => searchRef.current?.focus(), 20)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function toggle(skill: string) {
    if (disabled) return
    const exists = selectedSet.has(skill.toLowerCase())
    if (exists) {
      onChange(selected.filter((s) => s.toLowerCase() !== skill.toLowerCase()))
    } else {
      onChange([...selected, skill])
    }
  }

  function remove(skill: string) {
    if (disabled) return
    onChange(selected.filter((s) => s.toLowerCase() !== skill.toLowerCase()))
  }

  function addCustom() {
    const custom = query.trim()
    if (!custom || disabled) return
    if (!selectedSet.has(custom.toLowerCase())) {
      onChange([...selected, custom])
    }
    setQuery("")
  }

  return (
    <div className="space-y-3" ref={rootRef}>
      <div className="space-y-2">
        <Label htmlFor={listboxId}>Skills</Label>
        <Button
          id={listboxId}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="h-auto min-h-10 w-full justify-between px-3 py-2.5 font-normal"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="truncate text-left text-muted-foreground">
            {selected.length
              ? `${selected.length} skill${selected.length === 1 ? "" : "s"} selected — search to add more`
              : "Search and select skills by category"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </Button>

        {/* Inline panel (not absolute) so height is never clipped by parent overflow */}
        {open ? (
          <div
            role="listbox"
            aria-multiselectable="true"
            className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-md"
          >
            <div className="shrink-0 border-b border-border bg-popover px-3 py-2.5">
              <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search skills or categories…"
                  className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (totalVisible === 1) {
                        toggle(filteredCategories[0].skills[0])
                        return
                      }
                      addCustom()
                    }
                  }}
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setQuery("")}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {totalVisible} skill{totalVisible === 1 ? "" : "s"} · multi-select
                · use Save on the profile page to persist
              </p>
            </div>

            <div
              className={cn(
                "overflow-y-auto overscroll-contain p-2",
                LIST_HEIGHT_CLASS
              )}
            >
              {filteredCategories.length === 0 ? (
                <div className="space-y-3 px-2 py-6 text-center text-sm text-muted-foreground">
                  <p>No catalog matches for “{query.trim()}”.</p>
                  {query.trim() ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addCustom}
                    >
                      Add “{query.trim()}” as custom skill
                    </Button>
                  ) : null}
                </div>
              ) : (
                filteredCategories.map((category) => (
                  <div key={category.name} className="mb-3 last:mb-0">
                    <p className="sticky top-0 z-1 bg-popover/95 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                      {category.name}
                      <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
                        ({category.skills.length})
                      </span>
                    </p>
                    <ul className="space-y-0.5">
                      {category.skills.map((skill) => {
                        const active = selectedSet.has(skill.toLowerCase())
                        return (
                          <li key={`${category.name}-${skill}`}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted",
                                active && "bg-primary/10 text-foreground"
                              )}
                              onClick={() => toggle(skill)}
                            >
                              <span>{skill}</span>
                              {active ? (
                                <Check className="size-4 shrink-0 text-primary" />
                              ) : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {selected.length} selected
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="h-8 gap-1.5 rounded-full px-2.5 pr-1 font-normal"
            >
              <span>{skill}</span>
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                disabled={disabled}
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
                onClick={() => remove(skill)}
              >
                <X className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No skills selected yet. Open the list to pick from IT, Finance,
          Banking, HR, Marketing, and more.
        </p>
      )}
    </div>
  )
}
