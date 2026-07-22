import type { HoveredElement } from '../hooks/useElementCapture';

export interface ElementHighlightProps {
  hovered: HoveredElement | null;
}

/**
 * ElementHighlight — floating label chip shown above the element currently
 * hovered in select ("add element to chat") mode. The element's own outline is
 * drawn directly on the iframe node; this renders the tag/selector chip in the
 * overlay layer (which shares the iframe's coordinate space).
 */
export function ElementHighlight({ hovered }: ElementHighlightProps) {
  if (!hovered) return null;
  const { rect, label } = hovered;
  const top = Math.max(rect.y - 24, 2);
  return (
    <div
      className="element-highlight__label"
      style={{ position: 'absolute', left: Math.max(rect.x, 2), top }}
    >
      {label}
    </div>
  );
}
