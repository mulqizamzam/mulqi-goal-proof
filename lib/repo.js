/**
 * Mulqi Goal Proof — repository adapter.
 *
 * Turns a working tree into the two things the engine needs: the change set
 * against a base ref, and a reader over goal-package files. Kept separate from
 * `gate.js` so the verdict logic never depends on git being present.
 */

import { execFile } from 'node:child_process'
import { readFile as readFileAsync } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** A git failure that carries the repository's own stderr. */
export class GitError extends Error {
  constructor(message, stderr) {
    super(message)
    this.name = 'GitError'
    this.stderr = stderr
  }
}

async function git(cwd, args) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    return stdout.trim()
  } catch (err) {
    const stderr = typeof err?.stderr === 'string' ? err.stderr.trim() : ''
    throw new GitError(stderr || String(err?.message ?? err), stderr)
  }
}

/**
 * Repo-relative paths added, copied, modified, or renamed between base and HEAD.
 * @param {string} repoDir
 * @param {string} baseRef
 * @returns {Promise<string[]>}
 */
export async function changedPaths(repoDir, baseRef) {
  const output = await git(repoDir, ['diff', '--name-only', '--diff-filter=ACMR', baseRef, 'HEAD'])
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * Reader over goal-package files in a working tree. Returns null rather than
 * throwing when the file is absent, so a missing package is a verdict, not a
 * crash.
 * @param {string} repoDir
 * @returns {(relativePath: string) => Promise<string | null>}
 */
export function makeReader(repoDir) {
  return async (relativePath) => {
    const target = path.resolve(repoDir, relativePath)
    const root = path.resolve(repoDir)
    if (target !== root && !target.startsWith(root + path.sep)) {
      return null
    }
    try {
      return await readFileAsync(target, 'utf8')
    } catch (err) {
      if (err?.code === 'ENOENT' || err?.code === 'EISDIR') return null
      throw err
    }
  }
}

/** Repo top-level for a directory, or the directory itself when not a repo. */
export async function repoRoot(dir) {
  try {
    return await git(dir, ['rev-parse', '--show-toplevel'])
  } catch (err) {
    // Distinguish "not a repository" from other git failures so the caller can
    // report a usable message instead of raw git stderr.
    throw new GitError(
      `Not a git repository: ${path.resolve(dir)}. ` +
        'The proof gate compares a change set and needs a git working tree.',
      err?.stderr ?? '',
    )
  }
}

/** Resolve the comparison base: explicit ref, else the parent of HEAD. */
export async function resolveBaseRef(dir, explicit) {
  if (explicit) return explicit
  try {
    await git(dir, ['rev-parse', '--verify', '--quiet', 'HEAD~1'])
    return 'HEAD~1'
  } catch {
    try {
      const root = await git(dir, ['rev-list', '--max-parents=0', 'HEAD'])
      const first = root.split('\n').filter(Boolean).pop()
      if (first) return first
    } catch {
      /* fall through */
    }
    throw new GitError('Cannot resolve a base ref: the repository has no commits to compare.')
  }
}
