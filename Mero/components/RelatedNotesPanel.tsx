import React, { useEffect, useState } from 'react';
import { myobApi, NOTE_DRAG_TYPE, SimilarNote } from '../services/myobApi';

interface RelatedNotesPanelProps {
  noteId: string;
  onPlace: (noteId: string) => void;
}

export const RelatedNotesPanel: React.FC<RelatedNotesPanelProps> = ({ noteId, onPlace }) => {
  const [notes, setNotes] = useState<SimilarNote[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    setStatus('loading');
    myobApi.similarNotes(noteId, 5).then(result => {
      if (active) { setNotes(result.results); setStatus('ready'); }
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [noteId]);

  return (
    <aside className="fixed right-4 top-20 z-50 w-72 rounded-xl border border-gray-600 bg-gray-950 p-4 text-gray-100 shadow-xl" aria-labelledby="related-notes-title">
      <h2 id="related-notes-title" className="font-semibold">Related notes</h2>
      <p className="mt-1 text-xs text-gray-400">Similarity from the local {notes.length ? 'embedding model' : 'note index'}.</p>
      <p className="sr-only" role="status">{status === 'loading' ? 'Loading related notes' : status === 'error' ? 'Related notes unavailable' : `${notes.length} related notes`}</p>
      {status === 'loading' && <p className="py-5 text-sm text-gray-400">Loading...</p>}
      {status === 'error' && <p className="py-5 text-sm text-red-300">Related notes are unavailable.</p>}
      {status === 'ready' && notes.length === 0 && <p className="py-5 text-sm text-gray-400">No indexed relationships yet.</p>}
      {status === 'ready' && notes.length > 0 && <ul className="mt-3 grid gap-2">{notes.map(note => (
        <li key={note.id}>
          <div
            draggable
            onDragStart={event => event.dataTransfer.setData(NOTE_DRAG_TYPE, JSON.stringify({ id: note.id, title: note.title, tags: [], folder_id: null, created_at: null, modified_at: null, excerpt: '', embedding_status: 'ready' }))}
            className="rounded border border-gray-700 p-2"
          >
            <div className="flex items-center justify-between gap-2"><span className="truncate text-sm">{note.title}</span><span className="text-xs text-blue-300">{Math.round(note.score * 100)}%</span></div>
            <button type="button" onClick={() => onPlace(note.id)} className="mt-2 rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">Place on canvas</button>
          </div>
        </li>
      ))}</ul>}
    </aside>
  );
};
