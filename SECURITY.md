# Security and limits

Mulqi Goal Proof is a **review aid with an enforcing exit code**, not a security
control and not an adversary-proof gate. This page states precisely what it
guarantees, what it cannot, and how to use it without over-trusting it.

## What it guarantees

| Guarantee | How |
|---|---|
| A change set is read from git, not from the working tree | `git diff --name-only --diff-filter=ACMR <base> HEAD` |
| Product-code changes are detected by extension and known filename | `CODE_EXTENSIONS`, `CODE_FILENAMES` |
| A changed goal package must carry the required sections | Text presence checks per file |
| No shell is invoked | `execFile('git', [...])`, never `exec`/`execSync` |
| No file outside the repository is read | Path resolution is confined to the repository root |
| The tool never mutates the workspace or the session | Read-only `execute()` |

## What it does NOT guarantee

**The gate checks that text is present, not that it is true.** A package of one
line satisfies every requirement:

```
truth owner cutover evidence gate
```

An HTML comment satisfies it too. The gate cannot tell a real plan from a
placeholder. If your process needs real content, review the package by hand or
add a minimum-length or structure check in your own wrapper.

**The extension list is finite.** Files whose extension is not listed are not
counted as code, and a change consisting only of them passes the gate. The
current list covers the common languages; a language added to your repository
needs a line in `CODE_EXTENSIONS`. When in doubt, check `changedFiles` in the
verdict.

**Everything under `docs/` is treated as documentation.** A source file placed
there is never gated. This is deliberate, and it is also a bypass if misused.

**A determined author can always satisfy a text gate.** The purpose of the gate
is to stop an agent from shipping plausible wrong work by accident. It does not
defend against a person who wants to pass it without doing the work.

**The verdict depends on the ref you pass.** `--base-ref` defaults to `HEAD~1`.
Comparing against the wrong base produces a confidently wrong answer. In CI,
fetch and pass the real base branch.

## Trust boundaries

- **Input**: file paths and file contents from the repository under test.
- **Command execution**: `git` only, with an argument array; the base ref is
  passed as a single argument, so a ref cannot inject options or shell commands.
- **Output**: text to stdout on pass, stderr on fail, exit `0`/`1`/`2`.

No network access. No external dependencies. No credentials.

## Known limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Text-presence checks only | Placeholder packages pass | Human review, or a stricter wrapper |
| Finite extension list | Unlisted languages are ungated | Add the extension, verify with `changedFiles` |
| `docs/` is always documentation | Source under `docs/` is ungated | Keep source out of `docs/` |
| Defaults to `HEAD~1` | Wrong base gives a wrong verdict | Always pass `--base-ref` in CI |
| Pinned to one host version | Host upgrade drops the bundle | Match `engines.dsh`, or repackage |

## Reporting a vulnerability

If you find a way to make the gate report a false pass, or to make it read or
write something it should not, that is a defect worth fixing — include the
fixture, the command, and the observed output. Do not open a public issue for
anything that could be used against a running deployment before a fix exists.
