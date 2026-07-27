import { redirect } from "next/navigation"

/** Root is handled by middleware; keep a safe server fallback. */
export default function HomePage() {
  redirect("/login")
}
