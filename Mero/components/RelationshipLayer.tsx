import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BoardItem, ItemType, PanZoom } from '../types';
import { myobApi, SimilarityMatrix } from '../services/myobApi';
import { cubicPath, relationshipPairs, RelationshipCard, visibleCards } from '../lib/relationshipGeometry';

type RelationshipMode = 'off' | 'connectors' | 'heatmap';
const MODE_KEY = 'mero-relationship-mode';
const THRESHOLD_KEY = 'mero-relationship-threshold';

export const RelationshipLayer: React.FC<{ items: BoardItem[]; panZoom: PanZoom }> = ({ items, panZoom }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestGeneration = useRef(0);
  const [mode, setMode] = useState<RelationshipMode>(() => (localStorage.getItem(MODE_KEY) as RelationshipMode) || 'off');
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem(THRESHOLD_KEY)) || 0.55);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [settled, setSettled] = useState({ items, panZoom });
  const [matrix, setMatrix] = useState<SimilarityMatrix | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

  useEffect(() => {
    const node = rootRef.current?.parentElement;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (box) setViewport({ width: box.width, height: box.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geometryKey = items.filter(item => item.type === ItemType.NoteCard).map(item => `${item.id}:${item.x}:${item.y}:${item.width}:${item.height}:${item.noteData?.noteId}`).join('|');
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled({ items, panZoom }), 140);
    return () => window.clearTimeout(timer);
  }, [geometryKey, panZoom.x, panZoom.y, panZoom.k]);

  const cards = useMemo(() => visibleCards(
    settled.items.filter(item => item.type === ItemType.NoteCard && item.noteData?.noteId).map<RelationshipCard>(item => ({
      itemId: item.id, noteId: item.noteData!.noteId, x: item.x, y: item.y, width: item.width, height: item.height,
    })), viewport, settled.panZoom,
  ), [settled, viewport]);
  const noteIds = useMemo(() => [...new Set(cards.map(card => card.noteId))], [cards]);
  const noteIdKey = noteIds.join('|');

  useEffect(() => {
    if (mode === 'off' || noteIds.length < 2) { setMatrix(null); setState('idle'); return; }
    const generation = ++requestGeneration.current;
    setState('loading');
    myobApi.similarityMatrix(noteIds).then(result => {
      if (requestGeneration.current === generation) { setMatrix(result); setState('ready'); }
    }).catch(() => {
      if (requestGeneration.current === generation) { setMatrix(null); setState('unavailable'); }
    });
  }, [mode, noteIdKey]);

  const pairs = useMemo(() => matrix ? relationshipPairs(cards, matrix.ids, matrix.matrix, threshold) : [], [cards, matrix, threshold]);

  useEffect(() => {
    if (mode !== 'heatmap' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const scale = 0.25;
    const width = Math.max(1, Math.ceil(viewport.width * scale));
    const height = Math.max(1, Math.ceil(viewport.height * scale));
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const context = offscreen.getContext('2d');
    if (!context) return;
    const image = context.createImageData(width, height);
    const radius = 90 * scale;
    for (const pair of pairs) {
      const centerX = (pair.left.centerX + pair.right.centerX) * scale / 2;
      const centerY = (pair.left.centerY + pair.right.centerY) * scale / 2;
      const minimumX = Math.max(0, Math.floor(centerX - radius * 3));
      const maximumX = Math.min(width - 1, Math.ceil(centerX + radius * 3));
      const minimumY = Math.max(0, Math.floor(centerY - radius * 3));
      const maximumY = Math.min(height - 1, Math.ceil(centerY + radius * 3));
      for (let y = minimumY; y <= maximumY; y += 1) for (let x = minimumX; x <= maximumX; x += 1) {
        const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2;
        const alpha = pair.score * Math.exp(-distanceSquared / (2 * radius ** 2));
        const pixel = (y * width + x) * 4;
        image.data[pixel] = 99;
        image.data[pixel + 1] = 102;
        image.data[pixel + 2] = 241;
        image.data[pixel + 3] = Math.min(150, image.data[pixel + 3] + alpha * 95);
      }
    }
    context.putImageData(image, 0, 0);
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(offscreen, 0, 0);
  }, [mode, pairs, viewport]);

  const chooseMode = (next: RelationshipMode) => { setMode(next); localStorage.setItem(MODE_KEY, next); };
  const chooseThreshold = (next: number) => { setThreshold(next); localStorage.setItem(THRESHOLD_KEY, String(next)); };

  return <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
    {mode === 'connectors' && <svg className="absolute inset-0 h-full w-full" aria-hidden="true"><g fill="none">{pairs.map(pair => <path key={`${pair.left.itemId}:${pair.right.itemId}`} d={cubicPath(pair)} stroke="rgb(96 165 250)" strokeOpacity={Math.min(0.8, pair.score)} strokeWidth={1 + pair.score * 2} />)}</g></svg>}
    {mode === 'heatmap' && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" aria-hidden="true" />}
    <aside className="pointer-events-auto absolute right-3 top-16 rounded-lg border border-gray-700 bg-gray-950/90 p-2 text-xs text-gray-200 shadow-lg" aria-label="Relationship view preferences">
      <div className="flex gap-1">{(['off', 'connectors', 'heatmap'] as const).map(option => <button key={option} type="button" onClick={() => chooseMode(option)} aria-pressed={mode === option} className="rounded px-2 py-1 capitalize aria-pressed:bg-blue-600">{option}</button>)}</div>
      {mode !== 'off' && <><label className="mt-2 flex items-center gap-2">Similarity <input type="range" min="0.3" max="0.9" step="0.05" value={threshold} onChange={event => chooseThreshold(Number(event.target.value))} aria-label="Relationship similarity threshold" /><span>{threshold.toFixed(2)}</span></label><p className="mt-1 text-gray-400">Fainter = weaker · Brighter = stronger</p>{state === 'loading' && <p role="status" className="mt-1 text-blue-300">Updating relationships...</p>}{state === 'unavailable' && <p role="status" className="mt-1 text-amber-300">Relationships unavailable</p>}</>}
    </aside>
  </div>;
};
