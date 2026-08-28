import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FolderSummary, myobApi, NOTE_DRAG_TYPE, NoteSummary } from '../services/myobApi';

const PAGE_SIZE = 25;

interface NoteFinderDrawerProps {
  onClose: () => void;
  onPlace: (note: NoteSummary) => void;
  onOpen: (note: NoteSummary) => void;
}

export const NoteFinderDrawer: React.FC<NoteFinderDrawerProps> = ({ onClose, onPlace, onOpen }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [folderId, setFolderId] = useState('');
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    headingRef.current?.focus();
    return () => document.querySelector<HTMLButtonElement>('button[aria-label="Notes"]')?.focus();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    Promise.all([myobApi.listNotes({ q: debouncedQuery || undefined, folderId: folderId || undefined }), myobApi.listFolders()])
      .then(([nextNotes, nextFolders]) => {
        if (!active) return;
        setNotes(nextNotes);
        setFolders(nextFolders);
        setPage(1);
        setStatus('ready');
      })
      .catch(cause => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Notes are unavailable');
        setStatus('error');
      });
    return () => { active = false; };
  }, [debouncedQuery, folderId, reload]);

  const pageCount = Math.max(1, Math.ceil(notes.length / PAGE_SIZE));
  const visibleNotes = useMemo(() => notes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [notes, page]);

  return (
    <section className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-h-[52vh] max-w-5xl flex-col rounded-xl border border-gray-600 bg-gray-950 text-gray-100 shadow-2xl" aria-labelledby="note-finder-title">
      <header className="flex items-center justify-between border-b border-gray-700 px-5 py-3">
        <div>
          <h2 id="note-finder-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Notes</h2>
          <p className="text-sm text-gray-400">Find a durable note and place a reference on this canvas.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400" aria-label="Close notes">Close</button>
      </header>
      <div className="grid gap-3 border-b border-gray-800 px-5 py-3 sm:grid-cols-[1fr_14rem]">
        <label className="grid gap-1 text-sm text-gray-300">Search notes
          <input value={query} onChange={event => setQuery(event.target.value)} className="h-10 rounded border border-gray-600 bg-gray-900 px-3 text-gray-100 outline-none focus-visible:border-blue-400" placeholder="Title, content, or tag" />
        </label>
        <label className="grid gap-1 text-sm text-gray-300">Folder
          <select value={folderId} onChange={event => setFolderId(event.target.value)} className="h-10 rounded border border-gray-600 bg-gray-900 px-3 pe-9 text-gray-100 outline-none focus-visible:border-blue-400">
            <option value="">All folders</option>
            {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </label>
      </div>
      <div className="min-h-32 flex-1 overflow-y-auto px-5 py-3" aria-busy={status === 'loading'}>
        <p className="sr-only" role="status">{status === 'loading' ? 'Loading notes' : status === 'error' ? error : `${notes.length} notes found`}</p>
        {status === 'loading' && <div className="py-8 text-center text-gray-400">Loading notes...</div>}
        {status === 'error' && <div className="py-8 text-center"><p className="text-red-300">{error}</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-3 rounded border border-gray-500 px-3 py-2">Retry</button></div>}
        {status === 'ready' && notes.length === 0 && <div className="py-8 text-center text-gray-400">No notes match these filters.</div>}
        {status === 'ready' && visibleNotes.length > 0 && (
          <ul className="grid gap-2">
            {visibleNotes.map(note => (
              <li key={note.id}>
                <div
                  draggable
                  onDragStart={event => event.dataTransfer.setData(NOTE_DRAG_TYPE, JSON.stringify(note))}
                  onDoubleClick={() => onOpen(note)}
                  className="grid gap-2 rounded-lg border border-gray-700 bg-gray-900 p-3 sm:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0"><h3 className="truncate font-medium">{note.title || 'Untitled note'}</h3><p className="mt-1 line-clamp-2 text-sm text-gray-400">{note.excerpt || 'No preview available.'}</p></div>
                  <div className="flex items-center gap-2"><button type="button" onClick={() => onOpen(note)} className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">Open</button><button type="button" onClick={() => onPlace(note)} className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500">Place</button></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {pageCount > 1 && <footer className="flex items-center justify-between border-t border-gray-800 px-5 py-3 text-sm"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded px-3 py-2 disabled:opacity-40">Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage(value => value + 1)} className="rounded px-3 py-2 disabled:opacity-40">Next</button></footer>}
    </section>
  );
};

