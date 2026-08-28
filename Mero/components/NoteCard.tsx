import React from 'react';
import { BoardItem } from '../types';

interface NoteCardProps {
  item: BoardItem;
  scale: number;
}

const stateLabel = {
  loading: 'Loading note',
  ready: 'Note ready',
  stale: 'Note may be out of date',
  missing: 'Note no longer exists',
  error: 'Note could not be loaded',
} as const;

export const NoteCard: React.FC<NoteCardProps> = ({ item, scale }) => {
  const note = item.noteData;
  if (!note) {
    return <div className="h-full rounded-lg border border-red-400 bg-gray-950 p-4 text-sm text-gray-100" role="status">Missing note reference</div>;
  }
  const syncState = note.syncState || 'ready';
  const compact = scale < 0.65;
  const detailed = scale > 1.15;
  const status = syncState !== 'ready' ? stateLabel[syncState] : note.embeddingState === 'failed' ? 'Semantic indexing failed' : null;

  return (
    <article
      className="h-full overflow-hidden rounded-lg border border-gray-600 bg-gray-950 text-gray-100"
      aria-label={`${note.title}. ${status || 'Note ready'}`}
    >
      <div className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-base font-semibold leading-tight">{note.title || 'Untitled note'}</h3>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-blue-300">Note</span>
        </div>
        {!compact && <p className="mt-3 line-clamp-3 flex-1 overflow-hidden text-sm leading-5 text-gray-300">{note.excerpt || 'No preview available.'}</p>}
        {detailed && note.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
            {note.tags.slice(0, 4).map(tag => <li key={tag} className="rounded border border-gray-600 px-1.5 py-0.5 text-[11px] text-gray-300">{tag}</li>)}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-gray-400">
          <span>{status || (note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : 'Date unavailable')}</span>
          <span>{note.embeddingState === 'ready' ? 'Indexed' : note.embeddingState}</span>
        </div>
      </div>
    </article>
  );
};
