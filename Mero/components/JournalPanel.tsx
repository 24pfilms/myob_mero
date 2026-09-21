import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EntryHint, ExportJob, JournalEntry, JournalSpace, myobApi, NoteSummary, ProjectSummary } from '../services/myobApi';

const POLL_MS = 1000;

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function entryTitle(text: string): string {
  const firstLine = text.trim().split('\n')[0] || 'Entry';
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

interface JournalPanelProps {
  onClose: () => void;
  onOpen: (note: NoteSummary) => void;
}

export const JournalPanel: React.FC<JournalPanelProps> = ({ onClose, onOpen }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [text, setText] = useState('');
  const [entryDate, setEntryDate] = useState(localDate);
  const [space, setSpace] = useState<JournalSpace>('work');
  const [projectId, setProjectId] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [hints, setHints] = useState<Record<string, EntryHint[]>>({});
  const [undoable, setUndoable] = useState<Record<string, { space: JournalSpace; project_id: string | null }>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
    return () => document.querySelector<HTMLButtonElement>('button[aria-label="Journal"]')?.focus();
  }, []);

  const loadHints = useCallback(async (loaded: JournalEntry[]) => {
    const unassigned = loaded.filter(entry => !entry.project_id).slice(0, 10);
    const results = await Promise.all(unassigned.map(entry => myobApi.entryHints(entry.id).catch(() => null)));
    setHints(Object.fromEntries(results.filter(Boolean).map(result => [result!.entry_id, result!.hints])));
  }, []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    Promise.all([myobApi.listEntries({ from: entryDate, to: entryDate }), myobApi.listProjects({ status: 'active' })])
      .then(([loadedEntries, loadedProjects]) => {
        if (!active) return;
        setEntries(loadedEntries);
        setProjects(loadedProjects);
        setStatus('ready');
        void loadHints(loadedEntries);
      })
      .catch(cause => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'The journal is unavailable');
        setStatus('error');
      });
    return () => { active = false; };
  }, [entryDate, reload, loadHints]);

  useEffect(() => {
    if (!exportJob || exportJob.status === 'done' || exportJob.status === 'failed') return;
    const timer = window.setTimeout(() => {
      myobApi.exportStatus(exportJob.id).then(setExportJob).catch(() => setExportJob({ ...exportJob, status: 'failed', error: 'Export status unavailable' }));
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [exportJob]);

  async function saveEntry(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || saving) return;
    setSaving(true);
    setError('');
    try {
      await myobApi.createEntry({ title: entryTitle(body), content: body, entry_date: entryDate, space, project_id: projectId || null });
      setText('');
      setReload(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The entry could not be saved');
    } finally {
      setSaving(false);
    }
  }

  async function assign(entry: JournalEntry, hint: EntryHint) {
    if (hint.kind !== 'project') return;
    const result = await myobApi.updateAssignment(entry.id, { space: entry.space, project_id: hint.id });
    setEntries(current => current.map(item => (item.id === entry.id ? { ...item, ...result } : item)));
    setUndoable(current => ({ ...current, [entry.id]: { space: result.previous.space, project_id: result.previous.project_id } }));
  }

  async function undo(entry: JournalEntry) {
    const previous = undoable[entry.id];
    if (!previous) return;
    const result = await myobApi.updateAssignment(entry.id, previous);
    setEntries(current => current.map(item => (item.id === entry.id ? { ...item, ...result } : item)));
    setUndoable(current => { const next = { ...current }; delete next[entry.id]; return next; });
  }

  const exportPercent = exportJob && exportJob.total_count > 0 ? Math.round((exportJob.processed_count / exportJob.total_count) * 100) : 0;

  return (
    <section className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-h-[70vh] max-w-5xl flex-col rounded-xl border border-gray-600 bg-gray-950 text-gray-100 shadow-2xl" aria-labelledby="journal-title">
      <header className="flex items-center justify-between border-b border-gray-700 px-5 py-3">
        <div>
          <h2 id="journal-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Journal</h2>
          <p className="text-sm text-gray-400">Capture what happened, then assign it to a project.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400" aria-label="Close journal">Close</button>
      </header>

      <form onSubmit={saveEntry} className="grid gap-3 border-b border-gray-800 px-5 py-3">
        <label className="grid gap-1 text-sm text-gray-300">Today&apos;s entry
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={3}
            placeholder="What happened?"
            className="rounded border border-gray-600 bg-gray-900 p-3 text-gray-100 outline-none focus-visible:border-blue-400"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[10rem_12rem_1fr_auto]">
          <label className="grid gap-1 text-sm text-gray-300">Date
            <input type="date" value={entryDate} onChange={event => setEntryDate(event.target.value)} className="h-10 rounded border border-gray-600 bg-gray-900 px-3 text-gray-100 outline-none focus-visible:border-blue-400" />
          </label>
          <fieldset className="grid gap-1 text-sm text-gray-300">
            <legend className="mb-1">Space</legend>
            <div className="flex h-10 items-center gap-3">
              {(['work', 'personal'] as JournalSpace[]).map(option => (
                <label key={option} className="flex items-center gap-1 capitalize">
                  <input type="radio" name="journal-space" value={option} checked={space === option} onChange={() => setSpace(option)} />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm text-gray-300">Project
            <select value={projectId} onChange={event => setProjectId(event.target.value)} className="h-10 rounded border border-gray-600 bg-gray-900 px-3 pe-9 text-gray-100 outline-none focus-visible:border-blue-400">
              <option value="">No project</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={saving || !text.trim()} className="h-10 rounded bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40">{saving ? 'Saving...' : 'Save entry'}</button>
          </div>
        </div>
      </form>

      <div className="min-h-32 flex-1 overflow-y-auto px-5 py-3" aria-busy={status === 'loading'}>
        <p className="sr-only" role="status">{status === 'loading' ? 'Loading entries' : status === 'error' ? error : `${entries.length} entries on ${entryDate}`}</p>
        {status === 'error' && <div className="py-8 text-center"><p className="text-red-300">{error}</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-3 rounded border border-gray-500 px-3 py-2">Retry</button></div>}
        {status === 'loading' && <div className="py-8 text-center text-gray-400">Loading entries...</div>}
        {status === 'ready' && entries.length === 0 && <div className="py-8 text-center text-gray-400">No entries on this day yet.</div>}
        {status === 'ready' && entries.length > 0 && (
          <ul className="grid gap-2">
            {entries.map(entry => (
              <li key={entry.id} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{entry.title || 'Untitled entry'}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-400">{entry.excerpt}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {entry.space} · {entry.word_count} words · {entry.project_id ? projects.find(project => project.id === entry.project_id)?.name || 'Assigned' : 'No project'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {undoable[entry.id] && <button type="button" onClick={() => void undo(entry)} className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">Undo</button>}
                    <button type="button" onClick={() => onOpen({ id: entry.id, title: entry.title, tags: [], folder_id: null, created_at: entry.created_at, modified_at: entry.updated_at, excerpt: entry.excerpt })} className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">Open</button>
                  </div>
                </div>
                {(hints[entry.id] || []).filter(hint => hint.kind === 'project').length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400">Mentioned:</span>
                    {(hints[entry.id] || []).filter(hint => hint.kind === 'project').map(hint => (
                      <button key={hint.id} type="button" onClick={() => void assign(entry, hint)} className="rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-200 hover:bg-gray-800">
                        Assign to {hint.name}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-gray-800 px-5 py-3 text-sm">
        <button
          type="button"
          onClick={() => myobApi.startExport().then(setExportJob).catch(cause => setError(cause instanceof Error ? cause.message : 'Export could not start'))}
          disabled={exportJob?.status === 'pending' || exportJob?.status === 'running'}
          className="rounded border border-gray-500 px-3 py-2 disabled:opacity-40"
        >
          Export everything
        </button>
        {exportJob && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-2 flex-1 rounded bg-gray-800" role="progressbar" aria-valuenow={exportPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Export progress">
              <div className="h-2 rounded bg-blue-500" style={{ width: `${exportPercent}%` }} />
            </div>
            <span role="status" className="truncate text-xs text-gray-400">
              {exportJob.status === 'done' ? `Export saved: ${exportJob.path}` : exportJob.status === 'failed' ? `Export failed: ${exportJob.error}` : `Exporting ${exportPercent}%`}
            </span>
          </div>
        )}
      </footer>
    </section>
  );
};
