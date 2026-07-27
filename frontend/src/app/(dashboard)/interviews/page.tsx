import { CalendarPlus, Video } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"

export default function InterviewsPage() {
  return (
    <div>
      <PageHeader
        title="Interviews"
        description="Schedule voice, video, and onsite interviews."
        actions={
          <Button>
            <CalendarPlus data-icon="inline-start" />
            Schedule
          </Button>
        }
      />
      <EmptyState
        icon={Video}
        title="No interviews scheduled"
        description="Book interviews from shortlisted applications to see them here."
      />
    </div>
  )
}
