# Hermes Agent OS — Enhancement Roadmap

This roadmap is intentionally incremental. Each phase should be implemented, reviewed, and validated before the next phase starts. Keep `main` untouched until the pull request is reviewed.

## Guardrails

- Hermes remains the cognition/runtime layer; the GUI is the control surface, not a second agent.
- Show observed state, not optimistic guesses. Distinguish a request being accepted, a process being spawned, and a service actually responding.
- Keep privileged actions behind server-side validation. Never turn natural-language input into arbitrary shell execution.
- Prefer read-only diagnostics first. Never log conversation bodies, microphone audio, API keys, or other secrets.
- Every phase needs tests where practical, `npm run typecheck`, `npm run lint`, and `npm run build`; platform-specific behavior must be marked unverified until tested on the target machine.

## Phase 0 — Baseline and reliable app launching

- [x] Unified Windows/Kali app discovery and registered-app launching.
- [x] Route text and voice app-launch requests through the same safe launcher.
- [x] Add unit/security tests and CI checks.
- [x] CI validation passes for the current branch commit.
- [ ] Manually validate app discovery and launch on the user's Windows + Kali WSL/WSLg setup.

## Phase 1 — Truthful system-health overview

- [ ] Create a read-only health model for Studio/API, Hermes Gateway, WSL runtime, God's Eye, app discovery, and configured voice providers.
- [ ] Give every check explicit `online`, `offline`, `degraded`, or `unknown` state, with a timestamp and useful non-sensitive reason.
- [ ] Add a compact health overview with manual refresh and restrained polling; no fabricated default percentages or success states.
- [ ] Test timeout, unavailable-service, malformed-response, and local-request rejection paths.

## Phase 2 — Secure action and permission model

- [ ] Classify actions as read-only, routine/reversible, sensitive, or destructive.
- [ ] Enforce authorization and validation server-side, not only in UI controls.
- [ ] Require explicit confirmation for sensitive/destructive actions; provide a cancel path and explain the target.
- [ ] Add tests proving blocked requests cannot reach execution handlers.

## Phase 3 — Universal launcher and keyboard navigation

- [ ] Make the existing command palette a consistent global launcher for apps, views, sessions, and safe actions.
- [ ] Add/verify `Ctrl+K`, `Ctrl+N`, `Ctrl+Shift+V`, `Ctrl+,`, and `Esc` behavior without hijacking text-entry shortcuts.
- [ ] Add keyboard focus management, visible shortcut hints, and accessibility labels.

## Phase 4 — Honest execution timeline

- [ ] Record task lifecycle events: requested, validated, started, completed, failed, or cancelled.
- [ ] Include timestamps, target, duration, and concise result/error details.
- [ ] Never mark a task successful merely because a process was spawned.
- [ ] Keep logs local and redact secrets and conversation/audio payloads.

## Phase 5 — Voice interaction state machine

- [ ] Expose idle, listening, transcribing, reviewing, interpreting, awaiting-confirmation, executing, speaking, and error states where applicable.
- [ ] Show editable transcription before execution when configured for approval.
- [ ] Add interruption/cancel behavior, microphone/output selection where supported, and clear provider status.
- [ ] Clearly label local versus cloud processing and microphone-active state.

## Phase 6 — Integration and diagnostics manager

- [ ] Consolidate health/config/version details for Hermes, WSL, voice providers, God's Eye, and Windows bridge.
- [ ] Offer safe retry/restart/open-settings actions only where supported.
- [ ] Separate detection from remediation; explain changes before applying them.
- [ ] Avoid duplicate agent reasoning or duplicate ownership of Hermes state.

## Phase 7 — Visual refinement and accessibility

- [ ] Preserve the dark/cyan visual identity while improving hierarchy, spacing, responsive layout, and restrained glass effects.
- [ ] Respect reduced-motion preferences and provide readable focus states and contrast.
- [ ] Ensure dialogs, drawers, and command palette work at smaller window sizes and with keyboard navigation.

## Phase 8 — Persistent workspace

- [ ] Provide searchable/recent sessions, pinned apps/resources, and task history using explicit persistence.
- [ ] Make stored context visible and controllable; don't imply the GUI remembers information it hasn't saved.
- [ ] Keep app preferences and history scoped to the current profile unless a deliberate sync mechanism is introduced.

## Phase 9 — Customizable layouts and HUD widgets

- [ ] Add optional, user-controlled panels for system health, current task, voice, and pinned resources.
- [ ] Persist layout preferences and provide a reset-to-default action.
- [ ] Keep the default layout useful and lightweight; no decorative widgets that imply nonexistent capabilities.

## Completion criteria

A phase is complete only when its implementation, tests, documentation, and CI status are reviewed. Windows/WSL/WSLg and microphone behavior remain pending until manually verified on the target machine. Keep this checklist updated as work progresses.
