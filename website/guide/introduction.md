# Introduction

**Agentic HTML** is an agent-native HTML editor. You preview a local HTML file,
give visual feedback directly on the rendered page — by freehand-circling a
region or grabbing a DOM element — and any MCP-compatible agent turns that
feedback into **targeted, versioned edits**. No switching apps, no copy-pasting
selectors.

## The problem

Coding agents are great at editing HTML, but the feedback loop is clumsy. You
render a page, then describe what's wrong in words: *"the hero heading — the
big one near the top — make it smaller and use the brand color."* The agent
guesses which element you mean. You iterate blindly.

Tools like Codex and Claude Code added in-browser annotation to close this gap,
but they are closed, vendor-specific, and keep no explicit version history of
the HTML itself.

## The idea

Bring the **annotation → patch → version** loop to *any* agent, through the open
Model Context Protocol — and make it usable from the command line too.

```
1. Preview index.html            → creates version v1
2. Circle a region / grab an element, add a comment
3. Send to agent                 → version v1 is sealed
4. Agent reads the structured feedback (selector + screenshot + comment)
5. Agent applies a targeted patch → creates version v1.1
6. Preview auto-refreshes         → iterate, branch, or compare
```

Every step is inspectable, reversible, and cross-agent.

## What makes it different

| | Agentic HTML | Codex | Claude Code |
|---|:---:|:---:|:---:|
| Explicit version tree (v1 → v1.1 → v1.1.1) | ✅ | ❌ | ❌ |
| Cross-agent via MCP | ✅ | ❌ | ❌ |
| CLI / scriptable | ✅ | ❌ | ❌ |
| Annotation bound to a version | ✅ | ❌ | ❌ |
| Ink annotation + screenshot | ✅ | ✅ | ⚠️ |
| Add element to chat | ✅ | ✅ | ⚠️ |

## Next steps

- [Design Concepts](/guide/concepts) — the model behind annotations and versions
- [Architecture](/guide/architecture) — Core Service + dual gateway
- [Usage](/guide/usage) — CLI commands and MCP setup
- [Add Element to Chat](/guide/add-to-chat) — the VSCode-style capture flow
