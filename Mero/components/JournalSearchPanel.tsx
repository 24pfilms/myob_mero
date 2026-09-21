import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilterOption, JournalSpace, myobApi, NoteSummary, ProjectSummary, SearchMode, SearchResponse, SearchResult,
} from '../services/myobApi';

const MODE_STORAGE_KEY = 'mero.journal.searchMode';

function readStoredMode(): SearchMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'text' ? 'text' : 'ai';
  } catch {
    return 'ai';
  }
}

interface JournalSearchPanelProps {
  onClose: () => void;
  onOpen: (note: Pick<NoteSummary, 'id'>, line?: number) => void;
}

export const JournalSearchPanel: React.FC<JournalSearchPanelProps> = ({ onClose, onOpen }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [mode, setMode] = useState<SearchMode>(readStoredMode);
  const [space, setSpace] = useState<JournalSpace | ''>('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    headingRef.current?.focus();
    myobApi.listProjects({ status: 'active' }).then(setProjects).catch(() => setProjects([]));
    return () => document.querySelector<HTMLButtonElement>('button[aria-label="Search journal"]')?.focus();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch { /* storage is optional */ }
  }, [mode]);

  const run = useCallback(async (query: string, searchMode: SearchMode) => {
    if (!query.trim()) return;
    setStatus('loading');
    setError('');
    try {
      const result = await myobApi.search(query, {
        mode: searchMode,
        space: space || undefined,
        projectId: projectId || undefined,
      });
      setResponse(result);
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The search could not run');
      setStatus('error');
    }
  }, [space, projectId]);

  useEffect(() => {
    if (submitted) void run(submitted, mode);
  }, [submitted, mode, run]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSelected([]);
    setNotice('');
    setSubmitted(term.trim());
  }

  function retryInOtherMode() {
    const next = mode === 'ai' ? 'text' : 'ai';
    setMode(next);
  }

  function toggle(id: string) {
    setSelected(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));
  }

  async function assignSelected(targetProjectId: string) {
    if (!selected.length || !targetProjectId) return;
    try {
      await myobApi.bulkUpdateNotes({ note_ids: selected, project_id: targetProjectId });
      const name = projects.find(project => project.id === targetProjectId)?.name ?? 'the project';
      setNotice(`Assigned ${selected.length} ${selected.length === 1 ? 'result' : 'results'} to ${name}.`);
      setSelected([]);
      void run(submitted, mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The bulk change did not apply');
    }
  }

  const results = response?.results ?? [];
  const empty = status === 'ready' && results.length === 0;

  function facetLabel(option: FilterOption) {
    return `${option.name ?? option.value} (${option.count})`;
  }

  return (
    <section className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-h-[75vh] max-w-5xl flex-col rounded-xl border border-gray-600 bg-gray-950 text-gray-100 shadow-2xl" aria-labelledby="journal-search-title">
      <header className="flex items-center justify-between border-b border-gray-700 px-5 py-3">
        <div>
          <h2 id="journal-search-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Search</h2>
          <p className="text-sm text-gray-400">Text finds exact words. AI finds by meaning.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400" aria-label="Close search">Close</button>
      </header>

      <form onSubmit={submit} className="grid gap-3 border-b border-gray-800 px-5 py-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <label className="grid gap-1 text-sm text-gray-300">Search terms
          <input
            value={term}
            onChange={event => setTerm(event.target.value)}
            placeholder="What are you looking for?"
            className="h-10 rounded border border-gray-600 bg-gray-900 px-3 text-gray-100 outline-none focus-visible:border-blue-400"
          />
        </label>
        <fieldset className="grid gap-1 text-sm text-gray-300">
          <legend className="mb-1">Mode</legend>
          <div className="flex h-10 items-center gap-3">
            {(['ai', 'text'] as SearchMode[]).map(option => (
              <label key={option} className="flex items-center gap-1">
                <input type="radio" name="search-mode" value={option} checked={mode === option} onChange={() => setMode(option)} />
                {option === 'ai' ? 'AI' : 'Text'}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="grid gap-1 text-sm text-gray-300">Space
          <select value={space} onChange={event => setSpace(event.target.value as JournalSpace | '')} className="h-10 rounded border border-gray-600 bg-gray-900 px-3 pe-9 text-gray-100 outline-none focus-visible:border-blue-400">
            <option value="">Both</option>
            <option value="work">Work</option>
            <option value="personal">Personal</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={!term.trim()} className="h-10 rounded bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40">Search</button>
        </div>
      </form>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-800 bg-gray-900 px-5 py-2 text-sm">
          <span>{selected.length} selected</span>
          <label className="flex items-center gap-2">Assign to
            <select
              defaultValue=""
              onChange={event => { void assignSelected(event.target.value); event.target.value = ''; }}
              className="h-9 rounded border border-gray-600 bg-gray-950 px-2 pe-8 text-gray-100"
            >
              <option value="">Choose a project</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setSelected([])} className="rounded px-2 py-1 text-gray-300 hover:bg-gray-800">Clear</button>
        </div>
      )}

      <div className="min-h-32 flex-1 overflow-y-auto px-5 py-3" aria-busy={status === 'loading'}>
        <p className="sr-only" role="status">
          {status === 'loading' ? 'Searching' : status === 'ready' ? `${results.length} results` : ''}
        </p>
        {notice && <p className="mb-3 rounded bg-green-950 px-3 py-2 text-sm text-green-200">{notice}</p>}
        {status === 'error' && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}

        {status === 'ready' && response && results.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-400">
            {response.filter_options.space.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSpace(option.value as JournalSpace)}
                className="rounded-full border border-gray-700 px-3 py-1 hover:border-blue-400 hover:text-gray-100"
              >
                {facetLabel(option)}
              </button>
            ))}
            {response.filter_options.project_id.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setProjectId(option.value)}
                className="rounded-full border border-gray-700 px-3 py-1 hover:border-blue-400 hover:text-gray-100"
              >
                {facetLabel(option)}
              </button>
            ))}
          </div>
        )}

        {empty && (
          <div className="py-6 text-center text-sm text-gray-400">
            <p>Nothing matched in {mode === 'ai' ? 'AI' : 'Text'} mode.</p>
            <button type="button" onClick={retryInOtherMode} className="mt-2 rounded bg-gray-800 px-3 py-2 text-gray-100 hover:bg-gray-700">
              Try {mode === 'ai' ? 'Text' : 'AI'} mode instead
            </button>
          </div>
        )}

        <ul className="grid gap-2">
          {results.map((result: SearchResult) => (
            <li key={result.id} className="rounded border border-gray-700 bg-gray-900">
              <div className="flex items-start gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(result.id)}
                  onChange={() => toggle(result.id)}
                  aria-label={`Select ${result.title}`}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onOpen({ id: result.id })} className="block w-full truncate text-left font-medium text-gray-100 hover:text-blue-300">
                    {result.title}
                  </button>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {result.space}
                    {result.entry_date ? ` · ${result.entry_date}` : ''}
                    {` · ${result.kind}`}
                  </p>
                  {result.matches.length > 0 ? (
                    <ul className="mt-2 grid gap-1">
                      {result.matches.map(match => (
                        <li key={`${match.field}-${match.line}`}>
                          <button
                            type="button"
                            onClick={() => onOpen({ id: result.id }, match.line)}
                            className="w-full truncate rounded bg-gray-950 px-2 py-1 text-left text-xs text-gray-300 hover:text-blue-300"
                          >
                            <span className="uppercase tracking-wide text-gray-500">{match.field}</span>{' '}{match.preview}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 truncate text-xs text-gray-500">{result.excerpt}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
