import type { ReactNode } from "react";

/**
 * Minimal markdown renderer — deliberately tiny (no library).
 * Supports: # / ## / ### headings, paragraphs, unordered lists (- or *),
 * and **bold** inline.
 */

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const bold = /\*\*(.+?)\*\*/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = bold.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(<strong key={key++}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ source }: { source: string }): ReactNode {
  const lines = source.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let key = 0;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push(<p key={key++}>{renderInline(paragraph.join(" "))}</p>);
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list.length > 0) {
      blocks.push(
        <ul key={key++}>
          {list.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]?.length ?? 1;
      const text = heading[2] ?? "";
      if (level === 1) blocks.push(<h2 key={key++}>{renderInline(text)}</h2>);
      else if (level === 2) blocks.push(<h3 key={key++}>{renderInline(text)}</h3>);
      else blocks.push(<h4 key={key++}>{renderInline(text)}</h4>);
      continue;
    }

    const listItem = /^[-*]\s+(.*)$/.exec(trimmed);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1] ?? "");
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();

  return <div className="markdown">{blocks}</div>;
}
