export type DebugLevel = 'info' | 'success' | 'warn' | 'error';

export interface DebugAuthEvent {
  seq: number;
  ts: string;
  file: string;
  fn: string;
  event: string;
  data: Record<string, unknown>;
  level: DebugLevel;
}

const EVENTS_KEY = 'mu_debug_events';
const MAX_EVENTS = 150;

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadStoredEvents(): DebugAuthEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as DebugAuthEvent[]) : [];
  } catch { return []; }
}

function saveEvents(events: DebugAuthEvent[]): void {
  try {
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {}
}

// ── Event store ───────────────────────────────────────────────────────────────

let _seq = 0;
let _events: DebugAuthEvent[] = loadStoredEvents();
if (_events.length > 0) _seq = _events[_events.length - 1].seq;

type Listener = () => void;
const _listeners = new Set<Listener>();

function _notify() { _listeners.forEach(l => { try { l(); } catch {} }); }

// Sync events pushed by OTHER tabs/contexts (e.g. auth callback, beforeLoad).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== EVENTS_KEY || !e.newValue) return;
    try {
      const incoming = JSON.parse(e.newValue) as DebugAuthEvent[];
      const lastSeq = _events.length > 0 ? _events[_events.length - 1].seq : 0;
      const novel = incoming.filter(ev => ev.seq > lastSeq);
      if (novel.length > 0) {
        _events = [..._events, ...novel].slice(-MAX_EVENTS);
        _notify();
      }
    } catch {}
  });
}

export function pushDebugEvent(
  file: string,
  fn: string,
  event: string,
  data: Record<string, unknown> = {},
  level: DebugLevel = 'info'
): void {
  const entry: DebugAuthEvent = {
    seq: ++_seq,
    ts: new Date().toISOString(),
    file,
    fn,
    event,
    data,
    level,
  };
  _events = [..._events.slice(-(MAX_EVENTS - 1)), entry];
  saveEvents(_events);
  _notify();
}

export function getDebugEvents(): DebugAuthEvent[] { return _events; }

export function subscribeDebugEvents(listener: Listener): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

export function clearDebugEvents(): void {
  _events = [];
  _seq = 0;
  try { window.localStorage.removeItem(EVENTS_KEY); } catch {}
  _notify();
}

// ── Panel open/close state ────────────────────────────────────────────────────

const PANEL_KEY = 'mu_debug_panel_open';

let _panelOpen = false;
type PanelListener = (open: boolean) => void;
const _panelListeners = new Set<PanelListener>();

function _notifyPanel(open: boolean) {
  _panelListeners.forEach(l => { try { l(open); } catch {} });
}

// Allow any tab to open the panel (e.g. long-press in the auth tab surfaces
// events that were recorded in the dashboard tab).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== PANEL_KEY) return;
    const open = e.newValue === '1';
    _panelOpen = open;
    _notifyPanel(open);
  });
}

export function openDebugPanel(): void {
  _panelOpen = true;
  try { window.localStorage.setItem(PANEL_KEY, '1'); } catch {}
  _notifyPanel(true);
}

export function closeDebugPanel(): void {
  _panelOpen = false;
  try { window.localStorage.removeItem(PANEL_KEY); } catch {}
  _notifyPanel(false);
}

export function isDebugPanelOpen(): boolean { return _panelOpen; }

export function subscribeDebugPanelOpen(listener: PanelListener): () => void {
  _panelListeners.add(listener);
  return () => { _panelListeners.delete(listener); };
}
