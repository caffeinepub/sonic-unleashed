import React, { useEffect, useRef, useState, useCallback } from "react";
import { useActor } from "./hooks/useActor";
import { Character } from "./backend.d";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameScreen = "menu" | "characters" | "loading" | "playing" | "victory" | "gameover";
type LevelName = "GreenHill" | "ChemicalPlant" | "BossStage";

interface Vec2 { x: number; y: number; }
interface AABB { x: number; y: number; w: number; h: number; }

interface Platform {
  x: number; y: number; w: number; h: number;
  type: "solid" | "moving";
  moveDir?: number; moveSpeed?: number; moveRange?: number; startX?: number;
}

interface Ring { x: number; y: number; collected: boolean; animFrame: number; }
interface Badnik { x: number; y: number; w: number; h: number; vx: number; alive: boolean; stunTimer: number; }
interface Projectile { x: number; y: number; vx: number; vy: number; active: boolean; }

interface Player {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number;
  onGround: boolean;
  jumpsLeft: number;
  isFlying: boolean;
  flyTimer: number;
  specialActive: boolean;
  specialTimer: number;
  invincible: boolean;
  invincibleTimer: number;
  facing: number;
  animFrame: number;
  animTimer: number;
  dead: boolean;
}

interface GameState {
  player: Player;
  platforms: Platform[];
  rings: Ring[];
  badniks: Badnik[];
  cameraX: number;
  levelWidth: number;
  ringsCollected: number;
  score: number;
  lives: number;
  timeMs: number;
  levelComplete: boolean;
  goalX: number;
  goalReached: boolean;
  bossHits: number;
  bossHp: number;
  bossX: number;
  bossY: number;
  bossVx: number;
  bossAnimFrame: number;
  bossAnimTimer: number;
  projectiles: Projectile[];
  bossShootTimer: number;
  bossPhase: number;
  timeSlowActive: boolean;
  timeSlowTimer: number;
  hammerActive: boolean;
  hammerTimer: number;
  particles: Particle[];
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GRAVITY = 1800;
const JUMP_FORCE = -620;
const MOVE_SPEED = 260;
const PLAYER_W = 44;
const PLAYER_H = 44;
const GROUND_Y = 500;
const CANVAS_W = 900;
const CANVAS_H = 560;

const CHARACTER_COSTS: Record<Character, number> = {
  [Character.sonic]: 0,
  [Character.tails]: 100,
  [Character.knuckles]: 200,
  [Character.shadow]: 300,
  [Character.amy]: 150,
};

const CHARACTER_NAMES: Record<Character, string> = {
  [Character.sonic]: "Sonic",
  [Character.tails]: "Tails",
  [Character.knuckles]: "Knuckles",
  [Character.shadow]: "Shadow",
  [Character.amy]: "Amy",
};

const CHARACTER_ABILITIES: Record<Character, string> = {
  [Character.sonic]: "Speed Dash – Invincible charge",
  [Character.tails]: "Flight – Hover for 2s",
  [Character.knuckles]: "Ground Punch – Stuns Eggman",
  [Character.shadow]: "Chaos Control – Slow time",
  [Character.amy]: "Hammer Smash – Wide hit area",
};

const CHARACTER_COLORS: Record<Character, string> = {
  [Character.sonic]: "#1a6fc4",
  [Character.tails]: "#f8a830",
  [Character.knuckles]: "#cc2244",
  [Character.shadow]: "#8b0000",
  [Character.amy]: "#e8208c",
};

const CHARACTER_SPRITES: Record<Character, string> = {
  [Character.sonic]: "/assets/generated/sonic-sprite-transparent.dim_128x128.png",
  [Character.tails]: "/assets/generated/tails-sprite-transparent.dim_128x128.png",
  [Character.knuckles]: "/assets/generated/knuckles-sprite-transparent.dim_128x128.png",
  [Character.shadow]: "/assets/generated/shadow-sprite-transparent.dim_128x128.png",
  [Character.amy]: "/assets/generated/amy-sprite-transparent.dim_128x128.png",
};

const EGGMAN_SPRITE = "/assets/generated/eggman-sprite-transparent.dim_160x160.png";

const LEVELS: LevelName[] = ["GreenHill", "ChemicalPlant", "BossStage"];

// ─── Level Generation ────────────────────────────────────────────────────────

function generateGreenHill(): { platforms: Platform[]; rings: Ring[]; badniks: Badnik[]; levelWidth: number; goalX: number } {
  const levelWidth = 4000;
  const platforms: Platform[] = [
    { x: 0, y: GROUND_Y, w: levelWidth, h: 60, type: "solid" },
    { x: 400, y: 400, w: 180, h: 18, type: "solid" },
    { x: 700, y: 340, w: 140, h: 18, type: "solid" },
    { x: 1000, y: 280, w: 160, h: 18, type: "solid" },
    { x: 1300, y: 380, w: 200, h: 18, type: "solid" },
    { x: 1600, y: 310, w: 120, h: 18, type: "solid" },
    { x: 1900, y: 250, w: 180, h: 18, type: "solid" },
    { x: 2200, y: 350, w: 160, h: 18, type: "solid" },
    { x: 2500, y: 290, w: 200, h: 18, type: "solid" },
    { x: 2800, y: 380, w: 140, h: 18, type: "solid" },
    { x: 3100, y: 320, w: 180, h: 18, type: "solid" },
    { x: 3400, y: 400, w: 160, h: 18, type: "solid" },
    // Gap segments
    { x: 500, y: GROUND_Y, w: 0, h: 0, type: "solid" }, // marker
    { x: 850, y: GROUND_Y, w: 200, h: 60, type: "solid" },
    { x: 1150, y: GROUND_Y, w: 300, h: 60, type: "solid" },
    { x: 1550, y: GROUND_Y, w: 400, h: 60, type: "solid" },
    { x: 2050, y: GROUND_Y, w: 300, h: 60, type: "solid" },
    { x: 2450, y: GROUND_Y, w: 200, h: 60, type: "solid" },
    { x: 2750, y: GROUND_Y, w: 200, h: 60, type: "solid" },
    { x: 3050, y: GROUND_Y, w: 500, h: 60, type: "solid" },
    { x: 3650, y: GROUND_Y, w: 400, h: 60, type: "solid" },
    // moving platforms
    { x: 1800, y: 420, w: 120, h: 18, type: "moving", moveDir: 1, moveSpeed: 80, moveRange: 150, startX: 1800 },
    { x: 2650, y: 360, w: 100, h: 18, type: "moving", moveDir: -1, moveSpeed: 60, moveRange: 120, startX: 2650 },
  ];
  const rings: Ring[] = [];
  const ringPositions = [
    200, 250, 300, 420, 440, 460, 720, 740, 760,
    1020, 1040, 1300, 1320, 1620, 1640,
    1950, 1970, 1990, 2220, 2240, 2520, 2540,
    2820, 2840, 3120, 3140, 3420, 3440, 3700, 3720, 3740,
  ];
  ringPositions.forEach((rx, i) => {
    rings.push({ x: rx, y: GROUND_Y - 60 - (i % 3) * 40, collected: false, animFrame: Math.floor(i * 2) });
  });
  // Platform rings
  [[400, 360], [700, 300], [1000, 240], [1300, 340], [1900, 210]].forEach(([rx, ry]) => {
    rings.push({ x: rx, y: ry, collected: false, animFrame: 0 });
    rings.push({ x: rx + 30, y: ry, collected: false, animFrame: 4 });
    rings.push({ x: rx + 60, y: ry, collected: false, animFrame: 8 });
  });
  const badniks: Badnik[] = [
    { x: 600, y: GROUND_Y - 32, w: 32, h: 32, vx: -80, alive: true, stunTimer: 0 },
    { x: 1200, y: GROUND_Y - 32, w: 32, h: 32, vx: 80, alive: true, stunTimer: 0 },
    { x: 1700, y: GROUND_Y - 32, w: 32, h: 32, vx: -60, alive: true, stunTimer: 0 },
    { x: 2300, y: GROUND_Y - 32, w: 32, h: 32, vx: 70, alive: true, stunTimer: 0 },
    { x: 2900, y: GROUND_Y - 32, w: 32, h: 32, vx: -90, alive: true, stunTimer: 0 },
    { x: 3500, y: GROUND_Y - 32, w: 32, h: 32, vx: 80, alive: true, stunTimer: 0 },
    { x: 1310, y: 350, w: 28, h: 28, vx: -50, alive: true, stunTimer: 0 },
    { x: 1920, y: 220, w: 28, h: 28, vx: 50, alive: true, stunTimer: 0 },
  ];
  return { platforms, rings, badniks, levelWidth, goalX: levelWidth - 120 };
}

function generateChemicalPlant(): { platforms: Platform[]; rings: Ring[]; badniks: Badnik[]; levelWidth: number; goalX: number } {
  const levelWidth = 4500;
  const platforms: Platform[] = [
    { x: 0, y: GROUND_Y, w: levelWidth, h: 60, type: "solid" },
    { x: 300, y: 380, w: 160, h: 18, type: "solid" },
    { x: 600, y: 300, w: 140, h: 18, type: "solid" },
    { x: 900, y: 250, w: 180, h: 18, type: "solid" },
    { x: 1200, y: 320, w: 120, h: 18, type: "solid" },
    { x: 1500, y: 260, w: 160, h: 18, type: "solid" },
    { x: 1800, y: 200, w: 200, h: 18, type: "solid" },
    { x: 2100, y: 290, w: 140, h: 18, type: "solid" },
    { x: 2400, y: 350, w: 180, h: 18, type: "solid" },
    { x: 2700, y: 280, w: 160, h: 18, type: "solid" },
    { x: 3000, y: 220, w: 200, h: 18, type: "solid" },
    { x: 3300, y: 310, w: 140, h: 18, type: "solid" },
    { x: 3600, y: 380, w: 160, h: 18, type: "solid" },
    { x: 3900, y: 300, w: 180, h: 18, type: "solid" },
    { x: 800, y: GROUND_Y, w: 200, h: 60, type: "solid" },
    { x: 1100, y: GROUND_Y, w: 300, h: 60, type: "solid" },
    { x: 1500, y: GROUND_Y, w: 500, h: 60, type: "solid" },
    { x: 2100, y: GROUND_Y, w: 400, h: 60, type: "solid" },
    { x: 2600, y: GROUND_Y, w: 200, h: 60, type: "solid" },
    { x: 2900, y: GROUND_Y, w: 300, h: 60, type: "solid" },
    { x: 3300, y: GROUND_Y, w: 600, h: 60, type: "solid" },
    { x: 4000, y: GROUND_Y, w: 500, h: 60, type: "solid" },
    { x: 1000, y: 410, w: 100, h: 18, type: "moving", moveDir: 1, moveSpeed: 100, moveRange: 130, startX: 1000 },
    { x: 2200, y: 380, w: 110, h: 18, type: "moving", moveDir: -1, moveSpeed: 90, moveRange: 100, startX: 2200 },
    { x: 3150, y: 360, w: 90, h: 18, type: "moving", moveDir: 1, moveSpeed: 110, moveRange: 90, startX: 3150 },
  ];
  const rings: Ring[] = [];
  const rp2 = [300, 350, 620, 640, 920, 940, 1220, 1520, 1820, 1840, 1860, 2120, 2420, 2720, 3020, 3320, 3620, 3920, 4100, 4200, 4300];
  for (let i = 0; i < rp2.length; i++) rings.push({ x: rp2[i], y: GROUND_Y - 60 - (i % 4) * 35, collected: false, animFrame: i * 3 });
  const platformRingGroups2 = [[300, 340], [600, 260], [900, 210], [1800, 160], [3000, 180]];
  for (const [rx, ry] of platformRingGroups2) {
    for (let k = 0; k < 4; k++) rings.push({ x: rx + k * 28, y: ry, collected: false, animFrame: k * 3 });
  }
  const badniks: Badnik[] = [
    { x: 500, y: GROUND_Y - 32, w: 32, h: 32, vx: -80, alive: true, stunTimer: 0 },
    { x: 1000, y: GROUND_Y - 32, w: 32, h: 32, vx: 70, alive: true, stunTimer: 0 },
    { x: 1600, y: GROUND_Y - 32, w: 32, h: 32, vx: -90, alive: true, stunTimer: 0 },
    { x: 2200, y: GROUND_Y - 32, w: 32, h: 32, vx: 80, alive: true, stunTimer: 0 },
    { x: 2700, y: GROUND_Y - 32, w: 32, h: 32, vx: -70, alive: true, stunTimer: 0 },
    { x: 3200, y: GROUND_Y - 32, w: 32, h: 32, vx: 90, alive: true, stunTimer: 0 },
    { x: 3800, y: GROUND_Y - 32, w: 32, h: 32, vx: -80, alive: true, stunTimer: 0 },
    { x: 900, y: 220, w: 28, h: 28, vx: -50, alive: true, stunTimer: 0 },
    { x: 1820, y: 170, w: 28, h: 28, vx: 55, alive: true, stunTimer: 0 },
    { x: 3010, y: 190, w: 28, h: 28, vx: -55, alive: true, stunTimer: 0 },
  ];
  return { platforms, rings, badniks, levelWidth, goalX: levelWidth - 150 };
}

function generateBossStage(): { platforms: Platform[]; rings: Ring[]; badniks: Badnik[]; levelWidth: number; goalX: number } {
  const levelWidth = 1400;
  const platforms: Platform[] = [
    { x: 0, y: GROUND_Y, w: levelWidth, h: 60, type: "solid" },
    { x: 150, y: 380, w: 140, h: 18, type: "solid" },
    { x: 400, y: 320, w: 120, h: 18, type: "solid" },
    { x: 650, y: 380, w: 120, h: 18, type: "solid" },
    { x: 100, y: 260, w: 120, h: 18, type: "moving", moveDir: 1, moveSpeed: 70, moveRange: 100, startX: 100 },
    { x: 500, y: 250, w: 120, h: 18, type: "moving", moveDir: -1, moveSpeed: 80, moveRange: 100, startX: 500 },
  ];
  const rings: Ring[] = [];
  for (let i = 0; i < 15; i++) rings.push({ x: 100 + i * 80, y: GROUND_Y - 80, collected: false, animFrame: i * 2 });
  return { platforms, rings, badniks: [], levelWidth, goalX: levelWidth - 100 };
}

function createInitialPlayer(): Player {
  return {
    x: 80, y: GROUND_Y - PLAYER_H,
    vx: 0, vy: 0,
    w: PLAYER_W, h: PLAYER_H,
    onGround: false, jumpsLeft: 2,
    isFlying: false, flyTimer: 0,
    specialActive: false, specialTimer: 0,
    invincible: false, invincibleTimer: 0,
    facing: 1,
    animFrame: 0, animTimer: 0,
    dead: false,
  };
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { actor, isFetching: actorLoading } = useActor();
  const [screen, setScreen] = useState<GameScreen>("menu");
  const [selectedChar, setSelectedChar] = useState<Character>(Character.sonic);
  const [unlockedChars, setUnlockedChars] = useState<Character[]>([Character.sonic]);
  const [playerRings, setPlayerRings] = useState(0);
  const [totalRings, setTotalRings] = useState(0);
  const [pendingUnlock, setPendingUnlock] = useState<Character | null>(null);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [finalRings, setFinalRings] = useState(0);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  // Load progress from backend
  useEffect(() => {
    if (!actor || actorLoading) return;
    setIsLoadingProgress(true);
    Promise.all([
      actor.getPlayerProgress(),
      actor.getUnlockedCharacters(),
    ]).then(([progress, chars]) => {
      setPlayerRings(Number(progress.currentRings));
      setTotalRings(Number(progress.totalRingsCollected));
      const unlocked = chars.length > 0 ? chars : [Character.sonic];
      setUnlockedChars(unlocked);
    }).catch(() => {
      setUnlockedChars([Character.sonic]);
    }).finally(() => setIsLoadingProgress(false));
  }, [actor, actorLoading]);

  const handleUnlock = async (char: Character) => {
    if (!actor) return;
    try {
      await actor.spendRings(char);
      const [progress, chars] = await Promise.all([
        actor.getPlayerProgress(),
        actor.getUnlockedCharacters(),
      ]);
      setPlayerRings(Number(progress.currentRings));
      const unlocked = chars.length > 0 ? chars : [Character.sonic, char];
      setUnlockedChars(unlocked);
      toast.success(`${CHARACTER_NAMES[char]} unlocked!`);
    } catch {
      toast.error("Not enough rings!");
    }
    setPendingUnlock(null);
  };

  const handleLevelComplete = async (rings: number, score: number, levelName: LevelName, nextIdx: number) => {
    try {
      if (actor) {
        await Promise.all([
          actor.addRings(BigInt(rings)),
          actor.updateHighScore(levelName, BigInt(score)),
        ]);
        const progress = await actor.getPlayerProgress();
        setPlayerRings(Number(progress.currentRings));
        setTotalRings(Number(progress.totalRingsCollected));
      }
    } catch { /* ignore */ }

    if (nextIdx >= LEVELS.length) {
      setFinalScore(score);
      setFinalRings(rings);
      setScreen("victory");
    } else {
      setCurrentLevelIdx(nextIdx);
      setScreen("loading");
      setTimeout(() => setScreen("playing"), 800);
    }
  };

  const handleGameOver = (score: number, rings: number) => {
    setFinalScore(score);
    setFinalRings(rings);
    setScreen("gameover");
  };

  const startGame = (char: Character) => {
    setSelectedChar(char);
    setCurrentLevelIdx(0);
    setScreen("loading");
    setTimeout(() => setScreen("playing"), 800);
  };

  return (
    <div className="relative w-full h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #0d1a3a 0%, #050810 100%)" }}>
      <StarField />
      <Toaster />

      {screen === "menu" && <MainMenu onPlay={() => setScreen("characters")} isLoading={isLoadingProgress} />}

      {screen === "characters" && (
        <CharacterSelect
          unlockedChars={unlockedChars}
          playerRings={playerRings}
          onSelect={startGame}
          onUnlock={setPendingUnlock}
          onBack={() => setScreen("menu")}
        />
      )}

      {screen === "loading" && <LoadingScreen levelName={LEVELS[currentLevelIdx]} />}

      {screen === "playing" && (
        <GameCanvas
          character={selectedChar}
          levelIdx={currentLevelIdx}
          onLevelComplete={handleLevelComplete}
          onGameOver={handleGameOver}
        />
      )}

      {screen === "victory" && (
        <VictoryScreen
          score={finalScore}
          rings={finalRings}
          onMenu={() => setScreen("menu")}
        />
      )}

      {screen === "gameover" && (
        <GameOverScreen
          score={finalScore}
          rings={finalRings}
          onRetry={() => {
            setCurrentLevelIdx(0);
            setScreen("loading");
            setTimeout(() => setScreen("playing"), 800);
          }}
          onMenu={() => setScreen("menu")}
        />
      )}

      {pendingUnlock && (
        <UnlockDialog
          char={pendingUnlock}
          cost={CHARACTER_COSTS[pendingUnlock]}
          onConfirm={() => handleUnlock(pendingUnlock)}
          onCancel={() => setPendingUnlock(null)}
        />
      )}

      {/* Footer */}
      <div className="fixed bottom-2 left-0 right-0 text-center text-xs opacity-30"
        style={{ color: "#7090c0", fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        © {new Date().getFullYear()} Built with love using{" "}
        <a href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank" rel="noreferrer" className="underline hover:opacity-70">caffeine.ai</a>
      </div>
    </div>
  );
}

// ─── Star Field ──────────────────────────────────────────────────────────────

function StarField() {
  const stars = React.useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    x: Math.random() * 100, y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 4,
    dur: Math.random() * 3 + 2,
    id: i,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map(s => (
        <div key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            background: "#c0d8ff",
            animation: `twinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
          }} />
      ))}
    </div>
  );
}

// ─── Main Menu ────────────────────────────────────────────────────────────────

function MainMenu({ onPlay, isLoading }: { onPlay: () => void; isLoading: boolean }) {
  return (
    <div className="relative z-10 flex flex-col items-center justify-center gap-8 animate-slide-up">
      <div className="relative">
        <div className="absolute inset-0 blur-3xl rounded-full"
          style={{ background: "radial-gradient(circle, rgba(26,111,196,0.4) 0%, transparent 70%)" }} />
        <img src="/assets/generated/sonic-sprite-transparent.dim_128x128.png" alt="Sonic"
          className="relative w-32 h-32 drop-shadow-2xl"
          style={{ filter: "drop-shadow(0 0 20px #1a6fc4) drop-shadow(0 0 40px #1a6fc480)", animation: "sonic-run 1s ease-in-out infinite" }} />
      </div>

      <div className="text-center">
        <h1 className="text-6xl font-black tracking-tight neon-text-blue mb-2"
          style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "#ffffff", letterSpacing: "-0.02em" }}>
          SONIC
        </h1>
        <h2 className="text-3xl font-bold tracking-widest"
          style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "#f8c940", textShadow: "0 0 20px #f8c940" }}>
          UNLEASHED
        </h2>
        <p className="mt-2 text-sm tracking-widest uppercase opacity-60" style={{ color: "#7090c0" }}>
          Collect rings · Unlock heroes · Defeat Eggman
        </p>
      </div>

      <button
        type="button"
        onClick={onPlay}
        disabled={isLoading}
        className="relative px-12 py-4 text-xl font-black tracking-widest uppercase rounded-full transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, #1a6fc4, #0d3d8a)",
          color: "#ffffff",
          fontFamily: "'Bricolage Grotesque', sans-serif",
          boxShadow: "0 0 20px rgba(26,111,196,0.6), 0 0 60px rgba(26,111,196,0.3), 0 4px 20px rgba(0,0,0,0.5)",
          border: "1px solid rgba(26,111,196,0.5)",
        }}>
        {isLoading ? "Loading..." : "▶  PLAY"}
      </button>

      <div className="flex gap-6 mt-2">
        {[Character.sonic, Character.tails, Character.knuckles, Character.shadow, Character.amy].map(c => (
          <img key={c} src={CHARACTER_SPRITES[c]} alt={CHARACTER_NAMES[c]}
            className="w-10 h-10 opacity-60 hover:opacity-100 transition-opacity"
            style={{ filter: `drop-shadow(0 0 8px ${CHARACTER_COLORS[c]})` }}
            title={CHARACTER_NAMES[c]} />
        ))}
      </div>
    </div>
  );
}

// ─── Character Select ─────────────────────────────────────────────────────────

function CharacterSelect({ unlockedChars, playerRings, onSelect, onUnlock, onBack }: {
  unlockedChars: Character[];
  playerRings: number;
  onSelect: (c: Character) => void;
  onUnlock: (c: Character) => void;
  onBack: () => void;
}) {
  const allChars = [Character.sonic, Character.tails, Character.amy, Character.knuckles, Character.shadow];

  return (
    <div className="relative z-10 w-full max-w-4xl px-4 animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <button type="button" onClick={onBack} className="text-sm font-bold opacity-60 hover:opacity-100 transition-opacity px-4 py-2 rounded-lg"
          style={{ color: "#7090c0", border: "1px solid rgba(112,144,192,0.3)" }}>
          ← Back
        </button>
        <h2 className="text-2xl font-black tracking-widest uppercase"
          style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "#ffffff" }}>
          Choose Your Hero
        </h2>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: "rgba(248,201,64,0.15)", border: "1px solid rgba(248,201,64,0.4)" }}>
          <span className="text-xl">💛</span>
          <span className="font-black text-lg" style={{ color: "#f8c940" }}>{playerRings}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {allChars.map(char => {
          const isUnlocked = unlockedChars.includes(char);
          const cost = CHARACTER_COSTS[char];
          const canAfford = playerRings >= cost;
          return (
            <button type="button" key={char}
              className="relative rounded-2xl p-4 flex flex-col items-center gap-3 transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
              style={{
                background: isUnlocked
                  ? `linear-gradient(135deg, ${CHARACTER_COLORS[char]}22, ${CHARACTER_COLORS[char]}08)`
                  : "rgba(255,255,255,0.03)",
                border: isUnlocked
                  ? `1px solid ${CHARACTER_COLORS[char]}60`
                  : "1px solid rgba(255,255,255,0.1)",
                boxShadow: isUnlocked ? `0 0 20px ${CHARACTER_COLORS[char]}30` : "none",
              }}
              onClick={() => {
                if (isUnlocked) onSelect(char);
                else if (canAfford) onUnlock(char);
              }}>
              <div className="relative w-16 h-16 flex items-center justify-center">
                <img src={CHARACTER_SPRITES[char]} alt={CHARACTER_NAMES[char]}
                  className="w-full h-full object-contain"
                  style={{
                    filter: isUnlocked
                      ? `drop-shadow(0 0 10px ${CHARACTER_COLORS[char]})`
                      : "grayscale(100%) brightness(0.3)",
                  }} />
                {!isUnlocked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl">🔒</span>
                  </div>
                )}
              </div>

              <div className="text-center">
                <p className="font-black text-sm" style={{ color: isUnlocked ? "#ffffff" : "#445566" }}>
                  {CHARACTER_NAMES[char]}
                </p>
                <p className="text-xs opacity-60 mt-1 leading-tight" style={{ color: isUnlocked ? CHARACTER_COLORS[char] : "#445566", fontSize: "0.6rem" }}>
                  {CHARACTER_ABILITIES[char].split("–")[0].trim()}
                </p>
              </div>

              {!isUnlocked && (
                <div className="flex items-center gap-1">
                  <span className="text-xs">💛</span>
                  <span className="text-xs font-bold" style={{ color: canAfford ? "#f8c940" : "#667788" }}>{cost}</span>
                </div>
              )}

              {isUnlocked && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${CHARACTER_COLORS[char]}30`, color: CHARACTER_COLORS[char] }}>
                  SELECT
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-center mt-4 text-xs opacity-40" style={{ color: "#7090c0" }}>
        Collect rings in-game to unlock more characters
      </p>
    </div>
  );
}

// ─── Unlock Dialog ────────────────────────────────────────────────────────────

function UnlockDialog({ char, cost, onConfirm, onCancel }: {
  char: Character; cost: number; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="rounded-2xl p-8 flex flex-col items-center gap-5 animate-slide-up"
        style={{ background: "#0e1830", border: `1px solid ${CHARACTER_COLORS[char]}40`, boxShadow: `0 0 40px ${CHARACTER_COLORS[char]}30` }}>
        <img src={CHARACTER_SPRITES[char]} alt={CHARACTER_NAMES[char]} className="w-24 h-24"
          style={{ filter: `drop-shadow(0 0 15px ${CHARACTER_COLORS[char]})` }} />
        <div className="text-center">
          <h3 className="text-xl font-black mb-1" style={{ color: "#ffffff", fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Unlock {CHARACTER_NAMES[char]}?
          </h3>
          <p className="text-sm opacity-60 mb-2" style={{ color: "#7090c0" }}>{CHARACTER_ABILITIES[char]}</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">💛</span>
            <span className="text-xl font-black" style={{ color: "#f8c940" }}>{cost} Rings</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={onCancel} className="px-6 py-2 rounded-xl font-bold text-sm transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.08)", color: "#aaaaaa", border: "1px solid rgba(255,255,255,0.15)" }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="px-6 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${CHARACTER_COLORS[char]}, ${CHARACTER_COLORS[char]}88)`, color: "#fff", boxShadow: `0 0 20px ${CHARACTER_COLORS[char]}50` }}>
            Unlock!
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen({ levelName }: { levelName: LevelName }) {
  const descriptions: Record<LevelName, string> = {
    GreenHill: "Green Hill Zone · Act 1",
    ChemicalPlant: "Chemical Plant Zone · Act 2",
    BossStage: "Final Boss · Eggman's Lair",
  };
  return (
    <div className="relative z-10 flex flex-col items-center gap-6 animate-slide-up">
      <div className="w-16 h-16 rounded-full border-4 animate-spin"
        style={{ borderColor: "#1a6fc4", borderTopColor: "transparent" }} />
      <div className="text-center">
        <p className="text-sm tracking-widest uppercase opacity-60 mb-2" style={{ color: "#7090c0" }}>Loading</p>
        <h2 className="text-2xl font-black" style={{ color: "#ffffff", fontFamily: "'Bricolage Grotesque', sans-serif" }}>
          {descriptions[levelName]}
        </h2>
      </div>
    </div>
  );
}

// ─── Game Canvas ──────────────────────────────────────────────────────────────

function GameCanvas({ character, levelIdx, onLevelComplete, onGameOver }: {
  character: Character;
  levelIdx: number;
  onLevelComplete: (rings: number, score: number, level: LevelName, nextIdx: number) => void;
  onGameOver: (score: number, rings: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const livesRef = useRef(3);
  const touchJumpRef = useRef(false);
  const touchSpecialRef = useRef(false);

  const levelName = LEVELS[levelIdx] as LevelName;
  const isBoss = levelName === "BossStage";

  // Load images
  useEffect(() => {
    const sprites = [
      ...Object.values(CHARACTER_SPRITES),
      EGGMAN_SPRITE,
    ];
    sprites.forEach(src => {
      if (!imagesRef.current[src]) {
        const img = new Image();
        img.src = src;
        imagesRef.current[src] = img;
      }
    });
  }, []);

  const initLevel = useCallback(() => {
    let levelData: { platforms: Platform[]; rings: Ring[]; badniks: Badnik[]; levelWidth: number; goalX: number };
    if (levelName === "GreenHill") levelData = generateGreenHill();
    else if (levelName === "ChemicalPlant") levelData = generateChemicalPlant();
    else levelData = generateBossStage();

    const gs: GameState = {
      player: createInitialPlayer(),
      ...levelData,
      cameraX: 0,
      ringsCollected: 0,
      score: 0,
      lives: livesRef.current,
      timeMs: 0,
      levelComplete: false,
      goalReached: false,
      bossHits: 0,
      bossHp: 3,
      bossX: isBoss ? 900 : 0,
      bossY: isBoss ? GROUND_Y - 120 : 0,
      bossVx: isBoss ? -80 : 0,
      bossAnimFrame: 0,
      bossAnimTimer: 0,
      projectiles: [],
      bossShootTimer: 2.5,
      bossPhase: 1,
      timeSlowActive: false,
      timeSlowTimer: 0,
      hammerActive: false,
      hammerTimer: 0,
      particles: [],
    };
    stateRef.current = gs;
  }, [levelName, isBoss]);

  useEffect(() => {
    livesRef.current = 3;
    initLevel();
  }, [initLevel]);

  const characterRef = useRef(character);
  useEffect(() => { characterRef.current = character; }, [character]);

  const handleJumpRef = useRef<(gs: GameState) => void>(() => {});
  const handleSpecialRef = useRef<(gs: GameState, char: Character) => void>(() => {});

  // Input
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "KeyW", "KeyA", "KeyD"].includes(e.code)) {
        e.preventDefault();
      }
      if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && stateRef.current) {
        handleJumpRef.current(stateRef.current);
      }
      if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && stateRef.current) {
        handleSpecialRef.current(stateRef.current, characterRef.current);
      }
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  function handleJump(gs: GameState) {
    if (gs.levelComplete || gs.player.dead) return;
    const p = gs.player;
    if (p.jumpsLeft > 0) {
      p.vy = JUMP_FORCE;
      p.jumpsLeft--;
      p.onGround = false;
      if (characterRef.current === Character.tails && p.jumpsLeft === 0) {
        p.isFlying = true;
        p.flyTimer = 2.0;
      }
    }
  }
  handleJumpRef.current = handleJump;

  handleSpecialRef.current = handleSpecial;
  function handleSpecial(gs: GameState, char: Character) {
    if (gs.levelComplete || gs.player.dead) return;
    const p = gs.player;
    if (p.specialTimer > 0) return;
    p.specialActive = true;
    p.specialTimer = 1.5;

    switch (char) {
      case Character.sonic:
        p.vx = p.facing * 700;
        p.invincible = true;
        p.invincibleTimer = 1.2;
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#00e5ff", 12);
        break;
      case Character.shadow:
        gs.timeSlowActive = true;
        gs.timeSlowTimer = 3.0;
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#8b0000", 20);
        break;
      case Character.knuckles:
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#cc2244", 15);
        if (isBoss) {
          const dist = Math.abs((p.x + p.w / 2) - (gs.bossX + 80));
          if (dist < 200) hitBoss(gs);
        }
        gs.badniks.forEach(b => {
          if (!b.alive) return;
          const dist = Math.abs((p.x + p.w / 2) - (b.x + b.w / 2));
          if (dist < 150) b.stunTimer = 3.0;
        });
        break;
      case Character.amy:
        gs.hammerActive = true;
        gs.hammerTimer = 0.5;
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#e8208c", 15);
        if (isBoss) {
          const dist = Math.abs((p.x + p.w / 2) - (gs.bossX + 80));
          if (dist < 250) hitBoss(gs);
        }
        break;
      case Character.tails:
        p.vy = JUMP_FORCE * 0.6;
        p.isFlying = true;
        p.flyTimer = 2.5;
        break;
    }
  }

  function hitBoss(gs: GameState) {
    gs.bossHits++;
    gs.bossHp--;
    gs.bossVx = -gs.bossVx * 1.2;
    spawnParticles(gs, gs.bossX + 80, gs.bossY + 60, "#ff4400", 20);
    if (gs.bossHp <= 0) {
      gs.levelComplete = true;
      gs.goalReached = true;
    }
  }

  function spawnParticles(gs: GameState, x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 80 + Math.random() * 200;
      gs.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 0.6 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  const updateGameRef = useRef<(gs: GameState, dt: number, rawDt: number) => void>(() => {});
  const drawFrameRef = useRef<(gs: GameState, rawDt: number) => void>(() => {});

  // Main loop
  useEffect(() => {
    let dead = false;

    function loop(timestamp: number) {
      if (dead) return;
      const rawDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const gs = stateRef.current;
      if (!gs) { rafRef.current = requestAnimationFrame(loop); return; }

      const timeMult = gs.timeSlowActive ? 0.3 : 1;
      const dt = rawDt * timeMult;

      if (!gs.levelComplete) {
        updateGameRef.current(gs, dt, rawDt);
      }

      drawFrameRef.current(gs, rawDt);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { dead = true; cancelAnimationFrame(rafRef.current); };
  }, []);

  updateGameRef.current = updateGame;
  function updateGame(gs: GameState, dt: number, rawDt: number) {
    const p = gs.player;
    if (p.dead) { handlePlayerDead(gs, rawDt); return; }

    gs.timeMs += rawDt;

    // Timers
    if (p.specialTimer > 0) p.specialTimer -= rawDt;
    if (p.invincibleTimer > 0) { p.invincibleTimer -= rawDt; if (p.invincibleTimer <= 0) p.invincible = false; }
    if (p.flyTimer > 0) p.flyTimer -= rawDt;
    if (gs.timeSlowTimer > 0) { gs.timeSlowTimer -= rawDt; if (gs.timeSlowTimer <= 0) gs.timeSlowActive = false; }
    if (gs.hammerTimer > 0) gs.hammerTimer -= rawDt;

    // Player horizontal movement
    const isLeft = keysRef.current.has("ArrowLeft") || keysRef.current.has("KeyA");
    const isRight = keysRef.current.has("ArrowRight") || keysRef.current.has("KeyD");

    let targetVx = 0;
    if (isLeft) { targetVx = -MOVE_SPEED; p.facing = -1; }
    if (isRight) { targetVx = MOVE_SPEED; p.facing = 1; }

    // Speed boost for sonic special
    const speedMult = (character === Character.sonic && p.specialActive && p.specialTimer > 0) ? 2.5 : 1;
    if (p.specialActive && character === Character.sonic && p.specialTimer > 0) {
      p.vx = p.facing * MOVE_SPEED * speedMult;
    } else {
      p.vx = targetVx;
    }

    // Gravity
    if (character === Character.tails && p.isFlying && p.flyTimer > 0) {
      p.vy += GRAVITY * 0.2 * dt;
    } else {
      p.vy += GRAVITY * dt;
    }

    // Move player
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Clamp x
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > gs.levelWidth) p.x = gs.levelWidth - p.w;

    // Platform collision
    p.onGround = false;
    for (const plat of gs.platforms) {
      if (plat.w === 0) continue;
      // Update moving platforms
      if (plat.type === "moving") {
        plat.x += (plat.moveDir ?? 1) * (plat.moveSpeed ?? 60) * dt;
        if (plat.startX !== undefined) {
          if (plat.x > plat.startX + (plat.moveRange ?? 100)) plat.moveDir = -1;
          if (plat.x < plat.startX - (plat.moveRange ?? 100)) plat.moveDir = 1;
        }
      }
      if (rectOverlap(p.x, p.y, p.w, p.h, plat.x, plat.y, plat.w, plat.h)) {
        const overlapX = Math.min(p.x + p.w, plat.x + plat.w) - Math.max(p.x, plat.x);
        const overlapY = Math.min(p.y + p.h, plat.y + plat.h) - Math.max(p.y, plat.y);
        if (overlapY <= overlapX) {
          if (p.y < plat.y) { // landing on top
            p.y = plat.y - p.h;
            p.vy = 0;
            p.onGround = true;
            p.jumpsLeft = 2;
            p.isFlying = false;
            if (plat.type === "moving") p.x += (plat.moveDir ?? 1) * (plat.moveSpeed ?? 60) * dt;
          } else { p.y = plat.y + plat.h; p.vy = 0; }
        } else {
          if (p.x < plat.x) p.x = plat.x - p.w;
          else p.x = plat.x + plat.w;
        }
      }
    }

    // Fall into pit
    if (p.y > CANVAS_H + 100) {
      killPlayer(gs);
      return;
    }

    // Rings
    for (const ring of gs.rings) {
      if (ring.collected) continue;
      ring.animFrame = (ring.animFrame + rawDt * 8) % 8;
      if (circleAABB(ring.x + 8, ring.y + 8, 12, p.x, p.y, p.w, p.h)) {
        ring.collected = true;
        gs.ringsCollected++;
        gs.score += 10;
        spawnParticles(gs, ring.x + 8, ring.y + 8, "#f8c940", 5);
      }
    }

    // Badniks
    for (const b of gs.badniks) {
      if (!b.alive) continue;
      if (b.stunTimer > 0) { b.stunTimer -= dt; continue; }
      b.x += b.vx * dt;

      // Bounce off edges / platforms
      if (b.x < 0 || b.x + b.w > gs.levelWidth) b.vx = -b.vx;

      // Player collision with badnik
      if (!p.invincible && rectOverlap(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
        // Stomping
        if (p.vy > 0 && p.y + p.h < b.y + b.h * 0.5) {
          b.alive = false;
          p.vy = JUMP_FORCE * 0.5;
          gs.score += 100;
          spawnParticles(gs, b.x + b.w / 2, b.y + b.h / 2, "#ff8800", 8);
        } else if (!p.invincible) {
          hurtPlayer(gs, p);
        }
      }
    }

    // Boss update
    if (isBoss) {
      updateBoss(gs, dt, rawDt, p);
    }

    // Goal post (non-boss levels)
    if (!isBoss && !gs.goalReached) {
      if (p.x + p.w > gs.goalX) {
        gs.goalReached = true;
        gs.levelComplete = true;
      }
    }

    // Particles
    for (let i = gs.particles.length - 1; i >= 0; i--) {
      const pt = gs.particles[i];
      pt.x += pt.vx * rawDt;
      pt.y += pt.vy * rawDt;
      pt.vy += 300 * rawDt;
      pt.life -= rawDt;
      if (pt.life <= 0) gs.particles.splice(i, 1);
    }

    // Animation
    p.animTimer += rawDt;
    if (p.animTimer > 0.08) { p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 4; }

    // Camera
    const targetCamX = p.x - CANVAS_W * 0.35;
    gs.cameraX = Math.max(0, Math.min(targetCamX, gs.levelWidth - CANVAS_W));
    gs.score = Math.max(0, gs.score);

    // Level complete trigger
    if (gs.levelComplete && !gs.goalReached) { gs.goalReached = true; }

    // Touch input
    if (touchJumpRef.current) { handleJump(gs); touchJumpRef.current = false; }
    if (touchSpecialRef.current) { handleSpecial(gs, character); touchSpecialRef.current = false; }
  }

  function updateBoss(gs: GameState, dt: number, rawDt: number, p: Player) {
    if (gs.bossHp <= 0) return;

    gs.bossAnimTimer += rawDt;
    if (gs.bossAnimTimer > 0.15) { gs.bossAnimTimer = 0; gs.bossAnimFrame = (gs.bossAnimFrame + 1) % 4; }

    // Boss movement
    gs.bossX += gs.bossVx * dt;
    if (gs.bossX < 100) { gs.bossX = 100; gs.bossVx = Math.abs(gs.bossVx); }
    if (gs.bossX > CANVAS_W - 200 + gs.cameraX) { gs.bossX = CANVAS_W - 200 + gs.cameraX; gs.bossVx = -Math.abs(gs.bossVx); }

    // Phase 2: faster and more shots
    if (gs.bossHp <= 2) gs.bossPhase = 2;

    // Shooting
    gs.bossShootTimer -= rawDt;
    if (gs.bossShootTimer <= 0) {
      const interval = gs.bossPhase === 2 ? 1.2 : 2.0;
      gs.bossShootTimer = interval + Math.random() * 0.5;
      const dx = (p.x + p.w / 2) - (gs.bossX + 80);
      const dy = (p.y + p.h / 2) - (gs.bossY + 60);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = gs.bossPhase === 2 ? 320 : 220;
      gs.projectiles.push({ x: gs.bossX + 80, y: gs.bossY + 80, vx: (dx / dist) * speed, vy: (dy / dist) * speed, active: true });
      if (gs.bossPhase === 2) {
        // Extra scatter shots
        gs.projectiles.push({ x: gs.bossX + 80, y: gs.bossY + 80, vx: (dx / dist) * speed * 0.8 + 80, vy: (dy / dist) * speed * 0.8, active: true });
        gs.projectiles.push({ x: gs.bossX + 80, y: gs.bossY + 80, vx: (dx / dist) * speed * 0.8 - 80, vy: (dy / dist) * speed * 0.8, active: true });
      }
    }

    // Update projectiles
    for (const proj of gs.projectiles) {
      if (!proj.active) continue;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Check player hit
      if (!p.invincible && circleAABB(proj.x, proj.y, 10, p.x, p.y, p.w, p.h)) {
        proj.active = false;
        hurtPlayer(gs, p);
      }

      if (proj.x < gs.cameraX - 50 || proj.x > gs.cameraX + CANVAS_W + 50 ||
        proj.y < -50 || proj.y > CANVAS_H + 100) {
        proj.active = false;
      }
    }
    gs.projectiles = gs.projectiles.filter(p => p.active);

    // Player jumps on boss
    if (!p.invincible) {
      const bossRect = { x: gs.bossX + 20, y: gs.bossY + 10, w: 120, h: 110 };
      if (rectOverlap(p.x, p.y, p.w, p.h, bossRect.x, bossRect.y, bossRect.w, bossRect.h)) {
        if (p.vy > 0 && p.y + p.h < bossRect.y + bossRect.h * 0.5) {
          p.vy = JUMP_FORCE * 0.6;
          hitBoss(gs);
        } else {
          hurtPlayer(gs, p);
        }
      }
    }

    // Hammer wide hit
    if (gs.hammerActive && character === Character.amy) {
      const dist = Math.abs((p.x + p.w / 2) - (gs.bossX + 80));
      if (dist < 300) {
        gs.projectiles.forEach(pr => { pr.active = false; });
      }
    }
  }

  function hurtPlayer(gs: GameState, p: Player) {
    if (p.invincible) return;
    p.invincible = true;
    p.invincibleTimer = 2.0;
    p.vy = JUMP_FORCE * 0.5;
    if (gs.ringsCollected > 0) {
      const lost = Math.min(gs.ringsCollected, 10);
      gs.ringsCollected -= lost;
      gs.score = Math.max(0, gs.score - lost * 10);
    } else {
      killPlayer(gs);
    }
  }

  function killPlayer(gs: GameState) {
    gs.player.dead = true;
    gs.player.invincible = true;
    gs.lives--;
    livesRef.current = gs.lives;
  }

  function handlePlayerDead(gs: GameState, rawDt: number) {
    gs.player.y += 200 * rawDt;
    gs.player.vy += GRAVITY * rawDt;
    // Wait briefly then respawn or game over
    if (!('_deadTimer' in gs)) (gs as any)._deadTimer = 0;
    (gs as any)._deadTimer += rawDt;
    if ((gs as any)._deadTimer > 2) {
      (gs as any)._deadTimer = 0;
      if (gs.lives <= 0) {
        // trigger game over in draw
        (gs as any)._gameOver = true;
      } else {
        // Respawn
        gs.player = createInitialPlayer();
        gs.player.invincible = true;
        gs.player.invincibleTimer = 3.0;
      }
    }
  }

  // ─── Draw ────────────────────────────────────────────────────────────────────

  drawFrameRef.current = drawFrame;
  function drawFrame(gs: GameState, rawDt: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if ((gs as any)._gameOver) {
      (gs as any)._gameOver = false;
      onGameOver(gs.score, gs.ringsCollected);
      return;
    }
    if (gs.levelComplete && !('_levelTransitioning' in gs)) {
      (gs as any)._levelTransitioning = true;
      setTimeout(() => {
        onLevelComplete(gs.ringsCollected, gs.score, levelName, levelIdx + 1);
      }, 1500);
    }

    const cx = gs.cameraX;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ── Background ──
    drawBackground(ctx, gs, cx);

    // ── Platforms ──
    for (const plat of gs.platforms) {
      if (plat.w === 0) continue;
      drawPlatform(ctx, plat, cx);
    }

    // ── Goal Post ──
    if (!isBoss && gs.goalX > 0) {
      drawGoalPost(ctx, gs.goalX - cx, GROUND_Y - 80);
    }

    // ── Rings ──
    for (const ring of gs.rings) {
      if (ring.collected) continue;
      drawRing(ctx, ring.x - cx, ring.y);
    }

    // ── Badniks ──
    for (const b of gs.badniks) {
      if (!b.alive) continue;
      drawBadnik(ctx, b.x - cx, b.y, b.w, b.h, b.stunTimer > 0);
    }

    // ── Boss ──
    if (isBoss && gs.bossHp > 0) {
      drawBoss(ctx, gs, cx);
    }

    // ── Projectiles ──
    for (const proj of gs.projectiles) {
      drawProjectile(ctx, proj.x - cx, proj.y);
    }

    // ── Player ──
    drawPlayer(ctx, gs.player, cx, character, gs.player.invincible && Math.floor(rawDt * 20) % 2 === 0);

    // ── Particles ──
    for (const pt of gs.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x - cx, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── HUD ──
    drawHUD(ctx, gs, character, rawDt);

    // ── Level complete overlay ──
    if (gs.levelComplete) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#f8c940";
      ctx.font = "bold 52px 'Bricolage Grotesque', sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "#f8c940";
      ctx.shadowBlur = 30;
      ctx.fillText(isBoss ? "EGGMAN DEFEATED!" : "STAGE CLEAR!", CANVAS_W / 2, CANVAS_H / 2);
      ctx.shadowBlur = 0;
    }
  }

  function drawBackground(ctx: CanvasRenderingContext2D, gs: GameState, cx: number) {
    if (levelName === "GreenHill") {
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, "#1a3a8c");
      grad.addColorStop(0.5, "#2d5aa0");
      grad.addColorStop(1, "#1a5e30");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Rolling hills
      ctx.fillStyle = "#2d7a40";
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H);
      for (let x2 = 0; x2 <= CANVAS_W; x2 += 5) {
        const scrollX = (x2 + cx * 0.3) % (CANVAS_W * 2);
        ctx.lineTo(x2, GROUND_Y - 30 + Math.sin(scrollX / 80) * 25 + Math.sin(scrollX / 30) * 12);
      }
      ctx.lineTo(CANVAS_W, CANVAS_H);
      ctx.fill();
      // Sun
      const sunX = 750 - (cx * 0.05) % 100;
      ctx.fillStyle = "#ffe060";
      ctx.shadowColor = "#ffe060";
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(sunX, 80, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (levelName === "ChemicalPlant") {
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, "#0a0028");
      grad.addColorStop(0.5, "#1a0a3a");
      grad.addColorStop(1, "#0a2a18");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Chemical tubes
      ctx.strokeStyle = "rgba(0,100,200,0.4)";
      ctx.lineWidth = 20;
      for (let i = 0; i < 6; i++) {
        const tx = ((i * 150 - cx * 0.2) % (CANVAS_W + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(tx, 0);
        ctx.lineTo(tx, CANVAS_H);
        ctx.stroke();
        // Bubbles
        ctx.fillStyle = "rgba(0,200,255,0.4)";
        for (let j = 0; j < 3; j++) {
          const by = ((gs.timeMs * 40 + j * 100 + i * 50) % CANVAS_H);
          ctx.beginPath();
          ctx.arc(tx, by, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Boss stage
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, "#0a0008");
      grad.addColorStop(0.5, "#1a0010");
      grad.addColorStop(1, "#100000");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Lightning
      if (Math.random() < 0.02) {
        ctx.strokeStyle = "rgba(255,80,80,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        let lx = Math.random() * CANVAS_W, ly = 0;
        ctx.moveTo(lx, ly);
        while (ly < CANVAS_H * 0.6) {
          lx += (Math.random() - 0.5) * 60;
          ly += 30 + Math.random() * 20;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
    }
  }

  function drawPlatform(ctx: CanvasRenderingContext2D, plat: Platform, cx: number) {
    const sx = plat.x - cx;
    if (sx + plat.w < -10 || sx > CANVAS_W + 10) return;

    if (levelName === "GreenHill") {
      ctx.fillStyle = plat.y >= GROUND_Y ? "#3d5e20" : "#5a8c2a";
      ctx.fillRect(sx, plat.y, plat.w, plat.h);
      ctx.fillStyle = "#7ab840";
      ctx.fillRect(sx, plat.y, plat.w, 5);
      // Checkerboard
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < plat.w; i += 16) {
        for (let j = 0; j < plat.h; j += 16) {
          if ((Math.floor(i / 16) + Math.floor(j / 16)) % 2 === 0)
            ctx.fillRect(sx + i, plat.y + j, 16, 16);
        }
      }
    } else if (levelName === "ChemicalPlant") {
      ctx.fillStyle = plat.y >= GROUND_Y ? "#0a3060" : "#1a4880";
      ctx.fillRect(sx, plat.y, plat.w, plat.h);
      ctx.strokeStyle = "#00ccff";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, plat.y, plat.w, plat.h);
      ctx.fillStyle = "rgba(0,180,255,0.15)";
      ctx.fillRect(sx, plat.y, plat.w, 4);
    } else {
      ctx.fillStyle = "#2a0010";
      ctx.fillRect(sx, plat.y, plat.w, plat.h);
      ctx.strokeStyle = "#cc0044";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, plat.y, plat.w, plat.h);
    }
  }

  function drawGoalPost(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Pole
    ctx.fillStyle = "#aaaaaa";
    ctx.fillRect(x - 4, y, 8, 80);
    // Spinning star top
    ctx.fillStyle = "#f8c940";
    ctx.shadowColor = "#f8c940";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff8800";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⭐", x, y + 5);
  }

  function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const pulse = Math.sin(Date.now() / 200) * 0.15 + 0.85;
    ctx.save();
    ctx.translate(x + 8, y + 8);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = "#f8c940";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#f8c940";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawBadnik(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stunned: boolean) {
    ctx.fillStyle = stunned ? "#888800" : "#cc4400";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = stunned ? "#aaaa00" : "#ff6600";
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    // Eyes
    ctx.fillStyle = stunned ? "#ffff00" : "#ff0000";
    ctx.beginPath();
    ctx.arc(x + 8, y + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - 8, y + 10, 4, 0, Math.PI * 2);
    ctx.fill();
    if (stunned) {
      ctx.fillStyle = "#ffff88";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("💫", x + w / 2, y - 4);
    }
  }

  function drawBoss(ctx: CanvasRenderingContext2D, gs: GameState, cx: number) {
    const bx = gs.bossX - cx;
    const by = gs.bossY;
    const img = imagesRef.current[EGGMAN_SPRITE];
    if (img && img.complete) {
      // Flash on hit
      const flash = gs.bossHp < 3 && Math.floor(Date.now() / 200) % 2 === 0 && gs.bossHp > 0;
      ctx.save();
      if (flash) { ctx.filter = "brightness(3) sepia(1) hue-rotate(0deg)"; }
      ctx.drawImage(img, bx, by, 160, 160);
      ctx.restore();
    } else {
      ctx.fillStyle = "#cc2222";
      ctx.fillRect(bx + 20, by + 10, 120, 110);
    }

    // Health bar
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(CANVAS_W / 2 - 110, 18, 220, 24);
    ctx.fillStyle = gs.bossHp > 1 ? "#ff4400" : "#ff8800";
    ctx.fillRect(CANVAS_W / 2 - 108, 20, (gs.bossHp / 3) * 216, 20);
    ctx.strokeStyle = "#ff2200";
    ctx.lineWidth = 2;
    ctx.strokeRect(CANVAS_W / 2 - 110, 18, 220, 24);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DR. EGGMAN", CANVAS_W / 2, 34);
  }

  function drawProjectile(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = "#ff4400";
    ctx.shadowColor = "#ff4400";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Inner
    ctx.fillStyle = "#ffaa00";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, cx: number, char: Character, blinking: boolean) {
    if (blinking) return;
    const sx = p.x - cx;
    const img = imagesRef.current[CHARACTER_SPRITES[char]];

    ctx.save();
    if (p.specialActive && p.specialTimer > 0) {
      ctx.shadowColor = CHARACTER_COLORS[char];
      ctx.shadowBlur = 20;
    }
    if (char === Character.shadow && stateRef.current?.timeSlowActive) {
      ctx.shadowColor = "#8b0000";
      ctx.shadowBlur = 30;
    }

    ctx.scale(p.facing, 1);
    const drawX = p.facing === 1 ? sx : -(sx + p.w);

    if (img && img.complete) {
      ctx.drawImage(img, drawX, p.y, p.w, p.h);
    } else {
      ctx.fillStyle = CHARACTER_COLORS[char];
      ctx.fillRect(drawX, p.y, p.w, p.h);
    }
    ctx.restore();

    // Tails flight indicator
    if (char === Character.tails && p.isFlying && p.flyTimer > 0) {
      ctx.fillStyle = "rgba(248,168,48,0.4)";
      ctx.beginPath();
      ctx.ellipse(sx + p.w / 2, p.y + p.h, p.w * 0.8, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow special aura
    if (char === Character.shadow && stateRef.current?.timeSlowActive) {
      ctx.strokeStyle = "rgba(200,0,0,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx + p.w / 2, p.y + p.h / 2, p.w, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Amy hammer
    if (char === Character.amy && stateRef.current?.hammerActive) {
      ctx.fillStyle = "#e8208c";
      ctx.shadowColor = "#e8208c";
      ctx.shadowBlur = 15;
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🔨", sx + p.w / 2 + p.facing * 30, p.y - 10);
      ctx.shadowBlur = 0;
    }
  }

  function drawHUD(ctx: CanvasRenderingContext2D, gs: GameState, char: Character, rawDt: number) {
    // HUD background
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, CANVAS_W, 52);

    // Character icon
    const charImg = imagesRef.current[CHARACTER_SPRITES[char]];
    if (charImg && charImg.complete) {
      ctx.drawImage(charImg, 8, 4, 44, 44);
    }

    // Rings
    ctx.fillStyle = "#f8c940";
    ctx.shadowColor = "#f8c940";
    ctx.shadowBlur = 8;
    ctx.font = "bold 20px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`💛 ${gs.ringsCollected}`, 60, 28);
    ctx.shadowBlur = 0;

    // Lives
    ctx.fillStyle = "#ff4488";
    ctx.font = "bold 16px 'Bricolage Grotesque', sans-serif";
    ctx.fillText(`❤️ ${gs.lives}`, 60, 48);

    // Score
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${gs.score.toLocaleString()}`, CANVAS_W / 2, 30);

    // Level name
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px 'Cabinet Grotesk', sans-serif";
    ctx.fillText(levelName, CANVAS_W / 2, 46);

    // Special ability cooldown
    const spTimer = gs.player.specialTimer;
    const spMax = 1.5;
    ctx.textAlign = "right";
    if (spTimer > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "11px sans-serif";
      ctx.fillText(`SPECIAL: ${spTimer.toFixed(1)}s`, CANVAS_W - 10, 48);
    } else {
      ctx.fillStyle = CHARACTER_COLORS[char];
      ctx.shadowColor = CHARACTER_COLORS[char];
      ctx.shadowBlur = 6;
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("SPECIAL READY [SHIFT]", CANVAS_W - 10, 48);
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = "left";

    // Time slow indicator
    if (gs.timeSlowActive) {
      ctx.fillStyle = "rgba(139,0,0,0.3)";
      ctx.fillRect(0, 52, CANVAS_W, CANVAS_H - 52);
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 14px 'Bricolage Grotesque', sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 10;
      ctx.fillText("⏱ CHAOS CONTROL", CANVAS_W / 2, 75);
      ctx.shadowBlur = 0;
    }
  }

  return (
    <div className="relative z-10 flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        tabIndex={0}
        className="block rounded-xl scanlines"
        style={{
          maxWidth: "100vw",
          maxHeight: "calc(100vh - 120px)",
          aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
          outline: "none",
          border: "2px solid rgba(26,111,196,0.4)",
          boxShadow: "0 0 40px rgba(26,111,196,0.3), 0 0 80px rgba(26,111,196,0.15)",
        }}
      />
      {/* Mobile touch controls */}
      <MobileControls
        onJump={() => { touchJumpRef.current = true; }}
        onSpecial={() => { touchSpecialRef.current = true; }}
        onLeft={() => { keysRef.current.add("ArrowLeft"); }}
        onRight={() => { keysRef.current.add("ArrowRight"); }}
        onLeftEnd={() => keysRef.current.delete("ArrowLeft")}
        onRightEnd={() => keysRef.current.delete("ArrowRight")}
      />
    </div>
  );
}

// ─── Mobile Controls ──────────────────────────────────────────────────────────

function MobileControls({ onJump, onSpecial, onLeft, onRight, onLeftEnd, onRightEnd }: {
  onJump: () => void; onSpecial: () => void;
  onLeft: () => void; onRight: () => void;
  onLeftEnd: () => void; onRightEnd: () => void;
}) {
  return (
    <div className="flex items-center justify-between w-full px-4 mt-2 md:hidden">
      <div className="flex gap-2">
        <button type="button"
          onTouchStart={e => { e.preventDefault(); onLeft(); }}
          onTouchEnd={e => { e.preventDefault(); onLeftEnd(); }}
          className="w-14 h-14 rounded-xl text-xl font-black select-none active:scale-95"
          style={{ background: "rgba(26,111,196,0.3)", border: "1px solid rgba(26,111,196,0.5)", color: "#fff", touchAction: "none" }}>
          ◀
        </button>
        <button type="button"
          onTouchStart={e => { e.preventDefault(); onRight(); }}
          onTouchEnd={e => { e.preventDefault(); onRightEnd(); }}
          className="w-14 h-14 rounded-xl text-xl font-black select-none active:scale-95"
          style={{ background: "rgba(26,111,196,0.3)", border: "1px solid rgba(26,111,196,0.5)", color: "#fff", touchAction: "none" }}>
          ▶
        </button>
      </div>
      <div className="flex gap-3">
        <button type="button"
          onTouchStart={e => { e.preventDefault(); onSpecial(); }}
          className="w-14 h-14 rounded-full text-xs font-black select-none active:scale-95 uppercase tracking-tight"
          style={{ background: "rgba(248,201,64,0.25)", border: "1px solid rgba(248,201,64,0.5)", color: "#f8c940", touchAction: "none" }}>
          SPEC
        </button>
        <button type="button"
          onTouchStart={e => { e.preventDefault(); onJump(); }}
          className="w-16 h-16 rounded-full text-xl font-black select-none active:scale-95"
          style={{ background: "rgba(26,111,196,0.4)", border: "2px solid rgba(26,111,196,0.7)", color: "#fff", touchAction: "none" }}>
          ↑
        </button>
      </div>
    </div>
  );
}

// ─── Victory Screen ────────────────────────────────────────────────────────────

function VictoryScreen({ score, rings, onMenu }: { score: number; rings: number; onMenu: () => void }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-8 animate-slide-up">
      <div className="relative">
        <div className="absolute inset-0 blur-3xl rounded-full"
          style={{ background: "radial-gradient(circle, rgba(248,201,64,0.5) 0%, transparent 70%)" }} />
        <img src={EGGMAN_SPRITE} alt="Eggman defeated"
          className="relative w-32 h-32 grayscale opacity-40"
          style={{ transform: "rotate(-20deg) scaleX(-1)" }} />
      </div>
      <div className="text-center">
        <h1 className="text-5xl font-black neon-text-gold mb-2"
          style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "#f8c940" }}>
          VICTORY!
        </h1>
        <p className="text-xl font-bold opacity-80 mb-6" style={{ color: "#ffffff" }}>
          Eggman has been defeated!
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="px-6 py-4 rounded-2xl" style={{ background: "rgba(26,111,196,0.2)", border: "1px solid rgba(26,111,196,0.4)" }}>
            <p className="text-xs uppercase tracking-widest opacity-60 mb-1" style={{ color: "#7090c0" }}>Score</p>
            <p className="text-3xl font-black" style={{ color: "#ffffff" }}>{score.toLocaleString()}</p>
          </div>
          <div className="px-6 py-4 rounded-2xl" style={{ background: "rgba(248,201,64,0.15)", border: "1px solid rgba(248,201,64,0.4)" }}>
            <p className="text-xs uppercase tracking-widest opacity-60 mb-1" style={{ color: "#f8c94099" }}>Rings</p>
            <p className="text-3xl font-black" style={{ color: "#f8c940" }}>{rings} 💛</p>
          </div>
        </div>
      </div>
      <button type="button" onClick={onMenu}
        className="px-10 py-4 text-lg font-black tracking-widest uppercase rounded-full transition-all hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(135deg, #1a6fc4, #0d3d8a)",
          color: "#ffffff",
          fontFamily: "'Bricolage Grotesque', sans-serif",
          boxShadow: "0 0 20px rgba(26,111,196,0.6)",
        }}>
        Main Menu
      </button>
    </div>
  );
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────

function GameOverScreen({ score, rings, onRetry, onMenu }: {
  score: number; rings: number; onRetry: () => void; onMenu: () => void;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-8 animate-slide-up">
      <div className="text-center">
        <h1 className="text-5xl font-black mb-2"
          style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "#ff4444", textShadow: "0 0 20px #ff4444" }}>
          GAME OVER
        </h1>
        <p className="text-lg opacity-60 mb-6" style={{ color: "#aaaaaa" }}>You were stopped by Eggman...</p>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="px-6 py-4 rounded-2xl" style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)" }}>
            <p className="text-xs uppercase tracking-widest opacity-60 mb-1" style={{ color: "#ff8888" }}>Score</p>
            <p className="text-3xl font-black" style={{ color: "#ffffff" }}>{score.toLocaleString()}</p>
          </div>
          <div className="px-6 py-4 rounded-2xl" style={{ background: "rgba(248,201,64,0.1)", border: "1px solid rgba(248,201,64,0.3)" }}>
            <p className="text-xs uppercase tracking-widest opacity-60 mb-1" style={{ color: "#f8c94099" }}>Rings</p>
            <p className="text-3xl font-black" style={{ color: "#f8c940" }}>{rings} 💛</p>
          </div>
        </div>
      </div>
      <div className="flex gap-4">
        <button type="button" onClick={onRetry}
          className="px-8 py-3 text-base font-black tracking-widest uppercase rounded-full transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #cc2222, #880000)",
            color: "#ffffff", fontFamily: "'Bricolage Grotesque', sans-serif",
            boxShadow: "0 0 20px rgba(200,34,34,0.5)",
          }}>
          RETRY
        </button>
        <button type="button" onClick={onMenu}
          className="px-8 py-3 text-base font-black tracking-widest uppercase rounded-full transition-all hover:scale-105 active:scale-95"
          style={{
            background: "rgba(255,255,255,0.08)", color: "#aaaaaa",
            fontFamily: "'Bricolage Grotesque', sans-serif",
            border: "1px solid rgba(255,255,255,0.2)",
          }}>
          MENU
        </button>
      </div>
    </div>
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function rectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleAABB(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}
