export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      <div className="eyebrow mb-3">{eyebrow}</div>
      <h1 className="font-display text-[40px] leading-[1.05] text-ink sm:text-[52px]">{title}</h1>
      {children && <div className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">{children}</div>}
    </header>
  );
}

export function ComingNext({ items }: { items: string[] }) {
  return (
    <div className="panel p-6">
      <div className="eyebrow mb-3">Coming in the next build phase</div>
      <ul className="space-y-2 text-sm text-ink-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2"><span className="text-gold">◆</span>{i}</li>
        ))}
      </ul>
      <p className="mt-5 text-[13px] text-ink-3">Until then, you can manage all of this from the home screen and the AI command bar (⌘K).</p>
    </div>
  );
}
