/** Mock data mirroring the design prototype. Replace with real API data later. */

export const LEADERS = [
  { name: 'GrandDuke', rating: 2410, wins: 412, wr: '71%' },
  { name: 'Seraphine', rating: 2288, wins: 377, wr: '68%' },
  { name: 'IronRook', rating: 2201, wins: 502, wr: '64%' },
  { name: 'Marla_V', rating: 2144, wins: 298, wr: '66%' },
  { name: 'Bishop_9', rating: 2098, wins: 255, wr: '61%' },
  { name: 'NightKnight', rating: 2007, wins: 341, wr: '59%' },
  { name: 'PawnStar', rating: 1955, wins: 410, wr: '57%' },
  { name: 'CastleUp', rating: 1902, wins: 288, wr: '60%' },
]

export const MEDAL_COLORS = ['#f0c24e', '#cfd3d8', '#c98a4a']

export const MY_ROW = { rank: 12, rating: 1540, wins: 198, wr: '58%' }

export const STAT_TILES = [
  { value: '♛ 1,540', label: 'Rating' },
  { value: '342', label: 'Games played' },
  { value: '58%', label: 'Win rate' },
  { value: '4 🔥', label: 'Current streak' },
  { value: '11', label: 'Best streak' },
]

export const MATCHES = [
  { mode: '4P', win: true, delta: '+18', opp: 'Rook, Bishop, Knight', when: '2h ago' },
  { mode: '2P', win: false, delta: '-12', opp: 'Seraphine', when: '5h ago' },
  { mode: '4P', win: true, delta: '+15', opp: '3 house bots', when: 'Yesterday' },
  { mode: '4P', win: true, delta: '+9', opp: 'Marla_V & 2 others', when: 'Yesterday' },
  { mode: '2P', win: false, delta: '-14', opp: 'IronRook', when: '2 days ago' },
]

export const ACHIEVEMENTS = [
  { name: 'First Blood', glyph: '♟', unlocked: true },
  { name: 'Hat-Trick', glyph: '♛', unlocked: true },
  { name: 'Comeback King', glyph: '⚑', unlocked: true },
  { name: 'Untouchable', glyph: '◈', unlocked: false },
]

export type FriendStatus = 'online' | 'ingame' | 'offline'

export const FRIENDS: Array<{ name: string; status: FriendStatus; rating: number }> = [
  { name: 'Marla_V', status: 'ingame', rating: 1988 },
  { name: 'Bishop_9', status: 'online', rating: 1720 },
  { name: 'PawnStar', status: 'online', rating: 1610 },
  { name: 'IronRook', status: 'offline', rating: 2201 },
  { name: 'NightK', status: 'offline', rating: 1490 },
  { name: 'Seraphine', status: 'ingame', rating: 2288 },
]

export const STATUS_COLORS: Record<FriendStatus, string> = {
  online: '#5fd08a',
  ingame: '#f0c24e',
  offline: '#6b5d49',
}

export const STATUS_LABELS: Record<FriendStatus, string> = {
  online: 'Online',
  ingame: 'In a game',
  offline: 'Offline',
}

export const REQUESTS = [
  { name: 'DiceDenvy', initials: 'DI' },
  { name: 'QueenB', initials: 'QU' },
]

export const SETTING_GROUPS = [
  {
    title: 'Audio',
    rows: [
      { label: 'Sound effects', desc: 'Dice, moves, and captures' },
      { label: 'Music', desc: 'Ambient parlor soundtrack' },
    ],
  },
  {
    title: 'Gameplay',
    rows: [
      { label: 'Auto-roll on your turn', desc: 'Roll the die automatically' },
      { label: 'Fast animations', desc: 'Speed up token movement' },
      { label: 'Move hints', desc: 'Highlight legal moves' },
    ],
  },
  {
    title: 'Notifications',
    rows: [
      { label: 'Friend invites', desc: 'Get pinged for match invites' },
      { label: 'Weekly recap', desc: 'Email summary of your week' },
    ],
  },
]

export const MODE_CARDS = [
  { title: 'Vs Bots', desc: 'Play against the house AI', glyph: '♟', mode: 4, hue: '#4bbf7b' },
  { title: '4-Player Classic', desc: 'The full cross-board race', glyph: '✦', mode: 4, hue: '#f0c24e' },
  { title: '2-Player Duel', desc: 'Head-to-head, first home wins', glyph: '⚔', mode: 2, hue: '#e4574d' },
  { title: 'Private Table', desc: 'Invite friends to a room', glyph: '⌘', mode: 4, hue: '#4a92e0' },
]

export const MOVE_LOG_COLORS = ['red', 'green', 'yellow', 'blue'] as const

export const MOVE_LOG = [
  { ck: 'red', text: 'Rook moved a piece out of home' },
  { ck: 'green', text: 'Bishop rolled a 6 — extra turn' },
  { ck: 'yellow', text: 'Knight captured your blue piece' },
  { ck: 'blue', text: 'You entered the home stretch' },
] as const

export const PODIUM = [
  { place: '1', name: 'You', ck: 'blue', detail: 'All home' },
  { place: '2', name: 'Rook', ck: 'red', detail: '3 home' },
  { place: '3', name: 'Bishop', ck: 'green', detail: '2 home' },
  { place: '4', name: 'Knight', ck: 'yellow', detail: '1 home' },
] as const
