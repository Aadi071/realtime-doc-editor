import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Trash2 } from 'lucide-react'

// A simple local sketch pad. NOT collaborative - only you see your strokes
// while drawing. When you click "Insert", the whole canvas is rasterized
// to a PNG and inserted into the document as a plain image, at which point
// it syncs to everyone else exactly like any other edit (it becomes part
// of the Yjs doc's content, same as the image-upload path).
export default function DrawingModal({
  onInsert,
  onClose,
}: {
  onInsert: (dataUrl: string) => void
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawing = useRef(false)
  const [color, setColor] = useState('#1a1a1a')
  const [lineWidth, setLineWidth] = useState(3)

  // Start with a plain white background - without this, toDataURL() would
  // export a transparent PNG, which looks broken pasted into a document
  // with a white page behind it.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function getPos(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    isDrawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    const { x, y } = getPos(e)
    ctx?.beginPath()
    ctx?.moveTo(x, y)
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopDrawing() {
    isDrawing.current = false
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function insert() {
    const canvas = canvasRef.current
    if (!canvas) return
    onInsert(canvas.toDataURL('image/png'))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold text-[var(--text)]">Draw something</h3>

        <div className="mb-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Color
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded-md border border-[var(--border)] bg-transparent p-0.5"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Brush size
            <input
              type="range"
              min={1}
              max={20}
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="accent-[var(--accent)]"
            />
          </label>
          <button
            type="button"
            onClick={clearCanvas}
            className="ease-smooth ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--border)]
              px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors duration-150
              hover:bg-[var(--bg)] hover:text-[var(--text)]"
          >
            <Trash2 size={13} />
            Clear
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={480}
          height={320}
          className="drawing-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="ease-smooth rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-sm font-medium
              text-[var(--text)] transition-colors duration-150 hover:bg-[var(--bg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={insert}
            className="ease-smooth rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium
              text-[var(--accent-contrast)] transition-opacity duration-150 hover:opacity-90"
          >
            Insert into document
          </button>
        </div>
      </div>
    </div>
  )
}
