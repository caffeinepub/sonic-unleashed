# Sonic Unleashed

## Current State
A Sonic-themed browser game exists with basic gameplay (ring collecting, character unlocking, Eggman boss). Visuals are blocky/placeholder with no real character art.

## Requested Changes (Diff)

### Add
- Realistic illustrated character sprites for Sonic, Tails, Amy, Knuckles, Shadow, and Eggman (generated images)
- Rich environment backgrounds: Green Hill Zone (grassy hills), City Escape (urban streets), Lava Reef (volcanic), Space Colony (space)
- Animated sprite states: running, jumping, attacking, idle
- On-screen mobile-friendly controls (D-pad left/right, jump button, attack button)
- Character unlock screen with character portraits and unlock requirements
- Boss fight screen with Eggman health bar and attack patterns
- Ring counter HUD, lives counter, score display
- Level select screen after unlocking characters

### Modify
- Replace all block/rectangle graphics with generated character images and illustrated backgrounds
- Upgrade game loop to support multi-level progression with distinct zone themes
- Character selection now shows full portrait cards with stats (speed, power, special ability)
- Eggman boss now has multiple attack phases

### Remove
- Placeholder colored rectangle graphics
- Any pixel/retro art style elements

## Implementation Plan
1. Generate character images: Sonic running pose, Tails flying, Amy with hammer, Knuckles punching, Shadow with chaos energy, Eggman in his Egg Mobile
2. Generate environment backgrounds: Green Hill Zone, City Escape, Lava Reef, Space Colony
3. Generate UI assets: ring icon, life icon, HUD elements
4. Backend: store player progress (unlocked characters, rings collected, levels completed, high scores)
5. Frontend: 2D side-scrolling game using Canvas API with generated images as sprites
   - Game loop with physics (gravity, velocity, collision)
   - Multiple levels with scrolling backgrounds
   - Character switching mid-game
   - Mobile touch controls overlay
   - Boss fight mechanics with Eggman
   - Unlock system gated by ring count
