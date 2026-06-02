import { useState } from 'react'
import { generateEpisodes } from '../utils/generator'
import styles from './SeriesForm.module.css'

const GENRES = ['Romance', 'Revenge', 'Betrayal', 'Forbidden Love', 'Rags to Riches', 'Thriller']
const SETTINGS = ['Modern City', 'Corporate Office', 'High School', 'Royal Palace', 'Small Town', 'Hospital']

export default function SeriesForm({ onGenerate }) {
  const [form, setForm] = useState({
    title: '',
    genre: 'Romance',
    setting: 'Modern City',
    episodes: 5,
    protagonistName: '',
    antagonistName: '',
    hook: '',
  })
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      const result = generateEpisodes(form)
      onGenerate(result)
      setLoading(false)
    }, 800)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>Series Setup</h2>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label>Series Title</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="My Forbidden Love"
            required
          />
        </div>

        <div className={styles.field}>
          <label>Protagonist Name</label>
          <input
            name="protagonistName"
            value={form.protagonistName}
            onChange={handleChange}
            placeholder="Mia Chen"
          />
        </div>

        <div className={styles.field}>
          <label>Antagonist Name</label>
          <input
            name="antagonistName"
            value={form.antagonistName}
            onChange={handleChange}
            placeholder="Lucas Zhao"
          />
        </div>

        <div className={styles.field}>
          <label>Genre</label>
          <select name="genre" value={form.genre} onChange={handleChange}>
            {GENRES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label>Setting</label>
          <select name="setting" value={form.setting} onChange={handleChange}>
            {SETTINGS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className={styles.field}>
          <label>Number of Episodes: {form.episodes}</label>
          <input
            type="range"
            name="episodes"
            min={3}
            max={15}
            value={form.episodes}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label>Central Conflict / Hook</label>
        <textarea
          name="hook"
          value={form.hook}
          onChange={handleChange}
          placeholder="She discovers her new boss is the boy who broke her heart 10 years ago..."
          rows={3}
        />
      </div>

      <button className={styles.submit} type="submit" disabled={loading}>
        {loading ? 'Generating...' : '✨ Generate Episodes'}
      </button>
    </form>
  )
}
