import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface PlayerProgress {
    currentRings: bigint;
    totalRingsCollected: bigint;
}
export interface Score {
    player: Principal;
    score: bigint;
}
export enum Character {
    amy = "amy",
    tails = "tails",
    shadow = "shadow",
    sonic = "sonic",
    knuckles = "knuckles"
}
export interface backendInterface {
    addRings(rings: bigint): Promise<void>;
    getLeaderboard(level: string): Promise<Array<Score>>;
    getPlayerProgress(): Promise<PlayerProgress>;
    getUnlockedCharacters(): Promise<Array<Character>>;
    spendRings(character: Character): Promise<void>;
    updateHighScore(level: string, score: bigint): Promise<void>;
}
