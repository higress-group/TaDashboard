# Requirements Document

## Introduction

This feature upgrades the TaDashboard Agent management and Matrix chat
experience along two axes:

1. **Chat UX upgrade** — surface typing indicators, expand rich-content
   rendering (Markdown / HTML / A2UI), and tighten the feedback loop
   between Human and Worker / Manager agents.
2. **Agent management modernization** — investigate the 2025-2026 agent
   industry trajectory (A2A, MCP, A2UI, Mission Control dashboards,
   agent observability) and align TaDashboard's Worker / Team / Manager
   sections with the resulting patterns so the dashboard stays relevant
   as the ecosystem evolves.

Scope is limited to the dashboard frontend plus the local Next.js
proxy routes. The HiClaw Controller's REST surface is treated as the
authority; the dashboard consumes whatever the Controller exposes.

The feature ships behind a per-browser `modernChatEnabled` flag that
defaults to **enabled**. The Settings dialog surfaces a Kill Switch
that reverts to the legacy rendering while the modern renderer is
being validated.

## Glossary

- **System** — the TaDashboard Next.js application (frontend + BFF
  proxy routes under `/api/hiclaw/*` and `/api/matrix/*`).
- **Controller** — the HiClaw Controller that owns authoritative Worker,
  Team, Human, Manager, and Gateway Consumer state.
- **Homeserver** — the Matrix homeserver reached via the Matrix
  Client-Server API.
- **Agent** — a Worker or Manager instance managed by the Controller.
  Workers execute a single runtime; Managers coordinate across Teams.
- **Human** — a human collaborator surfaced through the Controller
  with a Matrix user id.
- **A2UI** — Google's Agent-to-User Interface declarative JSON format
  for rendering structured UI surfaces emitted by an Agent.
- **AG-UI** — CopilotKit's open Agent-User Interaction protocol (SSE /
  WebSocket event stream that synchronizes Agent state with a frontend).
- **A2A** — Agent-to-Agent protocol (Google / Linux Foundation) for
  cross-vendor Agent discovery and task delegation.
- **MCP** — Model Context Protocol, the standard way an Agent calls
  tools and external data.
- **Mission Control** — the visual idiom of a grid of live Agent
  cards with status badges, phase indicators, and one-click
  intervention controls (referenced by Modal Lab, Replicate, Cursor 3.0).
- **Activity Feed** — a chronological SSE / polling stream of recent
  state-change events (Worker wake, Audit write, Infrastructure
  flip, Matrix message arrival).
- **Typing Indicator** — a Matrix `m.typing` ephemeral event surfaced
  as "Alice is typing…" beside the chat input.
- **Rich Content** — any Matrix message body that is not plain text:
  `format: "org.matrix.custom.html"` Markdown / HTML, A2UI JSON,
  or AG-UI event payload.

## Requirements

### Requirement 1 — Typing Indicator

**User Story:** AS a dashboard operator chatting with a Worker or
Manager in a Matrix room, I want to see when the agent is composing
a response, so that I know the conversation is alive and roughly how
long to wait.

#### Acceptance Criteria

1. WHILE the local user has a non-empty draft in the chat input of a
   selected room, the System SHALL publish a Matrix `m.typing` event
   with `timeout: 30000` to that room at most every 4 seconds and
   SHALL stop publishing within 1 second after the input becomes
   empty or the user switches rooms.
2. WHEN the System receives an `m.typing` event in the currently
   selected room, the System SHALL render a typing row directly
   above the chat input that names the sender and displays three
   animated dots within 500 ms of the event arriving.
3. WHEN an `m.typing` event older than 6 seconds is observed in
   client memory without a follow-up event, the System SHALL remove
   the corresponding sender from the typing row.
4. IF the Matrix homeserver is unreachable while the user is typing,
   the System SHALL swallow the publish error and SHALL keep the
   input usable without surfacing the failure as a toast.

### Requirement 2 — Rich Content Rendering

**User Story:** AS a dashboard operator, I want chat messages to
render Markdown, sanitized HTML, A2UI surfaces, and AG-UI events
correctly, so that I can interact with what Agents produce instead
of reading raw JSON.

#### Acceptance Criteria

1. WHEN a Matrix message arrives with `format: "org.matrix.custom.html"`
   and a `formatted_body`, the System SHALL sanitize the HTML by
   retaining only the elements and attributes on a documented
   allow-list (text-formatting tags, hyperlinks to allow-listed hosts,
   and code blocks), apply Tailwind prose styling, and render the
   result inside the message bubble.
2. WHEN a message body contains Markdown that the Controller did not
   pre-format, the System SHALL render fenced code blocks with a
   monospaced background, inline code with a subtle background, and
   preserve line breaks through `whitespace-pre-wrap`.
3. IF sanitization removes any element or attribute, the System SHALL
   still display the surviving content; the System SHALL NOT raise a
   blocking error.
4. WHEN a message contains an `a2ui` JSON payload (a `body.a2ui` or
   `content.a2ui` object following the A2UI v0.9 schema), the System
   SHALL route that payload through the A2UI renderer and render the
   described surface instead of the raw JSON.
5. WHEN the System receives an AG-UI event over SSE / WebSocket for
   the selected room, the System SHALL reconcile the event into the
   message list (state snapshot, tool call, message chunk, done) and
   SHALL render the resulting UI accordingly.

### Requirement 3 — A2UI Renderer

**User Story:** AS a dashboard operator, I want Agents that emit A2UI
JSON to render as structured cards, forms, and confirmations inside
the chat, so that I can respond inline rather than switching tools.

#### Acceptance Criteria

1. WHEN an A2UI root document arrives, the System SHALL render the
   described component tree (text, image, button, text-input, form,
   column / row layout, card) using the project's existing shadcn /
   Radix primitives.
2. WHEN an A2UI `button` carries an `action` of `submit`, the System
   SHALL collect sibling field values, post the action payload to the
   Controller via `/api/hiclaw/proxy-helper`, and SHALL replace the
   rendered surface with the action result.
3. WHEN an A2UI surface references a data URL or remote image, the
   System SHALL validate the URL against the existing proxy allow-list
   (`isAllowedMatrixHost` and friends) before fetching.
4. IF an A2UI document references an unknown component type, the
   System SHALL render a fallback "Unsupported A2UI component" badge
   with the component name instead of crashing.

### Requirement 4 — Agent Industry Trend Alignment (all sections)

**User Story:** AS a TaDashboard maintainer, I want every dashboard
section to follow the visual and interaction patterns the wider
Agent ecosystem converged on in 2025-2026, so that the product reads
as one coherent operator console rather than a collection of
inconsistent prototypes.

#### Acceptance Criteria

1. The System SHALL document, in `.monkeycode/docs/专有概念/`, a
   survey note that lists the 5-8 most relevant industry trends
   (A2A, MCP, A2UI, Mission Control dashboards, agent observability,
   modern Dashboard visual idiom) with one-sentence rationale and a
   citation link.
2. WHEN the operator opens any of the 13 section views (Overview,
   Workers, Teams, Humans, Managers, Chat, Infrastructure, k8s,
   Skills, Architecture, Security, Runtime, Quickstart), the System
   SHALL render the section using the modern Dashboard visual idiom:
   dark-first surface, glass cards with rounded-2xl corners, gradient
   hairline borders, and a consistent header / sidebar / content
   scaffolding shared across sections.
3. WHEN the operator opens the Worker or Manager section, the System
   SHALL surface a "Mission Control" view: a responsive grid of live
   agent cards with phase dot, runtime badge, last-activity timestamp,
   and inline wake / sleep / ensure-ready / open-chat buttons.
4. WHEN the operator opens the Infrastructure section, the System
   SHALL render the component health graph using a node-and-edge
   layout (xyflow / React Flow) instead of the current vertical list,
   so that the Controller → Higress → Matrix → MinIO → k8s API
   dependency chain is visible at a glance.
5. WHEN the operator opens the Teams, Humans, Overview, or k8s
   section, the System SHALL use the same card grid idiom and shared
   chrome as the Worker and Manager sections so that navigation
   between sections reads as one product.
6. WHEN any state-change event lands in the audit log or Matrix
   room, the System SHALL append a one-line entry to a top-bar
   Activity Feed (last 20 entries, newest on top, click-to-navigate
   to the source section).
7. WHEN the operator expands a Worker card, the System SHALL expose
   the Agent's current run summary, last tool calls, and a "Trace"
   link to the Controller's log endpoint when the Controller exposes
   one.
8. IF a section does not yet ship the modern chrome, the System
   SHALL fall back to the legacy chrome for that section only while
   still using the modern chrome on every other section, and the
   System SHALL record that fallback in the survey note so the gap
   is visible to maintainers.

### Requirement 5 — Skill and Subagent Surfacing

**User Story:** AS a dashboard operator, I want to see what Skills a
Worker has loaded and which Subagents a Manager coordinates, so that
I can reason about agent capability without leaving the dashboard.

#### Acceptance Criteria

1. WHEN the operator opens a Worker detail view, the System SHALL
   render a "Skills" panel that lists each Skill name, version, and
   short description returned by the Controller.
2. WHEN the operator opens a Manager detail view, the System SHALL
   render a "Coordinated Teams" panel that lists the Teams and
   Workers under coordination with their current phase, using the
   same grid card pattern as Requirement 4.
3. IF the Controller does not expose Skills or Subagent metadata in
   the current API, the System SHALL display a single muted line that
   reads "Skills endpoint not exposed by this Controller version"
   instead of omitting the panel.

### Requirement 6 — Live Activity Feed

**User Story:** AS a dashboard operator, I want a top-bar Activity
Feed so that I can audit recent changes without opening the Audit
section.

#### Acceptance Criteria

1. WHEN the System writes a new entry to `/api/audit`, the System
   SHALL append a derived row to the Activity Feed within 1 second,
   showing `actor`, `action`, `resource`, and `resourceId` plus a
   relative timestamp.
2. WHEN a new Matrix message arrives in any watched room, the System
   SHALL append a derived row to the Activity Feed identifying the
   sender, room short id, and message preview (≤ 60 characters).
3. WHEN the Activity Feed reaches 20 entries, the System SHALL drop
   the oldest entry and keep the feed bounded at 20.
4. IF the feed query fails, the System SHALL retain the previously
   cached entries and SHALL not blank the feed.

### Requirement 7 — Backward Compatibility

**User Story:** AS an operator who already relies on the current
chat and Worker sections, I want the upgrade to preserve existing
behavior unless I opt in.

#### Acceptance Criteria

1. WHILE the operator has not toggled the new "Modern chat" feature
   flag, the System SHALL keep the current plain-text and
   formatted-HTML rendering paths intact.
2. WHEN the operator toggles the feature flag on, the System SHALL
   switch the chat section to the new typing / A2UI / AG-UI renderer
   and SHALL remember the choice per browser.
3. IF the Controller returns a Worker or Manager without the new
   metadata fields, the System SHALL degrade gracefully to the current
   card layout.

## Out of Scope

- Building a full A2UI server-side renderer (we only consume A2UI
  payloads emitted by the Controller or by an Agent).
- Replacing Matrix as the chat transport.
- Changing the Prisma schema beyond what is required for the
  Activity Feed cache (if any).
- Implementing A2A or MCP endpoints inside the Controller.