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
  minRating: 1400,
  color: '#ff1744',
  bg: 'rgba(255, 23, 68, 0.16)',
  border: 'rgba(255, 23, 68, 0.5)',
  glow: 'rgba(255, 23, 68, 0.6)',
}

export const RANK_MILO: RankTier = {
  key: 'milo',
  name: 'MILO DINOSAUR',
  badge: '[MILO]',
  minRating: 1300,
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
  color: '#00f0ff',
  bg: 'rgba(0, 240, 255, 0.14)',
  border: 'rgba(0, 240, 255, 0.45)',
  glow: 'rgba(0, 240, 255, 0.45)',
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
 * Derives player rank tier based consistently on rating and leaderboard standing.
 * - MAMEE MONSTER: Exclusively Top 3 on leaderboard OR rating >= 1600 (Apex tier with fire aura).
 * - MILO DINOSAUR: rating >= 1350 (Dark matter plasma).
 * - HONEY STARS: rating 1200 - 1349 (Cosmic starlight).
 * - SUPER RING: rating 1000 - 1199 (Cyan laser hologram).
 * - CHOKI CHOKI: rating < 1000 (Cyber bronze wireframe).
 */
export function getRankTier(rating: number = 0, rank?: number | null): RankTier {
  // Strictly Top 3 on leaderboard OR rating >= 1600 -> MAMEE MONSTER
  if ((typeof rank === 'number' && rank > 0 && rank <= 3) || rating >= 1600) {
    return RANK_MAMEE
  }
  if (rating >= 1350) {
    return RANK_MILO
  }
  if (rating >= 1200) {
    return RANK_HONEY
  }
  if (rating >= 1000) {
    return RANK_SUPER
  }
  return RANK_CHOKI
}
