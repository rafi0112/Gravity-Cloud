import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export const useDocStore = create(
  persist(
    (set) => ({
      docs: [],

      addDoc: (doc) => {
        set(st => ({ docs: [{ id: newId(), uploadedAt: Date.now(), ...doc }, ...st.docs] }));
      },

      removeDoc: (id) => {
        set(st => ({ docs: st.docs.filter(d => d.id !== id) }));
      },

      clearDocs: () => set({ docs: [] }),
    }),
    { name: 'nc-docs' }
  )
);
