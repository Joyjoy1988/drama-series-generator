const TIERS = [
  { min: 17, label: '🏆 Iconic — broadcast-ready character' },
  { min: 13, label: '⭐ Strong — compelling with clear arc' },
  { min: 9,  label: '📈 Developing — refine backstory & nuance' },
  { min: 5,  label: '📝 Draft — needs more depth' },
  { min: 1,  label: '🌱 Concept — flesh out all dimensions' },
  { min: 0,  label: '—' },
]

export function computeN4(scores, character) {
  const { novelty = 0, naturalness = 0, nuance = 0, narrative = 0 } = scores

  // Bonus: +1 if face anchor set, +1 if backstory filled
  let bonus = 0
  if (character?.faceAnchor?.anchor) bonus += 1
  if (character?.backstory?.trim().length > 40) bonus += 1

  const raw = novelty + naturalness + nuance + narrative
  const total = Math.min(20, raw + bonus)

  const tier = TIERS.find(t => total >= t.min)?.label ?? '—'

  return { novelty, naturalness, nuance, narrative, bonus, total, tier }
}
