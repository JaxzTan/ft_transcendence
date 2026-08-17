import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { COL, type ColorKey } from '../theme'

const CELL_BG = '#efe6d6'
const LINE = '#c9b995'

// ─── Track geometry ─────────────────────────────────────────────────────────
// The engine works purely in logical steps (0-57, see board-mapper.ts) and has
// no concept of board coordinates — the UI owns that mapping entirely. Red's
// 13-cell path segment below was derived from the existing STARTS/laneColor
// cells already in this file, then the other 3 colors' segments are generated
// by rotating it 90° around the grid center — the classic 15×15 cross board
// has exact 4-fold rotational symmetry, and this closes correctly (each
// color's last cell is adjacent to the next color's start, verified by hand).
type Cell = { r: number; c: number }

const RED_SEGMENT: Cell[] = [
  { r: 6, c: 1 }, { r: 6, c: 2 }, { r: 6, c: 3 }, { r: 6, c: 4 }, { r: 6, c: 5 },
  { r: 5, c: 6 }, { r: 4, c: 6 }, { r: 3, c: 6 }, { r: 2, c: 6 }, { r: 1, c: 6 }, { r: 0, c: 6 },
  { r: 0, c: 7 }, { r: 0, c: 8 },
]

/** 90° clockwise rotation about the 15×15 grid's center (7,7). */
function rotate90({ r, c }: Cell): Cell {
  return { r: c, c: 14 - r }
}

function rotateN(cell: Cell, n: number): Cell {
  let out = cell
  for (let i = 0; i < n; i++) out = rotate90(out)
  return out
}

/** The full 52-cell shared outer loop, track position 1-52 → board cell. */
const TRACK_CELLS: Cell[] = [0, 1, 2, 3].flatMap((rot) => RED_SEGMENT.map((cell) => rotateN(cell, rot)))

const RED_HOME_LANE: Cell[] = [
  { r: 7, c: 1 }, { r: 7, c: 2 }, { r: 7, c: 3 }, { r: 7, c: 4 }, { r: 7, c: 5 },
]

const HOME_LANES: Record<ColorKey, Cell[]> = {
  red: RED_HOME_LANE,
  green: RED_HOME_LANE.map((cell) => rotateN(cell, 1)),
  yellow: RED_HOME_LANE.map((cell) => rotateN(cell, 2)),
  blue: RED_HOME_LANE.map((cell) => rotateN(cell, 3)),
}

const TRACK_OFFSET: Record<ColorKey, number> = { red: 0, green: 13, yellow: 26, blue: 39 }

/** Map a piece's logical step (1-57) to a board cell, or null if not on the board (base/goal). */
function stepToCell(color: ColorKey, step: number): Cell | null {
  if (step >= 52 && step <= 56) return HOME_LANES[color][step - 52]
  if (step >= 1 && step <= 51) {
    const trackPos = ((step + TRACK_OFFSET[color] - 1) % 52) + 1
    return TRACK_CELLS[trackPos - 1]
  }
  return null
}

function Sphere({ ck }: { ck: ColorKey }) {
  const c = COL[ck]
  return (
    <div
      style={{
        width: '72%',
        aspectRatio: '1',
        borderRadius: '50%',
        background: `radial-gradient(circle at 34% 30%, #ffffffdd, ${c.base} 52%, ${c.dark})`,
        boxShadow: '0 3px 5px rgba(0,0,0,.45)',
        border: '2px solid rgba(0,0,0,.28)',
      }}
    />
  )
}

function Ring({ ck }: { ck: ColorKey }) {
  return (
    <div
      style={{
        width: '62%',
        aspectRatio: '1',
        borderRadius: '50%',
        border: `2px dashed ${COL[ck].base}88`,
        boxSizing: 'border-box',
      }}
    />
  )
}

function Yard({
  r, c, ck, basePieces, legalPieceIds, onPieceClick,
}: {
  r: number
  c: number
  ck: ColorKey
  basePieces: Array<{ id: string }>
  legalPieceIds: Set<string>
  onPieceClick?: (pieceId: string) => void
}) {
  const col = COL[ck]
  return (
    <div
      style={{
        gridRow: `${r + 1} / span 6`,
        gridColumn: `${c + 1} / span 6`,
        padding: '11%',
        background: col.yard,
        border: `3px solid ${col.base}`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: CELL_BG,
          borderRadius: 10,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '10%',
          padding: '13%',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,.2)',
        }}
      >
        {[0, 1, 2, 3].map((s) => {
          const piece = basePieces[s]
          if (!piece) return <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ring ck={ck} /></div>
          const isLegal = legalPieceIds.has(piece.id)
          return (
            <div
              key={s}
              onClick={() => isLegal && onPieceClick?.(piece.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isLegal ? 'pointer' : 'default',
                border: isLegal ? '2.5px solid #9aa4ad' : 'none',
                boxShadow: isLegal ? '0 0 0 4px rgba(160,165,170,.35), 0 0 10px rgba(0,0,0,.45)' : 'none',
                animation: isLegal ? 'haloPulse 1.8s ease-in-out infinite' : 'none',
                borderRadius: '50%',
              }}
            >
              <Sphere ck={ck} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Star/safe start cells, tinted the owner color. */
const STARTS: Record<string, ColorKey> = { '6,1': 'red', '1,8': 'green', '8,13': 'yellow', '13,6': 'blue' }

// Pre-start safe cells matching the backend's SAFE_TRACK_POSITIONS.
const SAFE_STAR_CELLS: Record<string, boolean> = (() => {
  const SAFE_TRACK_POSITIONS = [1, 9, 14, 22, 27, 35, 40, 48];
  const m: Record<string, boolean> = {};
  for (const tp of SAFE_TRACK_POSITIONS) {
    const cell = TRACK_CELLS[tp - 1];
    m[`${cell.r},${cell.c}`] = true;
  }
  return m;
})();

/** Home-stretch lane color for a track cell, or null for a plain cell. */
function laneColor(r: number, c: number): string | null {
  if (r === 7 && c >= 1 && c <= 5) return COL.red.base
  if (c === 7 && r >= 1 && r <= 5) return COL.green.base
  if (r === 7 && c >= 9 && c <= 13) return COL.yellow.base
  if (c === 7 && r >= 9 && r <= 13) return COL.blue.base
  return null
}

type BoardProps = {
  pieces?: Array<{ id: string; color: string; step: number; isInGoal: boolean; isInBase: boolean }>
  players?: Array<{ color: string; status: string }>
  legalMoves?: Array<{ pieceId: string; from: number; to: number; isCapture: boolean; isHomeEntry: boolean }>
  onPieceClick?: (pieceId: string) => void
  /** While set, this piece renders at `step` (box by box) instead of its real logical step — see Game.tsx's move animation. */
  animating?: { pieceId: string; step: number } | null
  /** Transient capture burst: expanding ring + sparks on the cell the mover landed on. Pure cosmetic overlay. */
  fx?: { color: string; to: number } | null
}

/** The classic 15×15 cross board, rendered procedurally — no images. */
export function Board({ pieces = [], players = [], legalMoves, onPieceClick, animating, fx }: BoardProps = {}) {
  const legalPieceIds = new Set((legalMoves ?? []).map((m) => m.pieceId))
  const activeColors = new Set(players.filter((p) => p.status === 'active').map((p) => p.color))
  const basePieces = (ck: ColorKey) =>
    activeColors.has(ck) ? pieces.filter((p) => p.color === ck && p.isInBase) : []

  const cells: ReactNode[] = []
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const inCross = (r >= 6 && r <= 8) || (c >= 6 && c <= 8)
      if (!inCross) continue
      if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue // center handled separately
      const key = `${r},${c}`
      const startCol = STARTS[key]
      const bg = startCol ? COL[startCol].base : laneColor(r, c) || CELL_BG
      const style: CSSProperties = {
        gridRow: r + 1,
        gridColumn: c + 1,
        background: bg,
        border: `1px solid ${LINE}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }
      let inner: ReactNode = null
      if (startCol)
        inner = (
          <div
            style={{
              width: '44%',
              height: '44%',
              clipPath:
                'polygon(50% 0,61% 35%,100% 35%,68% 57%,79% 100%,50% 72%,21% 100%,32% 57%,0 35%,39% 35%)',
              background: 'rgba(255,255,255,.85)',
            }}
          />
        )
      else if (SAFE_STAR_CELLS[key])
        inner = (
          <div
            style={{
              width: '36%',
              height: '36%',
              clipPath:
                'polygon(50% 0,61% 35%,100% 35%,68% 57%,79% 100%,50% 72%,21% 100%,32% 57%,0 35%,39% 35%)',
              background: '#000',
            }}
          />
        )
      cells.push(
        <div key={`p${key}`} style={style}>
          {inner}
        </div>,
      )
    }
  }

  // Render engine-driven pieces on the actual track cell their step maps to.
  // Grouped by cell so pieces sharing a square (common near base/captures)
  // fan out into sub-positions instead of fully overlapping.
  const byCell = new Map<string, Array<{ id: string; ck: ColorKey; isLegal: boolean }>>()
  for (const piece of pieces) {
    if (!activeColors.has(piece.color)) continue
    const isAnimating = animating?.pieceId === piece.id
    // Mid-animation the piece may already be logically captured/home/goal in
    // state (server applies the full move atomically) — render it at its
    // in-transit step regardless so the box-by-box travel stays visible.
    if (!isAnimating && (piece.isInBase || piece.isInGoal || piece.step <= 0)) continue
    const ck = piece.color as ColorKey
    const cell = stepToCell(ck, isAnimating ? animating!.step : piece.step)
    if (!cell) continue
    const key = `${cell.r},${cell.c}`
    const list = byCell.get(key) ?? []
    list.push({ id: piece.id, ck, isLegal: legalPieceIds.has(piece.id) })
    byCell.set(key, list)
  }

  // Sub-cell offsets so up to 4 stacked pieces stay individually visible/clickable.
  const SUB_OFFSETS = [
    { x: -22, y: -22 }, { x: 22, y: -22 }, { x: -22, y: 22 }, { x: 22, y: 22 },
  ]

  // Inject halo pulse keyframes once
  const injected = useRef(false)
  useEffect(() => {
    if (injected.current) return
    injected.current = true
    const id = 'board-halo-keyframes'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes haloPulse {
        0% { box-shadow: 0 0 0 4px rgba(160,165,170,.35), 0 0 6px rgba(0,0,0,.45); }
        50% { box-shadow: 0 0 0 7px rgba(160,165,170,.55), 0 0 14px rgba(0,0,0,.55); }
        100% { box-shadow: 0 0 0 4px rgba(160,165,170,.35), 0 0 6px rgba(0,0,0,.45); }
      }
      @keyframes captureRing {
        from { transform: scale(.2); opacity: .9; }
        to   { transform: scale(1.9); opacity: 0; }
      }
      @keyframes captureSpark {
        from { transform: translate(0,0) scale(1); opacity: 1; }
        to   { transform: translate(var(--dx), var(--dy)) scale(.2); opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }, [])

  const enginePieces: ReactNode[] = []

  // Capture burst FX: transient ring + sparks on the landing cell. Positioned
  // like enginePieces (grid row/col), above them (zIndex 11), non-interactive.
  if (fx && fx.to >= 1 && fx.to <= 57) {
    const ck = fx.color as ColorKey
    const cell = stepToCell(ck, fx.to)
    if (cell) {
      const col = COL[ck]
      let uid = 0
      const spark = (dx: number, dy: number, size: number, bg: string) => (
        <div
          key={`fx-s${uid++}`}
          style={
            {
              gridRow: cell.r + 1,
              gridColumn: cell.c + 1,
              width: size,
              height: size,
              alignSelf: 'center',
              justifySelf: 'center',
              borderRadius: '50%',
              background: bg,
              pointerEvents: 'none',
              zIndex: 11,
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              animation: 'captureSpark 600ms ease-out forwards',
            } as CSSProperties & Record<'--dx' | '--dy', string>
          }
        />
      )
      enginePieces.push(
        <div
          key="fx-ring"
          style={{
            gridRow: cell.r + 1,
            gridColumn: cell.c + 1,
            width: 34,
            height: 34,
            alignSelf: 'center',
            justifySelf: 'center',
            borderRadius: '50%',
            border: `3px solid ${col.base}`,
            boxShadow: `0 0 12px ${col.base}aa`,
            pointerEvents: 'none',
            zIndex: 11,
            animation: 'captureRing 600ms ease-out forwards',
          }}
        />,
        spark(0, -20, 7, '#ffffff'),
        spark(0, 20, 7, col.base),
        spark(-20, 0, 6, '#ffffff'),
        spark(20, 0, 6, col.base),
        spark(-14, -14, 5, col.base),
        spark(14, -14, 5, '#ffffff'),
        spark(-14, 14, 5, '#ffffff'),
        spark(14, 14, 5, col.base),
      )
    }
  }

  for (const [key, list] of byCell) {
    const [r, c] = key.split(',').map(Number)
    list.forEach((p, i) => {
      const col = COL[p.ck]
      const offset = list.length > 1 ? SUB_OFFSETS[i % SUB_OFFSETS.length] : { x: 0, y: 0 }
      enginePieces.push(
        <div
          key={p.id}
          onClick={() => p.isLegal && onPieceClick?.(p.id)}
          style={{
            gridRow: r + 1,
            gridColumn: c + 1,
            width: 20,
            height: 20,
            alignSelf: 'center',
            justifySelf: 'center',
            borderRadius: '50%',
            background: `radial-gradient(circle at 34% 30%, #ffffffdd, ${col.base} 52%, ${col.dark})`,
            border: p.isLegal ? '2.5px solid #9aa4ad' : '2px solid rgba(0,0,0,.28)',
            boxShadow: p.isLegal ? '0 0 0 4px rgba(160,165,170,.35), 0 0 10px rgba(0,0,0,.45)' : '0 2px 4px rgba(0,0,0,.45)',
            animation: p.isLegal ? 'haloPulse 1.8s ease-in-out infinite' : 'none',
            cursor: p.isLegal ? 'pointer' : 'default',
            zIndex: 10,
            transform: `translate(${offset.x}%, ${offset.y}%)`,
          }}
        />,
      )
    })
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          display: 'grid',
          gridTemplateColumns: 'repeat(15,1fr)',
          gridTemplateRows: 'repeat(15,1fr)',
          gap: 1,
          padding: '2.5%',
          borderRadius: 12,
          background: 'linear-gradient(160deg,#25150f,#1a0f0a)',
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,.5)',
        }}
      >
        <Yard r={0} c={0} ck="red" basePieces={basePieces('red')} legalPieceIds={legalPieceIds} onPieceClick={onPieceClick} />
        <Yard r={0} c={9} ck="green" basePieces={basePieces('green')} legalPieceIds={legalPieceIds} onPieceClick={onPieceClick} />
        <Yard r={9} c={9} ck="yellow" basePieces={basePieces('yellow')} legalPieceIds={legalPieceIds} onPieceClick={onPieceClick} />
        <Yard r={9} c={0} ck="blue" basePieces={basePieces('blue')} legalPieceIds={legalPieceIds} onPieceClick={onPieceClick} />
        <div
          style={{
            gridRow: '7 / span 3',
            gridColumn: '7 / span 3',
            background: `conic-gradient(from 45deg, ${COL.yellow.base} 0 90deg, ${COL.blue.base} 90deg 180deg, ${COL.red.base} 180deg 270deg, ${COL.green.base} 270deg 360deg)`,
            boxShadow: 'inset 0 0 0 2px rgba(0,0,0,.35)',
            transform: 'rotate(-90deg)',
          }}
        />
        {cells}
        {enginePieces}
      </div>
    </div>
  )
}