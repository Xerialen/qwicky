// src/utils/statsLogic.js - QuakeWorld Player Stats Calculator

import { unicodeToAscii } from './matchLogic';

// Standard Quake Colors
const QUAKE_COLORS = {
  0: "#D3D3D3",
  1: "#8B4513",
  2: "#D8BFD8",
  3: "#008000",
  4: "#8B0000",
  12: "#FFFF00",
  13: "#0000FF"
};

// Items to track opportunities for
// Note: RL is always treated as available.
const ALL_TRACKED_ITEMS = [
  // WEAPONS
  "lg", "gl", "sng", "ng", "ssg",
  // ARMOR / HEALTH
  "mh", "ra", "ya", "ga",
  // POWERUPS
  "pent", "ring", "quad"
];

// Map-specific item configurations
// This should match your maps_items.json config
const MAPS_CONFIG = {
  "dm2": ["lg", "sng", "mh", "ra", "ya", "quad"],
  "dm3": ["lg", "gl", "mh", "ra", "ya", "ga", "pent", "ring", "quad"],
  "dm4": ["lg", "mh", "ra", "pent"],
  "dm6": ["lg", "mh", "ra", "ya", "ring", "quad"],
  "e1m2": ["lg", "gl", "sng", "mh", "ra", "ya", "pent", "quad"],
  "ztndm3": ["lg", "mh", "ra", "ya", "quad"],
  // Add more maps as needed
};

const safeDiv = (n, d) => (d > 0 ? n / d : 0);

const getStatsStructure = () => ({
  games: 0,
  opportunities: {
    lg: 0, gl: 0, sng: 0, ng: 0, ssg: 0,
    mh: 0, ra: 0, ya: 0, ga: 0,
    pent: 0, ring: 0, quad: 0
  },
  teamColor: null,
  // Core Stats
  frags: 0,
  deaths: 0,
  dmgGiven: 0,      // Total Damage Given
  ewepGiven: 0,     // Enemy Weapon Damage (EWEP)
  dmgToDie: 0,
  // Movement
  speedSum: 0,      // Sum of average speeds
  speedMaxSum: 0,   // Sum of max speeds
  // Weapons
  rl: { k: 0, h: 0, t: 0, d: 0, xfer: 0 },
  lg: { k: 0, h: 0, t: 0, d: 0 },
  gl: { k: 0, h: 0, t: 0, d: 0 },
  sng: { k: 0, h: 0, t: 0, d: 0 },
  ng: { k: 0, h: 0, t: 0, d: 0 },
  ssg: { k: 0, h: 0, t: 0, d: 0 },
  // Accuracy Accumulators
  accSums: { lg: 0.0, sg: 0.0, eff: 0.0 },
  accCounts: { lg: 0, sg: 0, eff: 0 },
  // Items
  items: { q: 0, p: 0, r: 0, ra: 0, ya: 0, ga: 0, mh: 0 }
});

/**
 * Process a single match JSON object
 * @param {Object} matchData - Parsed JSON match data
 * @param {Object} playersDb - Accumulator object for all player stats
 */
const processMatch = (matchData, playersDb) => {
  const mapName = (matchData.map || "").toLowerCase();
  const availableItems = MAPS_CONFIG[mapName] || ALL_TRACKED_ITEMS;

  if (!matchData.players) return;

  matchData.players.forEach(p => {
    const rawName = p.name || "Unknown";
    const cleanedName = unicodeToAscii(rawName).trim(); // Clean Quake encoding
    const nameKey = cleanedName.toLowerCase(); // Case-insensitive aggregation key

    // Initialize player if not exists; preserve first-seen casing as display name
    if (!playersDb[nameKey]) {
      playersDb[nameKey] = getStatsStructure();
      playersDb[nameKey].displayName = cleanedName;
      const tc = p["top-color"] || 0;
      playersDb[nameKey].teamColor = QUAKE_COLORS[tc] || "";
    }

    const db = playersDb[nameKey];
    db.games += 1;

    // --- OPPORTUNITIES ---
    availableItems.forEach(item => {
      db.opportunities[item] += 1;
    });

    // --- CORE STATS ---
    const stats = p.stats || {};
    const pFrags = stats.frags || 0;
    const pDeaths = stats.deaths || 0;
    const pKills = stats.kills || 0; // Used for Efficiency calculation

    db.frags += pFrags;
    db.deaths += pDeaths;

    // Damage Processing
    const dmgObj = p.dmg || {};
    db.dmgGiven += dmgObj.given || 0;
    // EWEP: Enemy Weapon Damage (check both dash and underscore keys)
    db.ewepGiven += dmgObj["enemy-weapons"] || dmgObj["enemy_weapons"] || 0;
    // To-Die
    db.dmgToDie += dmgObj["taken-to-die"] || dmgObj["taken_to_die"] || 0;

    // Speed
    const speedData = p.speed || {};
    db.speedSum += speedData.avg || 0;
    db.speedMaxSum += speedData.max || 0;

    // Efficiency (Per Game)
    // Use Kills instead of Frags to avoid suicide negatives
    const engagements = pKills + pDeaths;
    if (engagements > 0) {
      const gameEff = pKills / engagements;
      db.accSums.eff += gameEff;
      db.accCounts.eff += 1;
    }

    // --- WEAPONS ---
    const weap = p.weapons || {};

    // Helper to extract weapon data
    const getW = (key, metric) => {
      const w = weap[key] || {};
      const pickups = w.pickups || {};
      const kills = w.kills || {};
      const acc = w.acc || {};
      
      return {
        k: kills[metric] || 0,
        h: acc.hits || 0,
        t: pickups["total-taken"] || 0,
        d: pickups.dropped || 0,
        a: acc.attacks || 0
      };
    };

    // --- ROCKET LAUNCHER (Always Processed) ---
    // RL: Use "enemy" (kills against enemy holding RL)
    const rlData = getW("rl", "enemy");
    db.rl.k += rlData.k;
    db.rl.h += rlData.h;
    db.rl.t += rlData.t;
    db.rl.d += rlData.d;
    db.rl.xfer += p.xferRL || 0;

    // --- OTHER WEAPONS (Map Dependent) ---
    
    // 1. Lightning Gun: Use "enemy" (kills against enemy holding LG)
    if (availableItems.includes("lg")) {
      const lgData = getW("lg", "enemy");
      db.lg.k += lgData.k;
      db.lg.h += lgData.h;
      db.lg.t += lgData.t;
      db.lg.d += lgData.d;
    }

    // 2. GL, SNG, NG, SSG: Use "total" (kills using these weapons)
    ["gl", "sng", "ng", "ssg"].forEach(wKey => {
      if (availableItems.includes(wKey)) {
        const wData = getW(wKey, "total");
        db[wKey].k += wData.k;
        db[wKey].h += wData.h;
        db[wKey].t += wData.t;
        db[wKey].d += wData.d;
      }
    });

    // --- ACCURACY ACCUMULATORS ---
    if (availableItems.includes("lg")) {
      const lgData = getW("lg", "total");
      if (lgData.a > 0) {
        db.accSums.lg += (lgData.h / lgData.a);
        db.accCounts.lg += 1;
      }
    }

    const sgData = getW("sg", "total");
    if (sgData.a > 0) {
      db.accSums.sg += (sgData.h / sgData.a);
      db.accCounts.sg += 1;
    }

    // --- ITEMS ---
    const items = p.items || {};
    const getItemCount = (key) => {
      const iData = items[key] || {};
      return iData.took || iData.taken || 0;
    };

    if (availableItems.includes("quad")) db.items.q += getItemCount("q");
    if (availableItems.includes("pent")) db.items.p += getItemCount("p");
    if (availableItems.includes("ring")) db.items.r += getItemCount("r");
    if (availableItems.includes("mh")) db.items.mh += getItemCount("health_100");
    if (availableItems.includes("ra")) db.items.ra += getItemCount("ra");
    if (availableItems.includes("ya")) db.items.ya += getItemCount("ya");
    if (availableItems.includes("ga")) db.items.ga += getItemCount("ga");
  });
};

/**
 * Calculate stats from an array of match objects
 * @param {Array} matchesArray - Array of parsed JSON match objects
 * @returns {Object} Player database with aggregated stats
 */
export const calculateStats = (matchesArray) => {
  const playersDb = {};
  
  matchesArray.forEach(match => {
    processMatch(match, playersDb);
  });

  return playersDb;
};

/**
 * Convert player stats to array format for table display
 * @param {Object} playersDb - Player database from calculateStats
 * @returns {Array} Array of player stat objects sorted by avg frags
 */
export const formatStatsForTable = (playersDb) => {
  const players = Object.entries(playersDb).map(([, db]) => {
    const g = db.games;
    if (g === 0) return null;

    const opp = db.opportunities;

    return {
      name: db.displayName || '',
      teamColor: db.teamColor,
      games: g,
      
      // General Stats
      avgFrags: parseFloat((db.frags / g).toFixed(1)),
      avgDeaths: parseFloat((db.deaths / g).toFixed(1)),
      avgDmg: Math.round(db.dmgGiven / g),
      avgEwep: Math.round(db.ewepGiven / g),
      avgToDie: Math.round(db.dmgToDie / g),
      effPct: safeDiv(db.accSums.eff, db.accCounts.eff) * 100,
      
      // Movement
      avgSpeed: Math.round(db.speedSum / g),
      maxSpeed: Math.round(db.speedMaxSum / g),
      
      // RL Stats
      rlKills: parseFloat(safeDiv(db.rl.k, g).toFixed(1)),
      rlXfer: parseFloat(safeDiv(db.rl.xfer, g).toFixed(1)),
      rlHits: parseFloat(safeDiv(db.rl.h, g).toFixed(1)),
      rlTaken: parseFloat(safeDiv(db.rl.t, g).toFixed(1)),
      rlDrop: parseFloat(safeDiv(db.rl.d, g).toFixed(1)),
      
      // LG Stats
      lgKills: parseFloat(safeDiv(db.lg.k, opp.lg).toFixed(1)),
      lgTaken: parseFloat(safeDiv(db.lg.t, opp.lg).toFixed(1)),
      lgDrop: parseFloat(safeDiv(db.lg.d, opp.lg).toFixed(1)),
      
      // Other Weapons
      glKills: parseFloat(safeDiv(db.gl.k, opp.gl).toFixed(1)),
      ssgKills: parseFloat(safeDiv(db.ssg.k, opp.ssg).toFixed(1)),
      ngKills: parseFloat(safeDiv(db.ng.k, opp.ng).toFixed(1)),
      sngKills: parseFloat(safeDiv(db.sng.k, opp.sng).toFixed(1)),
      
      // Items
      quad: parseFloat(safeDiv(db.items.q, opp.quad).toFixed(1)),
      pent: parseFloat(safeDiv(db.items.p, opp.pent).toFixed(1)),
      ring: parseFloat(safeDiv(db.items.r, opp.ring).toFixed(1)),
      ra: parseFloat(safeDiv(db.items.ra, opp.ra).toFixed(1)),
      ya: parseFloat(safeDiv(db.items.ya, opp.ya).toFixed(1)),
      mh: parseFloat(safeDiv(db.items.mh, opp.mh).toFixed(1)),
      
      // Accuracy
      lgAcc: safeDiv(db.accSums.lg, db.accCounts.lg) * 100,
      sgAcc: safeDiv(db.accSums.sg, db.accCounts.sg) * 100,
      
      // Raw data for sorting
      _rawFrags: db.frags,
      _rawDeaths: db.deaths,
    };
  }).filter(Boolean);

  // Sort by average frags (descending)
  return players.sort((a, b) => b.avgFrags - a.avgFrags);
};

/**
 * Generate MediaWiki table markup
 * @param {Object} playersDb - Player database from calculateStats
 * @returns {string} MediaWiki table markup
 */
export const generateWikiTable = (playersDb) => {
  const headers = [
    "Player", "Games",
    "Avg Frags", "Avg Deaths", "Avg Dmg", "EWEP", "To Die", "Eff %",
    "Avg Spd", "Max Spd",
    "RL Kills", "RL Xfer", "RL Hits", "RL Taken", "RL Drop",
    "LG Kills", "LG Taken", "LG Drop",
    "GL Kills", "SSG Kills", "NG Kills", "SNG Kills",
    "Quad", "Pent", "Ring", "RA", "YA", "MH",
    "LG %", "SG %"
  ];

  const out = ['{| class="wikitable sortable"'];
  out.push("! " + headers.join(" !! "));

  const sortedPlayers = Object.entries(playersDb).sort(
    ([, a], [, b]) => safeDiv(b.frags, b.games) - safeDiv(a.frags, a.games)
  );

  sortedPlayers.forEach(([, db]) => {
    const name = db.displayName || '';
    const g = db.games;
    if (g === 0) return;

    const opp = db.opportunities;

    // 1. General Stats
    const avgFrags = (db.frags / g).toFixed(1);
    const avgDeaths = (db.deaths / g).toFixed(1);
    const avgDmg = Math.round(db.dmgGiven / g);
    const avgEwep = Math.round(db.ewepGiven / g);
    const avgToDie = Math.round(db.dmgToDie / g);
    const effVal = safeDiv(db.accSums.eff, db.accCounts.eff);
    const effPct = `${(effVal * 100).toFixed(1)}%`;

    // 2. Movement
    const avgSpeed = Math.round(db.speedSum / g);
    const maxSpeed = Math.round(db.speedMaxSum / g);

    // 3. Weapons
    const rlK = safeDiv(db.rl.k, g).toFixed(1);
    const rlXfer = safeDiv(db.rl.xfer, g).toFixed(1);
    const rlH = safeDiv(db.rl.h, g).toFixed(1);
    const rlT = safeDiv(db.rl.t, g).toFixed(1);
    const rlD = safeDiv(db.rl.d, g).toFixed(1);

    const lgK = safeDiv(db.lg.k, opp.lg).toFixed(1);
    const lgT = safeDiv(db.lg.t, opp.lg).toFixed(1);
    const lgD = safeDiv(db.lg.d, opp.lg).toFixed(1);

    const glK = safeDiv(db.gl.k, opp.gl).toFixed(1);
    const ssgK = safeDiv(db.ssg.k, opp.ssg).toFixed(1);
    const ngK = safeDiv(db.ng.k, opp.ng).toFixed(1);
    const sngK = safeDiv(db.sng.k, opp.sng).toFixed(1);

    // 4. Items
    const quad = safeDiv(db.items.q, opp.quad).toFixed(1);
    const pent = safeDiv(db.items.p, opp.pent).toFixed(1);
    const ring = safeDiv(db.items.r, opp.ring).toFixed(1);
    const ra = safeDiv(db.items.ra, opp.ra).toFixed(1);
    const ya = safeDiv(db.items.ya, opp.ya).toFixed(1);
    const mh = safeDiv(db.items.mh, opp.mh).toFixed(1);

    // 5. Accuracy
    const lgAccVal = safeDiv(db.accSums.lg, db.accCounts.lg);
    const sgAccVal = safeDiv(db.accSums.sg, db.accCounts.sg);
    const lgAcc = `${(lgAccVal * 100).toFixed(1)}%`;
    const sgAcc = `${(sgAccVal * 100).toFixed(1)}%`;

    const colorStyle = db.teamColor 
      ? `style="border-left: 3px solid ${db.teamColor}"` 
      : "";

    const row = [
      `| ${colorStyle} | ${name}`,
      g,
      avgFrags, avgDeaths, avgDmg, avgEwep, avgToDie, effPct,
      avgSpeed, maxSpeed,
      rlK, rlXfer, rlH, rlT, rlD,
      lgK, lgT, lgD,
      glK, ssgK, ngK, sngK,
      quad, pent, ring, ra, ya, mh,
      lgAcc, sgAcc
    ];

    out.push("|-");
    out.push(row.join(" || "));
  });

  out.push("|}");
  return out.join("\n");
};
