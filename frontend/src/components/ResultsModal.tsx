import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { UserAvatar } from './UserAvatar'
import { useApp, type LastResult } from '../store'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

type ResultsModalProps = {
  result: NonNullable<LastResult>
  onReturnToLobby: () => void
  onClose?: () => void
}

export function ResultsModal({ result, onReturnToLobby, onClose }: ResultsModalProps) {
  const { t } = useTranslation()
  const { user } = useApp()

  // Trigger vending machine mechanical stepping feed sounds during 0.72s print animation
  useEffect(() => {
    const steps = [0, 80, 180, 290, 410, 540]
    const stepTimers = steps.map((ms, i) =>
      setTimeout(() => {
        retroAudio.playUiBeep(340 + (i % 3) * 60, 0.025, 'sawtooth')
      }, ms)
    )
    const finalTimer = setTimeout(() => {
      retroAudio.playUiBeep(880, 0.08, 'sine')
    }, 720)
    return () => {
      stepTimers.forEach(clearTimeout)
      clearTimeout(finalTimer)
    }
  }, [])

  const ranked = [...result.players].sort((a, b) => b.piecesInGoal - a.piecesInGoal)

  // A match is only completed with a real champion if it wasn't abandoned and has a winner
  const hasRealWinner = !result.abandoned && (Boolean(result.winner) || result.players.some((p) => p.piecesInGoal >= 4))

  // Find current player's color or fallback to first human/player
  const myPlayer =
    result.players.find((p) => !p.isBot && p.username === user?.username) ||
    result.players.find((p) => !p.isBot) ||
    result.players[0]
  const myColor = myPlayer?.color || 'red'
  const won = hasRealWinner && result.winner === myColor
  const winnerPlayer = result.players.find((p) => p.color === result.winner)

  const COLOR_NAME_KEYS: Record<string, string> = {
    red: 'lobby.colorRed',
    green: 'lobby.colorGreen',
    yellow: 'lobby.colorYellow',
    blue: 'lobby.colorBlue',
  }
  const winnerColorName = COLOR_NAME_KEYS[result.winner] ?? COLOR_NAME_KEYS.red
  const winnerName = winnerPlayer
    ? winnerPlayer.color === myColor
      ? t('common.you')
      : winnerPlayer.username
    : t(winnerColorName)

  const modeLabels: Record<string, string> = {
    pvp: t('results.modePvp'),
    pve: t('results.modePve'),
    hotseat: t('results.modeHotseat'),
  }
  const modeLabel = modeLabels[result.mode] || t('results.modeDefault')

  // Calculate outcome display title
  let outcomeTitle = t('results.outcomeCompleted')
  if (result.abandoned || !hasRealWinner) {
    outcomeTitle = t('results.outcomeAbandoned')
  } else if (result.mode === 'hotseat') {
    outcomeTitle = t('results.outcomeMatchComplete')
  } else if (won) {
    outcomeTitle = t('results.outcomeVictory')
  } else {
    outcomeTitle = t('results.outcomeDefeat')
  }

  // Render rank badge with correct 1st, 2nd, 3rd, 4th ordinal suffixes (only when not abandoned)
  const renderRankBadge = (rank: number, isWinner: boolean) => {
    if (!hasRealWinner) return null
    if (isWinner) {
      return <span className="pay-tag win">{t('results.firstPlace')}</span>
    }
    if (rank === 2) {
      return <span className="pay-tag runner">{t('results.secondPlace')}</span>
    }
    if (rank === 3) {
      return <span className="pay-tag third">{t('results.thirdPlace')}</span>
    }
    return <span className="pay-tag fourth">{t('results.fourthPlace')}</span>
  }

  return (
    <div
      className="results-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        padding: '20px 10px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        className="results-modal-content"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Ticket Dispenser Container */}
        <section className="container ticket-container" style={{ margin: 0, width: '100%' }}>
          <section className="invoice-container">
            {/* Bottom part of slot chassis (BEHIND ticket: z-index 2) */}
            <div className="invoice-slot-bottom">
              <div className="slot-hole-bottom"></div>
            </div>

            {/* Mask Container - Dispenses directly out of slot (z-index 10) */}
            <div className="ticket-paper-wrapper">
              {/* Animated Dispensed Invoice Ticket */}
              <div className="invoice">
                <span className="ticket-notch-left"></span>
                <span className="ticket-notch-right"></span>
                <h2 className="title">{t('results.matchInvoiceTitle')}</h2>

                <p className="amount">
                  {t('results.outcomeLabel')} <span className="value">{outcomeTitle}</span>
                </p>
                <p className="amount">
                  {t('results.modeLabel')} <span className="value">{modeLabel}</span>
                </p>
                {hasRealWinner && (
                  <p className="amount">
                    {t('results.championLabel')} <span className="value">{winnerName.toUpperCase()}</span>
                  </p>
                )}

                <hr
                  style={{
                    border: 'none',
                    height: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    margin: '0.75em 0',
                  }}
                />

                {/* Player Roster Breakdown List */}
                <ul className="payers-list">
                  {ranked.map((p, index) => {
                    const isWinner = index === 0 && hasRealWinner
                    const isMe = p.color === myColor
                    const pName = isMe ? t('common.you') : p.username

                    return (
                      <li key={p.color}>
                        <div className="payer-image-container">
                          <UserAvatar
                            username={p.username}
                            // Opponents here come from client-side game state
                            // (LastResult.players), which never carries a photo
                            // flag — `undefined` reads as "try the network" and
                            // fires a real 404 for every photo-less opponent.
                            // Only `user` (the logged-in viewer) has real data,
                            // via `?? false` for the same reason as below.
                            hasAvatarPhoto={p.isBot || !isMe ? false : (user?.hasAvatarPhoto ?? false)}
                            size={40}
                            fallbackStyle={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              background: 'rgba(0, 240, 255, 0.2)',
                              color: 'var(--accent-cyan)',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 'bold',
                              fontSize: '0.9rem',
                            }}
                          />
                        </div>
                        <p>
                          <span>
                            {pName} ({p.piecesInGoal}/4)
                          </span>
                          {renderRankBadge(index + 1, isWinner)}
                        </p>
                      </li>
                    )
                  })}
                </ul>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: '1.2em' }}>
                  <button
                    className="pay-now-btn"
                    onClick={() => {
                      retroAudio.playUiBeep(600, 0.05)
                      onReturnToLobby()
                    }}
                  >
                    {t('results.returnToLobbyBtn')}
                  </button>

                  {onClose && (
                    <button
                      className="retro-btn"
                      onClick={() => {
                        retroAudio.playUiBeep(520, 0.05)
                        onClose()
                      }}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderColor: 'rgba(0, 240, 255, 0.4)',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.76rem',
                        padding: '10px 0',
                      }}
                    >
                      {t('game.viewBoardBtn', 'VIEW BOARD')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Top part of slot chassis (IN FRONT OF ticket: z-index 20) */}
            <div className="invoice-slot-top">
              <div className="vending-header-bar"></div>
              <div className="slot-hole-top"></div>
            </div>
          </section>
        </section>
      </div>
    </div>
  )
}
