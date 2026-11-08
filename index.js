/**
 * Mulqi Goal Proof — native DeepSeek Harness bundle.
 *
 * Cordis plugin entry. On apply:
 *   1. registers the two bundled doctrines (`mulqi-goal-plan`,
 *      `mulqi-goal-execute`) on ctx.skills at the bundled-skill rank;
 *   2. registers the native proof-gate tool (`mulqi_gp_check`) on ctx.tools,
 *      backed by the pure engine in lib/gate.js;
 *   3. both registrations are disposed in reverse order on teardown.
 *
 * The same engine is also exposed as a CLI (`bin/mulqi-goal-proof.js`) for
 * pre-commit and CI use, where a non-zero exit is the point.
 *
 * Zero runtime dependencies (Node builtins only).
 */

import { makeProvider } from './lib/provider.js'
import { createGateTools } from './lib/tools.js'

/** Cordis entry id (diagnostic label in host logs). */
export const name = 'mulqi-goal-proof'

/** Services required at composition time. */
export const inject = ['skills', 'tools']

/**
 * @param {object} ctx Cordis plugin context.
 * @returns {() => void} disposer for every registration performed here.
 */
export function apply(ctx) {
  const disposers = []

  disposers.push(ctx.skills.registerProvider(() => makeProvider()))

  for (const definition of createGateTools()) {
    disposers.push(ctx.tools.register(definition))
  }

  return () => {
    for (const dispose of disposers.reverse()) {
      if (typeof dispose === 'function') dispose()
    }
  }
}
