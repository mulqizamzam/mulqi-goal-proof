/**
 * Regression suite for defects found by the 2026-11-09 red-team pass.
 *
 * Each test names the attack it locks down. These are deliberately separate
 * from the parity suite: parity locks behaviour against the reference engine,
 * while these lock corrections where the reference behaviour was wrong.
 *
 * Run: node --test tests/*.test.js
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { changedGoalDirs, evaluate, isCodeChange } from '../lib/gate.js'
import { GitError, repoRoot } from '../lib/repo.js'

// --- A1: extensions the classifier used to miss -------------------------

test('regression A1: widely used source extensions count as code', () => {
  const extensions = [
    '.lua',
    '.dart',
    '.vue',
    '.svelte',
    '.zig',
    '.ex',
    '.exs',
    '.scala',
  ]
  for (const extension of extensions) {
    assert.ok(
      isCodeChange(`src/module${extension}`),
      `${extension} must be treated as product code`,
    )
  }
})

test('regression A1: documentation exclusion still wins over the new extensions', () => {
  assert.ok(!isCodeChange('docs/example.lua'), 'a lua file under docs is documentation')
  assert.ok(!isCodeChange('docs/example.vue'), 'a vue file under docs is documentation')
})

test('regression A1: a lua change alone now fails the gate', () => {
  const verdict = evaluate({ changedPaths: ['game/main.lua'], readFile: () => null })
  assert.equal(verdict.status, 'fail')
  assert.equal(verdict.reason, 'missing-package')
})

// --- A6: nested goal packages ------------------------------------------

test('regression A6: a nested package resolves to its own directory', () => {
  assert.deepEqual(changedGoalDirs(['docs/goals/team/add-feature/PLAN.md']), [
    'docs/goals/team/add-feature',
  ])
})

test('regression A6: a nested package with a complete set validates', () => {
  const dir = 'docs/goals/team/add-feature'
  const files = {
    [`${dir}/PLAN.md`]: 'truth owner\ncutover\nevidence gate\n',
    [`${dir}/GOAL.md`]: 'cutover evidence gate\n',
    [`${dir}/EVIDENCE.md`]: 'acceptance evidence\nverification\n',
  }
  const verdict = evaluate({
    changedPaths: ['src/app.py', ...Object.keys(files)],
    readFile: (path) => (Object.hasOwn(files, path) ? files[path] : null),
  })
  assert.equal(verdict.status, 'pass', verdict.message)
  assert.deepEqual(verdict.goalDirs, [dir])
})

test('regression A6: sibling packages still resolve independently', () => {
  assert.deepEqual(
    changedGoalDirs(['docs/goals/a/PLAN.md', 'docs/goals/b/GOAL.md']),
    ['docs/goals/a', 'docs/goals/b'],
  )
})

test('regression A6: a loose file directly under the goals root owns no package', () => {
  assert.deepEqual(changedGoalDirs(['docs/goals/notes.md']), [])
})

// --- B5: not a git repository ------------------------------------------

test('regression B5: a non-repository raises a usable GitError', async () => {
  const os = await import('node:os')
  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gp-notrepo-'))
  try {
    await assert.rejects(
      () => repoRoot(dir),
      (err) => {
        assert.ok(err instanceof GitError, 'must be a GitError')
        assert.match(err.message, /Not a git repository/)
        return true
      },
    )
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('regression B5: exit code stays 2 for a non-repository', async () => {
  const os = await import('node:os')
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const { run } = await import('../bin/mulqi-goal-proof.js')

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gp-notrepo-exit-'))
  const originalWrite = process.stderr.write
  process.stderr.write = () => true
  try {
    const code = await run(['--base-ref', 'HEAD'], dir)
    assert.equal(code, 2)
  } finally {
    process.stderr.write = originalWrite
    await fs.rm(dir, { recursive: true, force: true })
  }
})
