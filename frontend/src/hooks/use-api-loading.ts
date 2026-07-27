"use client"

import { useEffect, useState } from "react"

import { apiLoading } from "@/lib/api/loading"

export function useApiLoading() {
  const [loading, setLoading] = useState(apiLoading.isLoading())
  const [pending, setPending] = useState(apiLoading.getPending())

  useEffect(() => {
    return apiLoading.subscribe((isLoading, count) => {
      setLoading(isLoading)
      setPending(count)
    })
  }, [])

  return { loading, pending }
}
