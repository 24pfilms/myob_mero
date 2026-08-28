import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ApiError } from '../services/api';
import { myobApi, NoteDetail, NoteVersion } from '../services/myobApi';

interface NoteEditorPanelProps {
  noteId: string;
  onClose: () => void;
  onSaved: (note: NoteDetail) => Promise<void> | void;
}

export const NoteEditorPanel: React.FC<NoteEditorPanelProps> = ({ noteId, onClose, onSaved }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'conflict'>('loading');
  const [message, setMessage] = useState('');
  const [height, setHeight] = useState(520);

  const dirty = useMemo(() => Boolean(note) && (title !== note!.title || content !== note!.content || tags !== note!.tags.join(', ')), [note, title, content, tags]);

  const load = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const [loaded, history] = await Promise.all([myobApi.getNote(noteId), myobApi.listVersions(noteId)]);
      setNote(loaded);
      setTitle(loaded.title);
      setTags(loaded.tags.join(', '));
      setContent(loaded.content);
      setVersions(history.versions);
      setStatus('ready');
      window.setTimeout(() => headingRef.current?.focus(), 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Note could not be loaded');
      setStatus('error');
    }
  };

  useEffect(() => { void load(); }, [noteId]);

  const requestClose = () => {
    if (dirty && !window.confirm('Discard unsaved note changes?')) return;
    onClose();
  };

  const save = async () => {
    if (!note || status === 'saving') return;
    setStatus('saving');
    setMessage('');
    try {
      const updated = await myobApi.updateNote(note.id, {
        title: title.trim() || 'Untitled note',
        content,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        version: note.version,
      });
      setNote(updated);
      setTitle(updated.title);
      setTags(updated.tags.join(', '));
      setContent(updated.content);
      await onSaved(updated);
      const history = await myobApi.listVersions(note.id);
      setVersions(history.versions);
      setStatus('saved');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setStatus('conflict');
        setMessage('This note changed elsewhere. Reload before saving again.');
      } else {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Save failed');
      }
    }
  };

  const restore = async (version: number) => {
    if (dirty && !window.confirm('Restore this version and replace your unsaved changes?')) return;
    if (!window.confirm(`Restore version ${version} as a new current version?`)) return;
    setStatus('saving');
    try {
      const restored = await myobApi.restoreVersion(noteId, version);
      setNote(restored);
      setTitle(restored.title);
      setTags(restored.tags.join(', '));
      setContent(restored.content);
      await onSaved(restored);
      const history = await myobApi.listVersions(noteId);
      setVersions(history.versions);
      setStatus('saved');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Restore failed');
    }
  };

  const startResize = (event: React.PointerEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    const move = (next: PointerEvent) => setHeight(Math.max(280, Math.min(window.innerHeight - 32, startHeight + startY - next.clientY)));
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  return (
    <section
      className="fixed inset-x-4 bottom-4 z-[80] mx-auto flex max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-950 text-gray-100 shadow-2xl"
      style={{ height }}
      aria-labelledby="note-editor-title"
      onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
        if (event.key === 'Escape') requestClose();
      }}
    >
      <div onPointerDown={startResize} className="h-3 shrink-0 cursor-ns-resize border-b border-gray-800" aria-hidden="true" />
      <header className="flex items-center justify-between gap-4 border-b border-gray-700 px-5 py-3">
        <div className="min-w-0"><h2 id="note-editor-title" ref={headingRef} tabIndex={-1} className="truncate text-lg font-semibold outline-none">Edit note</h2><p className="text-xs text-gray-400">Version {note?.version ?? '...'}</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => void save()} disabled={!dirty || status === 'saving' || !note} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-40">{status === 'saving' ? 'Saving...' : 'Save'}</button><button type="button" onClick={requestClose} className="rounded px-3 py-2 text-sm hover:bg-gray-800">Close</button></div>
      </header>
      {status === 'loading' && <div className="grid flex-1 place-items-center text-gray-400">Loading note...</div>}
      {status === 'error' && !note && <div className="grid flex-1 place-items-center text-center"><div><p className="text-red-300">{message}</p><button type="button" onClick={() => void load()} className="mt-3 rounded border border-gray-500 px-3 py-2">Retry</button></div></div>}
      {note && (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_17rem]">
          <main className="flex min-h-0 flex-col p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_18rem]"><label className="grid gap-1 text-sm text-gray-300">Title<input value={title} onChange={event => setTitle(event.target.value)} className="h-10 rounded border border-gray-600 bg-gray-900 px-3 text-gray-100 focus-visible:border-blue-400 focus-visible:outline-none" /></label><label className="grid gap-1 text-sm text-gray-300">Tags, comma separated<input value={tags} onChange={event => setTags(event.target.value)} className="h-10 rounded border border-gray-600 bg-gray-900 px-3 text-gray-100 focus-visible:border-blue-400 focus-visible:outline-none" /></label></div>
            <div className="mt-4 flex gap-2" role="tablist" aria-label="Note content mode"><button type="button" role="tab" aria-selected={mode === 'edit'} onClick={() => setMode('edit')} className="rounded px-3 py-1.5 text-sm aria-selected:bg-blue-600">Edit</button><button type="button" role="tab" aria-selected={mode === 'preview'} onClick={() => setMode('preview')} className="rounded px-3 py-1.5 text-sm aria-selected:bg-blue-600">Preview</button></div>
            {mode === 'edit' ? <label className="mt-3 flex min-h-0 flex-1 flex-col gap-1 text-sm text-gray-300">Markdown content<textarea value={content} onChange={event => setContent(event.target.value)} className="min-h-0 flex-1 resize-none rounded border border-gray-600 bg-gray-900 p-3 font-mono text-sm leading-6 text-gray-100 focus-visible:border-blue-400 focus-visible:outline-none" /></label> : <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded border border-gray-700 bg-gray-900 p-4 text-sm leading-6"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>}
            <p className={`mt-2 min-h-5 text-sm ${status === 'error' || status === 'conflict' ? 'text-red-300' : 'text-gray-400'}`} role="status">{message || (status === 'saved' ? 'Saved' : dirty ? 'Unsaved changes' : 'Up to date')}</p>
            {status === 'conflict' && <button type="button" onClick={() => void load()} className="w-fit rounded border border-gray-500 px-3 py-2 text-sm">Reload current version</button>}
          </main>
          <aside className="min-h-0 overflow-y-auto border-t border-gray-700 p-4 lg:border-l lg:border-t-0" aria-labelledby="versions-title"><h3 id="versions-title" className="font-medium">Versions</h3><ul className="mt-3 grid gap-2">{versions.map(version => <li key={version.version} className="rounded border border-gray-700 p-2"><div className="flex items-center justify-between gap-2"><span className="text-sm">Version {version.version}</span><button type="button" disabled={version.version === note.version} onClick={() => void restore(version.version)} className="rounded px-2 py-1 text-xs hover:bg-gray-800 disabled:opacity-40">Restore</button></div><p className="mt-1 text-xs text-gray-400">{new Date(version.created_at).toLocaleString()}</p></li>)}</ul></aside>
        </div>
      )}
    </section>
  );
};
