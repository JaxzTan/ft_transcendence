export interface RankTier {
  key: 'mamee' | 'milo' | 'honey' | 'super' | 'choki'
  name: string
  badge: string
  minRating: number
  color: string
  bg: string
  border: string
  glow: string
}

export const RANK_MAMEE: RankTier = {
  key: 'mamee',
  name: 'MAMEE MONSTER',
  badge: '[MAMEE]',
  minRating: 1350,
  color: '#ff1744',
  bg: 'rgba(255, 23, 68, 0.16)',
  border: 'rgba(255, 23, 68, 0.5)',
  glow: 'rgba(255, 23, 68, 0.6)',
}

export const RANK_MILO: RankTier = {
  key: 'milo',
  name: 'MILO DINOSAUR',
  badge: '[MILO]',
  minRating: 1350,
  color: '#bd00ff',
  bg: 'rgba(189, 0, 255, 0.14)',
  border: 'rgba(189, 0, 255, 0.45)',
  glow: 'rgba(189, 0, 255, 0.55)',
}

export const RANK_HONEY: RankTier = {
  key: 'honey',
  name: 'HONEY STARS',
  badge: '[HONEY]',
  minRating: 1200,
  color: '#ffd700',
  bg: 'rgba(255, 215, 0, 0.14)',
  border: 'rgba(255, 215, 0, 0.45)',
  glow: 'rgba(255, 215, 0, 0.45)',
}

export const RANK_SUPER: RankTier = {
  key: 'super',
  name: 'SUPER RING',
  badge: '[RING]',
  minRating: 1000,
  color: '#cfd3d8',
  bg: 'rgba(207, 211, 216, 0.14)',
  border: 'rgba(207, 211, 216, 0.45)',
  glow: 'rgba(207, 211, 216, 0.45)',
}

export const RANK_CHOKI: RankTier = {
  key: 'choki',
  name: 'CHOKI CHOKI',
  badge: '[CHOKI]',
  minRating: 0,
  color: '#d7a15c',
  bg: 'rgba(215, 161, 92, 0.14)',
  border: 'rgba(215, 161, 92, 0.45)',
  glow: 'rgba(215, 161, 92, 0.45)',
}

export const RANKS: RankTier[] = [
  RANK_MAMEE,
  RANK_MILO,
  RANK_HONEY,
  RANK_SUPER,
  RANK_CHOKI,
]

/**
 * Derives player rank tier based on rating and leaderboard standing.
 * - Top 3 players (Rank #1, #2, #3) or rating >= 1500 are granted the exclusive MAMEE MONSTER rank.
 * - Milo Dinosaur: rating 1350 - 1499 (or Rank #4+ when >= 1350).
 * - Honey Stars: rating 1200 - 1349.
 * - Super Ring: rating 1000 - 1199.
 * - Choki Choki: rating < 1000.
 */
export function getRankTier(rating: number = 0, rank?: number | null): RankTier {
  // When leaderboard rank position is known: strictly Top 3 are MAMEE MONSTER
  if (typeof rank === 'number' && rank > 0) {
    if (rank <= 3) return RANK_MAMEE
    if (rating >= 1350) return RANK_MILO
    if (rating >= 1200) return RANK_HONEY
    if (rating >= 1000) return RANK_SUPER
    return RANK_CHOKI
  }

  // When rank position is not yet known (e.g. standalone profile view without leaderboard rank):
  if (rating >= 1800) return RANK_MAMEE
  if (rating >= 1350) return RANK_MILO
  if (rating >= 1200) return RANK_HONEY
  if (rating >= 1000) return RANK_SUPER
  return RANK_CHOKI
}
