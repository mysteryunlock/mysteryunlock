import { useState, useEffect, useRef, type CSSProperties } from 'react';
import {
  getDebugEvents, subscribeDebugEvents, clearDebugEvents,
  closeDebugPanel, isDebugPanelOpen, subscribeDebugPanelOpen,
  type DebugAuthEvent, type DebugLevel,
} from '@/lib/debug-auth-log';

const LEVEL_BG: Record<DebugLevel, string> = {
  info:    '#0f172a',
  success: '#052e16',
  warn:    '#3a1500',
  error:   '#3d0000',
};
const LEVEL_COLOR: Record<DebugLevel, string> = {
  info:    '#94a3b8',
  success: '#86efac',
  warn:    '#fdba74',
  error:   '#fca5a5',
};
const LEVEL_BORDER: Record<DebugLevel, string> = {
  info:    '#334155',
  success: '#22c55e',
  warn:    '#f97316',
  error:   '#ef4444',
};

const BTN: CSSProperties = {
  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer',
  fontFamily: 'monospace', flexShrink: 0, touchAction: 'manipulation',
  minHeight: 40,
};

function fmtTime(ts: string): string {
  return ts.length >= 23 ? ts.slice(11, 23) : ts;
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function buildCopyText(events: DebugAuthEvent[]): string {
  return events
    .map(e =>
      `[${e.seq}] ${e.ts} [${e.level.toUpperCase()}] [${e.file}:${e.fn}] ${e.event}\n` +
      (Object.keys(e.data).length ? '  ' + safeStringify(e.data).replace(/\n/g, '\n  ') + '\n' : '')
    )
    .join('\n');
}

function EventRow({ e, forceExpand }: { e: DebugAuthEvent; forceExpand?: boolean }) {
  const isFailure = e.event === 'FIRST_FAILURE' || e.event.includes('FIRST_FAILURE');
  const autoExpand = isFailure || e.level === 'error' || forceExpand;
  const [expanded, setExpanded] = useState(() => !!autoExpand);
  const hasData = Object.keys(e.data).length > 0;

  const containerStyle: CSSProperties = {
    background: isFailure ? '#1a0000' : LEVEL_BG[e.level],
    color: LEVEL_COLOR[e.level],
    borderLeft: isFailure ? '4px solid #ff0000' : `3px solid ${LEVEL_BORDER[e.level]}`,
    padding: '6px 8px',
    marginBottom: 2,
    borderRadius: 3,
    cursor: hasData ? 'pointer' : 'default',
    ...(isFailure ? { boxShadow: '0 0 0 1px #ff0000' } : {}),
  };

  return (
    <div style={containerStyle} onClick={() => hasData && setExpanded(x => !x)}>
      {isFailure && (
        <div style={{ color: '#ff4444', fontWeight: 900, fontSize: 13, marginBottom: 4, letterSpacing: 1 }}>
          ⛔ FIRST FAILURE DETECTED
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ opacity: 0.4, minWidth: 26, textAlign: 'right', flexShrink: 0, fontSize: 11 }}>#{e.seq}</span>
        <span style={{ opacity: 0.6, flexShrink: 0, fontSize: 11 }}>{fmtTime(e.ts)}</span>
        <span style={{ color: '#c084fc', flexShrink: 0, fontSize: 11, wordBreak: 'break-all' }}>[{e.file}:{e.fn}]</span>
        <span style={{ fontWeight: 700, fontSize: 12 }}>{e.event}</span>
        {hasData && !expanded && !isFailure && (
          <span style={{ opacity: 0.6, fontSize: 10, wordBreak: 'break-all', flex: 1 }}>
            {Object.entries(e.data).slice(0, 3).map(([k, v]) =>
              `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`
            ).join('  ')}
          </span>
        )}
        {hasData && (
          <span style={{ opacity: 0.5, fontSize: 10, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>
      {expanded && hasData && (
        <pre style={{
          margin: '4px 0 2px 28px', fontSize: 11, whiteSpace: 'pre-wrap',
          wordBreak: 'break-all', lineHeight: 1.5,
          color: isFailure ? '#ff9999' : LEVEL_COLOR[e.level],
        }}>
          {safeStringify(e.data)}
        </pre>
      )}
    </div>
  );
}

function Panel() {
  const [events, setEvents] = useState<DebugAuthEvent[]>(() => getDebugEvents());
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const firstErrorIdx = events.findIndex(e => e.level === 'error' || e.event === 'FIRST_FAILURE');

  useEffect(() => {
    return subscribeDebugEvents(() => setEvents(getDebugEvents()));
  }, []);

  useEffect(() => {
    if (listRef.current) {
      if (firstErrorIdx >= 0) {
        const rows = listRef.current.querySelectorAll('[data-seq]');
        rows[firstErrorIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
  }, [events.length, firstErrorIdx]);

  const copyLogs = async () => {
    const text = buildCopyText(events);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;width:1px;height:1px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const errorCount = events.filter(e => e.level === 'error').length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2147483647,
      display: 'flex', flexDirection: 'column',
      background: '#020617',
      fontFamily: '"Cascadia Code","Fira Code",ui-monospace,monospace',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        background: '#0f172a', borderBottom: '2px solid #1d4ed8', flexShrink: 0,
      }}>
        <span style={{ color: '#60a5fa', fontWeight: 700, flex: 1, fontSize: 13 }}>
          🔍 Debug Logs — {events.length} events
          {errorCount > 0 && (
            <span style={{ marginLeft: 8, color: '#ef4444' }}>⛔ {errorCount} error{errorCount > 1 ? 's' : ''}</span>
          )}
        </span>
        <button style={BTN} onClick={copyLogs}>
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
        <button style={BTN} onClick={() => clearDebugEvents()}>🗑</button>
        <button
          style={{ ...BTN, color: '#f87171' }}
          onClick={() => closeDebugPanel()}
        >
          ✕ Close
        </button>
      </div>

      {/* Status bar — first error summary */}
      {firstErrorIdx >= 0 && (
        <div style={{
          background: '#3d0000', color: '#fca5a5', padding: '6px 12px',
          fontSize: 12, borderBottom: '1px solid #7f1d1d', flexShrink: 0,
        }}>
          ⛔ First error at event #{events[firstErrorIdx].seq}:&nbsp;
          <strong>{events[firstErrorIdx].file}:{events[firstErrorIdx].fn}</strong>&nbsp;
          → {events[firstErrorIdx].event}
        </div>
      )}

      {/* Event list */}
      <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '6px 6px 12px', WebkitOverflowScrolling: 'touch' } as CSSProperties}>
        {events.length === 0 && (
          <div style={{ color: '#475569', padding: 24, textAlign: 'center', fontSize: 13, lineHeight: 1.6 }}>
            No events yet.<br />
            Sign in to start collecting logs.
          </div>
        )}
        {events.map((e, i) => (
          <div key={e.seq} data-seq={e.seq}>
            <EventRow e={e} forceExpand={i === firstErrorIdx} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        background: '#0f172a', borderTop: '1px solid #1e293b',
        padding: '8px 12px', flexShrink: 0,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <span style={{ color: '#475569', fontSize: 11, flex: 1 }}>
          Long-press the logo to re-open this panel
        </span>
        <button style={{ ...BTN, fontSize: 12 }} onClick={copyLogs}>
          {copied ? '✅ Copied!' : '📋 Copy all logs'}
        </button>
      </div>
    </div>
  );
}

export function DebugAuthPanel() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // URL param fallback for desktop testing
    if (new URLSearchParams(window.location.search).get('debugAuth') === '1') {
      setShow(true);
    }
    // Subscribe to programmatic open/close (triggered by long-press)
    const unsub = subscribeDebugPanelOpen((open) => setShow(open));
    // Sync initial state
    if (isDebugPanelOpen()) setShow(true);
    return unsub;
  }, []);

  if (!show) return null;
  return <Panel />;
}
