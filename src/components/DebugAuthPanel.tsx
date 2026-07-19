import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { getDebugEvents, subscribeDebugEvents, clearDebugEvents, type DebugAuthEvent, type DebugLevel } from '@/lib/debug-auth-log';

const LEVEL_STYLE: Record<DebugLevel, CSSProperties> = {
  info:    { background: '#0f172a', color: '#94a3b8', borderLeft: '3px solid #334155' },
  success: { background: '#052e16', color: '#86efac', borderLeft: '3px solid #22c55e' },
  warn:    { background: '#3a1500', color: '#fdba74', borderLeft: '3px solid #f97316' },
  error:   { background: '#3d0000', color: '#fca5a5', borderLeft: '3px solid #ef4444' },
};

const BTN: CSSProperties = {
  background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
  borderRadius: 4, padding: '2px 10px', fontSize: 11, cursor: 'pointer',
  fontFamily: 'monospace', flexShrink: 0,
};

function fmtTime(ts: string): string {
  return ts.length >= 23 ? ts.slice(11, 23) : ts;
}

function fmtData(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([k, v]) => {
      if (v === null || v === undefined) return `${k}=null`;
      if (typeof v === 'object') return `${k}=${JSON.stringify(v)}`;
      return `${k}=${v}`;
    })
    .join('  ')
    .slice(0, 500);
}

function EventRow({ e }: { e: DebugAuthEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = Object.keys(e.data).length > 0;
  return (
    <div
      style={{ ...LEVEL_STYLE[e.level], padding: '3px 6px', marginBottom: 1, borderRadius: 2, cursor: hasData ? 'pointer' : 'default' }}
      title={hasData ? 'Click to expand/collapse' : undefined}
      onClick={() => hasData && setExpanded(x => !x)}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ opacity: 0.4, minWidth: 26, textAlign: 'right', flexShrink: 0 }}>#{e.seq}</span>
        <span style={{ opacity: 0.55, flexShrink: 0 }}>{fmtTime(e.ts)}</span>
        <span style={{ color: '#c084fc', flexShrink: 0 }}>[{e.file}:{e.fn}]</span>
        <span style={{ fontWeight: 700 }}>{e.event}</span>
        {hasData && !expanded && (
          <span style={{ opacity: 0.7, fontSize: 10, wordBreak: 'break-all' }}>{fmtData(e.data)}</span>
        )}
        {hasData && (
          <span style={{ opacity: 0.4, fontSize: 10, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>
      {expanded && hasData && (
        <pre style={{ margin: '3px 0 2px 32px', fontSize: 10, opacity: 0.95, whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.4 }}>
          {JSON.stringify(e.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Panel() {
  const [events, setEvents] = useState<DebugAuthEvent[]>(() => getDebugEvents());
  const [minimized, setMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeDebugEvents(() => setEvents(getDebugEvents()));
  }, []);

  useEffect(() => {
    if (!minimized && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events, minimized]);

  const copyLogs = async () => {
    const text = events
      .map(e => `[${e.seq}] ${e.ts} [${e.level.toUpperCase()}] [${e.file}:${e.fn}] ${e.event} ${JSON.stringify(e.data)}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 2147483647,
          ...BTN, padding: '7px 14px', fontSize: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}
      >
        🔍 Debug Auth ({events.length})
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2147483647,
      height: '52dvh', display: 'flex', flexDirection: 'column',
      background: '#020617', borderTop: '2px solid #1d4ed8',
      fontFamily: '"Cascadia Code","Fira Code",ui-monospace,monospace', fontSize: 11,
      boxShadow: '0 -6px 32px rgba(0,0,0,0.85)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
        background: '#0f172a', borderBottom: '1px solid #1e293b', flexShrink: 0,
      }}>
        <span style={{ color: '#60a5fa', fontWeight: 700, flex: 1, fontSize: 12 }}>
          🔍 DEBUG AUTH PANEL — {events.length} events
        </span>
        <button style={BTN} onClick={copyLogs}>{copied ? '✅ Copied!' : '📋 Copy all'}</button>
        <button style={BTN} onClick={() => clearDebugEvents()}>🗑 Clear</button>
        <button style={BTN} onClick={() => setMinimized(true)}>— Min</button>
      </div>
      <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '4px 4px 0' }}>
        {events.length === 0 && (
          <div style={{ color: '#475569', padding: 16, textAlign: 'center', fontSize: 12 }}>
            No events yet — interact with auth to see events here.
          </div>
        )}
        {events.map(e => <EventRow key={e.seq} e={e} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export function DebugAuthPanel() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debugAuth') === '1') {
      setShow(true);
    }
  }, []);

  if (!show) return null;
  return <Panel />;
}
