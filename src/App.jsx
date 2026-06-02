import { useState } from 'react'
import SeriesForm from './components/SeriesForm'
import EpisodeList from './components/EpisodeList'
import styles from './App.module.css'

export default function App() {
  const [episodes, setEpisodes] = useState([])

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🎬</span>
          <h1>Drama Series Generator</h1>
        </div>
        <p className={styles.tagline}>AI-powered TikTok drama prompts in seconds</p>
      </header>

      <main className={styles.main}>
        <SeriesForm onGenerate={setEpisodes} />
        {episodes.length > 0 && <EpisodeList episodes={episodes} />}
      </main>
    </div>
  )
}
