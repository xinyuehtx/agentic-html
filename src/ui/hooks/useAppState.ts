import { createContext, useContext, useReducer, useCallback, useMemo, ReactNode, createElement } from 'react';

// --- Types ---

export type AppMode = 'browse' | 'ink' | 'select';
export type AppPhase = 'idle' | 'previewing' | 'annotating' | 'submitting';

export interface AppStateValue {
  mode: AppMode;
  phase: AppPhase;
  versionGraphOpen: boolean;
  hasHtmlErrors: boolean;
  currentVersionId: string | null;
  sealed: boolean;
}

export interface AppStateActions {
  setMode: (mode: AppMode) => void;
  startPreviewing: () => void;
  startSubmitting: () => void;
  finishSubmitting: () => void;
  setVersionGraphOpen: (open: boolean) => void;
  toggleVersionGraph: () => void;
  setHasHtmlErrors: (hasErrors: boolean) => void;
  setCurrentVersion: (versionId: string | null, sealed?: boolean) => void;
}

export type AppContextValue = AppStateValue & AppStateActions;

// --- Reducer ---

type AppAction =
  | { type: 'SET_MODE'; mode: AppMode }
  | { type: 'START_PREVIEWING' }
  | { type: 'START_SUBMITTING' }
  | { type: 'FINISH_SUBMITTING' }
  | { type: 'SET_VERSION_GRAPH_OPEN'; open: boolean }
  | { type: 'TOGGLE_VERSION_GRAPH' }
  | { type: 'SET_HTML_ERRORS'; hasErrors: boolean }
  | { type: 'SET_CURRENT_VERSION'; versionId: string | null; sealed: boolean };

const initialState: AppStateValue = {
  mode: 'browse',
  phase: 'idle',
  versionGraphOpen: false,
  hasHtmlErrors: false,
  currentVersionId: null,
  sealed: false,
};

function appReducer(state: AppStateValue, action: AppAction): AppStateValue {
  switch (action.type) {
    case 'SET_MODE': {
      const newMode = action.mode;
      let newPhase = state.phase;

      // State transitions based on mode change
      if (state.phase === 'previewing' && (newMode === 'ink' || newMode === 'select')) {
        newPhase = 'annotating';
      } else if (state.phase === 'annotating' && newMode === 'browse') {
        newPhase = 'previewing';
      }

      // Cannot change mode while submitting
      if (state.phase === 'submitting') {
        return state;
      }

      return { ...state, mode: newMode, phase: newPhase };
    }

    case 'START_PREVIEWING':
      if (state.phase === 'idle') {
        return { ...state, phase: 'previewing' };
      }
      return state;

    case 'START_SUBMITTING':
      if (state.phase === 'previewing' || state.phase === 'annotating') {
        return { ...state, phase: 'submitting', mode: 'browse' };
      }
      return state;

    case 'FINISH_SUBMITTING':
      if (state.phase === 'submitting') {
        return { ...state, phase: 'previewing' };
      }
      return state;

    case 'SET_VERSION_GRAPH_OPEN':
      return { ...state, versionGraphOpen: action.open };

    case 'TOGGLE_VERSION_GRAPH':
      return { ...state, versionGraphOpen: !state.versionGraphOpen };

    case 'SET_HTML_ERRORS':
      return { ...state, hasHtmlErrors: action.hasErrors };

    case 'SET_CURRENT_VERSION':
      return { ...state, currentVersionId: action.versionId, sealed: action.sealed };

    default:
      return state;
  }
}

// --- Context ---

const AppStateContext = createContext<AppContextValue | null>(null);

export function useAppState(): AppContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return ctx;
}

// --- Provider ---

export interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setMode = useCallback((mode: AppMode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);

  const startPreviewing = useCallback(() => {
    dispatch({ type: 'START_PREVIEWING' });
  }, []);

  const startSubmitting = useCallback(() => {
    dispatch({ type: 'START_SUBMITTING' });
  }, []);

  const finishSubmitting = useCallback(() => {
    dispatch({ type: 'FINISH_SUBMITTING' });
  }, []);

  const setVersionGraphOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_VERSION_GRAPH_OPEN', open });
  }, []);

  const toggleVersionGraph = useCallback(() => {
    dispatch({ type: 'TOGGLE_VERSION_GRAPH' });
  }, []);

  const setHasHtmlErrors = useCallback((hasErrors: boolean) => {
    dispatch({ type: 'SET_HTML_ERRORS', hasErrors });
  }, []);

  const setCurrentVersion = useCallback((versionId: string | null, sealed = false) => {
    dispatch({ type: 'SET_CURRENT_VERSION', versionId, sealed });
  }, []);

  const value: AppContextValue = useMemo(() => ({
    ...state,
    setMode,
    startPreviewing,
    startSubmitting,
    finishSubmitting,
    setVersionGraphOpen,
    toggleVersionGraph,
    setHasHtmlErrors,
    setCurrentVersion,
  }), [state, setMode, startPreviewing, startSubmitting, finishSubmitting, setVersionGraphOpen, toggleVersionGraph, setHasHtmlErrors, setCurrentVersion]);

  return createElement(AppStateContext.Provider, { value }, children);
}
