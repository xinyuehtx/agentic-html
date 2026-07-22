---
title: Showcase
---

# Showcase

A tour of the redesigned, adaptive (dark-default) interface.

## Live preview

The sandboxed preview with the annotation sidebar. Dark is the default; a toggle
switches to light — both are driven by the same design-token system.

<div class="vp-doc shot">

![Preview](/screenshots/preview.png)

</div>

## Ink annotation

Freehand-circle a region; the app captures a screenshot and hit-tests the DOM
underneath, adding an `✎ Ink` card to the sidebar.

<div class="vp-doc shot">

![Ink annotation](/screenshots/annotation-ink.png)

</div>

## Add element to chat

Hover to highlight, click to capture, compose a note — the element joins the
sidebar as structured context for the agent.

<div class="vp-doc shot">

![Annotation sidebar](/screenshots/annotation-sidebar.png)

</div>

## Version graph

Every annotate → patch cycle is a new immutable version. Browse the tree, see
sealed states and annotation counts, and checkout any node.

<div class="vp-doc shot">

![Version graph](/screenshots/version-graph.png)

</div>

## Version diff

Compare any two versions with an inline, syntax-colored diff.

<div class="vp-doc shot">

![Version diff](/screenshots/version-diff.png)

</div>

## HTML error feedback

When the source HTML fails to parse, the preview shows a structured error banner
with a one-click *Feedback to Agent* action.

<div class="vp-doc shot">

![HTML error feedback](/screenshots/html-error-feedback.png)

</div>
