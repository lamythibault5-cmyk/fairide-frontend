import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';

const SEEN_KEY = 'fairide_assistant_seen';

export default function AssistantWidget() {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: t('assistant.greeting') }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [pulse, setPulse] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  // Une seule fois par session : un petit rappel discret que l'assistant existe, pour qu'on le remarque
  // sans être intrusif (une bulle, pas de popup bloquant, disparaît toute seule ou au premier clic).
  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) return;
    const showTimer = setTimeout(() => {
      setShowTooltip(true);
      setPulse(true);
    }, 2500);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!showTooltip) return;
    const hideTimer = setTimeout(() => dismissTooltip(), 9000);
    return () => clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTooltip]);

  function dismissTooltip() {
    setShowTooltip(false);
    setPulse(false);
    sessionStorage.setItem(SEEN_KEY, '1');
  }

  function toggleOpen() {
    dismissTooltip();
    setOpen((o) => !o);
  }

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const data = await api('/assistant/chat', { method: 'POST', body: { messages: nextMessages, language } });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('assistant.errorFallback') }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="assistant-widget">
      {open && (
        <div className="assistant-panel">
          <div className="assistant-header">
            <span>{t('assistant.header')}</span>
            <button className="assistant-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="assistant-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`assistant-bubble ${m.role}`}>{m.content}</div>
            ))}
            {loading && <div className="assistant-bubble assistant typing">...</div>}
          </div>
          <form className="assistant-input-row" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('assistant.inputPlaceholder')}
              disabled={loading}
            />
            <button type="submit" className="btn-teal" disabled={loading || !input.trim()}>{t('assistant.send')}</button>
          </form>
        </div>
      )}
      {!open && showTooltip && (
        <div className="assistant-tooltip">
          <button className="assistant-tooltip-close" onClick={dismissTooltip} aria-label={t('assistant.closeAria')}>✕</button>
          <span>{t('assistant.tooltipText')}</span>
        </div>
      )}
      <button className={`assistant-toggle${pulse ? ' pulse' : ''}`} onClick={toggleOpen} aria-label={t('assistant.openAria')}>
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
