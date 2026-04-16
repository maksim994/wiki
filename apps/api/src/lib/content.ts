/**
 * Извлекает плоский текст из JSON-блоков для поиска и превью.
 * Поддерживает старый MVP-формат и документ BlockNote (массив блоков с id, content, children).
 */
export function blocksToSearchText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  if (content.length === 0) return '';

  const first = content[0];
  if (first && typeof first === 'object' && 'id' in (first as object) && 'type' in (first as object)) {
    return extractBlockNoteText(content as BlockNoteLike[]).slice(0, 50000);
  }

  return extractLegacyText(content).slice(0, 50000);
}

type BlockNoteLike = {
  type?: string;
  content?: unknown[];
  children?: BlockNoteLike[];
};

function extractBlockNoteText(blocks: BlockNoteLike[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (Array.isArray(block.content)) {
      for (const inline of block.content) {
        if (inline && typeof inline === 'object' && 'text' in inline) {
          const t = (inline as { text?: string }).text;
          if (typeof t === 'string') parts.push(t);
        }
      }
    }
    if (Array.isArray(block.children)) {
      parts.push(extractBlockNoteText(block.children));
    }
  }
  return parts.join(' ');
}

function extractLegacyText(content: unknown[]): string {
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
  return parts.join(' ');
}
