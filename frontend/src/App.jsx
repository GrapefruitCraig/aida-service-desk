import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = import.meta.env.VITE_API_URL || '';

const TOOL_LABELS = {
  halo_create_ticket: { label: 'Halo PSA — Creating ticket', icon: 'ti-ticket', color: '#3b82f6' },
  halo_get_ticket: { label: 'Halo PSA — Fetching ticket', icon: 'ti-ticket', color: '#3b82f6' },
  halo_search_tickets: { label: 'Halo PSA — Searching tickets', icon: 'ti-search', color: '#3b82f6' },
  halo_update_ticket: { label: 'Halo PSA — Updating ticket', icon: 'ti-edit', color: '#3b82f6' },
  halo_escalate_ticket: { label: 'Halo PSA — Escalating ticket', icon: 'ti-arrow-up-right', color: '#f59e0b' },
  halo_get_users: { label: 'Halo PSA — Looking up user', icon: 'ti-user', color: '#3b82f6' },
  ninja_get_devices: { label: 'NinjaRMM — Searching devices', icon: 'ti-devices', color: '#22c55e' },
  ninja_get_device_health: { label: 'NinjaRMM — Checking device health', icon: 'ti-heartbeat', color: '#22c55e' },
  ninja_get_active_alerts: { label: 'NinjaRMM — Fetching alerts', icon: 'ti-bell-ringing', color: '#f59e0b' },
  ninja_get_offline_devices: { label: 'NinjaRMM — Listing offline devices', icon: 'ti-device-desktop-off', color: '#ef4444' },
  ninja_reboot_device: { label: 'NinjaRMM — Sending reboot', icon: 'ti-refresh', color: '#f59e0b' },
  ninja_run_script: { label: 'NinjaRMM — Running script', icon: 'ti-terminal', color: '#22c55e' },
  ninja_get_software: { label: 'NinjaRMM — Fetching software', icon: 'ti-package', color: '#22c55e' },
  ninja_get_patch_status: { label: 'NinjaRMM — Checking patches', icon: 'ti-shield-check', color: '#22c55e' },
};

const QUICK_PROMPTS = [
  { label: 'VPN issue', icon: 'ti-lock', text: "My laptop won't connect to VPN — I'm getting a timeout error." },
  { label: 'Device health', icon: 'ti-heartbeat', text: 'Check the health of all devices and show any with alerts or offline status.' },
  { label: 'New ticket', icon: 'ti-ticket', text: 'I need to raise a new IT support ticket for a software install request.' },
  { label: 'Open tickets', icon: 'ti-list', text: 'Show me all currently open tickets in Halo PSA.' },
  { label: 'Email issue', icon: 'ti-mail', text: "My Outlook isn't syncing — emails stopped arriving about an hour ago." },
  { label: 'Escalate', icon: 'ti-arrow-up-right', text: 'This issue needs escalation to 2nd line — please prepare a handover.' },
  { label: 'Offline devices', icon: 'ti-device-desktop-off', text: 'Which devices are currently showing as offline in NinjaRMM?' },
  { label: 'Admin rights', icon: 'ti-key', text: 'A user needs local admin rights on their machine — how do we process this?' },
];

function ToolCallBadge({ toolName, summary, success, pending }) {
  const meta = TOOL_LABELS[toolName] || { label: toolName, icon: 'ti-plug', color: '#999' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#1a1a1a', border: '1px solid #2a2a2a',
      borderRadius: 6, padding: '6px 10px', margin: '4px 0',
      fontSize: 12, color: '#888',
    }}>
      <i className={`ti ${meta.icon}`} style={{ color: meta.color, fontSize: 14 }} aria-hidden="true" />
      <span style={{ flex: 1 }}>{meta.label}</span>
      {pending
        ? <span style={{ display: 'flex', gap: 3 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: 4, height: 4, borderRadius: '50%', background: '#555',
                animation: `pulse 1s ${i * 0.2}s infinite`,
              }} />
            ))}
          </span>
        : <span style={{ color: success ? '#22c55e' : '#ef4444' }}>
            {success ? summary || '✓' : '✗ error'}
          </span>
      }
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start', maxWidth: '85%',
      alignSelf: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isUser ? '#1d3a6e' : '#1a2e1a',
        border: `1px solid ${isUser ? '#3b82f6' : '#22c55e'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13,
      }}>
        <i className={`ti ${isUser ? 'ti-user' : 'ti-robot'}`}
           style={{ color: isUser ? '#3b82f6' : '#22c55e' }} aria-hidden="true" />
      </div>
      <div style={{ flex: 1 }}>
        {/* Tool calls */}
        {msg.toolCalls?.map((tc, i) => (
          <ToolCallBadge key={i} {...tc} />
        ))}
        {/* Text content */}
        {msg.content && (
          <div style={{
            background: isUser ? '#1d3a6e' : '#141414',
            border: `1px solid ${isUser ? '#3b82f6' : '#2a2a2a'}`,
            borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
            padding: '10px 14px',
            color: isUser ? '#bfdbfe' : '#e8e8e8',
          }}>
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          </div>
        )}
        {/* Typing indicator */}
        {msg.typing && (
          <div style={{
            background: '#141414', border: '1px solid #2a2a2a',
            borderRadius: '4px 12px 12px 12px', padding: '12px 16px',
            display: 'flex', gap: 5, alignItems: 'center',
          }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: '#555',
                display: 'inline-block',
                animation: `bounce 1s ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }) {
  const colors = { ok: '#22c55e', error: '#ef4444', auth_error: '#f59e0b', unknown: '#555' };
  return (
    <span style={{
      width: 7, height: 7, borderRadius: '50%',
      background: colors[status] || '#555', display: 'inline-block',
    }} title={status} />
  );
}

export default function App() {
  const [messages, setMessages] = useState([{
    id: 'welcome', role: 'assistant',
    content: "Hi, I'm **Caida** — your AI-powered IT service desk agent.\n\nI have live access to **Halo PSA** and **NinjaRMM**. I can troubleshoot issues, raise and manage tickets, check device health, run remote scripts, and escalate to your team.\n\nWhat can I help you with?",
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ anthropic: 'unknown', halo: 'unknown', ninja: 'unknown' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetch(`${API}/api/agent/health`)
      .then(r => r.json())
      .then(d => setHealth(d.status))
      .catch(() => {});
  }, []);

  const buildApiMessages = useCallback((msgs) => {
    return msgs
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
      .map(m => ({ role: m.role, content: m.content }));
  }, []);

  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg = { id: Date.now().toString(), role: 'user', content: userText };
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg = { id: assistantId, role: 'assistant', content: '', toolCalls: [], typing: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    const apiMessages = [...buildApiMessages(messages), { role: 'user', content: userText }];

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) { eventType = line.slice(7).trim(); continue; }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(eventType, data, assistantId);
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: '⚠️ Connection error. Please check the server is running.', typing: false }
            : m
        ));
      }
    } finally {
      setLoading(false);
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, typing: false } : m
      ));
    }
  }, [input, loading, messages, buildApiMessages]);

  function handleSSEEvent(type, data, assistantId) {
    setMessages(prev => prev.map(m => {
      if (m.id !== assistantId) return m;
      switch (type) {
        case 'text':
          return { ...m, content: (m.content || '') + data.text, typing: false };
        case 'tool_start':
          return { ...m, toolCalls: [...(m.toolCalls || []), { toolName: data.name, pending: true, id: data.id }] };
        case 'tool_result':
          return {
            ...m,
            toolCalls: (m.toolCalls || []).map(tc =>
              tc.id === data.id ? { ...tc, pending: false, success: data.success, summary: data.summary } : tc
            ),
          };
        case 'done':
          return { ...m, typing: false };
        case 'error':
          return { ...m, content: (m.content || '') + `\n\n⚠️ ${data.message}`, typing: false };
        default:
          return m;
      }
    }));
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }

  function clearChat() {
    if (abortRef.current) abortRef.current.abort();
    setMessages([{
      id: 'welcome', role: 'assistant',
      content: "Chat cleared. How can I help you?",
    }]);
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0d0d0d', fontFamily: 'var(--font)' }}>
      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{
          width: 230, flexShrink: 0, borderRight: '1px solid #1e1e1e',
          display: 'flex', flexDirection: 'column', background: '#0a0a0a',
        }}>
          {/* Logo */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #1e1e1e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: '#14532d',
                border: '1px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="ti ti-robot" style={{ color: '#22c55e', fontSize: 14 }} aria-hidden="true" />
              </div>
              <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '0.05em' }}>Caida</span>
              <span style={{
                marginLeft: 'auto', fontSize: 10, padding: '2px 6px', borderRadius: 3,
                background: '#14532d', color: '#22c55e', border: '1px solid #22c55e22',
              }}>LIVE</span>
            </div>
            <p style={{ fontSize: 11, color: '#555', fontFamily: 'var(--mono)' }}>IT Service Desk Agent</p>
          </div>

          {/* Integrations */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e1e' }}>
            <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Integrations</p>
            {[
              { name: 'Halo PSA', icon: 'ti-cloud', key: 'halo', color: '#3b82f6' },
              { name: 'NinjaRMM', icon: 'ti-device-desktop', key: 'ninja', color: '#22c55e' },
              { name: 'Claude API', icon: 'ti-brain', key: 'anthropic', color: '#a855f7' },
            ].map(({ name, icon, key, color }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                <i className={`ti ${icon}`} style={{ color, fontSize: 13 }} aria-hidden="true" />
                <span style={{ flex: 1, fontSize: 12, color: '#888' }}>{name}</span>
                <StatusDot status={health[key]} />
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{ padding: '12px 8px', flex: 1, overflowY: 'auto' }}>
            <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 8 }}>Quick actions</p>
            {QUICK_PROMPTS.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q.text)} disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 10px', background: 'none', border: 'none',
                  borderRadius: 6, color: '#666', fontSize: 12, textAlign: 'left',
                  transition: 'all 0.15s', cursor: loading ? 'default' : 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#141414'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <i className={`ti ${q.icon}`} style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true" />
                {q.label}
              </button>
            ))}
          </div>

          {/* Bottom controls */}
          <div style={{ padding: '10px 8px', borderTop: '1px solid #1e1e1e', display: 'flex', gap: 4 }}>
            <button onClick={clearChat} style={{
              flex: 1, padding: '7px', background: 'none', border: '1px solid #2a2a2a',
              borderRadius: 6, color: '#555', fontSize: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 5, transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#888'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#555'; }}
            >
              <i className="ti ti-trash" style={{ fontSize: 12 }} aria-hidden="true" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          padding: '0 16px', height: 52, display: 'flex', alignItems: 'center',
          borderBottom: '1px solid #1e1e1e', gap: 10, flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(v => !v)} style={{
            background: 'none', border: 'none', color: '#555', padding: 4, borderRadius: 4,
          }}>
            <i className="ti ti-layout-sidebar" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#888', fontFamily: 'var(--mono)' }}>
            Caida / service-desk
          </span>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', color: '#555', fontSize: 11 }}>
              <i className="ti ti-loader" style={{ fontSize: 13, animation: 'spin 1s linear infinite' }} aria-hidden="true" />
              Working…
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px 20px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {messages.map(msg => <Message key={msg.id} msg={msg} />)}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #1e1e1e',
          background: '#0a0a0a', flexShrink: 0,
        }}>
          {/* Quick chips (only at start) */}
          {messages.length <= 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {QUICK_PROMPTS.slice(0, 4).map((q, i) => (
                <button key={i} onClick={() => sendMessage(q.text)} disabled={loading}
                  style={{
                    padding: '4px 10px', border: '1px solid #2a2a2a', borderRadius: 20,
                    background: '#141414', color: '#666', fontSize: 12, display: 'flex',
                    alignItems: 'center', gap: 5, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#aaa'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#666'; }}
                >
                  <i className={`ti ${q.icon}`} style={{ fontSize: 11 }} aria-hidden="true" />
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKey}
              placeholder="Describe your IT issue or ask Caida anything…"
              disabled={loading}
              rows={1}
              style={{
                flex: 1, resize: 'none', background: '#141414',
                border: '1px solid #2a2a2a', borderRadius: 8,
                padding: '9px 12px', color: '#e8e8e8', fontSize: 13,
                outline: 'none', lineHeight: 1.5, maxHeight: 140,
                fontFamily: 'var(--font)',
              }}
              onFocus={e => e.target.style.borderColor = '#333'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'}
            />
            <button
              onClick={() => loading ? abortRef.current?.abort() : sendMessage()}
              style={{
                width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                background: loading ? '#1a1a1a' : '#14532d',
                border: `1px solid ${loading ? '#2a2a2a' : '#22c55e'}`,
                color: loading ? '#555' : '#22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', fontSize: 16,
              }}
              aria-label={loading ? 'Stop' : 'Send'}
            >
              <i className={`ti ${loading ? 'ti-square' : 'ti-send'}`} aria-hidden="true" />
            </button>
          </div>
          <p style={{ fontSize: 10, color: '#333', marginTop: 6, textAlign: 'center', fontFamily: 'var(--mono)' }}>
            Caida · Halo PSA + NinjaRMM · Claude Sonnet 4
          </p>
        </div>
      </div>
    </div>
  );
}
