import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

const GREETING = "Bonjour ! Je suis l'assistant Fairide 🤖 Pose-moi tes questions sur les commandes, les livraisons, les commissions ou comment devenir partenaire !";

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const data = await api('/assistant/chat', { method: 'POST', body: { messages: nextMessages } });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Désolé, une erreur est survenue. Réessaie dans un instant !" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="assistant-widget">
      {open && (
        <div className="assistant-panel">
          <div className="assistant-header">
            <span>🤖 Assistant Fairide</span>
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
              placeholder="Écris ta question..."
              disabled={loading}
            />
            <button type="submit" className="btn-teal" disabled={loading || !input.trim()}>Envoyer</button>
          </form>
        </div>
      )}
      <button className="assistant-toggle" onClick={() => setOpen((o) => !o)} aria-label="Ouvrir l'assistant Fairide">
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
