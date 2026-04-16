import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { useEffect, useMemo, useRef } from 'react';
import { toPartialBlocks } from '../lib/blockContent';

type Props = {
  content: unknown;
  documentKey: string;
  editable: boolean;
  className?: string;
  /** Для чтения document при сохранении (только режим редактирования) */
  editorRef?: React.MutableRefObject<BlockNoteEditor | null>;
};

export function WikiBlockEditor({ content, documentKey, editable, className, editorRef }: Props) {
  const initialContent = useMemo(() => toPartialBlocks(content), [content, documentKey]);

  const editor = useCreateBlockNote(
    {
      initialContent,
    },
    [documentKey],
  );

  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  return (
    <div className={`wiki-blocknote ${className ?? ''}`} style={{ minHeight: editable ? 320 : undefined }}>
      <BlockNoteView editor={editor} editable={editable} theme="dark" />
    </div>
  );
}
