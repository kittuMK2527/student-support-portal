import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser } from '@/types';

interface SessionState {
  user: PublicUser | null;
  ready: boolean;
  setUser: (u: PublicUser | null) => void;
  setReady: () => void;
}
export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: () => set({ ready: true }),
}));

interface UiState {
  guideOpen: boolean;
  setGuideOpen: (v: boolean) => void;
}
export const useUi = create<UiState>()(
  persist((set) => ({ guideOpen: false, setGuideOpen: (guideOpen) => set({ guideOpen }) }), {
    name: 'support-portal.ui.v2',
  }),
);
