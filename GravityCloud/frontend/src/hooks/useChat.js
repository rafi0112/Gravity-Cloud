import { useState, useCallback } from 'react';
import { useChatStore } from '../context/chatStore';
import { askQuestion } from '../services/api';
import toast from 'react-hot-toast';

export function useChat(sessionId) {
  const [loading, setLoading] = useState(false);
  const { addMessage, updateLastAssistant, renameSession, sessions } = useChatStore();

  const sendMessage = useCallback(async (text) => {
    if (!sessionId || !text.trim()) return;

    // Add user message
    addMessage(sessionId, { role: 'user', content: text.trim() });

    // Auto-title session from first message
    const session = useChatStore.getState().sessions.find(s => s.id === sessionId);
    if (session && session.messages.length === 0) {
      renameSession(sessionId, text.slice(0, 40));
    }

    // Add placeholder assistant message
    addMessage(sessionId, { role: 'assistant', content: '' });
    setLoading(true);

    try {
      const res = await askQuestion(text.trim());
      const answer = typeof res.data === 'string' ? res.data : (res.data?.response ?? JSON.stringify(res.data));
      updateLastAssistant(sessionId, answer);
    } catch (err) {
      const msg = err?.response?.data?.detail ?? err.message ?? 'Request failed';
      updateLastAssistant(sessionId, `⚠️ Error: ${msg}`);
      toast.error('AI request failed');
    } finally {
      setLoading(false);
    }
  }, [sessionId, addMessage, updateLastAssistant, renameSession]);

  return { sendMessage, loading };
}
