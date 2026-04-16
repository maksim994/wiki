import type { PartialBlock } from '@blocknote/core';

/** Проверка: массив блоков BlockNote (есть id + type у элементов). */
function isBlockNoteDocument(content: unknown): content is PartialBlock[] {
  if (!Array.isArray(content) || content.length === 0) return false;
  const first = content[0] as Record<string, unknown>;
  return typeof first?.id === 'string' && typeof first?.type === 'string';
}

/** Старый формат MVP: { type, text, ... } без id. */
function legacyToPartialBlocks(content: unknown): PartialBlock[] {
  if (!Array.isArray(content) || content.length === 0) {
    return [{ type: 'paragraph' }];
  }
  const out: PartialBlock[] = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    const t = typeof b.type === 'string' ? b.type : 'paragraph';
    if (t === 'heading') {
      const level = typeof b.level === 'number' ? Math.min(3, Math.max(1, b.level)) : 1;
      out.push({
        type: 'heading',
        props: { level },
        content: [{ type: 'text', text: String(b.text ?? ''), styles: {} }],
      });
    } else if (t === 'code') {
      out.push({
        type: 'codeBlock',
        props: { language: 'text' },
        content: [{ type: 'text', text: String(b.code ?? b.text ?? ''), styles: {} }],
      });
    } else if (t === 'bullet_list' && Array.isArray(b.items)) {
      for (const it of b.items) {
        out.push({
          type: 'bulletListItem',
          content: [{ type: 'text', text: typeof it === 'string' ? it : JSON.stringify(it), styles: {} }],
        });
      }
    } else {
      out.push({
        type: 'paragraph',
        content: [{ type: 'text', text: String(b.text ?? ''), styles: {} }],
      });
    }
  }
  return out.length ? out : [{ type: 'paragraph' }];
}

/** Нормализует контент страницы для BlockNote. */
export function toPartialBlocks(content: unknown): PartialBlock[] {
  if (isBlockNoteDocument(content)) {
    return content;
  }
  return legacyToPartialBlocks(content);
}
