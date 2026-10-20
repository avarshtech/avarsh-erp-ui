import { Fragment } from 'react';

/** **bold** and `code` inside one line, as React nodes — never raw HTML. */
function inline(line, key) {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={`${key}-${i}`}>{part.slice(1, -1)}</code>;
    return <Fragment key={`${key}-${i}`}>{part}</Fragment>;
  });
}

/** The Genie's reply: paragraphs and "- " bullets, with bold and code. */
export default function GenieText({ text }) {
  const blocks = [];
  let bullets = null;
  String(text || '').split('\n').forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      if (!bullets) { bullets = []; blocks.push({ type: 'list', items: bullets, key: i }); }
      bullets.push({ text: bullet[1], key: i });
      return;
    }
    bullets = null;
    if (line.trim()) blocks.push({ type: 'p', text: line, key: i });
  });
  return (
    <div className="genie-text">
      {blocks.map((b) => (b.type === 'list'
        ? <ul key={b.key}>{b.items.map((it) => <li key={it.key}>{inline(it.text, it.key)}</li>)}</ul>
        : <p key={b.key}>{inline(b.text, b.key)}</p>))}
    </div>
  );
}
