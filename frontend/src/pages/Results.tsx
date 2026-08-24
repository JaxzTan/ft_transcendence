// import { useEffect, useState } from 'react'
// import { useTranslation } from 'react-i18next'
// import { navigate } from '../router'
// import { useApp } from '../store'
// import { UserAvatar } from '../components/UserAvatar'
// import { retroAudio } from '../utils/audio'
// import '../styles/retrowave.css'

// export function Results() {
//   const { t } = useTranslation()
//   const { user, lastResult } = useApp()
//   const [crtEnabled] = useState(true)

//   // Trigger vending machine chiptune mechanical sound on mount
//   useEffect(() => {
//     retroAudio.playUiBeep(450, 0.06)
//     const timer = setTimeout(() => {
//       retroAudio.playUiBeep(850, 0.07)
//     }, 100)
//     return () => clearTimeout(timer)
//   }, [])

//   // Demo fallback when user visits /results directly without a live game session
//   const fallbackResult = {
//     winner: 'red' as const,
//     resultDetail: 'ALL 4 TOKENS REACHED HOME',
//     mode: 'pvp' as const,
//     playerCount: 4,
//     players: [
//       { color: 'red' as const, username: user?.username || 'You', isBot: false, piecesInGoal: 4 },
//       { color: 'green' as const, username: 'CyberPilot_99', isBot: true, piecesInGoal: 3 },
//       { color: 'yellow' as const, username: 'NeonRider', isBot: true, piecesInGoal: 2 },
//       { color: 'blue' as const, username: 'GridRunner', isBot: true, piecesInGoal: 1 },
//     ],
//     abandoned: false,
//   }

//   const activeResult = lastResult || fallbackResult

//   const ranked = [...activeResult.players].sort((a, b) => b.piecesInGoal - a.piecesInGoal)

//   // A match is only completed with a real champion if it wasn't abandoned and a player reached the win condition
//   const hasRealWinner = !activeResult.abandoned && activeResult.players.some((p) => p.piecesInGoal >= 4)

//   // Find current player's color or fallback to first human/player
//   const myPlayer = activeResult.players.find((p) => !p.isBot && p.username === user?.username) || activeResult.players.find((p) => !p.isBot) || activeResult.players[0]
//   const myColor = myPlayer?.color || 'red'
//   const won = hasRealWinner && activeResult.winner === myColor
//   const winnerPlayer = activeResult.players.find((p) => p.color === activeResult.winner)

//   const COLOR_NAME_KEYS: Record<string, string> = {
//     red: 'lobby.colorRed',
//     green: 'lobby.colorGreen',
//     yellow: 'lobby.colorYellow',
//     blue: 'lobby.colorBlue',
//   }
//   const winnerColorName = COLOR_NAME_KEYS[activeResult.winner] ?? COLOR_NAME_KEYS.red
//   const winnerName = winnerPlayer ? (winnerPlayer.color === myColor ? t('common.you') : winnerPlayer.username) : t(winnerColorName)

//   const modeLabels: Record<string, string> = {
//     pvp: t('results.modePvp'),
//     pve: t('results.modePve'),
//     hotseat: t('results.modeHotseat'),
//   }
//   const modeLabel = modeLabels[activeResult.mode] || t('results.modeDefault')

//   // Calculate outcome display title
//   let outcomeTitle = t('results.outcomeCompleted')
//   if (activeResult.abandoned || !hasRealWinner) {
//     outcomeTitle = t('results.outcomeAbandoned')
//   } else if (activeResult.mode === 'hotseat') {
//     outcomeTitle = t('results.outcomeMatchComplete')
//   } else if (won) {
//     outcomeTitle = t('results.outcomeVictory')
//   } else {
//     outcomeTitle = t('results.outcomeDefeat')
//   }

//   // Render rank badge with correct 1st, 2nd, 3rd, 4th ordinal suffixes (only when not abandoned)
//   const renderRankBadge = (rank: number, isWinner: boolean) => {
//     if (!hasRealWinner) return null
//     if (isWinner) {
//       return (
//         <span className="pay-tag win">
//           {t('results.firstPlace')}
//         </span>
//       )
//     }
//     if (rank === 2) {
//       return (
//         <span className="pay-tag runner">
//           {t('results.secondPlace')}
//         </span>
//       )
//     }
//     if (rank === 3) {
//       return (
//         <span className="pay-tag third">
//           {t('results.thirdPlace')}
//         </span>
//       )
//     }
//     return (
//       <span className="pay-tag fourth">
//         {t('results.fourthPlace')}
//       </span>
//     )
//   }

//   return (
//     <>
//       {/* Animated 3D Grid & Sun Background */}
//       <div className="grid-background">
//         <div className="synthwave-sun" />
//         <div className="grid-horizon" />
//         <div className="perspective-grid" />
//         <div className="win95-starfield" />
//         <div className="terminal-vector-core" />
//       </div>

//       {/* CRT FX Overlay */}
//       <div className={`crt-screen ${crtEnabled ? 'crt-curved' : ''}`} id="crtScreen">
//         <div className="crt-scanlines" id="crtOverlay" style={{ display: crtEnabled ? 'block' : 'none' }} />
//         <div className="crt-flicker" />

//         <div className="results-page-wrapper">
//           {/* Ticket Dispenser Container */}
//           <section className="container ticket-container">
//             <section className="invoice-container">
//               {/* Bottom part of slot chassis (BEHIND ticket: z-index 2) */}
//               <div className="invoice-slot-bottom">
//                 <div className="slot-hole-bottom"></div>
//               </div>

//               {/* Mask Container - Dispenses directly out of slot (z-index 10) */}
//               <div className="ticket-paper-wrapper">
//                 {/* Animated Dispensed Invoice Ticket */}
//                 <div className="invoice">
//                   <span className="ticket-notch-left"></span>
//                   <span className="ticket-notch-right"></span>
//                   <h2 className="title">{t('results.matchInvoiceTitle')}</h2>

//                   <p className="amount">
//                     {t('results.outcomeLabel')} <span className="value">{outcomeTitle}</span>
//                   </p>
//                   <p className="amount">
//                     {t('results.modeLabel')} <span className="value">{modeLabel}</span>
//                   </p>
//                   {hasRealWinner && (
//                     <p className="amount">
//                       {t('results.championLabel')} <span className="value">{winnerName.toUpperCase()}</span>
//                     </p>
//                   )}

//                   <hr style={{ border: 'none', height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0.75em 0' }} />

//                   {/* Player Roster Breakdown List */}
//                   <ul className="payers-list">
//                     {ranked.map((p, index) => {
//                       const isWinner = index === 0 && hasRealWinner
//                       const isMe = p.color === myColor
//                       const pName = isMe ? t('common.you') : p.username

//                       return (
//                         <li key={p.color}>
//                           <div className="payer-image-container">
//                             <UserAvatar
//                               username={p.username}
//                               size={40}
//                               fallbackStyle={{
//                                 width: 40,
//                                 height: 40,
//                                 borderRadius: '50%',
//                                 background: 'rgba(0, 240, 255, 0.2)',
//                                 color: 'var(--accent-cyan)',
//                                 display: 'grid',
//                                 placeItems: 'center',
//                                 fontWeight: 'bold',
//                                 fontSize: '0.9rem',
//                               }}
//                             />
//                           </div>
//                           <p>
//                             <span>{pName} ({p.piecesInGoal}/4)</span>
//                             {renderRankBadge(index + 1, isWinner)}
//                           </p>
//                         </li>
//                       )
//                     })}
//                   </ul>

//                   {/* Action Button: Return to Lobby Only */}
//                   <button
//                     className="pay-now-btn"
//                     onClick={() => {
//                       retroAudio.playUiBeep(600, 0.05)
//                       navigate('/gamelobby')
//                     }}
//                   >
//                     {t('results.returnToLobbyBtn')}
//                   </button>
//                 </div>
//               </div>

//               {/* Top part of slot chassis (IN FRONT OF ticket: z-index 20) */}
//               <div className="invoice-slot-top">
//                 <div className="vending-header-bar"></div>
//                 <div className="slot-hole-top"></div>
//               </div>
//             </section>
//           </section>
//         </div>
//       </div>
//     </>
//   )
// }
