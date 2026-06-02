import { useRef, useState } from 'react'
import styles from './ImageUpload.module.css'

export default function ImageUpload({ value, onChange }) {
  const inputRef = useRef(null)
  const canvasRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [anchor, setAnchor] = useState(null)   // {x, y} relative 0-1 for face center
  const [anchoring, setAnchoring] = useState(false)

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    onChange({ url, anchor: null })
    setAnchor(null)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleClick(e) {
    if (anchoring && value?.url) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      const newAnchor = { x: parseFloat(x.toFixed(3)), y: parseFloat(y.toFixed(3)) }
      setAnchor(newAnchor)
      onChange({ ...value, anchor: newAnchor })
      setAnchoring(false)
    }
  }

  function clear() {
    onChange(null)
    setAnchor(null)
    setAnchoring(false)
  }

  const anchorPct = anchor ?? value?.anchor

  return (
    <div className={styles.wrapper}>
      {!value?.url ? (
        <div
          className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
        >
          <span className={styles.dropIcon}>📷</span>
          <p>Drop face reference image<br /><span>or click to upload</span></p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className={styles.hidden}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className={styles.previewWrap}>
          <div
            className={`${styles.imgContainer} ${anchoring ? styles.crosshair : ''}`}
            onClick={handleClick}
          >
            <img src={value.url} alt="Face reference" className={styles.img} />
            {anchorPct && (
              <div
                className={styles.anchorDot}
                style={{ left: `${anchorPct.x * 100}%`, top: `${anchorPct.y * 100}%` }}
                title={`Face anchor: ${Math.round(anchorPct.x * 100)}%, ${Math.round(anchorPct.y * 100)}%`}
              />
            )}
          </div>
          <div className={styles.imgActions}>
            <button
              className={`${styles.actionBtn} ${anchoring ? styles.actionActive : ''}`}
              onClick={() => setAnchoring(a => !a)}
              title="Click to place face anchor point on the image"
            >
              {anchoring ? '🎯 Click image to set anchor' : anchorPct ? '✅ Anchor set' : '🎯 Set face anchor'}
            </button>
            {anchorPct && (
              <span className={styles.anchorCoords}>
                ({Math.round(anchorPct.x * 100)}%, {Math.round(anchorPct.y * 100)}%)
              </span>
            )}
            <button className={styles.clearBtn} onClick={clear}>Remove</button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className={styles.hidden} />
    </div>
  )
}
