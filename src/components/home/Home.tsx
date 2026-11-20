"use client";

import { useStore, useNow } from "@/lib/store";
import { buildSample, isSample } from "@/lib/sample";
import { Skeleton } from "@/components/ui/primitives";
import { useUI } from "@/components/ui/ui-store";
import { useSchoolAutoSync } from "@/lib/school/client";
import { Greeting } from "./Greeting";
import { Priorities } from "./Priorities";
import { Schedule } from "./Schedule";
import { Deadlines } from "./Deadlines";
import { Insights } from "./Insights";

export function Home() {
  const now = useNow();
  const hasSample = useStore((s) => s.tasks.some(isSample) || s.events.some(isSample));
  const toast = useUI((s) => s.toast);
  useSchoolAutoSync();

  if (!now) return <HomeSkeleton />;

  const loadSample = () => {
    const s = useStore.getState();
    const sample = buildSample(new Date());
    s.replaceAll(
      {
        tasks: [...s.tasks, ...sample.tasks],
        events: [...s.events, ...sample.events],
        projects: [...s.projects, ...sample.projects],
        notes: s.notes,
      },
      "Loaded sample data",
    );
    toast({ text: "Sample data loaded", undo: true });
  };

  const clearSample = () => {
    const s = useStore.getState();
    s.replaceAll(
      {
        tasks: s.tasks.filter((t) => !isSample(t)),
        events: s.events.filter((e) => !isSample(e)),
        projects: s.projects.filter((p) => !isSample(p)),
        notes: s.notes.filter((n) => !isSample(n)),
      },
      "Cleared sample data",
    );
    toast({ text: "Sample data cleared", undo: true });
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-6 sm:px-8 md:pt-12">
      {hasSample && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong px-4 py-2 text-xs text-ink-3">
          <span>You&apos;re looking at sample data — none of it is real.</span>
          <button onClick={clearSample} className="text-gold hover:underline">Clear sample data</button>
        </div>
      )}
      <Greeting now={now} />
      <div className="rule my-8 sm:my-10" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Priorities now={now} onLoadSample={loadSample} />
        </div>
        <div className="lg:col-span-5">
          <Schedule now={now} />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <Deadlines now={now} />
        </div>
        <div className="lg:col-span-5">
          <Insights now={now} />
        </div>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-6 sm:px-8 md:pt-12">
      <Skeleton className="mb-4 h-3 w-48" />
      <Skeleton className="mb-3 h-14 w-[min(520px,90%)]" />
      <Skeleton className="h-4 w-72" />
      <div className="rule my-10" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Skeleton className="h-80 lg:col-span-7" />
        <Skeleton className="h-80 lg:col-span-5" />
      </div>
    </div>
  );
}
