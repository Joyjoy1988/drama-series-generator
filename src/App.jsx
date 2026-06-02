import { useState } from 'react'
import SeriesForm from './components/SeriesForm'
import EpisodeList from './components/EpisodeList'
import CharacterSheet from './components/CharacterSheet'
import styles from './App.module.css'

const TABS = ['Episodes', 'Characters']

export default function App() {
  const [tab, setTab] = useState('Episodes')
  const [episodes, setEpisodes] = useState([])
  const [characters, setCharacters] = useState([])

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🎬</span>
          <h1>Drama Series Generator</h1>
        </div>
        <p className={styles.tagline}>AI-powered TikTok drama prompts · Character sheets · Google Flow ready</p>
      </header>

      <nav className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'Episodes' ? '🎞 Episodes' : '🧑‍🎤 Characters'}
          </button>
        ))}
      </nav>

      <main className={styles.main}>
        {tab === 'Episodes' && (
          <>
            <SeriesForm onGenerate={setEpisodes} characters={characters} />
            {episodes.length > 0 && <EpisodeList episodes={episodes} />}
          </>
        )}
        {tab === 'Characters' && (
          <CharacterSheet characters={characters} onChange={setCharacters} />
        )}
      </main>
    </div>
  )
}
