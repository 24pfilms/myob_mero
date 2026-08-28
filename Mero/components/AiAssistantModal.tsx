import React, { useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/api';
import { ChatCitation, myobApi } from '../services/myobApi';
import { BotIcon, CheckIcon, ClipboardPlusIcon, CopyIcon, XIcon } from './icons';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToBoard: (text: string) => void;
  selectedNoteId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  citations?: ChatCitation[];
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ isOpen, onClose, onAddToBoard, selectedNoteId }) => {
  const [scope, setScope] = useState<'canvas' | 'notes'>('canvas');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshStatus = async () => {
    try {
      const status = await myobApi.openAIOAuthStatus();
      setConfigured(status.configured);
      if (status.configured) setConnecting(false);
      else if (status.oauth.state === 'failed') { setConnecting(false); setError('OpenAI sign-in failed. Try connecting again.'); }
    } catch {
      setConfigured(false);
      setError('AI status is unavailable.');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void refreshStatus();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!connecting) return;
    const timer = window.setInterval(() => void refreshStatus(), 1500);
    return () => window.clearInterval(timer);
  }, [connecting]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      setPosition({ x: Math.max(8, event.clientX - dragOffset.current.x), y: Math.max(8, event.clientY - dragOffset.current.y) });
    };
    const stop = () => { dragging.current = false; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, []);

  const connect = async () => {
    setError(null);
    try {
      const { authorizeUrl } = await myobApi.startOpenAIOAuth();
      window.open(authorizeUrl, '_blank', 'noopener,noreferrer');
      setConnecting(true);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'OpenAI sign-in could not start.');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = input.trim();
    if (!query || loading || !configured) return;
    const previous = messages.slice(-5).map(message => ({ role: message.role, content: message.text }));
    setMessages(current => [...current, { role: 'user', text: query }]);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const response = scope === 'notes'
        ? await myobApi.chat({ query, current_note_id: selectedNoteId, conversation_history: previous })
        : await myobApi.generalChat({ query, conversation_history: previous });
      setMessages(current => [...current, { role: 'assistant', text: response.answer, citations: response.citations }]);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 429) setError('AI rate limit reached. Wait a moment and retry.');
      else if (requestError instanceof ApiError && [424, 502, 503].includes(requestError.status)) setError('AI is unavailable. Reconnect OpenAI, then retry.');
      else setError('AI request failed. Retry when the service is available.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <section className="fixed z-[90] flex h-[480px] w-[min(26rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-blue-500/30 bg-slate-950/95 text-white shadow-2xl" style={{ left: position.x, top: position.y }} aria-labelledby="ai-assistant-title">
      <header className="flex cursor-grab items-center gap-2 border-b border-blue-500/20 p-3" onPointerDown={event => { dragging.current = true; dragOffset.current = { x: event.clientX - position.x, y: event.clientY - position.y }; }}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600"><BotIcon /></span>
        <h2 id="ai-assistant-title" className="flex-1 font-semibold">AI Assistant</h2>
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={onClose} className="rounded p-2 text-gray-400 hover:bg-slate-800 hover:text-white" aria-label="Close AI assistant"><XIcon /></button>
      </header>
      <div className="grid grid-cols-2 gap-1 border-b border-gray-800 p-2" role="group" aria-label="AI scope">
        <button type="button" onClick={() => setScope('canvas')} aria-pressed={scope === 'canvas'} className="rounded px-3 py-2 text-sm aria-pressed:bg-blue-600">Canvas</button>
        <button type="button" onClick={() => setScope('notes')} aria-pressed={scope === 'notes'} className="rounded px-3 py-2 text-sm aria-pressed:bg-blue-600">Notes</button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-gray-400">{scope === 'notes' ? 'Ask across your notes. Answers include note citations.' : 'Ask a general question, then add the answer to this canvas.'}</p>}
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-lg p-3 text-sm ${message.role === 'user' ? 'bg-blue-600' : 'border border-gray-700 bg-slate-900'}`}><p className="whitespace-pre-wrap leading-6">{message.text}</p>{message.citations?.length ? <ul className="mt-3 space-y-1 border-t border-gray-700 pt-2" aria-label="Note citations">{message.citations.map(citation => <li key={citation.noteId} className="text-xs text-blue-300">{citation.noteTitle}{citation.excerpt ? ` — ${citation.excerpt.slice(0, 100)}` : ''}</li>)}</ul> : null}{message.role === 'assistant' && <div className="mt-2 flex justify-end gap-1"><button type="button" onClick={() => { void navigator.clipboard.writeText(message.text); setCopied(index); window.setTimeout(() => setCopied(null), 1500); }} className="rounded p-1 text-blue-300 hover:bg-gray-800" aria-label="Copy AI answer">{copied === index ? <CheckIcon /> : <CopyIcon />}</button><button type="button" onClick={() => onAddToBoard(message.text)} className="rounded p-1 text-blue-300 hover:bg-gray-800" aria-label="Add AI answer to canvas"><ClipboardPlusIcon /></button></div>}</div></div>)}
        {loading && <p className="text-sm text-blue-300" role="status">Thinking...</p>}
        <div ref={endRef} />
      </div>
      {error && <p className="mx-3 mb-2 rounded border border-red-500/40 bg-red-950/50 p-2 text-xs text-red-200" role="alert">{error}</p>}
      {configured === false ? <div className="border-t border-gray-800 p-3"><p className="mb-2 text-xs text-gray-300">AI unavailable until OpenAI is connected.</p><button type="button" onClick={() => void connect()} disabled={connecting} className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">{connecting ? 'Waiting for OpenAI sign-in...' : 'Connect OpenAI'}</button></div> : <form onSubmit={submit} className="border-t border-gray-800 p-3"><label className="sr-only" htmlFor="ai-question">Question</label><textarea id="ai-question" ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={!configured || loading} placeholder={configured === null ? 'Checking AI availability...' : scope === 'notes' ? 'Ask your notes...' : 'Ask anything...'} rows={2} className="w-full resize-none rounded border border-gray-700 bg-slate-900 p-2 text-sm outline-none focus:border-blue-400 disabled:opacity-50" /><button type="submit" disabled={loading || !input.trim()} className="mt-2 w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold disabled:opacity-40">Send</button></form>}
    </section>
  );
};
