---
name: mulqi-goal-execute
description: Use when executing an approved plan, GOAL.md, or implementation plan that already defines intent, ownership, contract, cutover, task boundaries, and acceptance evidence. Use for main-agent execution where drift from ownership, cutover, or proof obligations is the primary risk.
---

# Goal Execution

Runs an approved plan without drifting from its ownership, cutover, and
evidence contract. The main agent implements; this discipline keeps it honest.

## Entry rule

Do not invent the plan inside this workflow. With no approved plan, goal
document, or clear task board, ask for one direct input or run the planning
workflow first. A complete package looks like:

```text
docs/goals/<goal-slug>/PLAN.md
docs/goals/<goal-slug>/GOAL.md
docs/goals/<goal-slug>/EVIDENCE.md
```

Before touching code, restate these ten fields:

```text
Goal:
Plan path:
Intent:
Truth owner:
Contract boundary:
Cutover:
Displaced path:
Acceptance evidence:
Kill criteria:
Forbidden moves:
```

If any field is unknown, the plan is not approved yet. Say so instead of
proceeding.

## Task board

```text
Task:
Owner:
Input:
Files allowed:
Files forbidden:
Output:
Evidence:
Depends on:
Parallel safe:
```

Run implementation tasks sequentially in the main agent unless the approved plan
explicitly allows otherwise.

## Execution loop

For each task:

1. Confirm the task still matches the plan contract.
2. Gather only the context this task needs.
3. Implement directly in the main agent.
4. Review the result before it is integrated or checkpointed.
5. Check for wrong owner, duplicate path, missing cutover, contract drift, and
   weak proof.
6. Commit or checkpoint only the current task's files.
7. Update the task board.

The main agent owns implementation, integration, and final coherence. A
delegated subtask never becomes the owner of the truth.

## Evidence gate

Do not call the goal complete because tests, lint, typecheck, or a clean diff
passed. Those are supporting checks, not proof.

Completion requires target-perspective evidence:

| Change | Evidence that counts |
|---|---|
| UI or visual | Browser state, screenshot, or rendered output |
| API or data flow | Request/response, fixture, trace, or persisted record |
| CLI or workflow | The command plus its meaningful output |
| Migration or cutover | Old path deleted, redirected, demoted, or shimmed with a removal trigger |
| Hidden logic | A deterministic artifact showing the intended result |

When evidence cannot be captured, report the blocker and say
`implemented but unproven`. That sentence is honest; silence is not.

Record accepted evidence in `EVIDENCE.md` before the final response when the
repository uses goal packages.

## Final gates

Before the final response:

1. Run the POST review when the plan carried a review gate.
2. Review correctness: behavior, data integrity, trust boundaries, missing
   evidence.
3. Review maintainability: duplicate paths, stale artifacts, coupling, unclear
   ownership.
4. Fix important findings, or record why each remains.
5. Summarize changed artifacts, acceptance evidence, review result, and
   blockers.

## Closing checklist

Run the proof gate before claiming the work ships:

```bash
mulqi-goal-proof --base-ref origin/main
```

A failing verdict means the package is missing or incomplete. Fix the package —
do not weaken the gate.

## Common mistakes

| Mistake | Why it fails |
|---|---|
| "Tests pass, so it's done" | A supporting check is not target-perspective proof |
| Adding the new path beside the old one | The duplicate path is now permanent |
| Restating the plan from memory | Memory drifts; the plan file does not |
| Capturing evidence after the fact | Reconstructed proof is indistinguishable from invented proof |
| Editing the gate to make it pass | Turns a proof gate into decoration |
