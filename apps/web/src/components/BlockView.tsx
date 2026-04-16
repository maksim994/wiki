export function BlockView({ content }: { content: unknown }) {
  if (!Array.isArray(content) || content.length === 0) {
    return <p className="muted">Пустая страница. Нажмите «Редактировать» и задайте блоки JSON.</p>;
  }

  return (
    <div className="blocks">
      {content.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: unknown }) {
  if (!block || typeof block !== 'object') return null;
  const b = block as Record<string, unknown>;
  const type = typeof b.type === 'string' ? b.type : 'paragraph';

  if (type === 'heading') {
    const level = typeof b.level === 'number' ? Math.min(3, Math.max(1, b.level)) : 1;
    const text = typeof b.text === 'string' ? b.text : '';
    if (level <= 1) return <h1>{text}</h1>;
    if (level === 2) return <h2>{text}</h2>;
    return <h3>{text}</h3>;
  }

  if (type === 'paragraph') {
    const text = typeof b.text === 'string' ? b.text : '';
    return <p>{text}</p>;
  }

  if (type === 'code') {
    const code = typeof b.code === 'string' ? b.code : JSON.stringify(block);
    return (
      <pre
        style={{
          background: '#0b0d12',
          padding: '0.75rem',
          borderRadius: 8,
          overflow: 'auto',
          border: '1px solid var(--border)',
        }}
      >
        <code>{code}</code>
      </pre>
    );
  }

  if (type === 'bullet_list') {
    const items = Array.isArray(b.items) ? b.items : [];
    return (
      <ul>
        {items.map((it, j) => (
          <li key={j}>{typeof it === 'string' ? it : JSON.stringify(it)}</li>
        ))}
      </ul>
    );
  }

  return (
    <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>
      {JSON.stringify(block, null, 2)}
    </pre>
  );
}
