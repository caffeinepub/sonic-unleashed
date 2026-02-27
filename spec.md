# Sonic Unleashed - Destroy Eggman

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- 2D side-scrolling Sonic platformer game built with Canvas API and React
- Multiple playable Sonic characters (Sonic, Tails, Knuckles, Shadow, Amy) each with unique abilities
- Character unlock system: players earn coins/rings by completing levels to unlock new characters
- Eggman boss fight as the final challenge
- Game levels with platforms, enemies (Badniks), and ring collectibles
- Health/lives system, ring counter, score display
- Character selection screen showing locked/unlocked characters
- Boss fight mechanics: attack Eggman with character-specific abilities
- Game states: main menu, character select, gameplay, boss fight, victory/game over screens

### Modify
- N/A (new project)

### Remove
- N/A (new project)

## Implementation Plan
1. Backend: Store player progress (unlocked characters, high scores, rings collected) in Motoko canister
2. Frontend game engine using Canvas API with requestAnimationFrame loop
3. Game entities: Player (character), Platforms, Enemies (Badniks), Rings, Eggman boss
4. Character system: 5 characters with unique stats/abilities, unlock costs in rings
5. Level design: 2-3 stages leading to Eggman boss fight
6. Physics: gravity, jumping, running, collision detection
7. HUD: rings counter, lives, score, character ability indicator
8. Screens: Main menu, character select, level gameplay, boss fight, win/lose screens
9. Eggman boss: multiple attack phases, health bar, defeated animation
