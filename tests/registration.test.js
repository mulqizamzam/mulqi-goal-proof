/**
 * Mulqi Goal Proof — registration and provider suite.
 *
 * Proves that apply() performs the two registrations the bundle promises and
 * that the catalog is genuinely derived from the shipped SKILL.md files.
 * Uses a mock Cordis context: no host required.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { apply, inject, name } from '../index.js'
import { parseFrontmatter, PROVIDER_NAME, SKILL_NAMES } from '../lib/provider.js'

function mockContext() {
  const registered = { skills: [], tools: [] }
  const ctx = {
    skills: {
      registerProvider(factory) {
        registered.skills.push(factory())
        return () => {}
      },
    },
    tools: {
      register(definition) {
        registered.tools.push(definition)
        return () => {}
      },
    },
  }
  return { ctx, registered }
}

test('bundle declares the expected entry identity and injected services', () => {
  assert.equal(name, 'mulqi-goal-proof')
  assert.deepEqual(inject, ['skills', 'tools'])
})

test('apply registers exactly one skill provider and one tool', () => {
  const { ctx, registered } = mockContext()
  const dispose = apply(ctx)
  assert.equal(registered.skills.length, 1)
  assert.equal(registered.tools.length, 1)
  assert.equal(registered.skills[0].name, PROVIDER_NAME)
  assert.equal(registered.tools[0].name, 'mulqi_gp_check')
  assert.equal(typeof dispose, 'function')
})

test('the gate tool exposes a schema-bound, read-only contract', () => {
  const { ctx, registered } = mockContext()
  apply(ctx)
  const tool = registered.tools[0]
  assert.equal(tool.parameters.type, 'object')
  for (const key of ['baseRef', 'goalsDir', 'requireFor']) {
    assert.ok(Object.hasOwn(tool.parameters.properties, key), `parameter ${key} documented`)
  }
  assert.ok(Array.isArray(tool.output.render({}, { ok: true })), 'render returns blocks')
  const blocks = tool.output.render({}, { ok: true })
  assert.equal(blocks[0].type, 'text')
})

test('provider lists every shipped doctrine with a real description', async () => {
  const { ctx, registered } = mockContext()
  apply(ctx)
  const candidates = await registered.skills[0].list()
  assert.equal(candidates.length, SKILL_NAMES.length)
  assert.deepEqual(
    candidates.map((entry) => entry.name).sort(),
    [...SKILL_NAMES].sort(),
  )
  for (const entry of candidates) {
    assert.ok(entry.description.length > 40, `${entry.name} has a substantive description`)
    assert.ok(entry.description.startsWith('Use when'), `${entry.name} description states a trigger`)
    assert.equal(entry.rank, 600)
    assert.equal(entry.source, 'bundled')
    assert.equal(entry.invocation.modelInvocable, true)
    assert.equal(entry.invocation.userInvocable, true)
  }
})

test('provider get returns the doctrine body without frontmatter', async () => {
  const { ctx, registered } = mockContext()
  apply(ctx)
  const provider = registered.skills[0]
  for (const skillName of SKILL_NAMES) {
    const definition = await provider.get({ name: skillName })
    assert.ok(definition, `${skillName} loads`)
    assert.equal(definition.name, skillName)
    assert.ok(definition.content.startsWith('# '), `${skillName} body starts with a heading`)
    assert.ok(!definition.content.includes('\ndescription:'), `${skillName} body omits frontmatter`)
  }
})

test('provider returns undefined for a skill it does not serve', async () => {
  const { ctx, registered } = mockContext()
  apply(ctx)
  assert.equal(await registered.skills[0].get({ name: 'not-a-doctrine' }), undefined)
})

test('catalog text is derived from disk, not hardcoded', () => {
  const raw = readFileSync(new URL('../skills/mulqi-goal-plan/SKILL.md', import.meta.url), 'utf8')
  const parsed = parseFrontmatter(raw)
  assert.equal(parsed.fields.name, 'mulqi-goal-plan')
  assert.ok(parsed.fields.description.startsWith('Use when'))
  // A meaningful slice of the description must survive the block-scalar path.
  assert.ok(parsed.fields.description.includes('goal package'))
})

test('frontmatter parser tolerates input without a fence', () => {
  const parsed = parseFrontmatter('no frontmatter here\n')
  assert.deepEqual(parsed.fields, {})
  assert.equal(parsed.body, 'no frontmatter here\n')
})
