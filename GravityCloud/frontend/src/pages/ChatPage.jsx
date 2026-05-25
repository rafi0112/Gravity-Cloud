import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trash2, PlusSquare } from 'lucide-react';
import { useChatStore } from '../context/chatStore';
import { useChat } from '../hooks/useChat';
import MessageBubble from '../components/chat/MessageBubble';
import ChatInput from '../components/chat/ChatInput';
import ChatWelcome from '../components/chat/ChatWelcome';

export default function ChatPage() {
  const { sessions, activeId, createSession, active, clearSession } = useChatStore();
  const session = active();
  const bottomRef = useRef(null);

  // Ensure there's always an active session
  useEffect(() => {
    if (!activeId || !session) {
      createSession();
    }
  }, []);

  const sessionId = session?.id ?? activeId;
  const { sendMessage, loading } = useChat(sessionId);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, loading]);

  return (
    <div className="flex flex-col h-full">
      {/* Session toolbar */}
      {session && (
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-[var(--border)]"
          style={{ background: 'var(--surface-950)' }}>
          <span className="text-xs text-[var(--text-muted)] truncate flex-1">
            {session.title || 'Untitled Chat'}
          </span>
          <button onClick={() => clearSession(sessionId)}
            className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-rose-400 transition-colors px-2 py-1 rounded-lg hover:bg-[var(--surface-100)]">
            <Trash2 size={11} /> Clear
          </button>
          <button onClick={() => createSession()}
            className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--surface-100)]">
            <PlusSquare size={11} /> New
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto">
          {!session?.messages?.length ? (
            <ChatWelcome onPrompt={sendMessage} />
          ) : (
            <>
              {session.messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={sendMessage} loading={loading} disabled={!sessionId} />
    </div>
  );
}
