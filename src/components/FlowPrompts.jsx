import { useState } from 'react'
import { buildFlowPrompt } from '../utils/flowPrompts'
import styles from './FlowPrompts.module.css'

export default function FlowPrompts({ character, view }) {
  const [copied, setCopied] = useState(false)
  const prompt = buildFlowPrompt(character, view)

  function copy() {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const meta = VIEW_META[view]

  return (
    <div className={styles.wrapper}>
      <div className={styles.viewBadge}>
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
        <span className={styles.viewDesc}>{meta.desc}</span>
      </div>

      <div className={styles.promptBox}>
        <pre className={styles.prompt}>{prompt}</pre>
      </div>

      <div className={styles.actions}>
        <button className={styles.copyBtn} onClick={copy}>
          {copied ? '✓ Copied' : '📋 Copy Flow Prompt'}
        </button>
        <span className={styles.note}>Paste directly into Google Flow / Veo 2</span>
      </div>

      <div className={styles.params}>
        <span className={styles.param}>📐 9:16</span>
        <span className={styles.param}>⏱ 5–8s clip</span>
        <span className={styles.param}>🎥 {meta.camera}</span>
        <span className={styles.param}>💡 {meta.lighting}</span>
      </div>
    </div>
  )
}

const VIEW_META = {
  front: {
    icon: '👤',
    label: 'Front View',
    desc: 'Direct camera — establishes identity',
    camera: 'Eye-level, static or slow push-in',
    lighting: 'Soft front-fill',
  },
  side: {
    icon: '👥',
    label: 'Side Profile',
    desc: 'Character in thought or in motion',
    camera: '90° profile, slight Dutch tilt',
    lighting: 'Rim light from opposite side',
  },
  back: {
    icon: '🚶',
    label: 'Back View',
    desc: 'Walking away — mystery, departure',
    camera: 'Low angle tracking behind',
    lighting: 'Silhouette or backlight glow',
  },
  closeup: {
    icon: '🔍',
    label: 'Close-Up',
    desc: 'Emotion — eyes, micro-expressions',
    camera: 'Extreme close-up, shallow DOF',
    lighting: 'Single practical + eye light',
  },
}
