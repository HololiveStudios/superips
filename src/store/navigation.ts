import { create } from 'zustand';

export type Page =
  | 'dashboard'
  | 'devices'
  | 'printers'
  | 'routers'
  | 'boxes'
  | 'tasks'
  | 'settings'
  | 'switches'
  | 'sheet'
  | 'scales'
  | 'room';

interface NavigationState {
  currentPage: Page;
  setPage: (page: Page) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentPage: (localStorage.getItem('currentPage') as Page) || 'dashboard',
  setPage: (page: Page) => {
    localStorage.setItem('currentPage', page);
    set({ currentPage: page });
  },
}));
