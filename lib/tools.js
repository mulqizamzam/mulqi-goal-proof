/**
 * Mulqi Goal Proof — native tool layer.
 *
 * One model-facing tool, `mulqi_gp_check`, over the proof-gate engine. It
 * reports a verdict; it never mutates the workspace or the session. Enforcement
 * (a non-zero exit that blocks a merge or a commit hook) belongs to the CLI.
 */

import { DEFAULT_GOALS_DIR, evaluate, requiredFiles } from './gate.js'
import { changedPaths, makeReader, repoRoot, resolveBaseRef } from './repo.js'

/**
 * @param {object} [deps]
 * @param {string} [deps.cwd] repository root override (tests)
 * @returns {object[]} tool definitions for `ctx.tools.register`
 */
export function createGateTools(deps = {}) {
  return [
    {
      name: 'mulqi_gp_check',
      description:
        'Mulqi Goal Proof: run the proof gate over the working tree. Compares the current HEAD ' +
        'against a base ref, decides whether the change touches product code, and validates the ' +
        'changed goal package (PLAN.md, GOAL.md, EVIDENCE.md with truth owner, deletion/cutover, ' +
        'and evidence-gate text). Returns a verdict with status, reason, the packages found, and ' +
        'the exact findings. Read-only: it reports, it does not enforce and never edits files.',
      parameters: {
        type: 'object',
        properties: {
          baseRef: {
            type: 'string',
            description:
              'Git ref to compare against. Defaults to HEAD~1, or the root commit when HEAD has no parent.',
          },
          goalsDir: {
            type: 'string',
            description: `Goal-package root relative to the repository (default "${DEFAULT_GOALS_DIR}").`,
          },
          requireFor: {
            type: 'string',
            enum: ['code', 'always'],
            description:
              'When a goal package is required: "code" only for product-code changes, "always" for every change. Default "code".',
          },
        },
        additionalProperties: false,
      },
      output: {
        schema: { type: 'object' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      isConcurrencySafe: () => true,
      async execute(args = {}) {
        const cwd = deps.cwd || process.cwd()
        const root = await repoRoot(cwd)
        const baseRef = await resolveBaseRef(root, args.baseRef)
        const paths = await changedPaths(root, baseRef)
        const goalsDir = args.goalsDir || DEFAULT_GOALS_DIR
        const requireFor = args.requireFor === 'always' ? 'always' : 'code'

        const cache = await preload(paths, goalsDir, makeReader(root))
        const verdict = evaluate({
          changedPaths: paths,
          goalsDir,
          requireFor,
          readFile: (relativePath) => (cache.has(relativePath) ? cache.get(relativePath) : null),
        })

        return {
          ...verdict,
          baseRef,
          goalsDir,
          requireFor,
          changedFiles: paths,
          nextAction: nextAction(verdict),
        }
      },
    },
  ]
}

function nextAction(verdict) {
  switch (verdict.reason) {
    case 'no-changes':
      return 'Nothing to gate. Compare a branch with baseRef if you expected changes.'
    case 'no-code-change':
      return 'Documentation-only change; no goal package required.'
    case 'missing-package':
      return 'Create docs/goals/<slug>/PLAN.md, GOAL.md, and EVIDENCE.md before shipping this code change.'
    case 'invalid-package':
      return 'Complete the reported fields in the named plan files, then re-run the gate.'
    case 'validated':
      return 'Package valid. Keep recording acceptance evidence from the real path as the work completes.'
    default:
      return 'Review the findings.'
  }
}

async function preload(paths, goalsDir, readFile) {
  const root = goalsDir.split('/').filter(Boolean)
  const cache = new Map()
  for (const filePath of paths) {
    const segments = filePath.split('/')
    if (segments.length < root.length + 2) continue
    if (!root.every((part, index) => segments[index] === part)) continue
    const slugDir = [...root, segments[root.length]].join('/')
    for (const name of requiredFiles) {
      const target = `${slugDir}/${name}`
      if (!cache.has(target)) cache.set(target, await readFile(target))
    }
  }
  return cache
}
