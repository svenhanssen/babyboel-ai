import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/reviews/')({
  component: ReviewSelection,
})

function ReviewSelection() {
  return (
    <div className="surface review-detail empty-state">
      <h3>Select a Review</h3>
      <p>
        Choose a case to inspect sanitized evidence, exact candidates, and
        activity.
      </p>
    </div>
  )
}
