import type { CSSProperties, ReactNode } from 'react'
import { COL, type ColorKey } from '../theme'

const CELL_BG = '#efe6d6'
const LINE = '#c9b995'

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

function Yard({ r, c, ck, tokens }: { r: number; c: number; ck: ColorKey; tokens: number }) {
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
        {[0, 1, 2, 3].map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {s < tokens ? <Sphere ck={ck} /> : <Ring ck={ck} />}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Demo token positions on the track: "row,col" → color. */
const TOKENS: Record<string, ColorKey> = {
  '6,1': 'red', '7,3': 'red', '1,8': 'green', '8,13': 'yellow', '7,11': 'yellow', '13,6': 'blue',
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

/** The classic 15×15 cross board, rendered procedurally — no images. */
export function Board() {
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
      if (TOKENS[key]) inner = <Sphere ck={TOKENS[key]} />
      else if (startCol)
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
      cells.push(
        <div key={`p${key}`} style={style}>
          {inner}
        </div>,
      )
    }
  }

  return (
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
      <Yard r={0} c={0} ck="red" tokens={2} />
      <Yard r={0} c={9} ck="green" tokens={3} />
      <Yard r={9} c={9} ck="yellow" tokens={1} />
      <Yard r={9} c={0} ck="blue" tokens={4} />
      <div
        style={{
          gridRow: '7 / span 3',
          gridColumn: '7 / span 3',
          background: `conic-gradient(from 45deg, ${COL.green.base} 0 90deg, ${COL.yellow.base} 90deg 180deg, ${COL.blue.base} 180deg 270deg, ${COL.red.base} 270deg 360deg)`,
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,.35)',
        }}
      />
      {cells}
    </div>
  )
}
