import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ACCENTS = ['blue', 'purple', 'emerald', 'rose', 'orange'];

export const useThemeStore = create(
  persist(
    (set, get) => ({
      dark: true,
      accent: 'blue',

      toggleDark: () => {
        const next = !get().dark;
        set({ dark: next });
        document.documentElement.classList.toggle('dark', next);
      },

      setAccent: (accent) => {
        if (!ACCENTS.includes(accent)) return;
        set({ accent });
        document.documentElement.setAttribute('data-accent', accent);
      },

      init: () => {
        const { dark, accent } = get();
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.setAttribute('data-accent', accent);
      },
    }),
    { name: 'nc-theme' }
  )
);

export { ACCENTS };
