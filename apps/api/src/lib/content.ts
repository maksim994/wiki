/**
 * Извлекает плоский текст из JSON-блоков для поиска и превью.
 */
export function blocksToSearchText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    if (typeof b.text === 'string') parts.push(b.text);
    if (Array.isArray(b.spans)) {
      for (const s of b.spans) {
        if (s && typeof s === 'object' && typeof (s as { text?: string }).text === 'string') {
          parts.push((s as { text: string }).text);
        }
      }
    }
    if (typeof b.label === 'string') parts.push(b.label);
    if (typeof b.code === 'string') parts.push(b.code);
  }
  return parts.join(' ').slice(0, 50000);
}
