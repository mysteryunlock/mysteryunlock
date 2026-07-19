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
  _events = [..._events.slice(-99), entry];
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
