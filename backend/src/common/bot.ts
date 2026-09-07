// Bot identity, in one place. Bots are persisted as real User rows
// ("bot-red", ...) because GameParticipant.user_id is an FK to User.id :
// so match, achievement and leaderboard code all ask `isBotUserId()`.
export const BOT_PREFIX = 'bot-';

export function isBotUserId(userId: string | undefined | null): boolean {
  return !!userId && userId.startsWith(BOT_PREFIX);
}
