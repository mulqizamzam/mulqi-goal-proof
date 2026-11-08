/**
 * Mulqi Goal Proof — engine parity suite.
 *
 * Every case here was captured from the reference implementation's observable
 * behavior (exit code, message text, finding order) before this engine was
 * written. The suite asserts behavior, not internals: if the engine ever
 * disagrees with the reference on a verdict, this file fails.
 *
 * Run: node --test tests/*.test.js
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { changedGoalDirs, evaluate, isCodeChange } from '../lib/gate.js'

const GOALS = 'docs/goals'

/** Build a readFile stub from a plain object of relative path -> text. */
function readerFrom(files) {
  return (relativePath) => (Object.hasOwn(files, relativePath) ? files[relativePath] : null)
}

function validPackage(slug, overrides = {}) {
  return {
    [`${GOALS}/${slug}/PLAN.md`]: overrides.plan ?? '# Plan\n\n## Truth Owner\nsrc/app.py\n\n## Cutover\nReplace.\n\n## Evidence Gate\nRun test.\n',
    [`${GOALS}/${slug}/GOAL.md`]: overrides.goal ?? '# Goal\n\nPreserve truth owner and cutover. Evidence gate.\n',
    [`${GOALS}/${slug}/EVIDENCE.md`]: overrides.evidence ?? '# Evidence\n\n## Acceptance Evidence\nproof\n\n## Verification\ncheck\n',
  }
}

function run(paths, files, options = {}) {
  return evaluate({ changedPaths: paths, readFile: readerFrom(files), ...options })
}

// --- Case 1: empty change set -------------------------------------------

test('parity: no changed files passes', () => {
  const verdict = evaluate({ changedPaths: [], readFile: () => null })
  assert.equal(verdict.status, 'pass')
  assert.equal(verdict.exitCode, 0)
  assert.equal(verdict.message, 'No changed files.')
  assert.equal(verdict.reason, 'no-changes')
})

// --- Case 2: documentation-only change ----------------------------------

test('parity: docs-only change passes without a package', () => {
  const verdict = run(['docs/notes.md'], {})
  assert.equal(verdict.status, 'pass')
  assert.equal(verdict.message, 'No code changes detected; Mulqi goal package not required.')
  assert.equal(verdict.reason, 'no-code-change')
})

// --- Case 3: code change, no package ------------------------------------

test('parity: code change without a package fails with remediation text', () => {
  const verdict = run(['src/app.py'], {})
  assert.equal(verdict.status, 'fail')
  assert.equal(verdict.exitCode, 1)
  assert.equal(verdict.reason, 'missing-package')
  assert.match(verdict.message, /No Mulqi goal package changed/)
  assert.match(verdict.message, /PLAN\.md, GOAL\.md, and EVIDENCE\.md/)
})

// --- Case 4: code change with a complete package ------------------------

test('parity: code change with a complete package passes', () => {
  const verdict = run(['src/app.py', ...Object.keys(validPackage('add-feature'))], validPackage('add-feature'))
  assert.equal(verdict.status, 'pass')
  assert.equal(verdict.exitCode, 0)
  assert.equal(verdict.reason, 'validated')
  assert.equal(verdict.message, `Mulqi goal package validated: ${GOALS}/add-feature`)
})

// --- Case 5: incomplete package, finding order --------------------------

test('parity: incomplete package reports text findings before missing files', () => {
  const files = { [`${GOALS}/g1/PLAN.md`]: '# Plan\n\n## Truth Owner\nsrc\n' }
  const verdict = run(['src/app.py', `${GOALS}/g1/PLAN.md`], files)
  assert.equal(verdict.status, 'fail')
  assert.deepEqual(verdict.errors, [
    `${GOALS}/g1/PLAN.md: missing deletion or cutover`,
    `${GOALS}/g1/PLAN.md: missing evidence gate`,
    `${GOALS}/g1: missing GOAL.md`,
    `${GOALS}/g1: missing EVIDENCE.md`,
  ])
})

// --- Case 6: extension and filename classification ----------------------

test('parity: root json and Dockerfile count as code; python under docs does not', () => {
  assert.ok(isCodeChange('conf.json'), 'root json is code')
  assert.ok(isCodeChange('Dockerfile'), 'Dockerfile is code')
  assert.ok(isCodeChange('src/app.ts'), 'ts is code')
  assert.ok(!isCodeChange('docs/tool.py'), 'python under docs is documentation')
  assert.ok(!isCodeChange('docs/notes.md'), 'markdown is not code')
  assert.ok(!isCodeChange('README.md'), 'markdown is not code')
})

// --- Case 7: require-for always -----------------------------------------

test('parity: require-for always rejects a docs-only change', () => {
  const verdict = run(['docs/notes.md'], {}, { requireFor: 'always' })
  assert.equal(verdict.status, 'fail')
  assert.equal(verdict.exitCode, 1)
  assert.match(verdict.message, /No Mulqi goal package changed/)
})

// --- Case 8: custom goals directory -------------------------------------

test('parity: custom goals dir is honoured', () => {
  const files = {
    'goals/g2/PLAN.md': 'truth owner cutover evidence gate',
    'goals/g2/GOAL.md': 'truth owner evidence gate',
    'goals/g2/EVIDENCE.md': 'acceptance evidence verification',
  }
  const verdict = run(['src/app.py', ...Object.keys(files)], files, { goalsDir: 'goals' })
  assert.equal(verdict.status, 'pass')
  assert.equal(verdict.message, 'Mulqi goal package validated: goals/g2')
})

// --- Case 9: two packages, one broken -----------------------------------

test('parity: only the broken package is reported', () => {
  const files = {
    ...validPackage('good'),
    [`${GOALS}/bad/PLAN.md`]: 'nothing here\n',
  }
  const verdict = run(['src/app.ts', ...Object.keys(files)], files)
  assert.equal(verdict.status, 'fail')
  assert.equal(verdict.goalDirs.length, 2)
  for (const error of verdict.errors) {
    assert.match(error, /\/bad(\/|:)/, `unexpected finding for good package: ${error}`)
  }
  assert.ok(
    verdict.errors.some((error) => error === `${GOALS}/bad/PLAN.md: missing truth owner`),
    'bad package truth-owner finding must be present',
  )
})

// --- Structural invariants ---------------------------------------------

test('changedGoalDirs returns only slug directories that own a changed path', () => {
  const dirs = changedGoalDirs([
    `${GOALS}/a/PLAN.md`,
    `${GOALS}/a/EVIDENCE.md`,
    `${GOALS}/b/GOAL.md`,
    `${GOALS}/loose-file.md`,
  ])
  assert.deepEqual(dirs, [`${GOALS}/a`, `${GOALS}/b`])
})

test('every verdict carries a stable shape', () => {
  const verdicts = [
    evaluate({ changedPaths: [], readFile: () => null }),
    run(['docs/x.md'], {}),
    run(['src/a.py'], {}),
  ]
  for (const verdict of verdicts) {
    assert.equal(typeof verdict.status, 'string')
    assert.equal(typeof verdict.reason, 'string')
    assert.equal(typeof verdict.message, 'string')
    assert.ok(Array.isArray(verdict.goalDirs), 'goalDirs is an array')
    assert.ok(Array.isArray(verdict.errors), 'errors is an array')
    assert.equal(verdict.exitCode, verdict.status === 'pass' ? 0 : 1)
  }
})
