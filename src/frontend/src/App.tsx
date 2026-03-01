import { Toaster } from "@/components/ui/sonner";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

type GameScreen = "title" | "charselect" | "playing" | "victory" | "gameover";
type LevelId = "greenhill" | "cityescape" | "lavareef" | "boss";

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "solid" | "moving";
  moveDir?: number;
  moveSpeed?: number;
  moveRange?: number;
  startX?: number;
}

interface Ring {
  x: number;
  y: number;
  collected: boolean;
  bobOffset: number;
}

interface Enemy {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  alive: boolean;
  stunTimer: number;
  startX: number;
  patrolRange: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  jumpsLeft: number;
  isFlying: boolean;
  flyTimer: number;
  specialActive: boolean;
  specialTimer: number;
  specialCooldown: number;
  invincible: boolean;
  invincibleTimer: number;
  facing: number;
  animFrame: number;
  animTimer: number;
  dead: boolean;
  deadTimer: number;
}

interface GameState {
  player: Player;
  platforms: Platform[];
  rings: Ring[];
  enemies: Enemy[];
  cameraX: number;
  levelWidth: number;
  ringsCollected: number;
  score: number;
  lives: number;
  timeMs: number;
  levelComplete: boolean;
  levelCompleteTimer: number;
  goalX: number;
  bossHp: number;
  bossMaxHp: number;
  bossX: number;
  bossY: number;
  bossVx: number;
  bossPhase: number;
  bossShootTimer: number;
  projectiles: Projectile[];
  particles: Particle[];
  timeSlowActive: boolean;
  timeSlowTimer: number;
  hammerActive: boolean;
  hammerTimer: number;
  shieldActive: boolean;
  shieldTimer: number;
  gameOverTriggered: boolean;
  levelTransTriggered: boolean;
}

// ─── Character Definitions ───────────────────────────────────────────────────

interface CharDef {
  id: string;
  name: string;
  sprite: string;
  color: string;
  cost: number;
  speed: number;
  ability: string;
  abilityKey: string;
}

const CHARS: CharDef[] = [
  {
    id: "sonic",
    name: "Sonic",
    sprite: "/assets/generated/sonic-run-transparent.dim_200x200.png",
    color: "#1a6fc4",
    cost: 0,
    speed: 10,
    ability: "Spin Dash – Invincible charge burst",
    abilityKey: "SpinDash",
  },
  {
    id: "tails",
    name: "Tails",
    sprite: "/assets/generated/tails-fly-transparent.dim_200x200.png",
    color: "#f8a830",
    cost: 100,
    speed: 7,
    ability: "Fly – Hover for 2 seconds",
    abilityKey: "Fly",
  },
  {
    id: "amy",
    name: "Amy",
    sprite: "/assets/generated/amy-run-transparent.dim_200x200.png",
    color: "#e8208c",
    cost: 250,
    speed: 6,
    ability: "Hammer Strike – Wide area attack",
    abilityKey: "Hammer",
  },
  {
    id: "knuckles",
    name: "Knuckles",
    sprite: "/assets/generated/knuckles-punch-transparent.dim_200x200.png",
    color: "#cc2244",
    cost: 500,
    speed: 8,
    ability: "Glide & Climb – Glide + stun all enemies",
    abilityKey: "Glide",
  },
  {
    id: "shadow",
    name: "Shadow",
    sprite: "/assets/generated/shadow-run-transparent.dim_200x200.png",
    color: "#8b1a1a",
    cost: 1000,
    speed: 9,
    ability: "Chaos Control – Slow time 3s",
    abilityKey: "Chaos",
  },
];

const EGGMAN_SPRITE =
  "/assets/generated/eggman-boss-transparent.dim_300x300.png";
const RING_ICON = "/assets/generated/ring-icon-transparent.dim_64x64.png";

// ─── Level Definitions ───────────────────────────────────────────────────────

const LEVEL_SEQUENCE: LevelId[] = [
  "greenhill",
  "cityescape",
  "lavareef",
  "boss",
];
const LEVEL_NAMES: Record<LevelId, string> = {
  greenhill: "Green Hill Zone",
  cityescape: "City Escape",
  lavareef: "Lava Reef",
  boss: "Eggman's Lair",
};
const LEVEL_BGS: Record<LevelId, string> = {
  greenhill: "/assets/generated/bg-green-hill.dim_1200x400.jpg",
  cityescape: "/assets/generated/bg-city-escape.dim_1200x400.jpg",
  lavareef: "/assets/generated/bg-lava-reef.dim_1200x400.jpg",
  boss: "/assets/generated/bg-space-colony.dim_1200x400.jpg",
};

// ─── Canvas Constants ─────────────────────────────────────────────────────────

const CW = 960;
const CH = 540;
const GRAVITY = 1700;
const JUMP_VEL = -600;
const BASE_SPEED = 280;
const PLAYER_W = 52;
const PLAYER_H = 52;
const GROUND_Y = 460;

// ─── Level Generators ─────────────────────────────────────────────────────────

function buildLevel(
  id: LevelId,
): Pick<
  GameState,
  | "platforms"
  | "rings"
  | "enemies"
  | "levelWidth"
  | "goalX"
  | "bossHp"
  | "bossMaxHp"
  | "bossX"
  | "bossY"
  | "bossVx"
> {
  if (id === "boss") return buildBossLevel();

  const levelWidth = id === "lavareef" ? 5000 : 4200;
  const platforms: Platform[] = [
    { x: 0, y: GROUND_Y, w: levelWidth, h: 80, type: "solid" },
  ];

  // Floating platforms – varied heights
  const floatDefs: [number, number, number][] =
    id === "greenhill"
      ? [
          [350, 380, 160],
          [650, 320, 140],
          [950, 270, 160],
          [1250, 360, 140],
          [1600, 300, 120],
          [1900, 240, 160],
          [2200, 340, 140],
          [2550, 280, 160],
          [2850, 360, 120],
          [3150, 310, 140],
          [3450, 380, 160],
          [3750, 290, 140],
        ]
      : id === "cityescape"
        ? [
            [300, 370, 150],
            [600, 300, 130],
            [900, 250, 150],
            [1200, 330, 140],
            [1550, 280, 120],
            [1850, 220, 150],
            [2200, 310, 140],
            [2500, 370, 120],
            [2800, 270, 150],
            [3100, 320, 130],
            [3400, 390, 150],
            [3700, 260, 140],
            [4000, 340, 130],
          ]
        : [
            [400, 375, 150],
            [700, 310, 130],
            [1000, 255, 150],
            [1300, 350, 140],
            [1650, 285, 120],
            [1950, 225, 150],
            [2300, 330, 140],
            [2600, 375, 120],
            [2900, 270, 150],
            [3200, 325, 130],
            [3550, 385, 150],
            [3850, 265, 140],
            [4200, 340, 130],
            [4550, 300, 130],
          ];

  for (const [x, y, w] of floatDefs) {
    platforms.push({ x, y, w, h: 18, type: "solid" });
  }

  // Moving platforms
  const movingDefs: [number, number, number, number, number][] =
    id === "greenhill"
      ? [
          [1750, 410, 110, 70, 120],
          [2700, 360, 100, -80, 100],
        ]
      : id === "cityescape"
        ? [
            [1400, 400, 110, 80, 110],
            [2650, 350, 100, -70, 100],
            [3600, 410, 90, 90, 90],
          ]
        : [
            [1500, 410, 110, 75, 110],
            [2800, 355, 100, -80, 100],
            [3700, 405, 95, 85, 95],
            [4400, 370, 110, -90, 100],
          ];

  for (const [x, y, w, spd, range] of movingDefs) {
    platforms.push({
      x,
      y,
      w,
      h: 18,
      type: "moving",
      moveDir: spd > 0 ? 1 : -1,
      moveSpeed: Math.abs(spd),
      moveRange: range,
      startX: x,
    });
  }

  // Rings
  const rings: Ring[] = [];
  const ringCount = id === "lavareef" ? 22 : 18;
  for (let i = 0; i < ringCount; i++) {
    const rx = 200 + i * ((levelWidth * 0.85) / ringCount) + Math.random() * 80;
    const ry = GROUND_Y - 80 - Math.floor(i % 4) * 45;
    rings.push({
      x: rx,
      y: ry,
      collected: false,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }
  // Rings on floating platforms
  for (let k = 0; k < Math.min(floatDefs.length, 8); k++) {
    const [px, py, pw] = floatDefs[k * Math.floor(floatDefs.length / 8)];
    rings.push({
      x: px + pw / 2 - 20,
      y: py - 40,
      collected: false,
      bobOffset: k,
    });
    rings.push({
      x: px + pw / 2 + 10,
      y: py - 40,
      collected: false,
      bobOffset: k + 1,
    });
  }

  // Enemies
  const enemies: Enemy[] = [];
  const enemyCount = id === "lavareef" ? 9 : 7;
  for (let i = 0; i < enemyCount; i++) {
    const ex =
      500 + i * ((levelWidth * 0.75) / enemyCount) + Math.random() * 100;
    enemies.push({
      x: ex,
      y: GROUND_Y - 40,
      w: 40,
      h: 40,
      vx: (i % 2 === 0 ? 1 : -1) * (70 + Math.random() * 40),
      alive: true,
      stunTimer: 0,
      startX: ex - 150,
      patrolRange: 300,
    });
  }

  return {
    platforms,
    rings,
    enemies,
    levelWidth,
    goalX: levelWidth - 140,
    bossHp: 0,
    bossMaxHp: 0,
    bossX: 0,
    bossY: 0,
    bossVx: 0,
  };
}

function buildBossLevel(): ReturnType<typeof buildLevel> {
  const levelWidth = 1600;
  const platforms: Platform[] = [
    { x: 0, y: GROUND_Y, w: levelWidth, h: 80, type: "solid" },
    { x: 120, y: 380, w: 140, h: 18, type: "solid" },
    { x: 400, y: 320, w: 120, h: 18, type: "solid" },
    { x: 680, y: 380, w: 130, h: 18, type: "solid" },
    {
      x: 200,
      y: 260,
      w: 110,
      h: 18,
      type: "moving",
      moveDir: 1,
      moveSpeed: 65,
      moveRange: 90,
      startX: 200,
    },
    {
      x: 540,
      y: 250,
      w: 110,
      h: 18,
      type: "moving",
      moveDir: -1,
      moveSpeed: 75,
      moveRange: 90,
      startX: 540,
    },
  ];
  const rings: Ring[] = [];
  for (let i = 0; i < 12; i++) {
    rings.push({
      x: 80 + i * 120,
      y: GROUND_Y - 90,
      collected: false,
      bobOffset: i * 0.5,
    });
  }
  return {
    platforms,
    rings,
    enemies: [],
    levelWidth,
    goalX: 0,
    bossHp: 5,
    bossMaxHp: 5,
    bossX: CW - 180,
    bossY: GROUND_Y - 240,
    bossVx: -90,
  };
}

function createPlayer(): Player {
  return {
    x: 80,
    y: GROUND_Y - PLAYER_H,
    vx: 0,
    vy: 0,
    w: PLAYER_W,
    h: PLAYER_H,
    onGround: false,
    jumpsLeft: 2,
    isFlying: false,
    flyTimer: 0,
    specialActive: false,
    specialTimer: 0,
    specialCooldown: 0,
    invincible: false,
    invincibleTimer: 0,
    facing: 1,
    animFrame: 0,
    animTimer: 0,
    dead: false,
    deadTimer: 0,
  };
}

function createGameState(levelId: LevelId, lives: number): GameState {
  const levelData = buildLevel(levelId);
  return {
    player: createPlayer(),
    ...levelData,
    cameraX: 0,
    ringsCollected: 0,
    score: 0,
    lives,
    timeMs: 0,
    levelComplete: false,
    levelCompleteTimer: 0,
    bossPhase: 1,
    bossShootTimer: 2.5,
    projectiles: [],
    particles: [],
    timeSlowActive: false,
    timeSlowTimer: 0,
    hammerActive: false,
    hammerTimer: 0,
    shieldActive: false,
    shieldTimer: 0,
    gameOverTriggered: false,
    levelTransTriggered: false,
  };
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<GameScreen>("title");
  const [selectedChar, setSelectedChar] = useState<CharDef>(CHARS[0]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("sonic_unlocked");
      return saved ? JSON.parse(saved) : ["sonic"];
    } catch {
      return ["sonic"];
    }
  });
  const [totalRings, setTotalRings] = useState<number>(() => {
    try {
      return Number.parseInt(localStorage.getItem("sonic_rings") || "0", 10);
    } catch {
      return 0;
    }
  });
  const [levelIdx, setLevelIdx] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [finalRings, setFinalRings] = useState(0);
  const [livesForGame, setLivesForGame] = useState(3);

  const saveProgress = useCallback((rings: number, ids: string[]) => {
    try {
      localStorage.setItem("sonic_rings", String(rings));
      localStorage.setItem("sonic_unlocked", JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, []);

  const handleLevelComplete = useCallback(
    (ringsEarned: number, score: number, nextLevelIdx: number) => {
      const newTotal = totalRings + ringsEarned;
      const newUnlocked = [...unlockedIds];
      let newlyUnlocked: CharDef | null = null;
      for (const c of CHARS) {
        if (!newUnlocked.includes(c.id) && newTotal >= c.cost) {
          newUnlocked.push(c.id);
          if (!newlyUnlocked) newlyUnlocked = c;
        }
      }
      setTotalRings(newTotal);
      setUnlockedIds(newUnlocked);
      saveProgress(newTotal, newUnlocked);
      if (newlyUnlocked) {
        setTimeout(
          () =>
            toast.success(`🎉 ${newlyUnlocked!.name} unlocked!`, {
              duration: 4000,
            }),
          300,
        );
      }
      if (nextLevelIdx >= LEVEL_SEQUENCE.length) {
        setFinalScore(score);
        setFinalRings(newTotal);
        setScreen("victory");
      } else {
        setLevelIdx(nextLevelIdx);
        setLivesForGame((prev) => prev); // carry lives
      }
    },
    [totalRings, unlockedIds, saveProgress],
  );

  const handleGameOver = useCallback(
    (score: number) => {
      setFinalScore(score);
      setFinalRings(totalRings);
      setScreen("gameover");
    },
    [totalRings],
  );

  const startGame = useCallback((char: CharDef) => {
    setSelectedChar(char);
    setLevelIdx(0);
    setLivesForGame(3);
    setScreen("playing");
  }, []);

  const handleUnlock = useCallback(
    (char: CharDef) => {
      if (totalRings >= char.cost && !unlockedIds.includes(char.id)) {
        const newIds = [...unlockedIds, char.id];
        const newRings = totalRings - char.cost;
        setUnlockedIds(newIds);
        setTotalRings(newRings);
        saveProgress(newRings, newIds);
        toast.success(`${char.name} unlocked!`);
      }
    },
    [totalRings, unlockedIds, saveProgress],
  );

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center overflow-hidden relative">
      <Toaster position="top-center" />

      {screen === "title" && (
        <TitleScreen
          onPlay={() => setScreen("charselect")}
          totalRings={totalRings}
        />
      )}

      {screen === "charselect" && (
        <CharSelectScreen
          unlockedIds={unlockedIds}
          totalRings={totalRings}
          onSelect={startGame}
          onUnlock={handleUnlock}
          onBack={() => setScreen("title")}
        />
      )}

      {screen === "playing" && (
        <GameCanvas
          key={`${selectedChar.id}-${levelIdx}`}
          char={selectedChar}
          levelId={LEVEL_SEQUENCE[levelIdx]}
          levelIdx={levelIdx}
          lives={livesForGame}
          onLevelComplete={handleLevelComplete}
          onGameOver={handleGameOver}
          onLivesChange={setLivesForGame}
        />
      )}

      {screen === "victory" && (
        <VictoryScreen
          score={finalScore}
          rings={finalRings}
          onMenu={() => setScreen("title")}
        />
      )}

      {screen === "gameover" && (
        <GameOverScreen
          score={finalScore}
          rings={totalRings}
          onRetry={() => {
            setLevelIdx(0);
            setLivesForGame(3);
            setScreen("playing");
          }}
          onMenu={() => setScreen("title")}
        />
      )}

      {/* Footer */}
      <div
        className="fixed bottom-2 left-0 right-0 text-center text-xs pointer-events-none"
        style={{
          color: "rgba(120,140,180,0.4)",
          fontFamily: "'Cabinet Grotesk', sans-serif",
        }}
      >
        © {new Date().getFullYear()} Built with ♥ using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noreferrer"
          className="underline pointer-events-auto"
          style={{ color: "rgba(120,140,180,0.5)" }}
        >
          caffeine.ai
        </a>
      </div>
    </div>
  );
}

// ─── Title Screen ─────────────────────────────────────────────────────────────

function TitleScreen({
  onPlay,
  totalRings,
}: { onPlay: () => void; totalRings: number }) {
  const [bgLoaded, setBgLoaded] = useState(false);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="/assets/generated/bg-green-hill.dim_1200x400.jpg"
          alt=""
          className="w-full h-full object-cover"
          onLoad={() => setBgLoaded(true)}
          style={{ opacity: bgLoaded ? 1 : 0, transition: "opacity 0.5s" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,10,30,0.55) 0%, rgba(0,5,15,0.75) 100%)",
          }}
        />
      </div>

      {/* Stars */}
      <StarField />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center gap-6 px-4"
        style={{ animation: "slideUp 0.6s ease forwards" }}
      >
        {/* Logo area */}
        <div className="relative flex items-center gap-4">
          <img
            src="/assets/generated/sonic-run-transparent.dim_200x200.png"
            alt="Sonic"
            className="w-24 h-24 drop-shadow-2xl"
            style={{
              filter:
                "drop-shadow(0 0 16px #1a6fc4) drop-shadow(0 0 32px #1a6fc480)",
              animation: "sonicBob 1.2s ease-in-out infinite",
            }}
          />
          <div className="text-left">
            <h1
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1,
                textShadow:
                  "0 0 20px rgba(26,111,196,0.8), 0 4px 0 rgba(0,0,0,0.8)",
              }}
            >
              SONIC
            </h1>
            <h2
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: "clamp(1.2rem, 3vw, 2rem)",
                fontWeight: 700,
                color: "#f8c940",
                letterSpacing: "0.15em",
                textShadow: "0 0 15px #f8c940, 0 2px 0 rgba(0,0,0,0.8)",
              }}
            >
              UNLEASHED
            </h2>
          </div>
        </div>

        {/* Character parade */}
        <div className="flex gap-3 sm:gap-5">
          {CHARS.map((c, i) => (
            <img
              key={c.id}
              src={c.sprite}
              alt={c.name}
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain transition-all duration-300"
              style={{
                filter: `drop-shadow(0 0 8px ${c.color})`,
                animation: `sonicBob ${1.2 + i * 0.15}s ease-in-out ${i * 0.1}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Ring count */}
        {totalRings > 0 && (
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: "rgba(248,201,64,0.15)",
              border: "1px solid rgba(248,201,64,0.5)",
            }}
          >
            <img src={RING_ICON} alt="rings" className="w-5 h-5" />
            <span
              style={{
                color: "#f8c940",
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 900,
              }}
            >
              {totalRings} Rings
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onPlay}
          className="relative px-12 py-4 rounded-full font-black tracking-widest uppercase text-lg transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            background: "linear-gradient(135deg, #1a6fc4 0%, #0d3d8a 100%)",
            color: "#fff",
            boxShadow:
              "0 0 24px rgba(26,111,196,0.7), 0 0 60px rgba(26,111,196,0.3), 0 4px 16px rgba(0,0,0,0.5)",
            border: "1px solid rgba(100,160,255,0.4)",
          }}
        >
          ▶ PRESS START
        </button>

        <p
          className="text-xs tracking-widest uppercase"
          style={{ color: "rgba(120,160,220,0.6)" }}
        >
          Collect rings · Unlock heroes · Defeat Eggman
        </p>
      </div>
    </div>
  );
}

// ─── Star Field ───────────────────────────────────────────────────────────────

function StarField() {
  const stars = React.useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        dur: Math.random() * 3 + 2,
        delay: Math.random() * 4,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: "#c0d8ff",
            animation: `twinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Character Select ─────────────────────────────────────────────────────────

function CharSelectScreen({
  unlockedIds,
  totalRings,
  onSelect,
  onUnlock,
  onBack,
}: {
  unlockedIds: string[];
  totalRings: number;
  onSelect: (c: CharDef) => void;
  onUnlock: (c: CharDef) => void;
  onBack: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const highlighted = hovered ? CHARS.find((c) => c.id === hovered) : null;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, #0d1a3a 0%, #050810 100%)",
        }}
      />
      <StarField />

      <div
        className="relative z-10 w-full max-w-3xl px-4 flex flex-col gap-5"
        style={{ animation: "slideUp 0.5s ease forwards" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "#7090c0",
              border: "1px solid rgba(112,144,192,0.3)",
            }}
          >
            ← Back
          </button>
          <h2
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontWeight: 900,
              fontSize: "1.5rem",
              color: "#fff",
              letterSpacing: "0.05em",
            }}
          >
            CHOOSE YOUR HERO
          </h2>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(248,201,64,0.15)",
              border: "1px solid rgba(248,201,64,0.4)",
            }}
          >
            <img src={RING_ICON} alt="rings" className="w-4 h-4" />
            <span
              style={{
                color: "#f8c940",
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 900,
              }}
            >
              {totalRings}
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-5 gap-3">
          {CHARS.map((c) => {
            const unlocked = unlockedIds.includes(c.id);
            const canAfford = totalRings >= c.cost;
            return (
              <button
                type="button"
                key={c.id}
                className="relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200"
                style={{
                  background: unlocked
                    ? `linear-gradient(145deg, ${c.color}22, ${c.color}08)`
                    : "rgba(255,255,255,0.03)",
                  border: unlocked
                    ? `1.5px solid ${c.color}70`
                    : "1.5px solid rgba(255,255,255,0.08)",
                  boxShadow: unlocked ? `0 0 20px ${c.color}25` : "none",
                  transform: hovered === c.id ? "scale(1.06)" : "scale(1)",
                  cursor: unlocked || canAfford ? "pointer" : "default",
                }}
                onMouseEnter={() => setHovered(c.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (unlocked) onSelect(c);
                  else if (canAfford) onUnlock(c);
                }}
              >
                <div className="relative w-16 h-16">
                  <img
                    src={c.sprite}
                    alt={c.name}
                    className="w-full h-full object-contain"
                    style={{
                      filter: unlocked
                        ? `drop-shadow(0 0 10px ${c.color})`
                        : "grayscale(1) brightness(0.25)",
                    }}
                  />
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl">🔒</span>
                    </div>
                  )}
                </div>
                <p
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    color: unlocked ? "#fff" : "#334455",
                  }}
                >
                  {c.name}
                </p>
                {unlocked ? (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${c.color}30`, color: c.color }}
                  >
                    PLAY
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <img src={RING_ICON} alt="" className="w-3 h-3" />
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: canAfford ? "#f8c940" : "#445566",
                      }}
                    >
                      {c.cost}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {highlighted && (
          <div
            className="rounded-2xl p-4 flex items-center gap-4 transition-all duration-200"
            style={{
              background: `linear-gradient(135deg, ${highlighted.color}15, rgba(0,0,0,0.3))`,
              border: `1px solid ${highlighted.color}40`,
            }}
          >
            <img
              src={highlighted.sprite}
              alt={highlighted.name}
              className="w-16 h-16 object-contain flex-shrink-0"
              style={{ filter: `drop-shadow(0 0 12px ${highlighted.color})` }}
            />
            <div>
              <p
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontWeight: 900,
                  color: "#fff",
                  fontSize: "1.1rem",
                }}
              >
                {highlighted.name}
              </p>
              <p
                style={{
                  color: highlighted.color,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {highlighted.ability}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span style={{ fontSize: "0.72rem", color: "#7090c0" }}>
                  SPEED
                </span>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }, (_, i) => i).map((i) => (
                    <div
                      key={`speed-${i}`}
                      className="w-3 h-2 rounded-sm"
                      style={{
                        background:
                          i < highlighted.speed
                            ? highlighted.color
                            : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <p
          className="text-center text-xs"
          style={{ color: "rgba(120,160,220,0.45)" }}
        >
          Tap a locked character to unlock with rings · Tap an unlocked
          character to play
        </p>
      </div>
    </div>
  );
}

// ─── Game Canvas ──────────────────────────────────────────────────────────────

function GameCanvas({
  char,
  levelId,
  levelIdx,
  lives,
  onLevelComplete,
  onGameOver,
  onLivesChange,
}: {
  char: CharDef;
  levelId: LevelId;
  levelIdx: number;
  lives: number;
  onLevelComplete: (rings: number, score: number, nextIdx: number) => void;
  onGameOver: (score: number) => void;
  onLivesChange: (l: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const imgsRef = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number>(0);
  const lastTRef = useRef<number>(0);
  const livesRef = useRef(lives);
  const cbRef = useRef({ onLevelComplete, onGameOver, onLivesChange });
  cbRef.current = { onLevelComplete, onGameOver, onLivesChange };

  // Touch state
  const touchLeft = useRef(false);
  const touchRight = useRef(false);
  const touchJump = useRef(false);
  const touchAttack = useRef(false);

  const isBoss = levelId === "boss";

  // Preload images
  useEffect(() => {
    const srcs = [char.sprite, EGGMAN_SPRITE, RING_ICON, LEVEL_BGS[levelId]];
    for (const src of srcs) {
      if (!imgsRef.current[src]) {
        const img = new Image();
        img.src = src;
        imgsRef.current[src] = img;
      }
    }
  }, [char.sprite, levelId]);

  // Init game state
  useEffect(() => {
    livesRef.current = lives;
    gsRef.current = createGameState(levelId, lives);
    lastTRef.current = 0;
  }, [levelId, lives]);

  // Keyboard input
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      const prevent = [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyW",
        "KeyA",
        "KeyD",
        "KeyZ",
        "KeyX",
        "ShiftLeft",
        "ShiftRight",
      ];
      if (prevent.includes(e.code)) e.preventDefault();

      // Jump on keydown
      if (
        (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") &&
        gsRef.current
      ) {
        doJump(gsRef.current);
      }
      // Attack / special
      if (
        (e.code === "KeyZ" ||
          e.code === "KeyX" ||
          e.code === "ShiftLeft" ||
          e.code === "ShiftRight") &&
        gsRef.current
      ) {
        doSpecial(gsRef.current, char);
      }
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [char]);

  // Game loop
  useEffect(() => {
    let alive = true;

    function loop(ts: number) {
      if (!alive) return;
      const rawDt =
        lastTRef.current === 0
          ? 0.016
          : Math.min((ts - lastTRef.current) / 1000, 0.05);
      lastTRef.current = ts;

      const gs = gsRef.current;
      if (gs) {
        // Handle touch jump/attack as one-shot
        if (touchJump.current) {
          doJump(gs);
          touchJump.current = false;
        }
        if (touchAttack.current) {
          doSpecial(gs, char);
          touchAttack.current = false;
        }

        if (!gs.levelComplete && !gs.gameOverTriggered) {
          update(gs, rawDt, char);
        }
        draw(gs, rawDt);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
    // levelId is used inside draw/update via closure capture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  // ── Physics & Update ──────────────────────────────────────────────────────

  function doJump(gs: GameState) {
    if (gs.levelComplete || gs.player.dead) return;
    const p = gs.player;
    if (p.jumpsLeft > 0) {
      p.vy = JUMP_VEL;
      p.jumpsLeft--;
      p.onGround = false;
      spawnParticles(gs, p.x + p.w / 2, p.y + p.h, "#aaddff", 6);
      if (char.id === "tails" && p.jumpsLeft === 0) {
        p.isFlying = true;
        p.flyTimer = 2.2;
      }
    }
  }

  function doSpecial(gs: GameState, ch: CharDef) {
    if (gs.levelComplete || gs.player.dead) return;
    const p = gs.player;
    if (p.specialCooldown > 0) return;
    p.specialActive = true;
    p.specialTimer = 1.2;
    p.specialCooldown = 3.5;

    switch (ch.id) {
      case "sonic":
        p.vx = p.facing * 700;
        p.invincible = true;
        p.invincibleTimer = 1.0;
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#00e5ff", 14);
        break;
      case "shadow":
        gs.timeSlowActive = true;
        gs.timeSlowTimer = 3.0;
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#cc0000", 18);
        break;
      case "knuckles":
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#cc2244", 16);
        p.invincible = true;
        p.invincibleTimer = 0.8;
        // Stun all enemies
        for (const e of gs.enemies) {
          if (e.alive) e.stunTimer = 3.0;
        }
        // Damage boss
        if (isBoss) hitBoss(gs, 1);
        break;
      case "amy":
        gs.hammerActive = true;
        gs.hammerTimer = 0.5;
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#e8208c", 16);
        // Clear nearby projectiles, hit boss
        for (const pr of gs.projectiles) {
          const dx = pr.x - (p.x + p.w / 2);
          if (Math.abs(dx) < 280) pr.active = false;
        }
        if (isBoss && Math.abs(gs.bossX - p.x) < 280) hitBoss(gs, 1);
        break;
      case "tails":
        p.vy = JUMP_VEL * 0.7;
        p.isFlying = true;
        p.flyTimer = 2.5;
        spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, "#f8a830", 10);
        break;
    }
  }

  function hitBoss(gs: GameState, dmg: number) {
    gs.bossHp = Math.max(0, gs.bossHp - dmg);
    gs.bossVx = -gs.bossVx * 1.1;
    spawnParticles(gs, gs.bossX + 120, gs.bossY + 90, "#ff4400", 22);
    if (gs.bossHp <= 0) {
      gs.levelComplete = true;
      spawnParticles(gs, gs.bossX + 120, gs.bossY + 80, "#f8c940", 40);
    }
  }

  function spawnParticles(
    gs: GameState,
    x: number,
    y: number,
    color: string,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const spd = 80 + Math.random() * 200;
      gs.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 80,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  function update(gs: GameState, rawDt: number, ch: CharDef) {
    const timeMult = gs.timeSlowActive ? 0.3 : 1.0;
    const dt = rawDt * timeMult;

    gs.timeMs += rawDt;
    const p = gs.player;

    // Timers
    if (p.specialTimer > 0) p.specialTimer -= rawDt;
    else p.specialActive = false;
    if (p.specialCooldown > 0) p.specialCooldown -= rawDt;
    if (p.invincibleTimer > 0) {
      p.invincibleTimer -= rawDt;
      if (p.invincibleTimer <= 0) p.invincible = false;
    }
    if (p.flyTimer > 0) p.flyTimer -= rawDt;
    if (gs.timeSlowTimer > 0) {
      gs.timeSlowTimer -= rawDt;
      if (gs.timeSlowTimer <= 0) gs.timeSlowActive = false;
    }
    if (gs.hammerTimer > 0) gs.hammerTimer -= rawDt;

    // Dead player
    if (p.dead) {
      p.deadTimer += rawDt;
      p.y += 180 * rawDt;
      p.vy += GRAVITY * rawDt;
      if (p.deadTimer > 1.8) {
        p.dead = false;
        p.deadTimer = 0;
        if (gs.lives <= 0) {
          gs.gameOverTriggered = true;
        } else {
          // Respawn
          gs.player = createPlayer();
          gs.player.invincible = true;
          gs.player.invincibleTimer = 3.0;
        }
      }
      return;
    }

    // Movement
    const isLeft =
      keysRef.current.has("ArrowLeft") ||
      keysRef.current.has("KeyA") ||
      touchLeft.current;
    const isRight =
      keysRef.current.has("ArrowRight") ||
      keysRef.current.has("KeyD") ||
      touchRight.current;

    const speedMult = 1 + (ch.speed - 7) * 0.07;
    let targetVx = 0;
    if (isLeft) {
      targetVx = -BASE_SPEED * speedMult;
      p.facing = -1;
    }
    if (isRight) {
      targetVx = BASE_SPEED * speedMult;
      p.facing = 1;
    }

    if (ch.id === "sonic" && p.specialActive) {
      p.vx = p.facing * 700;
    } else {
      const acc = p.onGround ? 12 : 7;
      p.vx += (targetVx - p.vx) * acc * dt;
    }

    // Gravity
    if (ch.id === "tails" && p.isFlying && p.flyTimer > 0) {
      p.vy += GRAVITY * 0.18 * dt;
    } else if (ch.id === "knuckles" && p.specialActive && !p.onGround) {
      p.vy += GRAVITY * 0.35 * dt;
    } else {
      p.vy += GRAVITY * dt;
    }
    p.vy = Math.min(p.vy, 900);

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Clamp
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > gs.levelWidth) p.x = gs.levelWidth - p.w;

    // Platform collisions
    p.onGround = false;
    for (const plat of gs.platforms) {
      if (plat.w <= 0) continue;
      // Update moving platforms
      if (plat.type === "moving") {
        plat.x += (plat.moveDir ?? 1) * (plat.moveSpeed ?? 60) * dt;
        if (plat.startX !== undefined) {
          const range = plat.moveRange ?? 100;
          if (plat.x > plat.startX + range) {
            plat.x = plat.startX + range;
            plat.moveDir = -1;
          }
          if (plat.x < plat.startX - range) {
            plat.x = plat.startX - range;
            plat.moveDir = 1;
          }
        }
      }
      if (rectsOverlap(p.x, p.y, p.w, p.h, plat.x, plat.y, plat.w, plat.h)) {
        const overX =
          Math.min(p.x + p.w, plat.x + plat.w) - Math.max(p.x, plat.x);
        const overY =
          Math.min(p.y + p.h, plat.y + plat.h) - Math.max(p.y, plat.y);
        if (overY <= overX) {
          if (p.y < plat.y) {
            p.y = plat.y - p.h;
            p.vy = 0;
            p.onGround = true;
            p.jumpsLeft = ch.id === "shadow" ? 3 : 2;
            p.isFlying = false;
            if (plat.type === "moving") {
              p.x += (plat.moveDir ?? 1) * (plat.moveSpeed ?? 60) * dt;
            }
          } else {
            p.y = plat.y + plat.h;
            p.vy = 1;
          }
        } else {
          if (p.x < plat.x) p.x = plat.x - p.w;
          else p.x = plat.x + plat.w;
        }
      }
    }

    // Fall death
    if (p.y > CH + 150) {
      killPlayer(gs);
      return;
    }

    // Rings
    for (const ring of gs.rings) {
      if (ring.collected) continue;
      ring.bobOffset += rawDt * 3;
      if (circleRect(ring.x + 10, ring.y + 10, 14, p.x, p.y, p.w, p.h)) {
        ring.collected = true;
        gs.ringsCollected++;
        gs.score += 10;
        spawnParticles(gs, ring.x + 10, ring.y + 10, "#f8c940", 5);
      }
    }

    // Enemies
    for (const e of gs.enemies) {
      if (!e.alive) continue;
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        continue;
      }
      e.x += e.vx * dt;
      // Patrol bounce
      if (e.x < e.startX) {
        e.x = e.startX;
        e.vx = Math.abs(e.vx);
      }
      if (e.x > e.startX + e.patrolRange) {
        e.x = e.startX + e.patrolRange;
        e.vx = -Math.abs(e.vx);
      }

      if (
        !p.invincible &&
        rectsOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)
      ) {
        if (p.vy > 0 && p.y + p.h < e.y + e.h * 0.6) {
          e.alive = false;
          p.vy = JUMP_VEL * 0.45;
          gs.score += 100;
          spawnParticles(gs, e.x + e.w / 2, e.y, "#ff8800", 10);
        } else {
          hurtPlayer(gs, p);
        }
      }
    }

    // Boss logic
    if (isBoss && gs.bossHp > 0) {
      updateBoss(gs, dt, rawDt, p);
    }

    // Goal post (non-boss)
    if (!isBoss && p.x + p.w > gs.goalX && !gs.levelComplete) {
      gs.levelComplete = true;
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
    if (p.animTimer > 0.07) {
      p.animTimer = 0;
      p.animFrame = (p.animFrame + 1) % 6;
    }

    // Camera
    const targetCam = p.x - CW * 0.35;
    gs.cameraX = Math.max(0, Math.min(targetCam, gs.levelWidth - CW));

    // Level complete timer
    if (gs.levelComplete) {
      gs.levelCompleteTimer += rawDt;
      if (gs.levelCompleteTimer > 2.0 && !gs.levelTransTriggered) {
        gs.levelTransTriggered = true;
        cbRef.current.onLevelComplete(
          gs.ringsCollected,
          gs.score,
          levelIdx + 1,
        );
      }
    }

    // Game over trigger
    if (gs.gameOverTriggered) {
      cbRef.current.onGameOver(gs.score);
    }
  }

  function updateBoss(gs: GameState, dt: number, rawDt: number, p: Player) {
    // Boss movement
    gs.bossX += gs.bossVx * dt;
    const leftBound = gs.cameraX + 80;
    const rightBound = gs.cameraX + CW - 250;
    if (gs.bossX < leftBound) {
      gs.bossX = leftBound;
      gs.bossVx = Math.abs(gs.bossVx);
    }
    if (gs.bossX > rightBound) {
      gs.bossX = rightBound;
      gs.bossVx = -Math.abs(gs.bossVx);
    }
    gs.bossY = GROUND_Y - 240 + Math.sin(gs.timeMs * 0.8) * 20;

    // Phase 2
    if (gs.bossHp <= Math.floor(gs.bossMaxHp / 2)) gs.bossPhase = 2;

    // Shooting
    gs.bossShootTimer -= rawDt;
    if (gs.bossShootTimer <= 0) {
      gs.bossShootTimer = gs.bossPhase === 2 ? 1.4 : 2.2;
      const dx = p.x + p.w / 2 - (gs.bossX + 120);
      const dy = p.y + p.h / 2 - (gs.bossY + 120);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const spd = gs.bossPhase === 2 ? 310 : 210;
      gs.projectiles.push({
        x: gs.bossX + 120,
        y: gs.bossY + 140,
        vx: (dx / dist) * spd,
        vy: (dy / dist) * spd,
        active: true,
      });
      if (gs.bossPhase === 2) {
        gs.projectiles.push({
          x: gs.bossX + 120,
          y: gs.bossY + 140,
          vx: (dx / dist) * spd * 0.75 + 90,
          vy: (dy / dist) * spd * 0.75,
          active: true,
        });
        gs.projectiles.push({
          x: gs.bossX + 120,
          y: gs.bossY + 140,
          vx: (dx / dist) * spd * 0.75 - 90,
          vy: (dy / dist) * spd * 0.75,
          active: true,
        });
      }
    }

    // Update projectiles
    for (const proj of gs.projectiles) {
      if (!proj.active) continue;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      if (!p.invincible && circleRect(proj.x, proj.y, 12, p.x, p.y, p.w, p.h)) {
        proj.active = false;
        hurtPlayer(gs, p);
      }
      if (
        proj.x < gs.cameraX - 100 ||
        proj.x > gs.cameraX + CW + 100 ||
        proj.y > CH + 100
      ) {
        proj.active = false;
      }
    }
    gs.projectiles = gs.projectiles.filter((pr) => pr.active);

    // Player stomp boss
    if (!p.invincible) {
      const bossHit = { x: gs.bossX + 30, y: gs.bossY + 40, w: 180, h: 180 };
      if (
        rectsOverlap(
          p.x,
          p.y,
          p.w,
          p.h,
          bossHit.x,
          bossHit.y,
          bossHit.w,
          bossHit.h,
        )
      ) {
        if (p.vy > 50 && p.y + p.h < bossHit.y + bossHit.h * 0.55) {
          p.vy = JUMP_VEL * 0.55;
          hitBoss(gs, 1);
        } else {
          hurtPlayer(gs, p);
        }
      }
    }
  }

  function hurtPlayer(gs: GameState, p: Player) {
    if (p.invincible) return;
    p.invincible = true;
    p.invincibleTimer = 2.0;
    p.vy = JUMP_VEL * 0.4;
    if (gs.ringsCollected > 0) {
      const lost = Math.min(gs.ringsCollected, 15);
      gs.ringsCollected -= lost;
      gs.score = Math.max(0, gs.score - lost * 5);
      // Scatter lost rings as sparkles
      spawnParticles(
        gs,
        p.x + p.w / 2,
        p.y + p.h / 2,
        "#f8c940",
        lost > 8 ? 8 : lost,
      );
    } else {
      killPlayer(gs);
    }
  }

  function killPlayer(gs: GameState) {
    if (gs.player.dead) return;
    gs.player.dead = true;
    gs.player.deadTimer = 0;
    gs.lives--;
    cbRef.current.onLivesChange(gs.lives);
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  function draw(gs: GameState, rawDt: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CW, CH);
    const cx = gs.cameraX;

    // Background
    drawBg(ctx, gs, cx);

    // Platforms
    for (const plat of gs.platforms) {
      if (plat.w <= 0) continue;
      drawPlatform(ctx, plat, cx, levelId);
    }

    // Goal post
    if (!isBoss) {
      drawGoal(ctx, gs.goalX - cx, GROUND_Y - 90);
    }

    // Rings
    for (const ring of gs.rings) {
      if (ring.collected) continue;
      drawRing(ctx, ring.x - cx, ring.y + Math.sin(ring.bobOffset) * 5);
    }

    // Enemies
    for (const e of gs.enemies) {
      if (!e.alive) continue;
      drawEnemy(ctx, e.x - cx, e.y, e.w, e.h, e.stunTimer > 0, levelId);
    }

    // Boss
    if (isBoss && gs.bossHp > 0) {
      drawBoss(ctx, gs, cx);
    }

    // Projectiles
    for (const proj of gs.projectiles) {
      drawProjectile(ctx, proj.x - cx, proj.y, gs.bossPhase);
    }

    // Particles
    for (const pt of gs.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife) * 0.9;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x - cx, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Player
    const blinking =
      gs.player.invincible &&
      !gs.player.dead &&
      Math.floor(gs.timeMs * 10) % 2 === 0;
    if (!blinking) {
      drawPlayer(ctx, gs.player, cx, char, gs);
    }

    // HUD
    drawHUD(ctx, gs, char);

    // Time slow vignette
    if (gs.timeSlowActive) {
      ctx.fillStyle = "rgba(80,0,0,0.2)";
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "#ff4444";
      ctx.font = `bold 14px 'Bricolage Grotesque', sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 10;
      ctx.fillText("⏱ CHAOS CONTROL", CW / 2, 72);
      ctx.shadowBlur = 0;
    }

    // Level complete overlay
    if (gs.levelComplete) {
      const alpha = Math.min(gs.levelCompleteTimer / 0.5, 1);
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.55})`;
      ctx.fillRect(0, 0, CW, CH);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#f8c940";
      ctx.font = `bold 54px 'Bricolage Grotesque', sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#f8c940";
      ctx.shadowBlur = 40;
      ctx.fillText(
        isBoss ? "EGGMAN DEFEATED!" : "STAGE CLEAR!",
        CW / 2,
        CH / 2 - 20,
      );
      ctx.font = `24px 'Bricolage Grotesque', sans-serif`;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.fillText(
        `Rings: ${gs.ringsCollected}  Score: ${gs.score.toLocaleString()}`,
        CW / 2,
        CH / 2 + 30,
      );
      ctx.restore();
    }

    // Game over overlay
    if (gs.gameOverTriggered) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, CW, CH);
      ctx.fillStyle = "#ff4444";
      ctx.font = `bold 56px 'Bricolage Grotesque', sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "#ff0000";
      ctx.shadowBlur = 30;
      ctx.fillText("GAME OVER", CW / 2, CH / 2);
      ctx.shadowBlur = 0;
    }

    // Draw rawDt param usage to suppress lint
    void rawDt;
  }

  function drawBg(ctx: CanvasRenderingContext2D, gs: GameState, cx: number) {
    const bg = imgsRef.current[LEVEL_BGS[levelId]];
    if (bg?.complete && bg.naturalWidth > 0) {
      const bgW = bg.naturalWidth;
      const parallax = (cx * 0.35) % bgW;
      // Tile horizontally
      const startX = -(parallax % bgW);
      for (let bx = startX; bx < CW; bx += bgW) {
        ctx.drawImage(bg, bx, 0, bgW, CH);
      }
      // Darken slightly for readability
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, CW, CH);
    } else {
      // Fallback gradient per level
      const grads: Record<LevelId, [string, string]> = {
        greenhill: ["#1a3a8c", "#2a7a35"],
        cityescape: ["#0a1528", "#203050"],
        lavareef: ["#1a0508", "#3a1008"],
        boss: ["#050008", "#100018"],
      };
      const [top, bot] = grads[levelId];
      const g = ctx.createLinearGradient(0, 0, 0, CH);
      g.addColorStop(0, top);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
    }
    void gs;
  }

  function drawPlatform(
    ctx: CanvasRenderingContext2D,
    plat: Platform,
    cx: number,
    lvl: LevelId,
  ) {
    const sx = plat.x - cx;
    if (sx + plat.w < -20 || sx > CW + 20) return;
    const isGround = plat.y >= GROUND_Y - 2;

    if (lvl === "greenhill") {
      // Ground: earthy brown with grass top
      if (isGround) {
        const grad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
        grad.addColorStop(0, "#5a3e1b");
        grad.addColorStop(1, "#3a2610");
        ctx.fillStyle = grad;
        ctx.fillRect(sx, plat.y, plat.w, plat.h);
        // Grass stripe
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(sx, plat.y, plat.w, 7);
        ctx.fillStyle = "#66bb6a";
        ctx.fillRect(sx, plat.y, plat.w, 3);
        // Checkerboard on dirt
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        for (let i = 0; i < plat.w; i += 20) {
          for (let j = 8; j < plat.h; j += 20) {
            if ((Math.floor(i / 20) + Math.floor(j / 20)) % 2 === 0)
              ctx.fillRect(sx + i, plat.y + j, 20, 20);
          }
        }
      } else {
        // Floating platform: stone/grass look
        const grad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
        grad.addColorStop(0, "#6dbf5e");
        grad.addColorStop(0.3, "#5a3e1b");
        grad.addColorStop(1, "#3a2610");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(sx, plat.y, plat.w, plat.h, 6);
        ctx.fill();
        // Highlight edge
        ctx.strokeStyle = "rgba(100,200,80,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sx + 1, plat.y + 1, plat.w - 2, plat.h - 2, 5);
        ctx.stroke();
      }
    } else if (lvl === "cityescape") {
      if (isGround) {
        ctx.fillStyle = "#303845";
        ctx.fillRect(sx, plat.y, plat.w, plat.h);
        // Road markings
        ctx.fillStyle = "#ffffff22";
        for (let i = 0; i < plat.w; i += 60)
          ctx.fillRect(sx + i, plat.y + 4, 30, 4);
        ctx.strokeStyle = "#00aaff66";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, plat.y, plat.w, plat.h);
      } else {
        const grad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
        grad.addColorStop(0, "#4a5a70");
        grad.addColorStop(1, "#2a3040");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(sx, plat.y, plat.w, plat.h, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(100,180,255,0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(sx + 1, plat.y + 1, plat.w - 2, plat.h - 2, 3);
        ctx.stroke();
      }
    } else if (lvl === "lavareef") {
      if (isGround) {
        const grad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
        grad.addColorStop(0, "#2a0800");
        grad.addColorStop(1, "#0f0300");
        ctx.fillStyle = grad;
        ctx.fillRect(sx, plat.y, plat.w, plat.h);
        // Lava cracks
        ctx.strokeStyle = "rgba(255,80,0,0.5)";
        ctx.lineWidth = 2;
        for (let i = 0; i < plat.w; i += 40) {
          ctx.beginPath();
          ctx.moveTo(sx + i, plat.y);
          ctx.lineTo(sx + i + 10, plat.y + 6);
          ctx.stroke();
        }
      } else {
        const grad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
        grad.addColorStop(0, "#4a1000");
        grad.addColorStop(1, "#1a0500");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(sx, plat.y, plat.w, plat.h, 5);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,80,0,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(sx + 1, plat.y + 1, plat.w - 2, plat.h - 2, 4);
        ctx.stroke();
      }
    } else {
      // Boss stage
      if (isGround) {
        ctx.fillStyle = "#0a0020";
        ctx.fillRect(sx, plat.y, plat.w, plat.h);
        ctx.strokeStyle = "rgba(120,0,200,0.5)";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, plat.y, plat.w, plat.h);
      } else {
        const grad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
        grad.addColorStop(0, "#1a0040");
        grad.addColorStop(1, "#0a0020");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(sx, plat.y, plat.w, plat.h, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(160,80,255,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(sx + 1, plat.y + 1, plat.w - 2, plat.h - 2, 3);
        ctx.stroke();
      }
    }

    // Moving platform indicator
    if (plat.type === "moving" && !isGround) {
      ctx.fillStyle = "rgba(255,220,0,0.4)";
      ctx.fillRect(sx + 4, plat.y + plat.h - 4, plat.w - 8, 3);
    }
  }

  function drawGoal(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (x < -60 || x > CW + 60) return;
    // Pole
    ctx.fillStyle = "#aaaaaa";
    ctx.fillRect(x - 3, y, 6, 90);
    // Star
    const pulse = 1 + Math.sin(Date.now() / 300) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#f8c940";
    ctx.shadowColor = "#f8c940";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⭐", 0, 6);
    ctx.restore();
  }

  function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const ringImg = imgsRef.current[RING_ICON];
    const pulse = 1 + Math.sin(Date.now() / 250) * 0.12;
    if (ringImg?.complete && ringImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(x + 12, y + 12);
      ctx.scale(pulse, pulse);
      ctx.drawImage(ringImg, -12, -12, 24, 24);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x + 10, y + 10);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = "#f8c940";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#f8c940";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  function drawEnemy(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    stunned: boolean,
    lvl: LevelId,
  ) {
    // Robot body
    const bodyColor = stunned
      ? "#665500"
      : lvl === "lavareef"
        ? "#8b0000"
        : "#cc4400";
    const accentColor = stunned
      ? "#aaa000"
      : lvl === "lavareef"
        ? "#ff2200"
        : "#ff6600";

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, w - 8, h - 8, 3);
    ctx.fill();

    // Eyes
    ctx.fillStyle = stunned ? "#ffff44" : "#ff0000";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(x + 10, y + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - 10, y + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stunned ? "💫" : "ROBO", x + w / 2, y + h - 4);
  }

  function drawBoss(ctx: CanvasRenderingContext2D, gs: GameState, cx: number) {
    const bx = gs.bossX - cx;
    const by = gs.bossY;
    const img = imgsRef.current[EGGMAN_SPRITE];
    const flash =
      gs.bossHp < gs.bossMaxHp && Math.floor(Date.now() / 180) % 2 === 0;

    ctx.save();
    if (flash) ctx.filter = "brightness(2.5) saturate(3)";
    if (img?.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, bx, by, 240, 240);
    } else {
      ctx.fillStyle = "#aa0000";
      ctx.beginPath();
      ctx.roundRect(bx + 20, by + 20, 200, 200, 20);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("EGGMAN", bx + 120, by + 120);
    }
    ctx.restore();

    // Boss HP bar
    const barW = 280;
    const barX = CW / 2 - barW / 2;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    ctx.roundRect(barX - 4, 14, barW + 8, 28, 8);
    ctx.fill();

    const hpFrac = gs.bossHp / gs.bossMaxHp;
    const hpColor =
      hpFrac > 0.6 ? "#44dd22" : hpFrac > 0.3 ? "#ffaa00" : "#ff2200";
    ctx.fillStyle = hpColor;
    ctx.shadowColor = hpColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(barX, 16, barW * hpFrac, 24, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255,80,80,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(barX - 4, 14, barW + 8, 28, 8);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 12px 'Bricolage Grotesque', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("DR. EGGMAN", CW / 2, 31);
  }

  function drawProjectile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    phase: number,
  ) {
    const size = phase === 2 ? 13 : 10;
    const col = phase === 2 ? "#ff6600" : "#ff3300";
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffcc44";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawPlayer(
    ctx: CanvasRenderingContext2D,
    p: Player,
    cx: number,
    ch: CharDef,
    gs: GameState,
  ) {
    const sx = p.x - cx;
    const img = imgsRef.current[ch.sprite];

    ctx.save();
    // Glow for special active
    if (p.specialActive) {
      ctx.shadowColor = ch.color;
      ctx.shadowBlur = 22;
    }
    // Chaos control purple tint
    if (ch.id === "shadow" && gs.timeSlowActive) {
      ctx.shadowColor = "#cc00cc";
      ctx.shadowBlur = 28;
    }

    // Flip for direction
    ctx.translate(sx + p.w / 2, p.y + p.h / 2);
    ctx.scale(p.facing, 1);
    ctx.translate(-(p.w / 2), -(p.h / 2));

    if (img?.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, p.w, p.h);
    } else {
      ctx.fillStyle = ch.color;
      ctx.beginPath();
      ctx.roundRect(0, 0, p.w, p.h, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ch.name[0], p.w / 2, p.h / 2 + 4);
    }
    ctx.restore();

    // Tails fly glow
    if (ch.id === "tails" && p.isFlying && p.flyTimer > 0) {
      ctx.fillStyle = "rgba(248,168,48,0.35)";
      ctx.beginPath();
      ctx.ellipse(sx + p.w / 2, p.y + p.h + 4, p.w * 0.7, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Amy hammer effect
    if (ch.id === "amy" && gs.hammerActive) {
      ctx.fillStyle = "#e8208c";
      ctx.shadowColor = "#e8208c";
      ctx.shadowBlur = 18;
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🔨", sx + p.w / 2 + p.facing * 36, p.y - 8);
      ctx.shadowBlur = 0;
    }

    // Shadow chaos aura
    if (ch.id === "shadow" && gs.timeSlowActive) {
      ctx.strokeStyle = "rgba(180,0,180,0.5)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx + p.w / 2, p.y + p.h / 2, p.w * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sonic speed lines
    if (ch.id === "sonic" && p.specialActive && Math.abs(p.vx) > 400) {
      ctx.strokeStyle = `${ch.color}88`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const lineY = p.y + 10 + i * 10;
        const lineX = sx - p.facing * (30 + i * 15);
        ctx.beginPath();
        ctx.moveTo(lineX, lineY);
        ctx.lineTo(lineX - p.facing * 40, lineY);
        ctx.stroke();
      }
    }
  }

  function drawHUD(ctx: CanvasRenderingContext2D, gs: GameState, ch: CharDef) {
    // HUD background bar
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, CW, 54);

    // Character portrait
    const charImg = imgsRef.current[ch.sprite];
    if (charImg?.complete && charImg.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(6, 4, 46, 46, 6);
      ctx.clip();
      ctx.drawImage(charImg, 6, 4, 46, 46);
      ctx.restore();
    }
    ctx.strokeStyle = `${ch.color}90`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(6, 4, 46, 46, 6);
    ctx.stroke();

    // Rings
    const ringImg = imgsRef.current[RING_ICON];
    if (ringImg?.complete && ringImg.naturalWidth > 0) {
      ctx.drawImage(ringImg, 58, 8, 28, 28);
    } else {
      ctx.strokeStyle = "#f8c940";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(72, 22, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#f8c940";
    ctx.shadowColor = "#f8c940";
    ctx.shadowBlur = 6;
    ctx.font = `bold 22px 'Bricolage Grotesque', sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`${gs.ringsCollected}`, 91, 28);
    ctx.shadowBlur = 0;

    // Lives
    ctx.fillStyle = "#ff4488";
    ctx.font = `bold 16px 'Bricolage Grotesque', sans-serif`;
    ctx.fillText(`❤️ ${gs.lives}`, 58, 48);

    // Level name center
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `bold 18px 'Bricolage Grotesque', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(LEVEL_NAMES[levelId], CW / 2, 28);

    // Score
    ctx.fillStyle = "rgba(200,220,255,0.7)";
    ctx.font = `13px 'Cabinet Grotesk', sans-serif`;
    ctx.fillText(`${gs.score.toLocaleString()} PTS`, CW / 2, 46);

    // Special cooldown
    ctx.textAlign = "right";
    if (gs.player.specialCooldown > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "11px sans-serif";
      ctx.fillText(`[Z] ${gs.player.specialCooldown.toFixed(1)}s`, CW - 10, 20);
      // Cooldown bar
      const barW2 = 120;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(CW - 10 - barW2, 23, barW2, 5);
      ctx.fillStyle = ch.color;
      ctx.fillRect(
        CW - 10 - barW2,
        23,
        barW2 * (1 - gs.player.specialCooldown / 3.5),
        5,
      );
    } else {
      ctx.fillStyle = ch.color;
      ctx.shadowColor = ch.color;
      ctx.shadowBlur = 6;
      ctx.font = `bold 12px 'Bricolage Grotesque', sans-serif`;
      ctx.fillText("[Z] SPECIAL READY", CW - 10, 22);
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = "left";

    // Character name right
    ctx.fillStyle = `${ch.color}cc`;
    ctx.font = `bold 11px 'Cabinet Grotesk', sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(ch.name.toUpperCase(), CW - 10, 42);
    ctx.textAlign = "left";
  }

  // Canvas scale for responsiveness
  const canvasStyle: React.CSSProperties = {
    maxWidth: "100vw",
    maxHeight: "calc(100vh - 0px)",
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
    outline: "none",
    cursor: "default",
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black">
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ maxHeight: "100vh" }}
      >
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          tabIndex={0}
          style={{
            ...canvasStyle,
            maxHeight: "calc(100vh - 140px)",
            aspectRatio: `${CW}/${CH}`,
            border: "2px solid rgba(30,60,120,0.6)",
            boxShadow:
              "0 0 40px rgba(26,111,196,0.25), 0 0 80px rgba(26,111,196,0.1)",
            borderRadius: "8px",
          }}
        />

        {/* Touch Controls Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-3 px-3">
          <div className="flex justify-between items-end pointer-events-none">
            {/* D-Pad left side */}
            <div
              className="pointer-events-auto flex flex-col items-center gap-1"
              style={{ opacity: 0.85 }}
            >
              <div className="relative" style={{ width: 160, height: 90 }}>
                {/* Left button */}
                <button
                  type="button"
                  className="absolute select-none active:opacity-70"
                  style={{
                    left: 0,
                    top: 20,
                    width: 72,
                    height: 50,
                    background: "rgba(20,40,80,0.7)",
                    border: "2px solid rgba(80,140,255,0.5)",
                    borderRadius: 12,
                    color: "#fff",
                    fontSize: 24,
                    touchAction: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    touchLeft.current = true;
                    keysRef.current.add("ArrowLeft");
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    touchLeft.current = false;
                    keysRef.current.delete("ArrowLeft");
                  }}
                  onMouseDown={() => {
                    touchLeft.current = true;
                    keysRef.current.add("ArrowLeft");
                  }}
                  onMouseUp={() => {
                    touchLeft.current = false;
                    keysRef.current.delete("ArrowLeft");
                  }}
                  onMouseLeave={() => {
                    touchLeft.current = false;
                    keysRef.current.delete("ArrowLeft");
                  }}
                >
                  ◀
                </button>
                {/* Right button */}
                <button
                  type="button"
                  className="absolute select-none active:opacity-70"
                  style={{
                    right: 0,
                    top: 20,
                    width: 72,
                    height: 50,
                    background: "rgba(20,40,80,0.7)",
                    border: "2px solid rgba(80,140,255,0.5)",
                    borderRadius: 12,
                    color: "#fff",
                    fontSize: 24,
                    touchAction: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    touchRight.current = true;
                    keysRef.current.add("ArrowRight");
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    touchRight.current = false;
                    keysRef.current.delete("ArrowRight");
                  }}
                  onMouseDown={() => {
                    touchRight.current = true;
                    keysRef.current.add("ArrowRight");
                  }}
                  onMouseUp={() => {
                    touchRight.current = false;
                    keysRef.current.delete("ArrowRight");
                  }}
                  onMouseLeave={() => {
                    touchRight.current = false;
                    keysRef.current.delete("ArrowRight");
                  }}
                >
                  ▶
                </button>
              </div>
              <p
                style={{
                  color: "rgba(120,160,255,0.4)",
                  fontSize: 9,
                  textAlign: "center",
                  fontFamily: "'Cabinet Grotesk', sans-serif",
                }}
              >
                MOVE
              </p>
            </div>

            {/* Action buttons right side */}
            <div
              className="pointer-events-auto flex flex-col items-center gap-1"
              style={{ opacity: 0.85 }}
            >
              <div className="flex gap-3 items-end">
                {/* Special / B button */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    className="select-none active:scale-90 transition-transform"
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: "rgba(200,60,60,0.6)",
                      border: "2px solid rgba(255,100,100,0.6)",
                      color: "#fff",
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      fontWeight: 900,
                      fontSize: 14,
                      touchAction: "none",
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      touchAttack.current = true;
                    }}
                    onMouseDown={() => {
                      touchAttack.current = true;
                    }}
                  >
                    SPEC
                  </button>
                  <p
                    style={{
                      color: "rgba(255,120,120,0.4)",
                      fontSize: 9,
                      fontFamily: "'Cabinet Grotesk', sans-serif",
                    }}
                  >
                    Z KEY
                  </p>
                </div>
                {/* Jump / A button */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    className="select-none active:scale-90 transition-transform"
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: "50%",
                      background: "rgba(26,111,196,0.65)",
                      border: "2.5px solid rgba(80,150,255,0.7)",
                      color: "#fff",
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      fontWeight: 900,
                      fontSize: 20,
                      touchAction: "none",
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      touchJump.current = true;
                    }}
                    onMouseDown={() => {
                      touchJump.current = true;
                    }}
                  >
                    ↑
                  </button>
                  <p
                    style={{
                      color: "rgba(80,150,255,0.4)",
                      fontSize: 9,
                      fontFamily: "'Cabinet Grotesk', sans-serif",
                    }}
                  >
                    JUMP
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Keyboard hint - desktop only */}
          <div className="hidden sm:flex justify-center mt-1 pointer-events-none">
            <p
              style={{
                color: "rgba(120,160,220,0.3)",
                fontSize: 10,
                fontFamily: "'Cabinet Grotesk', sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              ← → move &nbsp;·&nbsp; SPACE jump &nbsp;·&nbsp; Z special
              &nbsp;·&nbsp; double jump available
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Victory Screen ───────────────────────────────────────────────────────────

function VictoryScreen({
  score,
  rings,
  onMenu,
}: { score: number; rings: number; onMenu: () => void }) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #0a2a10 0%, #050810 100%)",
        }}
      />
      <StarField />
      <div
        className="relative z-10 flex flex-col items-center gap-6 px-4"
        style={{ animation: "slideUp 0.6s ease forwards" }}
      >
        <div className="relative">
          <div
            className="absolute inset-0 blur-3xl rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(248,201,64,0.4) 0%, transparent 70%)",
            }}
          />
          <img
            src={EGGMAN_SPRITE}
            alt="Eggman defeated"
            className="relative w-28 h-28 object-contain"
            style={{
              filter: "grayscale(0.8) brightness(0.4)",
              transform: "rotate(-25deg) scaleX(-1)",
            }}
          />
        </div>
        <div className="text-center">
          <h1
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: "3.5rem",
              fontWeight: 900,
              color: "#f8c940",
              textShadow: "0 0 20px #f8c940, 0 0 50px #f8c94080",
            }}
          >
            VICTORY!
          </h1>
          <p
            style={{
              color: "#ffffff",
              fontSize: "1.1rem",
              fontWeight: 600,
              opacity: 0.8,
            }}
          >
            Eggman has been defeated!
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div
            className="px-6 py-4 rounded-2xl text-center"
            style={{
              background: "rgba(26,111,196,0.2)",
              border: "1px solid rgba(26,111,196,0.4)",
            }}
          >
            <p
              style={{
                color: "#7090c0",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              Final Score
            </p>
            <p
              style={{
                color: "#ffffff",
                fontSize: "2rem",
                fontWeight: 900,
                fontFamily: "'Bricolage Grotesque', sans-serif",
              }}
            >
              {score.toLocaleString()}
            </p>
          </div>
          <div
            className="px-6 py-4 rounded-2xl text-center"
            style={{
              background: "rgba(248,201,64,0.15)",
              border: "1px solid rgba(248,201,64,0.4)",
            }}
          >
            <p
              style={{
                color: "rgba(248,201,64,0.6)",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              Total Rings
            </p>
            <p
              style={{
                color: "#f8c940",
                fontSize: "2rem",
                fontWeight: 900,
                fontFamily: "'Bricolage Grotesque', sans-serif",
              }}
            >
              {rings} 💛
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onMenu}
          className="px-10 py-4 rounded-full font-black tracking-widest uppercase text-lg transition-all hover:scale-105 active:scale-95"
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            background: "linear-gradient(135deg, #1a6fc4, #0d3d8a)",
            color: "#fff",
            boxShadow: "0 0 24px rgba(26,111,196,0.6)",
          }}
        >
          Main Menu
        </button>
      </div>
    </div>
  );
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────

function GameOverScreen({
  score,
  rings,
  onRetry,
  onMenu,
}: {
  score: number;
  rings: number;
  onRetry: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, #1a0505 0%, #050810 100%)",
        }}
      />
      <StarField />
      <div
        className="relative z-10 flex flex-col items-center gap-6 px-4"
        style={{ animation: "slideUp 0.6s ease forwards" }}
      >
        <div className="text-center">
          <h1
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: "3.5rem",
              fontWeight: 900,
              color: "#ff4444",
              textShadow: "0 0 20px #ff4444, 0 0 50px #ff444480",
            }}
          >
            GAME OVER
          </h1>
          <p style={{ color: "#aaaaaa", fontSize: "1rem", opacity: 0.7 }}>
            Eggman wins this round...
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div
            className="px-6 py-4 rounded-2xl text-center"
            style={{
              background: "rgba(255,68,68,0.1)",
              border: "1px solid rgba(255,68,68,0.3)",
            }}
          >
            <p
              style={{
                color: "#ff8888",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              Score
            </p>
            <p
              style={{
                color: "#ffffff",
                fontSize: "2rem",
                fontWeight: 900,
                fontFamily: "'Bricolage Grotesque', sans-serif",
              }}
            >
              {score.toLocaleString()}
            </p>
          </div>
          <div
            className="px-6 py-4 rounded-2xl text-center"
            style={{
              background: "rgba(248,201,64,0.1)",
              border: "1px solid rgba(248,201,64,0.3)",
            }}
          >
            <p
              style={{
                color: "rgba(248,201,64,0.5)",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 4,
              }}
            >
              Rings
            </p>
            <p
              style={{
                color: "#f8c940",
                fontSize: "2rem",
                fontWeight: 900,
                fontFamily: "'Bricolage Grotesque', sans-serif",
              }}
            >
              {rings} 💛
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onRetry}
            className="px-8 py-3 rounded-full font-black tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              background: "linear-gradient(135deg, #cc2222, #880000)",
              color: "#fff",
              boxShadow: "0 0 20px rgba(200,34,34,0.5)",
            }}
          >
            RETRY
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="px-8 py-3 rounded-full font-black tracking-widest uppercase transition-all hover:opacity-80"
            style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              background: "rgba(255,255,255,0.07)",
              color: "#aaaaaa",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            MENU
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Utility functions ────────────────────────────────────────────────────────

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < r * r;
}
