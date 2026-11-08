---
name: mulqi-goal-plan
description: Use when a user has a feature request, bugfix, refactor, migration, or architecture change and needs it turned into a goal package before any code is written. Use especially when wrong ownership, duplicate paths, stale contracts, weak evidence, or unclear cutover would make fast agent work dangerous.
---

# Goal Planning

Turns a request into a goal package that names the outcome, who owns the truth,
which path is being replaced, and what proof closes the work — before anyone
writes a line of code.

## Core rule

A task list is not a plan. The plan is ready only when it answers all seven:

```text
What outcome are we serving?
What current behavior is replaced, redirected, deleted, or demoted?
Who owns the truth?
What contract crosses the boundary?
What is the smallest high-value slice?
What proves the result from the affected person's perspective?
What kill criteria stop a duplicate path from living forever?
```

If ownership, cutover, contract, or evidence is fuzzy, stop and map it. Do not
plan on top of an unknown.

## Workflow

### 1. Write the outcome contract

Fill every field. An empty field is a plan that will drift.

```text
Plan title:
Intent:
Current behavior:
Expected outcome:
Target-perspective output:
Truth owner:
Contract boundary:
Cutover:
Displaced path:
Value density:
Evidence gate:
Acceptance evidence:
Evidence lane:
Kill criteria:
Non-goals:
Risk if wrong:
```

### 2. Map the architecture slice before tasks

```text
Files to create:
Files to modify:
Files to avoid:
Source of truth:
Read path:
Write path:
Contract boundary:
Integration points:
Migration/cutover:
Displaced path:
Acceptance evidence gate:
```

For a broad or unfamiliar repository, dispatch a read-only explorer with one
bounded question: "map the source of truth, the read and write paths, the
unsafe files, and the evidence gate." Reuse that map in the execution session
instead of rediscovering the same ground.

### 3. Write the goal package

Default location, unless the user names another:

```text
docs/goals/<goal-slug>/PLAN.md
docs/goals/<goal-slug>/GOAL.md
docs/goals/<goal-slug>/EVIDENCE.md
```

- `PLAN.md` — the full plan.
- `GOAL.md` — a short execution prompt that points at the plan instead of
  restating it.
- `EVIDENCE.md` — starts as empty headings and is filled during execution with
  real proof.

### 4. Open `PLAN.md` with the header shape

```markdown
# [Outcome Title] Implementation Plan

**Intent:** ...
**Current Behavior:** ...
**Expected Outcome:** ...
**Target-Perspective Output:** ...
**Truth Owner:** ...
**Contract Boundary:** ...
**Cutover:** ...
**Displaced Path:** ...
**Value Density:** ...
**Evidence Gate:** ...
**Acceptance Evidence:** ...
**Evidence Lane:** ...
**Kill Criteria:** ...
**Architecture Slice:** ...
**Plan Review Gate:** Requires PRE review before execution.
```

The gate reads `PLAN.md` for a truth owner, a deletion or cutover statement, and
an evidence gate. Writing those as headings, not prose buried mid-document,
keeps the package valid.

### 5. Break work into tasks

Each task names exact files, allowed scope, expected output, the verification
command, the acceptance evidence, and whether it can run in parallel with its
neighbours.

### 6. Run a PRE plan review

Use `plan-reviewer-prompt.md`. Do not start execution until blocker findings are
fixed or the user explicitly accepts them.

## GOAL.md shape

The compact handoff an operator pastes into a fresh session:

```markdown
# Goal: [Outcome Title]

Execute `docs/goals/<goal-slug>/PLAN.md` using the goal-execution discipline.

Core rules:
- Treat PLAN.md as the source plan.
- Preserve intent, ownership, contract, cutover, evidence, and kill criteria.
- Do not add a dominant new path without deleting, redirecting, demoting, or
  shimming the displaced path.
- Capture acceptance evidence from the target perspective and record it in
  EVIDENCE.md.
- Say "implemented but unproven" when that evidence cannot be captured.
```

## EVIDENCE.md shape

```markdown
# [Outcome Title] Evidence

## Acceptance Evidence

Record the real artifact that proves the outcome from the target perspective.

## Verification

Record the focused check that passed, including the command and its output.

## Review Notes

Record review findings that changed the result.
```

## Common mistakes

| Mistake | Why it fails |
|---|---|
| Plan is a list of files to edit | No outcome, no owner, nothing to prove |
| Truth owner is "the backend" | Not a file, module, or service — nothing can be held to it |
| Cutover says "later" | The duplicate path lives forever |
| Evidence is "tests pass" | Supporting check, not proof from the real path |
| GOAL.md restates PLAN.md | Two sources of truth that drift apart |
