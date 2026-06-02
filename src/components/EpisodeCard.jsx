import { useState } from 'react'
import styles from './EpisodeCard.module.css'

export default function EpisodeCard({ episode }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  function copy() {
    const text = `Episode ${episode.number}: ${episode.title}\n\n${episode.prompt}\n\nCliffhanger: ${episode.cliffhanger}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.card}>
      <div className={styles.top} onClick={() => setExpanded(e => !e)}>
        <div className={styles.meta}>
          <span className={styles.num}>EP {episode.number}</span>
          <h3 className={styles.epTitle}>{episode.title}</h3>
        </div>
        <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className={styles.body}>
          <p className={styles.prompt}>{episode.prompt}</p>
          <div className={styles.cliffhanger}>
            <span className={styles.cliffLabel}>Cliffhanger</span>
            <p>{episode.cliffhanger}</p>
          </div>
          <div className={styles.tags}>
            {episode.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
          </div>
          <button className={styles.copy} onClick={copy}>
            {copied ? '✓ Copied' : 'Copy Prompt'}
          </button>
        </div>
      )}
    </div>
  )
}
