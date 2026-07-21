import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppState } from '../hooks/useAppState';
import { VersionNode, UseVersionGraphReturn } from '../hooks/useVersionGraph';

interface VersionGraphProps {
  sessionId: string | null;
  versionGraph: UseVersionGraphReturn;
}

/**
 * VersionGraph - tree visualization panel showing version history.
 * Supports node selection for checkout and comparison.
 */
export function VersionGraph({ sessionId, versionGraph }: VersionGraphProps) {
  const { versionGraphOpen, setVersionGraphOpen } = useAppState();
  const {
    nodes,
    currentId,
    selectedNodes,
    loading,
    error,
    fetchHistory,
    checkoutVersion,
    compareVersions,
    selectNode,
    clearSelection,
  } = versionGraph;

  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });

  // Fetch history when panel opens
  useEffect(() => {
    if (versionGraphOpen && sessionId) {
      fetchHistory(sessionId);
    }
  }, [versionGraphOpen, sessionId, fetchHistory]);

  // Handle node click
  const handleNodeClick = useCallback((node: VersionNode, e: React.MouseEvent) => {
    if (e.shiftKey) {
      // Shift+click for selection (compare mode)
      selectNode(node.id);
    } else {
      // Normal click → checkout
      checkoutVersion(node.id);
    }
  }, [selectNode, checkoutVersion]);

  // Handle compare
  const handleCompare = useCallback(() => {
    if (selectedNodes.length === 2) {
      compareVersions(selectedNodes[0], selectedNodes[1]);
    }
  }, [selectedNodes, compareVersions]);

  // Drag to scroll
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setScrollStart({
        x: canvasRef.current?.scrollLeft ?? 0,
        y: canvasRef.current?.scrollTop ?? 0,
      });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    canvasRef.current.scrollLeft = scrollStart.x - dx;
    canvasRef.current.scrollTop = scrollStart.y - dy;
  }, [isDragging, dragStart, scrollStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Build tree structure (root nodes first, children below parents)
  const sortedNodes = buildTree(nodes);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className={`version-graph-panel ${!versionGraphOpen ? 'version-graph-panel--hidden' : ''}`}>
      <div className="version-graph-panel__header">
        <span className="version-graph-panel__title">Version History</span>
        <button
          className="version-graph-panel__close"
          onClick={() => setVersionGraphOpen(false)}
          aria-label="Close version panel"
        >
          ✕
        </button>
      </div>

      {loading && (
        <div className="version-graph-panel__loading">Loading versions...</div>
      )}

      {error && (
        <div className="version-graph-panel__error">{error}</div>
      )}

      <div
        ref={canvasRef}
        className={`version-graph-panel__canvas ${isDragging ? 'version-graph-panel__canvas--dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {sortedNodes.map((node, idx) => {
          const isCurrent = node.id === currentId;
          const isSelected = selectedNodes.includes(node.id);
          const hasChild = idx < sortedNodes.length - 1;

          return (
            <div
              key={node.id}
              className={`version-node ${isCurrent ? 'version-node--current' : ''} ${isSelected ? 'version-node--selected' : ''}`}
              onClick={(e) => handleNodeClick(node, e)}
              title={`Click to checkout, Shift+Click to select for compare`}
            >
              <div className="version-node__dot" />
              {hasChild && <div className="version-node__connector" />}
              <div className="version-node__info">
                <div className="version-node__id">
                  {node.id.slice(0, 8)}
                  {isCurrent && ' (current)'}
                </div>
                <div className="version-node__meta">
                  <span>{formatTime(node.timestamp)}</span>
                  {node.sealed && <span className="version-node__sealed">🔒 sealed</span>}
                  {node.annotationCount > 0 && (
                    <span className="version-node__annotations">
                      {node.annotationCount} annotation{node.annotationCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compare bar */}
      {selectedNodes.length > 0 && (
        <div className="version-graph-panel__compare-bar">
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {selectedNodes.length}/2 selected
          </span>
          <button
            className="version-graph-panel__compare-btn"
            onClick={handleCompare}
            disabled={selectedNodes.length !== 2}
          >
            Compare
          </button>
          <button
            className="version-graph-panel__clear-btn"
            onClick={clearSelection}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

/** Build a simple tree ordering: parents before children */
function buildTree(nodes: VersionNode[]): VersionNode[] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map<string, VersionNode>();
  const childrenMap = new Map<string | null, VersionNode[]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    const siblings = childrenMap.get(node.parentId) ?? [];
    siblings.push(node);
    childrenMap.set(node.parentId, siblings);
  }

  const result: VersionNode[] = [];
  const roots = childrenMap.get(null) ?? [];

  function traverse(node: VersionNode) {
    result.push(node);
    const children = childrenMap.get(node.id) ?? [];
    for (const child of children) {
      traverse(child);
    }
  }

  for (const root of roots) {
    traverse(root);
  }

  // Include any orphan nodes not in tree
  if (result.length < nodes.length) {
    for (const node of nodes) {
      if (!result.includes(node)) {
        result.push(node);
      }
    }
  }

  return result;
}
