# Mulqi Goal Proof

A goal-based planning and proof gate for DeepSeek Harness. It turns a request
into an outcome contract before code is written, keeps execution bound to that
contract, and refuses code changes that ship no verifiable proof package.

The failure it exists to stop is not broken syntax. It is the change that
compiles, looks correct, and sits on the wrong layer — a second source of truth,
a skipped cutover, or a claim of success with nothing behind it.

## What you get

| Surface | Kind | What it does |
|---|---|---|
| `mulqi-goal-plan` | skill | Turns a request into a goal package: truth owner, contract boundary, cutover, acceptance evidence |
| `mulqi-goal-execute` | skill | Runs an approved package without drifting from ownership, cutover, or proof |
| `mulqi_gp_check` | tool | Inspects the working tree and returns a gate verdict |
| `mulqi-goal-proof` | CLI | Same verdict, with an exit code you can gate a commit or a pipeline on |

The tool and the CLI share one engine. They cannot disagree.

## Install

Prerequisite: DeepSeek Harness `0.2.1-rc.2`.

```bash
dsh plugin --profile <profile> add /path/to/mulqi-goal-proof
```

The package declares a bundle patch, so the host mounts it automatically — no
manual edit of the profile manifest. Confirm the mount:

```bash
dsh --profile <profile> --dump-config | grep mulqi-goal-proof
```

You should see the `mulqi-goal-proof` line. A `skipping profile bundle` line
instead means the host version does not match `engines.dsh`.

After that, both skills appear in the session's skill catalog and
`mulqi_gp_check` is available to the model.

## Use it

### 1. Plan

Ask for the planning skill with a concrete request. You get a goal package:

```text
docs/goals/<goal-slug>/PLAN.md      the full plan
docs/goals/<goal-slug>/GOAL.md      a short handoff prompt
docs/goals/<goal-slug>/EVIDENCE.md  filled in as proof is captured
```

Start from `templates/goal-package/` when you want the shapes by hand.

### 2. Execute

Load the execution skill in a fresh session with the `GOAL.md` prompt. It restates
the ten contract fields before touching code, and it refuses to invent a plan.

### 3. Gate

From the model, call `mulqi_gp_check`. From a terminal or a pipeline:

```bash
mulqi-goal-proof --base-ref origin/main
```

The tool reports; the CLI enforces. A model call returns a verdict object it must
act on. The CLI returns a non-zero exit that stops a commit or a build.

## What the gate requires

A change fails the gate when it touches product code and ships no valid goal
package. A package is valid when all three files exist:

| File | Must contain |
|---|---|
| `PLAN.md` | `truth owner`, and `deletion` / `cutover` / `displaced path`, and `evidence gate` |
| `GOAL.md` | `truth owner` or `cutover`, and `evidence gate` or `acceptance evidence` |
| `EVIDENCE.md` | `acceptance evidence`, and `verification` or `focused check` |

Matching is case-insensitive. Write these as headings, not as mentions buried in
prose, so the intent is unmistakable to a human reader too.

Documentation never needs a package. Any path under `docs/` is documentation,
including a `.py` file sitting there. Everything else that looks like code — by
extension or by known filename such as `Dockerfile` or `package.json` — does.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Passed: no changes, documentation only, or a valid package |
| `1` | Failed: a code change shipped no valid goal package |
| `2` | Usage or environment error: bad flag, no git, unresolvable base ref |

Findings go to stderr. Success goes to stdout.

## Options

| Flag | Default | Meaning |
|---|---|---|
| `--base-ref <ref>` | `HEAD~1`, else the root commit | Ref to compare against |
| `--goals-dir <path>` | `docs/goals` | Where goal packages live |
| `--require-for <mode>` | `code` | `code` gates product-code changes; `always` gates every change |

The tool accepts the same three settings as `baseRef`, `goalsDir`, and
`requireFor`.

## Recipes

Gate a pull request in CI:

```bash
git fetch --no-tags origin main:refs/remotes/origin/main
mulqi-goal-proof --base-ref origin/main
```

Block a local commit with a pre-commit hook:

```bash
#!/bin/sh
exec mulqi-goal-proof --base-ref origin/main
```

Audit before pushing, from inside the agent:

```text
Call mulqi_gp_check with baseRef "origin/main" and report the reason and findings.
```

Gate a documentation-only repository, where nothing should be required:

```bash
mulqi-goal-proof --base-ref origin/main --require-for code
```

## Reading a verdict

The tool returns:

```json
{
  "status": "fail",
  "reason": "invalid-package",
  "message": "docs/goals/add-feature/PLAN.md: missing evidence gate",
  "goalDirs": ["docs/goals/add-feature"],
  "errors": ["docs/goals/add-feature/PLAN.md: missing evidence gate"],
  "exitCode": 1,
  "nextAction": "Complete the reported fields in the named plan files, then re-run the gate."
}
```

`reason` is one of `no-changes`, `no-code-change`, `missing-package`,
`invalid-package`, `validated`.

## Troubleshooting

**`Cannot resolve a base ref`** — the repository has no commit to compare
against, or the ref does not exist locally. Pass an explicit `--base-ref`, and
fetch it first in CI.

**The gate passes when you expected it to fail** — the change is probably under
`docs/`, or carries no known code extension. Check what the gate saw with the
tool's `changedFiles` field.

**The gate fails on a docs change** — you passed `--require-for always`.

**The bundle does not appear** — your host version differs from `engines.dsh`.
The host logs `skipping profile bundle` and keeps serving.

## Design notes

- The engine is pure: no I/O, no git, no clock. The CLI and the tool supply the
  change set; the engine supplies the verdict.
- Zero runtime dependencies. Node builtins only.
- The tool is read-only. It never edits your package to make itself pass.

## License

MIT.
