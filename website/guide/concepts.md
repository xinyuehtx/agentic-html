# Design Concepts

The design distills a few ideas from the project RFC. Understanding them makes
the whole workflow click.

## One annotation model: element + comment

Ink circling and element clicking feel different, but they produce the **same
thing**: an annotation anchored to a DOM node, plus a comment. The selection
method only differs in what *extra* data it carries.

| Selection | Extra data | Visual |
|-----------|-----------|--------|
| **Click an element** | — | anchor marker + comment |
| **Freehand circle** | screenshot, hit-tested elements | anchor marker + hover screenshot + DOM highlight |

Because a version's HTML is an immutable snapshot, a CSS selector captured
against it stays valid forever — no fragile fallback matching needed.

```ts
interface Annotation {
  id: string;
  anchor_element: { selector: string };   // valid for the life of the version
  screenshot?: string;                     // ink captures include one
  hit_elements?: HitElement[];             // elements under the circle
  comment: string;                         // your intent
  status: 'pending' | 'resolved';
  version_id: string;                      // annotations belong to a version
}
```

## Versions are immutable, and seal on send

- A new version starts **unsealed** — you can add, edit, and delete annotations.
- When you **send to the agent**, the version **seals**: it and its annotations
  become a permanent, read-only historical record.
- The agent's patch produces a **new unsealed** child version, and the loop
  continues.

Version numbers form a tree: `v1 → v1.1 / v1.2`, `v1.1 → v1.1.1`. You can
checkout any node to branch a new line of iteration.

```
v1.0 (sealed)
 ├─ v1.1 (unsealed) — 3 annotations
 │   ├─ v1.1.1 (sealed)
 │   └─ v1.1.2 (working)
 └─ v1.2 (sealed) — 2 annotations
```

## Isomorphic gateways

All business logic lives in one **Core Service** layer. The **MCP Gateway** and
**CLI Gateway** are thin wrappers over it — every MCP tool has an equivalent CLI
command and vice-versa. They differ only in *how* they're invoked and how
feedback reaches the agent:

- **MCP** — the page's *Send to Agent* button pushes annotations to the agent
  via an MCP notification.
- **CLI** — annotations are written to `.html-editor/annotations/{version}.json`
  for the agent (or a script) to read.

## Minimal, targeted patching

The agent doesn't regenerate the page. It emits precise `Patch` operations
(`replace` / `delete` / `insert_before` / `insert_after` / `modify_style`)
against selectors, so unannotated regions stay byte-for-byte unchanged.

```ts
interface Patch {
  annotation_id: string;
  selector: string;
  action: 'replace' | 'delete' | 'insert_before' | 'insert_after' | 'modify_style';
  content?: string;
  old_content?: string; // optional guard against drift
}
```

## Structured feedback the agent can act on

When you send, the agent receives a compact, structured brief — anchor selector,
comment, optional screenshot, and hit-tested elements — so it can locate and
change exactly what you meant:

```md
## User annotation feedback (v1.1)

### [1] div.hero > h1
Comment: Make the heading smaller, use the brand color #1a73e8

### [2] div.hero
Hit elements: div.hero > h1, div.hero > p.subtitle
Screenshot: [attached]
Comment: This area is too cramped — add spacing between title and subtitle
```
