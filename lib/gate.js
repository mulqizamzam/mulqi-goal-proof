/**
 * Mulqi Goal Proof — proof-gate engine.
 *
 * Pure evaluation: given a change set and the goal-package root, decide
 * whether the change ships a valid proof package. No I/O here — the git
 * adapter and the file reader are injected, so this module is fully
 * deterministic and testable without a repository.
 *
 * The engine is the single source of truth for the gate verdict. The native
 * tool, the CLI, and the test suite all call `evaluate()`; none of them may
 * re-derive a verdict on their own.
 */

/** Extensions that mark a file as executable product surface. */
export const CODE_EXTENSIONS = Object.freeze(
  new Set([
    '.c',
    '.cc',
    '.cpp',
    '.cs',
    '.cts',
    '.go',
    '.h',
    '.hpp',
    '.java',
    '.json',
    '.js',
    '.jsx',
    '.kt',
    '.kts',
    '.mjs',
    '.mts',
    '.php',
    '.py',
    '.rb',
    '.rs',
    '.sh',
    '.sql',
    '.swift',
    '.ts',
    '.tsx',
    '.toml',
    '.yaml',
    '.yml',
  ]),
)

/** Extensionless filenames that still carry product behavior. */
export const CODE_FILENAMES = Object.freeze(
  new Set([
    'Dockerfile',
    'Makefile',
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'requirements.txt',
    'requirements-lock.txt',
    'yarn.lock',
  ]),
)

/** Files every goal package must contain. */
export const requiredFiles = Object.freeze(['PLAN.md', 'GOAL.md', 'EVIDENCE.md'])

/**
 * Text every package file must carry, per file. Each requirement is a label
 * reported verbatim in a failure plus the pattern that satisfies it.
 */
export const REQUIRED_TEXT = Object.freeze({
  'PLAN.md': Object.freeze([
    Object.freeze({ label: 'truth owner', pattern: /truth\s+owner/i }),
    Object.freeze({ label: 'deletion or cutover', pattern: /deletion|cutover|displaced\s+path/i }),
    Object.freeze({ label: 'evidence gate', pattern: /evidence\s+gate/i }),
  ]),
  'GOAL.md': Object.freeze([
    Object.freeze({ label: 'truth owner/cutover instruction', pattern: /truth\s+owner|cutover/i }),
    Object.freeze({
      label: 'evidence gate instruction',
      pattern: /evidence\s+gate|acceptance\s+evidence/i,
    }),
  ]),
  'EVIDENCE.md': Object.freeze([
    Object.freeze({ label: 'acceptance evidence', pattern: /acceptance\s+evidence/i }),
    Object.freeze({ label: 'verification', pattern: /verification|focused\s+check/i }),
  ]),
})

export const DEFAULT_GOALS_DIR = 'docs/goals'
export const REMEDIATION =
  'No Mulqi goal package changed. Add docs/goals/<slug>/PLAN.md, GOAL.md, and EVIDENCE.md ' +
  'with truth owner, deletion/cutover, and evidence gate details.'

/** Split a repo-relative path into segments, tolerating leading "./". */
function segments(relativePath) {
  return String(relativePath)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .split('/')
    .filter((part) => part.length > 0)
}

/** True when the path lives anywhere under the goal-package root. */
export function isWithinGoals(relativePath, goalsDir = DEFAULT_GOALS_DIR) {
  const parts = segments(relativePath)
  const root = segments(goalsDir)
  if (parts.length < root.length) return false
  return root.every((part, index) => parts[index] === part)
}

/**
 * True when the path carries product behavior rather than documentation.
 * Paths under `docs/` are documentation by definition and never count.
 */
export function isCodeChange(relativePath) {
  const parts = segments(relativePath)
  if (parts.length === 0) return false
  if (parts.length > 1 && parts[0] === 'docs') return false
  const basename = parts[parts.length - 1]
  if (CODE_FILENAMES.has(basename)) return true
  const dot = basename.lastIndexOf('.')
  if (dot <= 0) return false
  return CODE_EXTENSIONS.has(basename.slice(dot).toLowerCase())
}

/**
 * Goal-package directory (repo-relative) owning each changed path, sorted and
 * de-duplicated. Depth is goals root + exactly one slug segment.
 */
export function changedGoalDirs(changedPaths, goalsDir = DEFAULT_GOALS_DIR) {
  const root = segments(goalsDir)
  const found = new Set()
  for (const filePath of changedPaths) {
    const parts = segments(filePath)
    if (parts.length < root.length + 2) continue
    if (!root.every((part, index) => parts[index] === part)) continue
    found.add([...root, parts[root.length]].join('/'))
  }
  return [...found].sort()
}

/**
 * Validate one goal package.
 * @param {string} goalDir repo-relative package directory
 * @param {(relativePath: string) => string | null} readFile
 *   returns file text, or null when the file does not exist
 * @returns {{ errors: string[], missingFiles: string[] }}
 */
export function inspectPackage(goalDir, readFile) {
  const textErrors = []
  const fileErrors = []
  for (const filename of requiredFiles) {
    const target = `${goalDir}/${filename}`
    const text = readFile(target)
    if (text === null) {
      fileErrors.push(`${goalDir}: missing ${filename}`)
      continue
    }
    for (const requirement of REQUIRED_TEXT[filename]) {
      if (!requirement.pattern.test(text)) {
        textErrors.push(`${target}: missing ${requirement.label}`)
      }
    }
  }
  // Observed ordering: a package's text findings precede its missing-file
  // findings, and packages are reported in sorted order by the caller.
  return { errors: [...textErrors, ...fileErrors], missingFiles: fileErrors }
}

/**
 * Evaluate the proof gate.
 *
 * @param {object} input
 * @param {string[]} input.changedPaths repo-relative paths changed against the base ref
 * @param {(relativePath: string) => string | null} input.readFile reader for the working tree
 * @param {string} [input.goalsDir] goal-package root (default `docs/goals`)
 * @param {'code'|'always'} [input.requireFor] when a package is required
 * @returns {{
 *   status: 'pass'|'fail',
 *   reason: 'no-changes'|'no-code-change'|'missing-package'|'invalid-package'|'validated',
 *   message: string,
 *   goalDirs: string[],
 *   errors: string[],
 *   exitCode: 0|1
 * }}
 */
export function evaluate(input) {
  const goalsDir = input.goalsDir || DEFAULT_GOALS_DIR
  const requireFor = input.requireFor || 'code'
  const changedPaths = Array.from(input.changedPaths || [])

  if (changedPaths.length === 0) {
    return pass('no-changes', 'No changed files.')
  }

  const needsPackage =
    requireFor === 'always' || changedPaths.some((filePath) => isCodeChange(filePath))

  if (!needsPackage) {
    return pass('no-code-change', 'No code changes detected; Mulqi goal package not required.')
  }

  const goalDirs = changedGoalDirs(changedPaths, goalsDir)
  if (goalDirs.length === 0) {
    return fail('missing-package', REMEDIATION, [])
  }

  const errors = []
  for (const goalDir of goalDirs) {
    const report = inspectPackage(goalDir, input.readFile)
    errors.push(...report.errors)
  }

  if (errors.length > 0) {
    return fail('invalid-package', errors.join('\n'), goalDirs, errors)
  }

  return pass('validated', `Mulqi goal package validated: ${goalDirs.join(', ')}`, goalDirs)
}

function pass(reason, message, goalDirs = []) {
  return { status: 'pass', reason, message, goalDirs, errors: [], exitCode: 0 }
}

function fail(reason, message, goalDirs = [], errors = [message]) {
  return { status: 'fail', reason, message, goalDirs, errors, exitCode: 1 }
}
