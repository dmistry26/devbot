import { ComingNext, PageHeader } from "@/components/ui/PageHeader";

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 sm:px-8 md:pt-12">
      <PageHeader eyebrow="Calendar" title={<>Your <em>time</em>, at a glance.</>} />
      <ComingNext items={["Month, week, day and agenda views", "Create and edit events by dragging", "Recurring events and conflict warnings", "Deadlines and due tasks on the grid"]} />
    </div>
  );
}
