import { useState, useCallback } from 'react';
import { isDemoMode, DEMO_VERSION_NODES, DEMO_VERSION_EDGES, DEMO_DIFF } from '../demoData';

// --- Types ---

export interface VersionNode {
  id: string;
  parentId: string | null;
  timestamp: string;
  annotationCount: number;
  sealed: boolean;
}

export interface VersionEdge {
  from: string;
  to: string;
}

export interface VersionDiff {
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  type: 'add' | 'remove' | 'context';
  content: string;
}

export interface UseVersionGraphReturn {
  nodes: VersionNode[];
  edges: VersionEdge[];
  currentId: string | null;
  selectedNodes: string[];
  loading: boolean;
  error: string | null;
  diff: VersionDiff | null;
  diffLoading: boolean;
  fetchHistory: (sessionId: string) => Promise<void>;
  checkoutVersion: (versionId: string, options?: { fork?: boolean }) => Promise<void>;
  compareVersions: (a: string, b: string) => Promise<void>;
  selectNode: (nodeId: string) => void;
  clearSelection: () => void;
  clearDiff: () => void;
}

/**
 * Hook for managing version graph data.
 * Communicates with backend API for version history, checkout, and comparison.
 */
export function useVersionGraph(): UseVersionGraphReturn {
  const [nodes, setNodes] = useState<VersionNode[]>([]);
  const [edges, setEdges] = useState<VersionEdge[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const fetchHistory = useCallback(async (_sessionId: string) => {
    if (isDemoMode()) {
      setNodes(DEMO_VERSION_NODES);
      setEdges(DEMO_VERSION_EDGES);
      setCurrentId(DEMO_VERSION_NODES[DEMO_VERSION_NODES.length - 1].id);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/versions/history?session_id=${encodeURIComponent(_sessionId)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch history: ${res.status}`);
      }
      const data = await res.json() as {
        nodes: VersionNode[];
        edges: VersionEdge[];
        currentId: string | null;
      };
      setNodes(data.nodes);
      setEdges(data.edges);
      setCurrentId(data.currentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkoutVersion = useCallback(async (versionId: string, options?: { fork?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/versions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId, ...options }),
      });
      if (!res.ok) {
        throw new Error(`Checkout failed: ${res.status}`);
      }
      const data = await res.json() as { newVersionId: string };
      setCurrentId(data.newVersionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const compareVersions = useCallback(async (a: string, b: string) => {
    if (isDemoMode()) {
      setDiff(DEMO_DIFF);
      return;
    }
    setDiffLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/versions/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`
      );
      if (!res.ok) {
        throw new Error(`Compare failed: ${res.status}`);
      }
      const data = await res.json() as VersionDiff;
      setDiff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setDiffLoading(false);
    }
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodes(prev => {
      if (prev.includes(nodeId)) {
        return prev.filter(id => id !== nodeId);
      }
      // Max 2 selected for comparison
      if (prev.length >= 2) {
        return [prev[1], nodeId];
      }
      return [...prev, nodeId];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodes([]);
  }, []);

  const clearDiff = useCallback(() => {
    setDiff(null);
  }, []);

  return {
    nodes,
    edges,
    currentId,
    selectedNodes,
    loading,
    error,
    diff,
    diffLoading,
    fetchHistory,
    checkoutVersion,
    compareVersions,
    selectNode,
    clearSelection,
    clearDiff,
  };
}
