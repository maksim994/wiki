import { diffLines } from 'diff';

export function TextDiff({ a, b, titleA, titleB }: { a: string; b: string; titleA?: string; titleB?: string }) {
  const parts = diffLines(a, b);

  return (
    <div>
      {(titleA != null || titleB != null) && (
        <div className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          {titleA != null && titleB != null && titleA !== titleB ? (
            <>
              Заголовок: <span style={{ textDecoration: 'line-through' }}>{titleA}</span> → <strong>{titleB}</strong>
            </>
          ) : (
            <>
              Заголовок: <strong>{titleA ?? titleB}</strong>
            </>
          )}
        </div>
      )}
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '0.85rem',
          lineHeight: 1.45,
          margin: 0,
          padding: '0.75rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          maxHeight: 360,
          overflow: 'auto',
        }}
      >
        {parts.map((p, i) => (
          <span
            key={i}
            style={{
              background: p.added ? 'rgba(91, 140, 255, 0.15)' : p.removed ? 'rgba(232, 93, 93, 0.12)' : undefined,
              display: p.added || p.removed ? 'block' : 'inline',
            }}
          >
            {p.value}
          </span>
        ))}
      </pre>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
        Сравнение по извлечённому тексту (без точного совпадения форматирования блоков).
      </p>
    </div>
  );
}
