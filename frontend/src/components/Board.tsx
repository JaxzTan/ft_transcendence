import type { CSSProperties, ReactNode } from 'react'
import { COL, type ColorKey } from '../theme'

const CELL_BG = '#ffffff'
const LINE = 'rgba(93, 228, 199, 0.22)'

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
        width: '74%',
        aspectRatio: '1',
        borderRadius: '50%',
        background: `radial-gradient(circle at 32% 28%, #ffffff, ${c.base} 55%, ${c.dark})`,
        boxShadow: `0 4px 8px rgba(0,0,0,.5), 0 0 12px ${c.base}88`,
        border: '1.5px solid rgba(255,255,255,.4)',
      }}
    />
  )
}

function Ring({ ck }: { ck: ColorKey }) {
  return (
    <div
      style={{
        width: '64%',
        aspectRatio: '1',
        borderRadius: '50%',
        border: `2px dashed ${COL[ck].base}99`,
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
        borderRadius: 16,
        boxShadow: `inset 0 0 14px rgba(0,0,0,.6), 0 0 16px ${col.base}44`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: CELL_BG,
          borderRadius: 12,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '10%',
          padding: '13%',
          boxShadow: 'inset 0 3px 8px rgba(0,0,0,.15)',
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
                filter: isLegal ? 'drop-shadow(0 0 8px #5de4c7) drop-shadow(0 0 14px #89ddff)' : 'none',
                transform: isLegal ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform .15s ease',
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
}

/** The classic 15×15 cross board, rendered procedurally — no images. */
export function Board({ pieces = [], players = [], legalMoves, onPieceClick }: BoardProps = {}) {
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
        boxShadow: startCol ? `inset 0 0 6px rgba(0,0,0,.2)` : undefined,
      }
      let inner: ReactNode = null
      if (startCol)
        inner = (
          <div
            style={{
              width: '48%',
              height: '48%',
              clipPath:
                'polygon(50% 0,61% 35%,100% 35%,68% 57%,79% 100%,50% 72%,21% 100%,32% 57%,0 35%,39% 35%)',
              background: 'rgba(255,255,255,.95)',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.3))',
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
    if (!activeColors.has(piece.color) || piece.isInBase || piece.isInGoal || piece.step <= 0) continue
    const ck = piece.color as ColorKey
    const cell = stepToCell(ck, piece.step)
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

  const enginePieces: ReactNode[] = []
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
            width: 22,
            height: 22,
            alignSelf: 'center',
            justifySelf: 'center',
            borderRadius: '50%',
            background: `radial-gradient(circle at 32% 28%, #ffffff, ${col.base} 55%, ${col.dark})`,
            border: p.isLegal ? '2.5px solid #ffffff' : '1.5px solid rgba(255,255,255,.4)',
            boxShadow: p.isLegal ? `0 0 14px #5de4c7, 0 0 22px ${col.base}` : `0 3px 6px rgba(0,0,0,.5)`,
            cursor: p.isLegal ? 'pointer' : 'default',
            zIndex: 10,
            transform: `translate(${offset.x}%, ${offset.y}%) ${p.isLegal ? 'scale(1.15)' : 'scale(1)'}`,
            transition: 'transform .15s ease',
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
          gap: 1.5,
          padding: '2.5%',
          borderRadius: 20,
          background: 'linear-gradient(145deg, #1b1e2e, #13151f)',
          border: '2px solid rgba(93, 228, 199, 0.3)',
          boxShadow: '0 24px 60px -15px rgba(0,0,0,0.85), 0 0 30px rgba(93,228,199,0.15), inset 0 0 20px rgba(0,0,0,0.6)',
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
            background: `conic-gradient(from 45deg, ${COL.green.base} 0 90deg, ${COL.yellow.base} 90deg 180deg, ${COL.blue.base} 180deg 270deg, ${COL.red.base} 270deg 360deg)`,
            boxShadow: 'inset 0 0 10px rgba(0,0,0,.4)',
            borderRadius: 4,
          }}
        />
        {cells}
        {enginePieces}
      </div>
    </div>
  )
}
