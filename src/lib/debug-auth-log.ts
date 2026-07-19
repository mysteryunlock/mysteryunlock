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

let _seq = 0;
let _events: DebugAuthEvent[] = [];
type Listener = () => void;
const _listeners = new Set<Listener>();

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
  _events = [..._events.slice(-199), entry];
  _listeners.forEach(l => { try { l(); } catch {} });
}

export function getDebugEvents(): DebugAuthEvent[] { return _events; }

export function subscribeDebugEvents(listener: Listener): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

export function clearDebugEvents(): void {
  _events = [];
  _seq = 0;
  _listeners.forEach(l => { try { l(); } catch {} });
}

// ── Panel open/close state ────────────────────────────────────────────────────
let _panelOpen = false;
type PanelListener = (open: boolean) => void;
const _panelListeners = new Set<PanelListener>();

export function openDebugPanel(): void {
  _panelOpen = true;
  _panelListeners.forEach(l => { try { l(true); } catch {} });
}

export function closeDebugPanel(): void {
  _panelOpen = false;
  _panelListeners.forEach(l => { try { l(false); } catch {} });
}

export function isDebugPanelOpen(): boolean { return _panelOpen; }

export function subscribeDebugPanelOpen(listener: PanelListener): () => void {
  _panelListeners.add(listener);
  return () => { _panelListeners.delete(listener); };
}
