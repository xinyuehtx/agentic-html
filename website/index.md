---
layout: home

hero:
  name: Agentic HTML
  text: Preview · Annotate · Version · Patch
  tagline: An agent-native HTML editor. Circle a region or grab an element in the live preview, and any MCP agent turns your feedback into targeted, versioned edits.
  image:
    src: /screenshots/preview.png
    alt: Agentic HTML preview
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: Design Concepts
      link: /guide/concepts
    - theme: alt
      text: View on GitHub
      link: https://github.com/xinyuehtx/agentic-html

features:
  - icon: 🖼️
    title: Live HTML Preview
    details: Sandboxed iframe rendering with WebSocket hot reload — the preview updates the instant the agent patches the file.
  - icon: ✎
    title: Ink Annotation
    details: Freehand-circle any region. The app auto hit-tests the DOM underneath and captures a screenshot for the agent.
  - icon: ⊹
    title: Add Element to Chat
    details: VSCode-style element capture — hover to highlight, click to grab the selector, HTML and screenshot, add a note, send.
  - icon: 🌳
    title: Version Tree
    details: Every edit is an immutable version. Branch, diff, checkout, and seal — full traceability of the annotate→patch loop.
  - icon: 🔌
    title: Dual Gateway (MCP + CLI)
    details: One Core Service, two isomorphic gateways. Works with Claude Code, Cursor, Codex — or standalone from the command line.
  - icon: 🎯
    title: Targeted Patching
    details: DOM-level precision patches by CSS selector instead of full-page regeneration. Untouched regions stay untouched.
---

<div class="vp-doc" style="max-width:1152px;margin:0 auto;padding:0 24px">

## See it in action

<div class="shot">

![Add element to chat](/screenshots/annotation-sidebar.png)

</div>

Select mode highlights the element under your cursor, captures it on click, and
collects it in the sidebar — ready to send to the agent as structured context.

<div class="shot">

![Version graph](/screenshots/version-graph.png)

</div>

Every annotate → patch cycle produces a new immutable version. Browse the tree,
compare any two versions, and branch from any point.

</div>
