import Map "mo:core/Map";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";

actor {
  type Level = {
    greenHill : Nat;
    chemicalPlant : Nat;
    bossStage : Nat;
  };

  type PlayerProgress = {
    totalRingsCollected : Nat;
    currentRings : Nat;
  };

  type Character = {
    #sonic;
    #tails;
    #knuckles;
    #shadow;
    #amy;
  };

  module Character {
    public func compare(char1 : Character, char2 : Character) : Order.Order {
      switch (char1, char2) {
        case (#sonic, #sonic) { #equal };
        case (#tails, #tails) { #equal };
        case (#knuckles, #knuckles) { #equal };
        case (#shadow, #shadow) { #equal };
        case (#amy, #amy) { #equal };
        case (_, _) { #less };
      };
    };
  };

  type PlayerData = {
    progress : PlayerProgress;
    unlockedCharacters : [Character];
  };

  type Score = {
    player : Principal;
    score : Nat;
  };

  module Score {
    public func compare(score1 : Score, score2 : Score) : Order.Order {
      Nat.compare(score2.score, score1.score);
    };
  };

  let players = Map.empty<Principal, PlayerData>();

  let levelScores = Map.empty<Text, [Score]>();

  let characterCosts = Map.fromArray<Character, Nat>(
    [
      (#tails, 100),
      (#knuckles, 200),
      (#shadow, 300),
      (#amy, 150),
    ]
  );

  public shared ({ caller }) func getPlayerProgress() : async PlayerProgress {
    switch (players.get(caller)) {
      case (null) { Runtime.trap("Player not found") };
      case (?data) { data.progress };
    };
  };

  public shared ({ caller }) func spendRings(character : Character) : async () {
    let newCharacter = arrayToCharacters([character]);
    switch (players.get(caller)) {
      case (null) {
        let newPlayer : PlayerData = {
          progress = {
            totalRingsCollected = 0;
            currentRings = 0;
          };
          unlockedCharacters = newCharacter;
        };
        players.add(caller, newPlayer);
      };
      case (?data) {
        switch (characterCosts.get(character)) {
          case (null) { Runtime.trap("Character not found") };
          case (?cost) {
            if (data.progress.currentRings < cost) {
              Runtime.trap("Not enough rings to unlock this character");
            };
            let updatedProgress : PlayerProgress = {
              totalRingsCollected = data.progress.totalRingsCollected;
              currentRings = data.progress.currentRings - cost;
            };
            let updatedCharacters = data.unlockedCharacters.concat(newCharacter);
            let updatedPlayer : PlayerData = {
              progress = updatedProgress;
              unlockedCharacters = updatedCharacters;
            };
            players.add(caller, updatedPlayer);
          };
        };
      };
    };
  };

  func arrayToCharacters(array : [Character]) : [Character] {
    array.map(func(char) { char });
  };

  public shared ({ caller }) func addRings(rings : Nat) : async () {
    switch (players.get(caller)) {
      case (null) {
        let newPlayer : PlayerData = {
          progress = {
            totalRingsCollected = rings;
            currentRings = rings;
          };
          unlockedCharacters = arrayToCharacters([#sonic]);
        };
        players.add(caller, newPlayer);
      };
      case (?data) {
        let updatedProgress : PlayerProgress = {
          totalRingsCollected = data.progress.totalRingsCollected + rings;
          currentRings = data.progress.currentRings + rings;
        };
        let updatedPlayer : PlayerData = {
          progress = updatedProgress;
          unlockedCharacters = data.unlockedCharacters;
        };
        players.add(caller, updatedPlayer);
      };
    };
  };

  public query ({ caller }) func getUnlockedCharacters() : async [Character] {
    switch (players.get(caller)) {
      case (null) { Runtime.trap("Player not found") };
      case (?data) { data.unlockedCharacters };
    };
  };

  public shared ({ caller }) func updateHighScore(level : Text, score : Nat) : async () {
    switch (levelScores.get(level)) {
      case (null) {
        let newScore : Score = { player = caller; score };
        levelScores.add(level, [newScore]);
      };
      case (?scores) {
        let newScore : Score = { player = caller; score };
        let updatedScores = scores.concat([newScore]);
        levelScores.add(level, updatedScores);
      };
    };
  };

  public query ({ caller }) func getLeaderboard(level : Text) : async [Score] {
    switch (levelScores.get(level)) {
      case (null) { Runtime.trap("Level not found") };
      case (?scores) { scores.sort() };
    };
  };
};
