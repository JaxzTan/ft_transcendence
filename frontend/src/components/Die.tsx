/** Pip indexes (3×3 grid, row-major) lit per face value. */
const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

export function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const on = PIP_MAP[value] || []
  return (
    <div
      style={{
        width: 82,
        height: 82,
        borderRadius: 20,
        background: 'linear-gradient(145deg, #ffffff 0%, #f8f0ff 60%, #d4c8e8 100%)',
        boxShadow:
          '0 18px 36px -8px rgba(0,0,0,.55), 0 0 24px rgba(167,139,250,.35), inset 0 2px 4px #ffffff, inset 0 -4px 8px rgba(244,114,182,.2)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        padding: 13,
        gap: 3,
        animation: rolling ? 'shake .3s ease-in-out infinite' : 'none',
        border: '1.5px solid rgba(255,255,255,.9)',
        cursor: 'pointer',
        transform: rolling ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform .15s ease',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ display: 'grid', placeItems: 'center' }}>
          {on.includes(i) ? (
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #a78bfa, #3b1e7a)',
                boxShadow: '0 0 8px rgba(167,139,250,.9), inset 0 1px 1px rgba(255,255,255,.8)',
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}
