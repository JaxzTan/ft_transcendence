__Blank Screen Fix Complete — Backend Extended to Match Frontend Contract__

The blank screen was caused by a __data shape mismatch__: the engine's serialized `GameState` didn't include the fields the frontend's `Game.tsx`/`Board.tsx` expect, causing `undefined.slice()` to throw during render and unmount React.

__Backend changes made:__

1. __`types.ts`__ — Extended `PlayerMeta` with frontend-compatible fields (`username`, `isBot`, `isConnected`, `piecesInGoal`, `hasRolled`, `consecutiveSixes`, `bonusRoll`, `isFinished`, `finishedAt`). Extended `Piece` with `isInGoal`/`isInBase`.

2. __`redis.ts`__ — `createGame` now initializes all new `PlayerMeta` and `Piece` fields with sensible defaults.

3. __`socket-handlers.ts`__ — `handleJoinGame` populates `username`/`isBot`/`isConnected` for the joining player; `autoRegisterBots` populates the same for bot seats.

4. __`engine.ts`__ — `rollDice` syncs `hasRolled`/`bonusRoll`/`consecutiveSixes`; `movePiece` syncs `piecesInGoal`/`isFinished`/`finishedAt` and piece `isInGoal`/`isInBase` on move/capture.

5. __`player-handler.ts`__ — disconnect/reconnect/exit now sync `isConnected` and `isFinished`.

__Result:__ The engine now serializes a `GameState` that matches the frontend's `PlayerMeta`/`Piece` contract, so `game_joined`/`state_update` events render correctly without crashing. The game should now display the board, players, and dice properly after starting and after refresh.
