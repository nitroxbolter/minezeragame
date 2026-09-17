'use strict';

const SEA_LEVEL = 62;
const WORLD_HEIGHT = 128;
const WORLD_SEED = 'minezera-ilha-biomas-v5-1500-vila';
const VILLAGE_CENTER = Object.freeze({ x: 0, z: 40 });
const MANSION_CENTER = Object.freeze({ x: 435, z: -360 });

const BIOME = Object.freeze({
  OCEAN: 0, PLAINS: 1, FOREST: 2, DESERT: 3, MOUNTAINS: 4, SNOWY: 5,
  TAIGA: 6, BEACH: 7, BIRCH: 8, DEEP_OCEAN: 9, JUNGLE: 10, SWAMP: 11
});

const PASSIVE_POOLS = Object.freeze({
  [BIOME.PLAINS]: ['pig', 'cow', 'sheep', 'chicken', 'horse', 'rabbit'],
  [BIOME.FOREST]: ['pig', 'cow', 'sheep', 'chicken', 'wolf', 'fox', 'bee'],
  [BIOME.BIRCH]: ['pig', 'cow', 'sheep', 'chicken', 'wolf', 'bee'],
  [BIOME.JUNGLE]: ['pig', 'chicken', 'cat', 'bee'],
  [BIOME.SWAMP]: ['pig', 'chicken', 'sheep'],
  [BIOME.DESERT]: ['rabbit'],
  [BIOME.MOUNTAINS]: ['goat', 'sheep', 'rabbit'],
  [BIOME.SNOWY]: ['polar_bear', 'rabbit'],
  [BIOME.TAIGA]: ['wolf', 'fox', 'rabbit'],
  [BIOME.BEACH]: ['rabbit']
});

const HOSTILE_POOLS = Object.freeze({
  default: ['zombie', 'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch'],
  [BIOME.DESERT]: ['husk', 'husk', 'skeleton', 'creeper', 'spider'],
  [BIOME.SWAMP]: ['zombie', 'witch', 'spider', 'slime'],
  [BIOME.OCEAN]: ['drowned', 'drowned', 'guardian'],
  [BIOME.DEEP_OCEAN]: ['drowned', 'guardian'],
  [BIOME.SNOWY]: ['zombie', 'skeleton', 'creeper', 'phantom']
});

const RANGED = new Set(['skeleton', 'pillager', 'drowned', 'witch', 'blaze', 'ghast', 'guardian', 'illusioner', 'evoker', 'wither']);
const FLYING = new Set(['bee', 'bat', 'blaze', 'ghast', 'phantom', 'vex', 'wither']);
const WATER = new Set(['drowned', 'guardian']);
const ALWAYS_HOSTILE = new Set([
  'zombie', 'skeleton', 'creeper', 'pillager', 'zombie_villager', 'husk', 'drowned', 'witch',
  'enderman', 'blaze', 'ghast', 'spider', 'cave_spider', 'slime', 'magma_cube', 'silverfish',
  'guardian', 'phantom', 'wither_skeleton', 'piglin', 'ravager', 'vex', 'illusioner', 'evoker', 'vindicator', 'wither',
  'alligator', 'anglerfish', 'bear', 'black_bear', 'desert_scorpion', 'great_white_shark', 'hippo',
  'jellyfish', 'jungle_scorpion', 'komodo_dragon', 'lion', 'piranha', 'snake', 'tiger'
]);
const SHEEP_COLORS = ['white', 'white', 'white', 'white', 'white', 'black', 'gray', 'brown', 'pink'];
const VILLAGER_PROFESSIONS = [
  'farmer', 'fisherman', 'shepherd', 'fletcher', 'librarian', 'cartographer',
  'cleric', 'armorer', 'weaponsmith', 'toolsmith', 'butcher', 'leatherworker', 'mason'
];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function pick(values) { return values[Math.floor(Math.random() * values.length)]; }

function hashString(str) {
  let h1 = 0xdeadbeef ^ 7, h2 = 0x41c6ce57 ^ 7;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) ^ (h1 >>> 0);
}

class Rand {
  constructor(seed) {
    this.s = (typeof seed === 'string' ? hashString(seed) : (seed | 0)) >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }
  next() {
    let t = (this.s += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n) { return Math.floor(this.next() * n); }
}

class Noise {
  constructor(seed) {
    const random = new Rand(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = random.int(i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  noise2(xin, yin) {
    const gradients = Noise.grad3, perm = this.perm, pm = this.permMod12;
    const F2 = 0.3660254037844386, G2 = 0.21132486540518713;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) { const g = gradients[pm[ii + perm[jj]]]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) { const g = gradients[pm[ii + i1 + perm[jj + j1]]]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) { const g = gradients[pm[ii + 1 + perm[jj + 1]]]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2);
  }

  fbm2(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2(x * freq, y * freq);
      norm += amp; amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }

  ridge2(x, y, octaves = 4) {
    let sum = 0, amp = 0.5, freq = 1, previous = 1;
    for (let i = 0; i < octaves; i++) {
      let n = 1 - Math.abs(this.noise2(x * freq, y * freq));
      n *= n; sum += n * amp * previous; previous = n; freq *= 2; amp *= 0.5;
    }
    return sum;
  }
}
Noise.grad3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];

class TerrainSampler {
  constructor(seed = WORLD_SEED) {
    this.cont = new Noise(seed + ':cont'); this.ero = new Noise(seed + ':ero');
    this.hill = new Noise(seed + ':hill'); this.ridge = new Noise(seed + ':ridge');
    this.temp = new Noise(seed + ':temp'); this.hum = new Noise(seed + ':hum');
  }

  sample(x, z) {
    const islandRadius = 680, shoreWidth = 72, distance = Math.hypot(x, z);
    const cont = this.cont.fbm2(x * 0.00045, z * 0.00045, 4);
    const ero = this.ero.fbm2((x + 1000) * 0.001, (z + 1000) * 0.001, 3);
    const hills = this.hill.fbm2(x * 0.004, z * 0.004, 4);
    const islandLand = 1 - smoothstep(islandRadius - shoreWidth, islandRadius, distance);
    const region = (cx, cz, rx, rz) => Math.max(0, 1 - Math.hypot((x - cx) / rx, (z - cz) / rz));
    const snowRegion = region(-276, -276, 315, 300);
    const jungleRegion = region(-354, 315, 348, 288);
    const swampRegion = region(-465, 102, 234, 192);
    const desertRegion = region(375, 294, 294, 312);
    const rockRegion = region(396, -303, 300, 282);
    const forestRegion = region(36, -186, 495, 276);
    const villageRegion = region(0, 40, 192, 192);
    const landness = smoothstep(-0.25, 0.15, cont);
    const naturalMountain = smoothstep(0.15, 0.65, ero) * smoothstep(0.05, 0.3, cont);
    const mountain = clamp(Math.max(naturalMountain * 0.7, snowRegion * 0.98, rockRegion * 0.9, region(54, -276, 375, 246) * 0.62), 0, 1) * islandLand;
    const ridge = mountain > 0 ? this.ridge.ridge2(x * 0.002, z * 0.002, 4) : 0;
    const base = lerp(SEA_LEVEL + 1 + cont * 4, 69 + cont * 7, landness);
    let height = base + hills * (5 + 18 * mountain) + ridge * 48 * mountain + snowRegion * 14 + rockRegion * 18;
    const coast = smoothstep(islandRadius - shoreWidth, islandRadius, distance);
    if (distance >= islandRadius) height = SEA_LEVEL - 10 - Math.min(22, Math.floor((distance - islandRadius) * 0.08));
    else if (coast > 0) height = lerp(Math.max(SEA_LEVEL + 1, height), SEA_LEVEL - 1 - coast * 10, coast);
    if (distance < islandRadius - shoreWidth && height < SEA_LEVEL + 1) height = SEA_LEVEL + 1;
    if (swampRegion > 0.2) height = Math.floor(clamp(SEA_LEVEL - 1 + hills * 4 + (swampRegion - 0.2) * 3, SEA_LEVEL - 2, SEA_LEVEL + 3));
    height = Math.floor(clamp(height, 4, WORLD_HEIGHT - 6));
    let temp = (this.temp.fbm2((x + 5000) * 0.0007, z * 0.0007, 3) + 1) * 0.5 - Math.max(0, height - 70) * 0.006;
    temp = clamp(temp - snowRegion * 0.55 + desertRegion * 0.38, 0, 1);
    let humidity = (this.hum.fbm2(x * 0.00085, (z + 5000) * 0.00085, 3) + 1) * 0.5;
    humidity = clamp(humidity + jungleRegion * 0.35 + swampRegion * 0.4 - desertRegion * 0.45, 0, 1);
    let biome;
    if (height < SEA_LEVEL - 12) biome = BIOME.DEEP_OCEAN;
    else if (height < SEA_LEVEL - 1) biome = BIOME.OCEAN;
    else if (snowRegion > 0.24 && height > 72) biome = BIOME.SNOWY;
    else if (mountain > 0.45 && height > 74) biome = BIOME.MOUNTAINS;
    else if (swampRegion > 0.24) biome = BIOME.SWAMP;
    else if (jungleRegion > 0.24) biome = BIOME.JUNGLE;
    else if (desertRegion > 0.24) biome = BIOME.DESERT;
    else if (villageRegion > 0.28) biome = BIOME.PLAINS;
    else if (height <= SEA_LEVEL + 2 && cont < 0.3) biome = BIOME.BEACH;
    else if (snowRegion > 0.14 || temp < 0.3) biome = humidity > 0.5 ? BIOME.TAIGA : BIOME.SNOWY;
    else if (desertRegion > 0.12 || (temp > 0.68 && humidity < 0.42)) biome = BIOME.DESERT;
    else if (forestRegion > 0.18 || humidity > 0.6) biome = temp < 0.5 ? BIOME.BIRCH : BIOME.FOREST;
    else biome = BIOME.PLAINS;
    return { h: height, biome, distance };
  }
}

function parseElement(catalogEntry) {
  const value = String(catalogEntry.element || '').toLowerCase();
  if (value.includes('fogo')) return 'fire';
  if (value.includes('veneno')) return 'poison';
  if (value.includes('explos')) return 'explosion';
  return null;
}

function createMobAuthority(options) {
  const catalog = new Map(options.catalog.map((entry) => [entry.id, entry]));
  const terrain = new TerrainSampler(options.seed || WORLD_SEED);
  const config = options.config || {};
  const passiveConfig = config.passive || {};
  const hostileConfig = config.hostile || {};
  const despawnConfig = config.despawn || {};
  const activeRadiusChunks = Number(config.activeRadiusChunks) || 6;
  const networkRadiusBlocks = Number(config.networkRadiusBlocks) || 112;
  const hardGlobalCap = Math.max(1, Number(config.hardGlobalCap) || 32);
  const getBlockId = typeof options.getBlockId === 'function' ? options.getBlockId : () => null;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const mobs = new Map();
  const hitCooldowns = new Map();
  let nextId = 1;
  let timer = null;
  let tickNumber = 0;
  let worldTime = 1000;
  let villageInitialized = false;
  let mansionInitialized = false;
  const villageBaseY = terrain.sample(VILLAGE_CENTER.x, VILLAGE_CENTER.z).h;

  // The village generator flattens a 25-block radius around the center on the
  // client. Use that same floor for village entities; sampling the untouched
  // procedural terrain at each spawn point could place some villagers below
  // the generated path or house floor.
  function groundHeightFor(type, x, z) {
    const inVillage = (type === 'villager' || type === 'iron_golem')
      && Math.hypot(x - VILLAGE_CENTER.x, z - VILLAGE_CENTER.z) <= 25;
    return inVillage ? villageBaseY : terrain.sample(x, z).h;
  }

  const villageHouses = [[-14, -12], [14, -12], [-16, 12], [16, 12], [0, -19]];

  // The generated village is deterministic but its generated chunks are not
  // necessarily uploaded to the server before the first mob tick. Mirror the
  // small solid parts of its houses here so villagers cannot walk through a
  // wall during that window. Player-built blocks are checked below from the
  // server's serialized chunk snapshots.
  function generatedVillageSolid(x, y, z) {
    if (Math.hypot(x - VILLAGE_CENTER.x, z - VILLAGE_CENTER.z) > 30) return false;
    for (const [hx, hz] of villageHouses) {
      const dx = Math.floor(x) - (VILLAGE_CENTER.x + hx);
      const dz = Math.floor(z) - (VILLAGE_CENTER.z + hz);
      if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
      const iy = Math.floor(y);
      if (iy >= villageBaseY + 2 && iy <= villageBaseY + 5 && (Math.abs(dx) === 4 || Math.abs(dz) === 4)) {
        const window = iy === villageBaseY + 3 && ((Math.abs(dx) === 4 && Math.abs(dz) <= 2) || (Math.abs(dz) === 4 && Math.abs(dx) <= 2));
        const door = dz === 4 && dx === 0 && iy <= villageBaseY + 3;
        if (!window && !door) return true;
      }
      if (iy === villageBaseY + 6 || iy === villageBaseY + 7) return true;
    }
    return false;
  }

  function entitySpaceClear(mob, x, y, z) {
    const radius = Math.max(0.16, Number(mob.w) || 0.3);
    const minY = Math.floor(y + 0.08), maxY = Math.ceil(y + Math.max(0.35, mob.h) - 0.05);
    const samples = [-radius, 0, radius];
    for (const ox of samples) for (const oz of samples) {
      for (let iy = minY; iy <= maxY; iy++) {
        const id = getBlockId(Math.floor(x + ox), iy, Math.floor(z + oz));
        if ((id !== null && id !== 0) || generatedVillageSolid(x + ox, iy, z + oz)) return false;
      }
    }
    return true;
  }

  function resolveHorizontalMotion(mob, nx, nz, nextY) {
    if (entitySpaceClear(mob, nx, nextY, nz)) return [nx, nz];
    // Preserve natural movement by sliding along a wall instead of freezing
    // whenever only one component of the requested movement is obstructed.
    if (entitySpaceClear(mob, nx, mob.y, mob.z)) return [nx, mob.z];
    if (entitySpaceClear(mob, mob.x, mob.y, nz)) return [mob.x, nz];
    return [mob.x, mob.z];
  }

  function publicState(mob) {
    return {
      id: mob.id, type: mob.type, x: mob.x, y: mob.y, z: mob.z,
      yaw: mob.yaw, health: mob.health, maxHealth: mob.maxHealth,
      state: mob.state, vx: mob.vx, vz: mob.vz, fuse: mob.fuse,
      sheared: mob.sheared, color: mob.color, spawnKind: mob.spawnKind,
      profession: mob.profession || null, villagerLevel: mob.villagerLevel || 0, tradeUses: mob.tradeUses || 0
    };
  }

  function snapshot() { return [...mobs.values()].map(publicState); }
  function stats() { return { totalMobs: mobs.size, maxMobs: hardGlobalCap }; }

  function reportCount(reason) {
    let natural = 0, passive = 0, hostile = 0, structures = 0, command = 0;
    for (const mob of mobs.values()) {
      if (mob.spawnKind === 'natural') natural++;
      if (mob.hostile) hostile++; else passive++;
      if (mob.spawnKind === 'village' || mob.spawnKind === 'mansion' || mob.spawnKind === 'structure') structures++;
      if (mob.spawnKind === 'command') command++;
    }
    log(`[mobs] ${reason}: ${mobs.size}/${hardGlobalCap} no mapa | naturais ${natural} | passivos ${passive} | hostis ${hostile} | estruturas ${structures} | comandos ${command}`);
  }

  function nearbySnapshot(client) {
    if (!client || !client.state) return [];
    return [...mobs.values()]
      .filter((mob) => Math.hypot(client.state.x - mob.x, client.state.z - mob.z) <= networkRadiusBlocks)
      .map(publicState);
  }

  function broadcastMobUpdate() {
    for (const client of options.getPlayers()) {
      if (!client.state) continue;
      const nearby = nearbySnapshot(client);
      options.send(client.ws, { type: 'mob_update', mobs: nearby, nearbyMobs: nearby.length, ...stats(), full: true, serverTime: worldTime });
    }
  }

  function broadcastMobSpawn(mob) {
    for (const client of options.getPlayers()) {
      if (!client.state) continue;
      if (Math.hypot(client.state.x - mob.x, client.state.z - mob.z) <= networkRadiusBlocks) {
        options.send(client.ws, { type: 'mob_spawn', mob: publicState(mob) });
      }
    }
  }

  function spawn(type, x, y, z, spawnKind = 'command', extra = {}) {
    const def = catalog.get(type);
    if (!def) return null;
    if (mobs.size >= hardGlobalCap) return null;
    const sx = Number(x), sz = Number(z);
    if (!Number.isFinite(sx) || !Number.isFinite(sz)) return null;
    const sample = terrain.sample(sx, sz);
    const suppliedY = Number(y);
    const sy = Number.isFinite(suppliedY) ? suppliedY : sample.h + 1;
    const id = `mob-${nextId++}`;
    const mob = {
      id, type, x: sx, y: sy, z: sz, yaw: Math.random() * Math.PI * 2,
      vx: 0, vz: 0, moveX: 0, moveZ: 0,
      health: Number(def.health) || 10, maxHealth: Number(def.health) || 10,
      speed: Math.max(0, Number(def.speed) || 1), damage: Math.max(0, Number(def.damage) || 0),
      element: parseElement(def), hostile: ALWAYS_HOSTILE.has(type), ranged: RANGED.has(type),
      flying: FLYING.has(type), water: WATER.has(type), state: 'idle', stateUntil: Date.now() + randomInt(1000, 3500),
      attackAt: 0, fuse: -1, sheared: false, color: type === 'sheep' ? pick(SHEEP_COLORS) : 'white',
      profession: type === 'villager' ? (extra.profession || pick(VILLAGER_PROFESSIONS)) : null,
      villagerLevel: type === 'villager' ? clamp(Number(extra.villagerLevel) || 1, 1, 5) : 0,
      tradeUses: type === 'villager' ? Math.max(0, Number(extra.tradeUses) || 0) : 0,
      regrowAt: 0, spawnKind, bornAt: Date.now(), targetId: null, ...extra
    };
    mobs.set(id, mob);
    broadcastMobSpawn(mob);
    reportCount(`nasceu ${type}`);
    return mob;
  }

  function spawnStructure(type, x, y, z) {
    const existing = [...mobs.values()].find((mob) => (
      mob.spawnKind === 'structure' && mob.type === type &&
      Math.hypot(mob.x - Number(x), mob.z - Number(z)) < 3
    ));
    return existing || spawn(type, x, y, z, 'structure');
  }

  function remove(mob, reason = 'despawn', killerId = null) {
    if (!mob || !mobs.delete(mob.id)) return;
    for (const key of hitCooldowns.keys()) if (key.endsWith(`:${mob.id}`)) hitCooldowns.delete(key);
    options.broadcast({ type: 'mob_remove', id: mob.id, reason, killerId, mob: publicState(mob) });
    reportCount(`removeu ${mob.type} (${reason})`);
  }

  function clear(reason = 'admin') {
    for (const mob of [...mobs.values()]) remove(mob, reason);
  }

  function validPlayers() {
    return [...options.getPlayers()].filter((client) => client.state && !client.state.dead);
  }

  function nearestPlayer(mob, maxDistance = Infinity, includeCreative = false) {
    let best = null, bestDistance = maxDistance;
    for (const client of validPlayers()) {
      if (!includeCreative && client.state.mode === 'creative') continue;
      const distance = Math.hypot(client.state.x - mob.x, client.state.y - mob.y, client.state.z - mob.z);
      if (distance < bestDistance) { best = client; bestDistance = distance; }
    }
    return best ? { client: best, distance: bestDistance } : null;
  }

  function attackPlayer(mob, target, distance) {
    const now = Date.now();
    const range = mob.ranged ? 16 : (mob.type === 'creeper' ? 3 : 1.9);
    if (distance > range || now < mob.attackAt) return;
    if (mob.type === 'creeper') {
      if (mob.fuse < 0) mob.fuse = 30;
      return;
    }
    mob.attackAt = now + (mob.ranged ? 1800 : 1000);
    const dx = target.state.x - mob.x, dz = target.state.z - mob.z, length = Math.hypot(dx, dz) || 1;
    options.send(target.ws, {
      type: 'mob_attack', mobId: mob.id, mobType: mob.type,
      amount: mob.damage, element: mob.element,
      knockback: [dx / length * 5, 3, dz / length * 5]
    });
  }

  function updateMob(mob, dt) {
    const targetResult = mob.hostile ? nearestPlayer(mob, 28) : null;
    const now = Date.now();
    if (targetResult) {
      const target = targetResult.client, dx = target.state.x - mob.x, dz = target.state.z - mob.z;
      const horizontal = Math.hypot(dx, dz) || 1;
      mob.targetId = target.id; mob.state = 'chase'; mob.yaw = Math.atan2(-dx, -dz);
      if (mob.ranged) {
        if (horizontal < 5) { mob.moveX = -dx / horizontal; mob.moveZ = -dz / horizontal; }
        else if (horizontal > 9) { mob.moveX = dx / horizontal; mob.moveZ = dz / horizontal; }
        else { mob.moveX = -dz / horizontal * 0.55; mob.moveZ = dx / horizontal * 0.55; }
      } else { mob.moveX = dx / horizontal; mob.moveZ = dz / horizontal; }
      attackPlayer(mob, target, targetResult.distance);
    } else {
      mob.targetId = null;
      if (now >= mob.stateUntil) {
        if (mob.state === 'wander') {
          mob.state = 'idle'; mob.moveX = 0; mob.moveZ = 0; mob.stateUntil = now + randomInt(1000, 4000);
        } else {
          const angle = Math.random() * Math.PI * 2;
          mob.state = 'wander'; mob.moveX = Math.sin(angle); mob.moveZ = Math.cos(angle);
          mob.yaw = Math.atan2(-mob.moveX, -mob.moveZ); mob.stateUntil = now + randomInt(1800, 5000);
        }
      }
    }

    if (mob.type === 'creeper' && mob.fuse >= 0) {
      if (!targetResult || targetResult.distance > 6) mob.fuse = -1;
      else if (--mob.fuse <= 0) {
        options.send(targetResult.client.ws, { type: 'mob_attack', mobId: mob.id, mobType: mob.type, amount: mob.damage, element: 'explosion', knockback: [0, 5, 0] });
        options.broadcast({ type: 'mob_explode', id: mob.id, x: mob.x, y: mob.y, z: mob.z });
        remove(mob, 'exploded');
        return;
      }
    }

    const moving = mob.fuse < 0 && (mob.state === 'wander' || mob.state === 'chase');
    const speed = moving ? mob.speed * (mob.hostile ? 0.72 : 0.55) : 0;
    let nx = mob.x + mob.moveX * speed * dt, nz = mob.z + mob.moveZ * speed * dt;
    const nextSample = terrain.sample(nx, nz), currentSample = terrain.sample(mob.x, mob.z);
    const nextGround = groundHeightFor(mob.type, nx, nz), currentGround = groundHeightFor(mob.type, mob.x, mob.z);
    const canMove = mob.water ? nextSample.h < SEA_LEVEL : (nextGround >= SEA_LEVEL - 1 && Math.abs(nextGround - currentGround) <= 2);
    if (canMove && !mob.flying) {
      [nx, nz] = resolveHorizontalMotion(mob, nx, nz, nextGround + (mob.water ? 2 : 1));
    }
    if (!canMove || nextSample.distance > 355) {
      // Do not turn every server tick while blocked. That made the client
      // interpolate between alternating yaws and rendered mobs spinning in place.
      mob.moveX = 0; mob.moveZ = 0; mob.state = 'idle';
      mob.stateUntil = now + randomInt(900, 2200);
      nx = mob.x; nz = mob.z;
    }
    mob.vx = (nx - mob.x) / Math.max(dt, 0.001); mob.vz = (nz - mob.z) / Math.max(dt, 0.001);
    mob.x = nx; mob.z = nz;
    const ground = groundHeightFor(mob.type, mob.x, mob.z) + 1;
    if (mob.water) mob.y = Math.min(SEA_LEVEL - 1, ground + 1);
    else if (mob.flying) mob.y += (ground + (mob.type === 'phantom' ? 10 : 3) - mob.y) * Math.min(1, dt * 2);
    else mob.y = ground;

    if (mob.type === 'sheep' && mob.sheared && mob.regrowAt && now >= mob.regrowAt) {
      mob.sheared = false; mob.regrowAt = 0;
    }
  }

  function spawnNearPlayer(hostile) {
    const players = validPlayers();
    if (!players.length) return;
    const player = pick(players);
    const rules = hostile ? hostileConfig : passiveConfig;
    const localCapRadius = Number(rules.localCapRadius) || 64;
    const localCap = Number(rules.localCap) || (hostile ? 10 : 8);
    const nearbyNaturalCount = [...mobs.values()].filter((mob) => (
      mob.spawnKind === 'natural' &&
      (hostile ? mob.hostile : !mob.hostile) &&
      Math.hypot(player.state.x - mob.x, player.state.z - mob.z) <= localCapRadius
    )).length;
    if (nearbyNaturalCount >= localCap) return;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = randomInt(Number(rules.minDistance) || 26, Number(rules.maxDistance) || 60);
      const x = Math.floor(player.state.x + Math.cos(angle) * distance);
      const z = Math.floor(player.state.z + Math.sin(angle) * distance);
      const playerChunkX = Math.floor(player.state.x / 16), playerChunkZ = Math.floor(player.state.z / 16);
      const spawnChunkX = Math.floor(x / 16), spawnChunkZ = Math.floor(z / 16);
      if (Math.max(Math.abs(spawnChunkX - playerChunkX), Math.abs(spawnChunkZ - playerChunkZ)) > activeRadiusChunks) continue;
      const sample = terrain.sample(x, z);
      if (sample.distance >= 660) continue;
      const minSpacing = Number(rules.minSpacing) || (hostile ? 8 : 10);
      if ([...mobs.values()].some((mob) => Math.hypot(mob.x - (x + 0.5), mob.z - (z + 0.5)) < minSpacing)) continue;
      const configuredPools = rules.pools || {};
      const fallbackPools = hostile ? HOSTILE_POOLS : PASSIVE_POOLS;
      const pool = configuredPools[String(sample.biome)] || (hostile ? configuredPools.default : null) || fallbackPools[sample.biome] || (hostile ? fallbackPools.default : null);
      if (!pool || !pool.length) continue;
      const type = pick(pool);
      const chunkMobCount = [...mobs.values()].filter((mob) => Math.floor(mob.x / 16) === spawnChunkX && Math.floor(mob.z / 16) === spawnChunkZ && (hostile ? mob.hostile : !mob.hostile)).length;
      const chunkCap = Number(rules.perChunkCap) || (hostile ? 6 : 4);
      if (chunkMobCount >= chunkCap) continue;
      const ground = terrain.sample(x, z);
      spawn(type, x + 0.5, ground.h + 1, z + 0.5, 'natural');
      return;
    }
  }

  function ensureStructures(players) {
    if (!villageInitialized) {
      villageInitialized = true;
      const spots = [
        [-3, 32, 'farmer'], [3, 32, 'librarian'], [-8, 40, 'armorer'],
        [8, 40, 'toolsmith'], [-8, 48, 'cleric'], [8, 48, 'fletcher']
      ];
      for (const [x, z, profession] of spots) spawn('villager', x + 0.5, villageBaseY + 1, z + 0.5, 'village', { profession });
      spawn('iron_golem', 0.5, villageBaseY + 1, 40.5, 'village');
    }
    const nearMansion = players.some((client) => Math.hypot(client.state.x - MANSION_CENTER.x, client.state.z - MANSION_CENTER.z) < 110);
    if (nearMansion && !mansionInitialized) {
      mansionInitialized = true;
      const guards = ['pillager', 'pillager', 'pillager', 'pillager', 'vindicator', 'evoker'];
      guards.forEach((type, index) => {
        const x = MANSION_CENTER.x - 12 + (index % 3) * 12, z = MANSION_CENTER.z - 8 + Math.floor(index / 3) * 14;
        spawn(type, x + 0.5, terrain.sample(x, z).h + 2, z + 0.5, 'mansion');
      });
    }
  }

  function tick() {
    tickNumber++;
    const tickMs = Number(config.tickMs) || 50;
    worldTime = (worldTime + tickMs / 50) % 24000;
    const players = validPlayers();
    if (!players.length) {
      for (const mob of [...mobs.values()]) if (mob.spawnKind === 'natural' && Date.now() - mob.bornAt > (Number(despawnConfig.minimumAgeMs) || 30000)) remove(mob, 'despawn');
      return;
    }
    ensureStructures(players);
    for (const mob of [...mobs.values()]) {
      updateMob(mob, tickMs / 1000);
      if (!mobs.has(mob.id) || mob.spawnKind !== 'natural') continue;
      const nearest = nearestPlayer(mob, Number(despawnConfig.distance) || 120, true);
      if (!nearest && Date.now() - mob.bornAt > (Number(despawnConfig.minimumAgeMs) || 30000)) remove(mob, 'despawn');
    }
    if (tickNumber % (Number(passiveConfig.everyTicks) || 60) === 0) {
      const passiveCount = [...mobs.values()].filter((mob) => !mob.hostile && mob.spawnKind === 'natural').length;
      if (passiveCount < (Number(passiveConfig.cap) || 22)) spawnNearPlayer(false);
    }
    const night = worldTime >= (Number(hostileConfig.nightStart) || 12500) && worldTime <= (Number(hostileConfig.nightEnd) || 23000);
    if (night && tickNumber % (Number(hostileConfig.everyTicks) || 40) === 0) {
      const hostileCount = [...mobs.values()].filter((mob) => mob.hostile && mob.spawnKind === 'natural').length;
      if (hostileCount < (Number(hostileConfig.cap) || 32)) spawnNearPlayer(true);
    }
    if (tickNumber % (Number(config.broadcastEveryTicks) || 2) === 0) broadcastMobUpdate();
  }

  function handleHit(client, message) {
    const mob = mobs.get(String(message.mobId || ''));
    if (!mob || !client.state || client.state.dead) return false;
    const now = Date.now(), cooldownKey = `${client.id}:${mob.id}`, last = hitCooldowns.get(cooldownKey) || 0;
    if (now - last < 220) return false;
    const source = ['arrow', 'explosion', 'player'].includes(String(message.source || '')) ? String(message.source) : 'player';
    const maxDistance = source === 'arrow' ? 64 : source === 'explosion' ? 16 : 6.5;
    const distance = Math.hypot(client.state.x - mob.x, client.state.y - mob.y, client.state.z - mob.z);
    if (distance > maxDistance) return false;
    hitCooldowns.set(cooldownKey, now);
    const amount = clamp(Number(message.amount) || 1, 0.1, 30);
    mob.health = Math.max(0, mob.health - amount);
    mob.state = 'flee'; mob.stateUntil = now + 2500;
    const dx = mob.x - client.state.x, dz = mob.z - client.state.z, length = Math.hypot(dx, dz) || 1;
    mob.moveX = dx / length; mob.moveZ = dz / length;
    options.broadcast({ type: 'mob_hurt', id: mob.id, health: mob.health, amount, attackerId: client.id });
    if (mob.health <= 0) remove(mob, 'killed', client.id);
    return true;
  }

  function handleAction(client, message) {
    const mob = mobs.get(String(message.mobId || ''));
    if (!mob || !client.state) return false;
    if (Math.hypot(client.state.x - mob.x, client.state.y - mob.y, client.state.z - mob.z) > 6.5) return false;
    if (message.action === 'trade' && mob.type === 'villager') {
      mob.tradeUses = Math.max(0, Number(mob.tradeUses) || 0) + 1;
      mob.villagerLevel = clamp(1 + Math.floor(mob.tradeUses / 5), 1, 5);
      for (const clientEntry of options.getPlayers()) {
        if (clientEntry.state && Math.hypot(clientEntry.state.x - mob.x, clientEntry.state.z - mob.z) <= networkRadiusBlocks) {
          options.send(clientEntry.ws, { type: 'mob_update', mobs: [publicState(mob)] });
        }
      }
      return true;
    }
    if (message.action === 'shear' && mob.type === 'sheep' && !mob.sheared) {
      mob.sheared = true; mob.regrowAt = Date.now() + randomInt(60000, 120000);
      for (const clientEntry of options.getPlayers()) {
        if (clientEntry.state && Math.hypot(clientEntry.state.x - mob.x, clientEntry.state.z - mob.z) <= networkRadiusBlocks) {
          options.send(clientEntry.ws, { type: 'mob_update', mobs: [publicState(mob)] });
        }
      }
      options.send(client.ws, { type: 'mob_action_result', action: 'shear', mobId: mob.id, color: mob.color, count: randomInt(1, 3) });
      return true;
    }
    return false;
  }

  function start() {
    if (timer) return;
    reportCount('sistema iniciado');
    timer = setInterval(tick, Number(config.tickMs) || 50);
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function setTime(value) { if (Number.isFinite(Number(value))) worldTime = ((Math.floor(Number(value)) % 24000) + 24000) % 24000; }

  return { start, stop, snapshot, snapshotFor: nearbySnapshot, stats, spawn, spawnStructure, clear, handleHit, handleAction, setTime, terrain };
}

module.exports = { createMobAuthority, TerrainSampler, BIOME };
