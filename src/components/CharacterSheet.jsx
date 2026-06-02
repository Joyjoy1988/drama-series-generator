import { useState } from 'react'
import ImageUpload from './ImageUpload'
import FlowPrompts from './FlowPrompts'
import N4Score from './N4Score'
import styles from './CharacterSheet.module.css'

const ROLES = ['Protagonist', 'Antagonist', 'Love Interest', 'Mentor', 'Comic Relief', 'Rival', 'Side Character']

function emptyCharacter() {
  return {
    id: crypto.randomUUID(),
    name: '',
    role: 'Protagonist',
    age: '',
    personality: '',
    backstory: '',
    appearance: '',
    faceAnchor: null,       // { url, bbox: {x,y,w,h} } — uploaded reference image
    n4Score: null,          // { N, novelty, naturalness, nuance, narrative }
    expanded: true,
  }
}

export default function CharacterSheet({ characters, onChange }) {
  const [activeId, setActiveId] = useState(null)

  function add() {
    const c = emptyCharacter()
    onChange([...characters, c])
    setActiveId(c.id)
  }

  function remove(id) {
    onChange(characters.filter(c => c.id !== id))
    if (activeId === id) setActiveId(null)
  }

  function update(id, patch) {
    onChange(characters.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <h2>Character Sheets</h2>
        <button className={styles.addBtn} onClick={add}>+ Add Character</button>
      </div>

      {characters.length === 0 && (
        <div className={styles.empty}>
          <p>No characters yet. Add one to build reference sheets and generate Google Flow prompts.</p>
        </div>
      )}

      {characters.map(char => (
        <CharacterPanel
          key={char.id}
          char={char}
          active={activeId === char.id}
          onToggle={() => setActiveId(activeId === char.id ? null : char.id)}
          onUpdate={patch => update(char.id, patch)}
          onRemove={() => remove(char.id)}
        />
      ))}
    </div>
  )
}

function CharacterPanel({ char, active, onToggle, onUpdate, onRemove }) {
  const [promptTab, setPromptTab] = useState('front')

  return (
    <div className={`${styles.panel} ${active ? styles.panelOpen : ''}`}>
      {/* ── Panel header ── */}
      <div className={styles.panelHeader} onClick={onToggle}>
        <div className={styles.panelMeta}>
          <span className={styles.roleChip}>{char.role}</span>
          <span className={styles.charName}>{char.name || 'Unnamed Character'}</span>
          {char.n4Score && (
            <span className={styles.n4Badge} title="N4 Score">N4 {char.n4Score.total}</span>
          )}
        </div>
        <div className={styles.panelActions} onClick={e => e.stopPropagation()}>
          <button className={styles.removeBtn} onClick={onRemove} title="Delete character">✕</button>
          <span className={styles.chevron}>{active ? '▲' : '▼'}</span>
        </div>
      </div>

      {active && (
        <div className={styles.panelBody}>
          {/* ── Two-column: form + image ── */}
          <div className={styles.topGrid}>
            <div className={styles.formCol}>
              <Field label="Name">
                <input value={char.name} onChange={e => onUpdate({ name: e.target.value })} placeholder="Character name" />
              </Field>
              <Field label="Role">
                <select value={char.role} onChange={e => onUpdate({ role: e.target.value })}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Age">
                <input value={char.age} onChange={e => onUpdate({ age: e.target.value })} placeholder="e.g. 24" />
              </Field>
              <Field label="Appearance">
                <textarea
                  rows={3}
                  value={char.appearance}
                  onChange={e => onUpdate({ appearance: e.target.value })}
                  placeholder="Hair, eyes, build, style, distinguishing features..."
                />
              </Field>
              <Field label="Personality">
                <textarea
                  rows={2}
                  value={char.personality}
                  onChange={e => onUpdate({ personality: e.target.value })}
                  placeholder="Traits, quirks, speech style..."
                />
              </Field>
              <Field label="Backstory">
                <textarea
                  rows={3}
                  value={char.backstory}
                  onChange={e => onUpdate({ backstory: e.target.value })}
                  placeholder="Key history that drives their motivation..."
                />
              </Field>
            </div>

            {/* ── Face anchor upload ── */}
            <div className={styles.imageCol}>
              <p className={styles.sectionLabel}>Face Anchor</p>
              <ImageUpload
                value={char.faceAnchor}
                onChange={anchor => onUpdate({ faceAnchor: anchor })}
              />
            </div>
          </div>

          {/* ── N4 Scoring ── */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>N4 Character Score</p>
            <N4Score value={char.n4Score} character={char} onChange={score => onUpdate({ n4Score: score })} />
          </div>

          {/* ── Google Flow Prompts ── */}
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Google Flow Video Prompts</p>
            <div className={styles.promptTabs}>
              {['front', 'side', 'back', 'closeup'].map(view => (
                <button
                  key={view}
                  className={`${styles.promptTab} ${promptTab === view ? styles.promptTabActive : ''}`}
                  onClick={() => setPromptTab(view)}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
            <FlowPrompts character={char} view={promptTab} />
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  )
}
