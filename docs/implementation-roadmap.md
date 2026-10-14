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

- [x] Add a read-only health endpoint for Studio/API, Hermes Gateway, WSL runtime, God's Eye, Kali app discovery, Wispr Flow, and Sarvam configuration.
- [x] Give checks explicit `online`, `offline`, `degraded`, or `unknown` state, timestamps, and non-sensitive explanations.
- [x] Add a System Command Center overlay with manual refresh and 30-second polling while open; no fabricated health percentages.
- [ ] Add automated route tests for timeout, unavailable-service, malformed-response, and local-request rejection paths.
- [ ] Validate health results on the actual Windows + Kali WSL2 machine before calling the phase complete.

## Phase 2 — Secure action and permission model

- [x] Add a central action-risk registry for read-only, routine, sensitive, and destructive action classes; unknown actions fail closed.
- [ ] Extend server-side policy enforcement to every mutating API (gateway actions, system optimization, auto-setup, daemon restart, and raw config/SOUL writes are now gated; remaining actions still need a complete audit).
- [x] Require exact-action confirmation for sensitive gateway stop/restart and system optimization, with a client cancel path and target-impact explanation.
- [x] Add policy tests proving denied requests cannot reach the execution callback.
- [x] Remove automatic background remediation from the diagnostics polling path; auto-setup now runs only after an explicit confirmation.
- [x] Replace interpolated shell execution for audio test tones with bounded input validation and direct argument spawning.
- [x] Register audio test-tone and diagnostics actions in the central policy and validate POST bodies as JSON objects.
- [x] Route both natural-language and exact-name Windows app launches through the central `apps.launch` policy.
- [x] Reject malformed loopback Host authorities and add regression tests for path, query, and user-info forms.
- [x] Restrict the diagnostic command endpoint to exact read-only command/argument combinations; remove general file-content and Hermes command access.
- [x] Add unit tests for approved diagnostic command shapes and rejection of arbitrary paths, flags, and commands.
- [x] Bound geocoding query length and reject out-of-range coordinates from external geocoders.
- [x] Validate Sarvam STT/TTS request fields and avoid returning raw provider error bodies to the client.
- [x] Keep the God's Eye status GET endpoint read-only; status polling no longer starts services implicitly.
- [x] Bound Wispr Flow dictation limits and request fields; reject unknown actions instead of silently treating them as status checks.
- [ ] Finish the remaining mutation-endpoint audit, add targeted route tests, and validate confirmation flows manually before calling this phase complete.

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
