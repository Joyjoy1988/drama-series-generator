import { useState } from 'react'
import { computeN4 } from '../utils/n4scoring'
import styles from './N4Score.module.css'

const DIMENSIONS = [
  {
    key: 'novelty',
    label: 'Novelty',
    icon: '✨',
    description: 'How unique and fresh is this character compared to genre tropes?',
    hints: ['Generic archetype', 'Some unique traits', 'Fresh subversion', 'Highly original', 'Never seen before'],
  },
  {
    key: 'naturalness',
    label: 'Naturalness',
    icon: '🌿',
    description: 'How authentic and believable are their motivations and reactions?',
    hints: ['Feels scripted', 'Mostly believable', 'Rings true', 'Very human', 'Deeply authentic'],
  },
  {
    key: 'nuance',
    label: 'Nuance',
    icon: '🎭',
    description: 'How layered and complex is their personality — flaws, contradictions, depth?',
    hints: ['Flat / one-note', 'Slight complexity', 'Some layers', 'Multi-dimensional', 'Richly complex'],
  },
  {
    key: 'narrative',
    label: 'Narrative Fit',
    icon: '📖',
    description: 'How well does this character serve the story\'s drama, conflict, and arc?',
    hints: ['Doesn\'t serve plot', 'Minimal impact', 'Useful presence', 'Strong driver', 'Essential catalyst'],
  },
]

export default function N4Score({ value, character, onChange }) {
  const [scores, setScores] = useState(
    value ?? { novelty: 0, naturalness: 0, nuance: 0, narrative: 0 }
  )
  const [hover, setHover] = useState({})

  function setDim(key, val) {
    const next = { ...scores, [key]: val }
    setScores(next)
    const computed = computeN4(next, character)
    onChange(computed)
  }

  const computed = computeN4(scores, character)

  return (
    <div className={styles.wrapper}>
      <div className={styles.dims}>
        {DIMENSIONS.map(({ key, label, icon, description, hints }) => {
          const active = scores[key]
          const hov = hover[key] ?? 0
          return (
            <div key={key} className={styles.dim}>
              <div className={styles.dimHeader}>
                <span>{icon} {label}</span>
                <span className={styles.dimVal}>{active}/5</span>
              </div>
              <p className={styles.dimDesc}>{description}</p>
              <div className={styles.stars}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    className={`${styles.star} ${n <= (hov || active) ? styles.starOn : ''}`}
                    onMouseEnter={() => setHover(h => ({ ...h, [key]: n }))}
                    onMouseLeave={() => setHover(h => ({ ...h, [key]: 0 }))}
                    onClick={() => setDim(key, n)}
                    title={hints[n - 1]}
                  >
                    ★
                  </button>
                ))}
                {(hov || active) > 0 && (
                  <span className={styles.hint}>{hints[(hov || active) - 1]}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {computed.total > 0 && (
        <div className={styles.total}>
          <div className={styles.totalLeft}>
            <span className={styles.totalLabel}>N4 Score</span>
            <span className={styles.totalVal}>{computed.total}<span className={styles.totalMax}>/20</span></span>
          </div>
          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${(computed.total / 20) * 100}%` }} />
          </div>
          <span className={styles.tier}>{computed.tier}</span>
        </div>
      )}
    </div>
  )
}
