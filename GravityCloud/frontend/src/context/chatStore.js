import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function newSession(title = 'New Chat') {
  return { id: newId(), title, messages: [], createdAt: Date.now() };
}

export const useChatStore = create(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,

      // Derived
      active: () => get().sessions.find(s => s.id === get().activeId) ?? null,

      createSession: () => {
        const s = newSession();
        set(st => ({ sessions: [s, ...st.sessions], activeId: s.id }));
        return s.id;
      },

      setActive: (id) => set({ activeId: id }),

      deleteSession: (id) => {
        set(st => {
          const sessions = st.sessions.filter(s => s.id !== id);
          const activeId = st.activeId === id ? (sessions[0]?.id ?? null) : st.activeId;
          return { sessions, activeId };
        });
      },

      renameSession: (id, title) => {
        set(st => ({
          sessions: st.sessions.map(s => s.id === id ? { ...s, title } : s)
        }));
      },

      addMessage: (sessionId, msg) => {
        set(st => ({
          sessions: st.sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, { id: newId(), ...msg, ts: Date.now() }] }
              : s
          )
        }));
      },

      updateLastAssistant: (sessionId, content) => {
        set(st => ({
          sessions: st.sessions.map(s => {
            if (s.id !== sessionId) return s;
            const msgs = [...s.messages];
            const lastIdx = msgs.findLastIndex(m => m.role === 'assistant');
            if (lastIdx === -1) return s;
            msgs[lastIdx] = { ...msgs[lastIdx], content };
            return { ...s, messages: msgs };
          })
        }));
      },

      clearSession: (id) => {
        set(st => ({
          sessions: st.sessions.map(s => s.id === id ? { ...s, messages: [] } : s)
        }));
      },
    }),
    { name: 'nc-chat' }
  )
);
