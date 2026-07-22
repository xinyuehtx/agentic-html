# Add Element to Chat

Inspired by the VSCode built-in browser's *"add element to chat"*, this is the
fastest way to hand a specific element to your agent — no typing selectors, no
guessing.

## The flow

1. **Enter Select mode** — press <kbd>3</kbd> or click **Select** in the toolbar.
2. **Hover** — the element under your cursor outlines in cyan with a label chip
   showing its tag and selector (like browser devtools).
3. **Click** — the element is captured: its CSS selector, tag, an `outerHTML`
   summary, its bounding rect, and a screenshot of just that element.
4. **Compose** — an inline popover appears. Add an optional note for the agent
   (<kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> to add, <kbd>Esc</kbd> to cancel).
5. **Collect** — the element lands in the sidebar as a card with an `⊹ Element`
   badge, its selector, your note, and a screenshot thumbnail.
6. **Send** — **Submit Annotations** pushes everything to the agent (MCP
   notification) or writes it to the project directory (CLI).

<div class="vp-doc shot">

![Add element to chat — captured element in the sidebar](/screenshots/annotation-sidebar.png)

</div>

## What the agent receives

Each captured element becomes a structured annotation:

```json
{
  "source": "element",
  "anchor_element": { "selector": "body > section.hero > h1" },
  "comment": "Make this headline smaller and use the brand color",
  "screenshot": "data:image/jpeg;base64,…",
  "hit_elements": [
    {
      "selector": "body > section.hero > h1",
      "tag": "h1",
      "outerHtmlSummary": "<h1>ProductX — …</h1>",
      "boundingRect": { "x": 188, "y": 152, "width": 500, "height": 58 }
    }
  ]
}
```

The agent has everything it needs to locate the element and make a precise,
minimal change — then it produces a new version and the preview refreshes.

## Ink vs. Select

Both create annotations; pick whichever fits:

- **Select** (this flow) — one precise element. Great for "change this button".
- **Ink** — freehand-circle a whole area. The app hit-tests every element under
  the circle and screenshots the region. Great for "this section is too cramped".

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> | Browse / Ink / Select |
| <kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> | Submit annotations |
| <kbd>⌘/Ctrl</kbd>+<kbd>A</kbd> | Select all annotations |
| <kbd>Del</kbd> | Delete selected |
| <kbd>Esc</kbd> | Cancel / back to Browse |
