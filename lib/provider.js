/**
 * Mulqi Goal Proof — bundled skill provider.
 *
 * Serves the two doctrines (`mulqi-goal-plan`, `mulqi-goal-execute`). Catalog
 * text is derived from each shipped SKILL.md at read time, so editing a
 * doctrine updates the catalog in lockstep and the two can never disagree.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const PROVIDER_NAME = 'mulqi-goal-proof'

/** DSH bundled-skill rank (platform constant BUNDLED_SKILL_RANK = 600). */
export const BUNDLED_SKILL_RANK = 600

/** Shipped doctrines, in catalog order. */
export const SKILL_NAMES = Object.freeze(['mulqi-goal-plan', 'mulqi-goal-execute'])

const INVOCATION = Object.freeze({ modelInvocable: true, userInvocable: true })

const FALLBACK_DESCRIPTION = Object.freeze({
  'mulqi-goal-plan':
    'Turn a feature request, bugfix, refactor, or migration into a goal package: outcome contract, truth owner, cutover, and acceptance evidence.',
  'mulqi-goal-execute':
    'Execute an approved goal package without drifting from ownership, cutover, or proof obligations.',
})

function skillFileUrl(skillName) {
  return new URL(`../skills/${skillName}/SKILL.md`, import.meta.url)
}

function resourceBase(skillName) {
  return {
    kind: 'directory',
    path: fileURLToPath(new URL(`../skills/${skillName}/`, import.meta.url)),
  }
}

/**
 * Minimal YAML frontmatter reader: plain scalars plus folded and literal
 * blocks. Tolerant — never throws, and returns the body when no frontmatter
 * fence is present.
 * @param {string} raw
 * @returns {{ fields: Record<string, string>, body: string }}
 */
export function parseFrontmatter(raw) {
  const text = String(raw ?? '')
  const fields = {}
  const noFrontmatter = { fields, body: text }

  const firstBreak = text.indexOf('\n')
  if (firstBreak < 0) return noFrontmatter
  if (text.slice(0, firstBreak).replace(/\r$/, '').trim() !== '---') return noFrontmatter

  const lines = []
  let pos = firstBreak + 1
  let closePos = -1
  while (pos <= text.length) {
    const nextBreak = text.indexOf('\n', pos)
    const end = nextBreak < 0 ? text.length : nextBreak
    const line = text.slice(pos, end).replace(/\r$/, '')
    if (line.trim() === '---') {
      closePos = pos
      break
    }
    lines.push(line)
    if (nextBreak < 0) break
    pos = nextBreak + 1
  }
  if (closePos < 0) return noFrontmatter

  const bodyStart = text.indexOf('\n', closePos)
  const body = bodyStart < 0 ? '' : text.slice(bodyStart + 1)

  for (let i = 0; i < lines.length; i += 1) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i])
    if (!match) continue
    let value = match[2].trim()
    if (['>-', '>', '|', '|-', '|>'].includes(value)) {
      const literal = value.startsWith('|')
      const block = []
      i += 1
      while (i < lines.length && (/^\s/.test(lines[i]) || lines[i].trim() === '')) {
        block.push(lines[i].trim())
        i += 1
      }
      i -= 1
      value = literal ? block.join('\n') : block.join(' ')
    }
    value = value.replace(/^["']/, '').replace(/["']$/, '').trim()
    fields[match[1]] = value
  }
  return { fields, body }
}

function candidate(skillName, parsed) {
  const name =
    typeof parsed.fields.name === 'string' && parsed.fields.name.trim()
      ? parsed.fields.name.trim()
      : skillName
  const description =
    typeof parsed.fields.description === 'string' && parsed.fields.description.trim()
      ? parsed.fields.description.trim()
      : FALLBACK_DESCRIPTION[skillName]
  return {
    name,
    description,
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: resourceBase(skillName),
    rank: BUNDLED_SKILL_RANK,
    locator: skillFileUrl(skillName),
  }
}

/** @returns {object} a DSH SkillProvider. */
export function makeProvider() {
  return {
    name: PROVIDER_NAME,
    async list() {
      return Promise.all(
        SKILL_NAMES.map(async (skillName) => {
          const raw = await readFile(skillFileUrl(skillName), 'utf8')
          return candidate(skillName, parseFrontmatter(raw))
        }),
      )
    },
    async get(requested) {
      const skillName = SKILL_NAMES.find((entry) => entry === requested?.name)
      if (!skillName) return undefined
      const raw = await readFile(skillFileUrl(skillName), 'utf8')
      const parsed = parseFrontmatter(raw)
      const built = candidate(skillName, parsed)
      return {
        name: built.name,
        description: built.description,
        invocation: built.invocation,
        provider: built.provider,
        source: built.source,
        resourceBase: built.resourceBase,
        content: parsed.body.trim(),
      }
    },
  }
}
