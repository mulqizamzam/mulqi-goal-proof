#!/usr/bin/env node
/**
 * Mulqi Goal Proof — command-line gate.
 *
 * Exit-code contract (stable; scripts may depend on it):
 *   0  gate passed  (no changes, documentation only, or a valid package)
 *   1  gate failed  (code change without a valid goal package)
 *   2  usage or environment error (bad flags, no git, unresolvable base ref)
 *
 * Findings go to stderr; success goes to stdout.
 */

import { DEFAULT_GOALS_DIR, evaluate, requiredFiles } from '../lib/gate.js'
import { GitError, changedPaths, makeReader, repoRoot, resolveBaseRef } from '../lib/repo.js'

const USAGE = `Usage: mulqi-goal-proof [options]

Require a goal package for non-trivial code changes.

Options:
  --base-ref <ref>     Git ref to compare against (default: HEAD~1, or the
                       root commit when HEAD has no parent)
  --goals-dir <path>   Goal-package root (default: ${DEFAULT_GOALS_DIR})
  --require-for <mode> "code" requires a package for code changes only;
                       "always" requires one for every change (default: code)
  -h, --help           Show this help
`

class UsageError extends Error {}

function parseArgs(argv) {
  const options = { baseRef: undefined, goalsDir: DEFAULT_GOALS_DIR, requireFor: 'code' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') return { help: true, options }
    const eq = arg.indexOf('=')
    const flag = eq > -1 ? arg.slice(0, eq) : arg
    const inline = eq > -1 ? arg.slice(eq + 1) : undefined
    const takeValue = () => {
      if (inline !== undefined) return inline
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('-')) {
        throw new UsageError(`${flag} requires a value`)
      }
      i += 1
      return next
    }
    if (flag === '--base-ref') options.baseRef = takeValue()
    else if (flag === '--goals-dir') options.goalsDir = takeValue()
    else if (flag === '--require-for') options.requireFor = takeValue()
    else throw new UsageError(`unknown option: ${arg}`)
  }
  if (!['code', 'always'].includes(options.requireFor)) {
    throw new UsageError(`--require-for must be "code" or "always", got "${options.requireFor}"`)
  }
  return { help: false, options }
}

/** Read every candidate package file up front so the engine stays synchronous. */
async function preloadPackageFiles(paths, goalsDir, readFile) {
  const root = goalsDir.split('/').filter(Boolean)
  const cache = new Map()
  for (const filePath of paths) {
    const segs = filePath.split('/')
    if (segs.length < root.length + 2) continue
    if (!root.every((part, index) => segs[index] === part)) continue
    const slugDir = [...root, segs[root.length]].join('/')
    for (const name of requiredFiles) {
      const target = `${slugDir}/${name}`
      if (!cache.has(target)) cache.set(target, await readFile(target))
    }
  }
  return cache
}

export async function run(argv, cwd = process.cwd()) {
  let parsed
  try {
    parsed = parseArgs(argv)
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${USAGE}`)
    return 2
  }
  if (parsed.help) {
    process.stdout.write(USAGE)
    return 0
  }

  const { options } = parsed
  try {
    const root = await repoRoot(cwd)
    const baseRef = await resolveBaseRef(root, options.baseRef)
    const paths = await changedPaths(root, baseRef)
    const cache = await preloadPackageFiles(paths, options.goalsDir, makeReader(root))

    const verdict = evaluate({
      changedPaths: paths,
      goalsDir: options.goalsDir,
      requireFor: options.requireFor,
      readFile: (relativePath) => (cache.has(relativePath) ? cache.get(relativePath) : null),
    })

    const stream = verdict.status === 'pass' ? process.stdout : process.stderr
    stream.write(`${verdict.message}\n`)
    return verdict.exitCode
  } catch (err) {
    if (err instanceof GitError) {
      process.stderr.write(`${err.message}\n`)
      return 2
    }
    process.stderr.write(`${String(err?.message ?? err)}\n`)
    return 2
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code
  })
}
