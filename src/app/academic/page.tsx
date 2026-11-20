import { ComingNext, PageHeader } from "@/components/ui/PageHeader";

export default function AcademicPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 sm:px-8 md:pt-12">
      <PageHeader eyebrow="Academic Staff" title={<>School, <em>handled</em>.</>} />
      <ComingNext items={["Automatic assignment import from learn.vcs.net", "Per-class view of homework, tests and grades", "Grade calculator — what you need on the final", "Study plans that spread prep before each test", "SAT, college and scholarship deadlines"]} />
    </div>
  );
}
