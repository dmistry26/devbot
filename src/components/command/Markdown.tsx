// Tiny, safe markdown for assistant replies: paragraphs, bullet and numbered
// lists, headings, **bold**, *italic* and `code`. Builds React elements only
// (no HTML strings), so model output can't inject markup.
import { Fragment, type ReactNode } from "react";

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**") || tok.startsWith("__")) out.push(<strong key={k} className="font-medium text-ink">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-ink/[0.06] px-1 font-mono text-[12.5px]">{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[]; depth: number[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; text: string };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  const push = (b: Block) => blocks.push(b);
  for (const raw of src.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const h = line.match(/^\s*#{1,4}\s+(.*)$/);
    if (!line.trim()) {
      push({ kind: "p", lines: [] }); // paragraph break
    } else if (h) {
      push({ kind: "h", text: h[1] });
    } else if (ul) {
      // Two or more leading spaces = a nested bullet under the previous item.
      const depth = /^\s{2,}/.test(raw) ? 1 : 0;
      if (last?.kind === "ul") {
        last.items.push(ul[1]);
        last.depth.push(depth);
      } else push({ kind: "ul", items: [ul[1]], depth: [depth] });
    } else if (ol) {
      if (last?.kind === "ol") last.items.push(ol[1]);
      else push({ kind: "ol", items: [ol[1]] });
    } else if (last?.kind === "p" && last.lines.length) {
      last.lines.push(line);
    } else if ((last?.kind === "ul" || last?.kind === "ol") && /^\s{2,}\S/.test(raw)) {
      last.items[last.items.length - 1] += " " + line.trim(); // wrapped list item
    } else {
      push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => !(b.kind === "p" && b.lines.length === 0));
}

export function Markdown({ text }: { text: string }) {
  const blocks = parse(text);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const k = `b${i}`;
        if (b.kind === "h") return <div key={k} className="pt-1 font-medium text-ink">{inline(b.text, k)}</div>;
        if (b.kind === "ul")
          return (
            <ul key={k} className="space-y-1 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className={`flex gap-2 ${b.depth[j] ? "pl-5 text-ink-3" : ""}`}>
                  <span className={`mt-[9px] shrink-0 rounded-full ${b.depth[j] ? "size-[3px] bg-ink-4" : "size-1 bg-ink-3"}`} />
                  <span>{inline(it, `${k}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        if (b.kind === "ol")
          return (
            <ol key={k} className="space-y-1 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="w-4 shrink-0 text-right font-mono text-[12px] text-ink-3">{j + 1}.</span>
                  <span>{inline(it, `${k}-${j}`)}</span>
                </li>
              ))}
            </ol>
          );
        return (
          <p key={k}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, `${k}-${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
