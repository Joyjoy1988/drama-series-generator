import { useState } from 'react'
import EpisodeCard from './EpisodeCard'
import styles from './EpisodeList.module.css'

export default function EpisodeList({ episodes }) {
  const [copied, setCopied] = useState(false)

  function copyAll() {
    const text = episodes.map(ep =>
      `Episode ${ep.number}: ${ep.title}\n${ep.prompt}\n\nHook: ${ep.cliffhanger}`
    ).join('\n\n---\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{episodes.length} Episodes Generated</h2>
        <button className={styles.copyAll} onClick={copyAll}>
          {copied ? '✓ Copied!' : '📋 Copy All'}
        </button>
      </div>
      <div className={styles.list}>
        {episodes.map(ep => <EpisodeCard key={ep.number} episode={ep} />)}
      </div>
    </div>
  )
}
