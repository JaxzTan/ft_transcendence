/**
 * Per-game serial execution queue.
 * All operations for the same game execute sequentially,
 * preventing race conditions from concurrent Redis load/modify/save.
 * Different games run in parallel.
 */
export class GameQueue {
  private queues: Map<string, Promise<void>> = new Map();

  enqueue(gameId: string, fn: () => Promise<void>): void {
    const prev = this.queues.get(gameId) || Promise.resolve();
    const next = prev.then(fn, fn); // Run even if previous promise rejected
    this.queues.set(gameId, next);
    // Clean up resolved promises to prevent memory leak
    next.finally(() => {
      if (this.queues.get(gameId) === next) {
        this.queues.delete(gameId);
      }
    });
  }
}