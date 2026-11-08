# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] — 2026-11-08

First public release.

### Added

- **Bundle for DeepSeek Harness 0.2.1-rc.2.** Ships a bundle patch so
  `dsh plugin --profile <profile> add <path>` mounts the plugin with no manual
  manifest editing.
- **`mulqi-goal-plan` skill.** Turns a request into a goal package: outcome
  contract, truth owner, contract boundary, cutover, acceptance evidence, kill
  criteria, and a task breakdown with per-task verification.
- **`mulqi-goal-execute` skill.** Runs an approved package without drifting:
  ten-field entry restatement, ordered task board, seven-step execution loop,
  an evidence-gate table keyed to change type, and the
  `implemented but unproven` escape hatch.
- **`mulqi_gp_check` tool.** Read-only gate over the working tree. Returns
  status, reason, the goal packages found, exact findings, and a next action.
  Never edits files and never mutates the session.
- **`mulqi-goal-proof` CLI.** The same verdict with an enforcing exit code:
  `0` pass, `1` fail, `2` usage or environment error.
- **One pure engine** (`lib/gate.js`) behind both front doors, so the tool and
  the CLI cannot disagree. No I/O, no clock, no filesystem in the engine.
- **Goal-package templates** for `PLAN.md`, `GOAL.md`, and `EVIDENCE.md`.
- **19 tests** covering gate parity, registration, and catalog derivation.

### Design notes

- Documentation never requires a goal package. Any path under `docs/` counts as
  documentation, including source-like files placed there.
- The gate reports; the CLI enforces. Enforcement belongs to commit hooks and
  pipelines, not to a model that could rationalize past it.
- Zero runtime dependencies. Node builtins only.

### Known limitations

- One model-driven session has not yet been recorded calling
  `mulqi_gp_check`; the tool was verified by invoking its `execute()` directly.
- Pinned to DSH `0.2.1-rc.2` exactly. A host bump requires an exemption or a
  repackaged release.

[Unreleased]: https://github.com/mulqizamzam/mulqi-goal-proof/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mulqizamzam/mulqi-goal-proof/releases/tag/v0.1.0
