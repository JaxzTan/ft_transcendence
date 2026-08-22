import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import { useApp } from '../store'
import { UserAvatar } from '../components/UserAvatar'
import { retroAudio } from '../utils/audio'
import '../styles/retrowave.css'

export function Results() {
  const { t } = useTranslation()
  const { user, lastResult } = useApp()
  const [crtEnabled] = useState(true)

  // Demo fallback when user visits /results directly without a live game session
  const fallbackResult = {
    winner: 'red' as const,
    resultDetail: 'ALL 4 TOKENS REACHED HOME',
    mode: 'pvp' as const,
    playerCount: 4,
    players: [
      { color: 'red' as const, username: user?.username || 'You', isBot: false, piecesInGoal: 4 },
      { color: 'green' as const, username: 'CyberPilot_99', isBot: true, piecesInGoal: 3 },
      { color: 'yellow' as const, username: 'NeonRider', isBot: true, piecesInGoal: 2 },
      { color: 'blue' as const, username: 'GridRunner', isBot: true, piecesInGoal: 1 },
    ],
    abandoned: false,
  }

  const activeResult = lastResult || fallbackResult

  const ranked = [...activeResult.players].sort((a, b) => b.piecesInGoal - a.piecesInGoal)
  
  // Find current player's color or fallback to first human/player
  const myPlayer = activeResult.players.find((p) => !p.isBot && p.username === user?.username) || activeResult.players.find((p) => !p.isBot) || activeResult.players[0]
  const myColor = myPlayer?.color || 'red'
  const won = activeResult.winner === myColor
  const myPiecesHome = ranked.find((p) => p.color === myColor)?.piecesInGoal ?? 0
  const winnerPlayer = activeResult.players.find((p) => p.color === activeResult.winner)

  const COLOR_NAME_KEYS: Record<string, string> = {
    red: 'lobby.colorRed',
    green: 'lobby.colorGreen',
    yellow: 'lobby.colorYellow',
    blue: 'lobby.colorBlue',
  }
  const winnerColorName = COLOR_NAME_KEYS[activeResult.winner] ?? COLOR_NAME_KEYS.red
  const winnerName = winnerPlayer ? (winnerPlayer.color === myColor ? t('common.you') : winnerPlayer.username) : t(winnerColorName)

  const modeLabels: Record<string, string> = {
    pvp: 'PVP ARENA',
    pve: 'VS BOT',
    hotseat: 'HOTSEAT LOCAL',
  }
  const modeLabel = modeLabels[activeResult.mode] || 'RETROLUDO'

  // Calculate outcome display title
  let outcomeTitle = 'COMPLETED'
  if (activeResult.abandoned) {
    outcomeTitle = 'ABANDONED'
  } else if (activeResult.mode === 'hotseat') {
    outcomeTitle = 'MATCH COMPLETE'
  } else if (won) {
    outcomeTitle = 'VICTORY'
  } else {
    outcomeTitle = 'DEFEAT'
  }

  // Render rank badge with correct 1st, 2nd, 3rd, 4th ordinal suffixes
  const renderRankBadge = (rank: number, isWinner: boolean) => {
    if (isWinner) {
      return (
        <span className="pay-tag win">
          <i className="fa-solid fa-crown"></i> 1st Place
        </span>
      )
    }
    if (rank === 2) {
      return (
        <span className="pay-tag runner">
          <i className="fa-solid fa-circle-check"></i> 2nd Place
        </span>
      )
    }
    if (rank === 3) {
      return (
        <span className="pay-tag third">
          <i className="fa-solid fa-medal"></i> 3rd Place
        </span>
      )
    }
    return (
      <span className="pay-tag fourth">
        <i className="fa-solid fa-flag"></i> 4th Place
      </span>
    )
  }

  return (
    <>
      {/* Animated 3D Grid & Sun Background */}
      <div className="grid-background">
        <div className="synthwave-sun" />
        <div className="grid-horizon" />
        <div className="perspective-grid" />
        <div className="win95-starfield" />
        <div className="terminal-vector-core" />
      </div>

      {/* CRT FX Overlay */}
      <div className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`} id="crtScreen">
        <div className="crt-scanlines" id="crtOverlay" style={{ display: crtEnabled ? 'block' : 'none' }} />
        <div className="crt-flicker" />

        <div className="results-page-wrapper">
          {/* Ticket Dispenser Container */}
          <section className="container ticket-container">
            <section className="invoice-container">
              {/* Metallic Slot Header */}
              <div className="invoice-slot">
                <div className="slot-hole"></div>
              </div>

              {/* Animated Dispensed Invoice Ticket */}
              <div className="invoice">
                <h2 className="title">MATCH INVOICE &mdash; RETROLUDO '42</h2>
                
                <p className="amount">
                  Outcome <span className="value">{outcomeTitle}</span>
                </p>
                <p className="amount">
                  Mode <span className="value">{modeLabel}</span>
                </p>
                <p className="amount">
                  Champion <span className="value">{winnerName.toUpperCase()}</span>
                </p>
                {activeResult.resultDetail && (
                  <p className="amount">
                    Detail <span className="value">{activeResult.resultDetail.toUpperCase()}</span>
                  </p>
                )}

                <hr style={{ border: 'none', height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0.75em 0' }} />

                {/* Player Roster Breakdown List */}
                <ul className="payers-list">
                  {ranked.map((p, index) => {
                    const isWinner = index === 0 && !activeResult.abandoned
                    const isMe = p.color === myColor
                    const pName = isMe ? t('common.you') : p.username
                    
                    return (
                      <li key={p.color}>
                        <div className="payer-image-container">
                          <UserAvatar
                            username={p.username}
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
                          <span>{pName} ({p.piecesInGoal}/4)</span>
                          {renderRankBadge(index + 1, isWinner)}
                        </p>
                      </li>
                    )
                  })}
                </ul>

                {/* Match Goal Progress Checkpoints Bar */}
                <div className="payment-status">
                  <p className="heading">
                    Goal Progress
                    <span>{myPiecesHome}/4 Tokens</span>
                  </p>
                  <div className="status-progress">
                    <div className="checkpoint">
                      {myPiecesHome >= 1 ? <i className="fa-solid fa-circle-check"></i> : <span className="circle" />}
                    </div>
                    <div className="checkpoint">
                      {myPiecesHome >= 2 ? <i className="fa-solid fa-circle-check"></i> : <span className="circle" />}
                    </div>
                    <div className="checkpoint">
                      {myPiecesHome >= 3 ? <i className="fa-solid fa-circle-check"></i> : <span className="circle" />}
                    </div>
                    <div className="checkpoint">
                      {myPiecesHome >= 4 ? <i className="fa-solid fa-circle-check"></i> : <span className="circle" />}
                    </div>
                    <div className="checkpoint">
                      {won ? <i className="fa-solid fa-crown" style={{ color: '#ffe600' }}></i> : <i className="fa-solid fa-stamp"></i>}
                    </div>
                  </div>
                </div>

                {/* Action Button: Return to Lobby Only */}
                <button
                  className="pay-now-btn"
                  onClick={() => {
                    retroAudio.playUiBeep(600, 0.05)
                    navigate('/gamelobby')
                  }}
                >
                  ▶ RETURN TO LOBBY
                </button>
              </div>
            </section>
          </section>
        </div>
      </div>
    </>
  )
}




