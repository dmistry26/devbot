import { ComingNext, PageHeader } from "@/components/ui/PageHeader";

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 sm:px-8 md:pt-12">
      <PageHeader eyebrow="Projects" title={<>Everything you&apos;re <em>building</em>.</>} />
      <ComingNext items={["Project boards with progress and target dates", "Notes and ideas linked to each project", "AI suggestions for the next step on each project"]} />
    </div>
  );
}
