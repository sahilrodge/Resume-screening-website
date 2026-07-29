"use client"

import { useMemo } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatLocation,
  getCitiesForState,
  INDIA_STATES,
  parseLocation,
} from "@/data/india-locations"

type LocationCascadingProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

export function LocationCascading({
  value,
  onChange,
  disabled = false,
}: LocationCascadingProps) {
  const { state, city } = useMemo(() => parseLocation(value), [value])
  const cities = useMemo(() => getCitiesForState(state), [state])

  function setState(nextState: string) {
    if (!nextState || nextState === "__none__") {
      onChange("")
      return
    }
    onChange(formatLocation(nextState, ""))
  }

  function setCity(nextCity: string) {
    if (!state) return
    if (!nextCity || nextCity === "__none__") {
      onChange(formatLocation(state, ""))
      return
    }
    onChange(formatLocation(state, nextCity))
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="location_state">State / UT</Label>
        <Select
          value={state || "__none__"}
          onValueChange={(v) => setState(!v || v === "__none__" ? "" : v)}
          disabled={disabled}
        >
          <SelectTrigger id="location_state" className="w-full">
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="__none__">Select state</SelectItem>
            {INDIA_STATES.map((item) => (
              <SelectItem key={item.name} value={item.name}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="location_city">City</Label>
        <Select
          value={city || "__none__"}
          onValueChange={(v) => setCity(!v || v === "__none__" ? "" : v)}
          disabled={disabled || !state}
        >
          <SelectTrigger id="location_city" className="w-full">
            <SelectValue
              placeholder={state ? "Select city" : "Select state first"}
            />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="__none__">
              {state ? "Select city" : "Select state first"}
            </SelectItem>
            {cities.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
