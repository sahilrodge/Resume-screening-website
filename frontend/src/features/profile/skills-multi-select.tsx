"use client"

import { useMemo, useState } from "react"
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

export function SkillsMultiSelect({
  value,
  onChange,
  disabled = false,
}: SkillsMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = useMemo(
    () => Array.from(new Set(value.map((s) => s.trim()).filter(Boolean))),
    [value]
  )
  const selectedSet = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected])

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
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Skills</Label>
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-auto min-h-9 w-full justify-between px-3 py-2 font-normal"
            onClick={() => setOpen((prev) => !prev)}
          >
            <span className="truncate text-muted-foreground">
              {selected.length
                ? `${selected.length} skill${selected.length === 1 ? "" : "s"} selected`
                : "Search and select skills"}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
          </Button>

          {open ? (
            <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-md">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search IT, Finance, HR, Design…"
                  className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustom()
                    }
                    if (e.key === "Escape") setOpen(false)
                  }}
                />
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {filteredCategories.length === 0 ? (
                  <div className="space-y-2 px-2 py-3 text-sm text-muted-foreground">
                    <p>No catalog matches.</p>
                    {query.trim() ? (
                      <Button type="button" size="sm" variant="outline" onClick={addCustom}>
                        Add “{query.trim()}”
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  filteredCategories.map((category) => (
                    <div key={category.name} className="mb-2">
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {category.name}
                      </p>
                      <ul className="space-y-0.5">
                        {category.skills.map((skill) => {
                          const active = selectedSet.has(skill.toLowerCase())
                          return (
                            <li key={`${category.name}-${skill}`}>
                              <button
                                type="button"
                                className={cn(
                                  "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                                  active && "bg-primary/10 text-foreground"
                                )}
                                onClick={() => toggle(skill)}
                              >
                                <span>{skill}</span>
                                {active ? <Check className="size-4 text-primary" /> : null}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-border px-3 py-2 text-right">
                <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((skill) => (
            <Badge key={skill} variant="secondary" className="h-7 gap-1 pr-1">
              {skill}
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                disabled={disabled}
                className="rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50"
                onClick={() => remove(skill)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pick skills from IT, Finance, Banking, HR, Marketing, and more.
        </p>
      )}
    </div>
  )
}
