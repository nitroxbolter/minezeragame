const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { URL } = require('node:url');

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const WebSocket = require('ws');
const { helpText, parseAdminCommand, MOB_TYPES } = require('./admin-commands');
const MOB_SOUND_SPECS = require('./assets/mob-sounds-26.2');
const { NATURALIST_MOBS, NATURALIST_SOUND_SPECS } = require('./assets/naturalist-mobs');
const { createMobAuthority } = require('./server-mobs');
const MOB_SPAWN_CONFIG = require('./config/mob-spawn.json');

const ROOT = __dirname;
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT || '8765', 10);
const SESSION_COOKIE = 'minezera_sid';
const SESSION_TTL_MS = Number.parseInt(process.env.SESSION_TTL_HOURS || '168', 10) * 60 * 60 * 1000;
const PUBLIC_BASE_PATH = normalizeBasePath(process.env.PUBLIC_BASE_PATH || '');
const DEFAULT_SPAWN = { x: 16.32, y: 71, z: 31.11 };
// The world is authoritative on the Node server. Clients only send changed
// chunk snapshots; this version must match the client world format.
const WORLD_PAYLOAD_VERSION = 5;
const WORLD_STORAGE_PATH = path.join(ROOT, 'storage', 'world', 'world.json');
const WORLD_AUTOSAVE_MS = 60 * 1000;
const WORLD_DEFAULT_SEED = 'minezera-ilha-biomas-v5-1500-vila';

const worldStore = {
  version: WORLD_PAYLOAD_VERSION,
  seed: WORLD_DEFAULT_SEED,
  time: 1000,
  day: 0,
  mode: 'survival',
  raining: false,
  chunks: new Map(),
  blockCache: new Map(),
  dirty: false,
  savePromise: Promise.resolve()
};

function worldChunkKey(cx, cz) { return `${Number(cx) | 0},${Number(cz) | 0}`; }

function validWorldChunk(chunk) {
  return chunk && Number.isInteger(Number(chunk.cx)) && Number.isInteger(Number(chunk.cz))
    && Array.isArray(chunk.b) && Array.isArray(chunk.m);
}

function worldPayload() {
  return {
    version: worldStore.version,
    seed: worldStore.seed,
    time: worldStore.time,
    day: worldStore.day,
    mode: worldStore.mode,
    raining: worldStore.raining,
    chunks: [...worldStore.chunks.values()]
  };
}

async function loadWorldStore() {
  try {
    const raw = await fs.promises.readFile(WORLD_STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const payload = parsed && parsed.world ? parsed.world : parsed;
    if (!payload || payload.version !== WORLD_PAYLOAD_VERSION || !Array.isArray(payload.chunks)) {
      console.warn('[world] arquivo ignorado: versao invalida ou formato antigo.');
      return;
    }
    worldStore.seed = String(payload.seed || WORLD_DEFAULT_SEED);
    worldStore.time = Number(payload.time) || 1000;
    worldStore.day = Number(payload.day) || 0;
    worldStore.mode = payload.mode === 'creative' ? 'creative' : 'survival';
    worldStore.raining = !!payload.raining;
    worldStore.chunks.clear();
    worldStore.blockCache.clear();
    for (const chunk of payload.chunks) if (validWorldChunk(chunk)) worldStore.chunks.set(worldChunkKey(chunk.cx, chunk.cz), chunk);
    console.log(`[world] carregado do servidor: ${worldStore.chunks.size} chunks modificados.`);
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[world] falha ao carregar:', err.message);
  }
}

function saveWorldStore(force = false) {
  if (!force && !worldStore.dirty) return worldStore.savePromise;
  const snapshot = JSON.stringify({ ok: true, world: worldPayload() });
  worldStore.dirty = false;
  worldStore.savePromise = worldStore.savePromise
    .catch(() => {})
    .then(async () => {
      await fs.promises.mkdir(path.dirname(WORLD_STORAGE_PATH), { recursive: true });
      await fs.promises.writeFile(WORLD_STORAGE_PATH, snapshot, 'utf8');
      console.log(`[world] salvo no servidor: ${worldStore.chunks.size} chunks modificados.`);
    })
    .catch((err) => { worldStore.dirty = true; console.error('[world] falha ao salvar:', err.message); });
  return worldStore.savePromise;
}

function acceptWorldChunk(chunk) {
  if (!validWorldChunk(chunk)) return false;
  const normalized = {
    ...chunk,
    cx: Number(chunk.cx) | 0,
    cz: Number(chunk.cz) | 0,
    b: chunk.b.slice(),
    m: chunk.m.slice(),
    t: Array.isArray(chunk.t) ? chunk.t : [],
    bio: Array.isArray(chunk.bio) ? chunk.bio.slice() : []
  };
  if (normalized.b.length > 131072 || normalized.m.length > 131072) return false;
  worldStore.chunks.set(worldChunkKey(normalized.cx, normalized.cz), normalized);
  worldStore.blockCache.delete(worldChunkKey(normalized.cx, normalized.cz));
  worldStore.dirty = true;
  return normalized;
}

// Chunk snapshots use the same [block, run] RLE as the browser. Mobs need a
// cheap solid-block lookup on the authoritative server so they cannot walk
// through player-built walls or structures received from a client.
function worldBlockId(x, y, z) {
  const iy = Number(y) | 0;
  if (iy < 0 || iy >= 128) return 0;
  const cx = Math.floor(Number(x) / 16), cz = Math.floor(Number(z) / 16);
  const chunk = worldStore.chunks.get(worldChunkKey(cx, cz));
  if (!chunk) return null;
  const key = worldChunkKey(cx, cz);
  let blocks = worldStore.blockCache.get(key);
  if (!blocks) {
    blocks = new Uint8Array(16 * 128 * 16);
    let offset = 0;
    for (let i = 0; i < chunk.b.length && offset < blocks.length; i += 2) {
      const value = Number(chunk.b[i]) || 0;
      const run = Math.max(0, Number(chunk.b[i + 1]) || 0);
      blocks.fill(value, offset, Math.min(blocks.length, offset + run));
      offset += run;
    }
    worldStore.blockCache.set(key, blocks);
  }
  const lx = ((Math.floor(Number(x)) % 16) + 16) % 16;
  const lz = ((Math.floor(Number(z)) % 16) + 16) % 16;
  return blocks[(lx << 11) | (lz << 7) | iy] || 0;
}

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'minezera',
  charset: process.env.DB_CHARSET || 'utf8mb4',
  waitForConnections: true,
  connectionLimit: Number.parseInt(process.env.DB_POOL_LIMIT || '10', 10)
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const CLASSES = {
  0: 'Guerreiro',
  1: 'Lenhador',
  2: 'Minerador',
  3: 'Fazendeiro',
  4: 'Artesao'
};

const PLAYER_SKINS = {
  security: 'security-guard-green.png',
  pearson: 'swag-24334585.png',
  sayori: 'sayori-ddlc-eye-tweak-2.png',
  clouds: 'clouds-24335191.png'
};

const ADMIN_MOB_CATALOG = [
  { id: 'pig', name: 'Porco', kind: 'Passivo', health: 10, damage: 0, element: 'Nenhum', speed: 1.6, spawn: 'Geração natural' },
  { id: 'cow', name: 'Vaca', kind: 'Passivo', health: 10, damage: 0, element: 'Nenhum', speed: 1.5, spawn: 'Geração natural' },
  { id: 'sheep', name: 'Ovelha', kind: 'Passivo', health: 8, damage: 0, element: 'Nenhum', speed: 1.5, spawn: 'Geração natural' },
  { id: 'chicken', name: 'Galinha', kind: 'Passivo', health: 4, damage: 0, element: 'Nenhum', speed: 1.7, spawn: 'Geração natural' },
  { id: 'zombie', name: 'Zumbi', kind: 'Hostil', health: 20, damage: 3, element: 'Nenhum', speed: 2.4, spawn: 'Escuridão e spawner' },
  { id: 'skeleton', name: 'Esqueleto', kind: 'Hostil à distância', health: 20, damage: 3, element: 'Nenhum', speed: 2.6, spawn: 'Escuridão e spawner' },
  { id: 'creeper', name: 'Creeper', kind: 'Hostil explosivo', health: 20, damage: 12, element: 'Explosão', speed: 2.6, spawn: 'Escuridão' },
  { id: 'villager', name: 'Aldeão', kind: 'Passivo / trading', health: 20, damage: 0, element: 'Nenhum', speed: 1.25, spawn: 'Vila central' },
  { id: 'pillager', name: 'Pillager', kind: 'Hostil à distância', health: 24, damage: 4, element: 'Nenhum', speed: 2.4, spawn: 'Mansão dos pillagers' },
  { id: 'wolf', name: 'Lobo', kind: 'Domesticável', health: 12, damage: 0, element: 'Nenhum', speed: 2.5, spawn: 'Geração de fauna 26.2' },
  { id: 'cat', name: 'Gato', kind: 'Domesticável', health: 10, damage: 0, element: 'Nenhum', speed: 2.8, spawn: 'Geração de fauna 26.2' },
  { id: 'horse', name: 'Cavalo', kind: 'Montaria', health: 24, damage: 0, element: 'Nenhum', speed: 4.2, spawn: 'Geração de fauna 26.2' },
  { id: 'bee', name: 'Abelha', kind: 'Passivo / colmeia', health: 10, damage: 0, element: 'Nenhum', speed: 2.6, spawn: 'Geração de fauna 26.2' },
  { id: 'zombie_villager', name: 'Aldeão zumbi', kind: 'Hostil', health: 20, damage: 3, element: 'Nenhum', speed: 2.35, spawn: 'Escuridão' },
  { id: 'husk', name: 'Husk', kind: 'Hostil', health: 20, damage: 3, element: 'Nenhum', speed: 2.4, spawn: 'Escuridão / deserto' },
  { id: 'drowned', name: 'Afogado', kind: 'Hostil à distância', health: 20, damage: 3, element: 'Nenhum', speed: 2.2, spawn: 'Água / escuridão' },
  { id: 'witch', name: 'Bruxa', kind: 'Hostil à distância', health: 26, damage: 3, element: 'Veneno (+2)', speed: 1.8, spawn: 'Escuridão' },
  { id: 'enderman', name: 'Enderman', kind: 'Hostil', health: 40, damage: 7, element: 'Nenhum', speed: 3.2, spawn: 'Escuridão' },
  { id: 'blaze', name: 'Blaze', kind: 'Hostil à distância', health: 20, damage: 5, element: 'Fogo (+3)', speed: 2.2, spawn: 'Nether' },
  { id: 'ghast', name: 'Ghast', kind: 'Hostil à distância', health: 10, damage: 6, element: 'Fogo (+4)', speed: 1.4, spawn: 'Nether' },
  { id: 'spider', name: 'Aranha', kind: 'Hostil', health: 16, damage: 3, element: 'Nenhum', speed: 2.8, spawn: 'Escuridão' },
  { id: 'cave_spider', name: 'Aranha de caverna', kind: 'Hostil', health: 12, damage: 2, element: 'Veneno (+1)', speed: 3, spawn: 'Caverna' },
  { id: 'slime', name: 'Slime', kind: 'Hostil', health: 16, damage: 2, element: 'Nenhum', speed: 1.8, spawn: 'Cavernas' },
  { id: 'magma_cube', name: 'Cubo de magma', kind: 'Hostil', health: 16, damage: 4, element: 'Fogo (+2)', speed: 1.8, spawn: 'Nether' },
  { id: 'silverfish', name: 'Traça', kind: 'Hostil', health: 8, damage: 2, element: 'Nenhum', speed: 2.7, spawn: 'Cavernas' },
  { id: 'guardian', name: 'Guardião', kind: 'Hostil à distância', health: 30, damage: 6, element: 'Nenhum', speed: 2, spawn: 'Água' },
  { id: 'phantom', name: 'Phantom', kind: 'Hostil voador', health: 20, damage: 6, element: 'Nenhum', speed: 3.5, spawn: 'Céu noturno' },
  { id: 'polar_bear', name: 'Urso polar', kind: 'Passivo', health: 30, damage: 6, element: 'Nenhum', speed: 1.8, spawn: 'Gelo' },
  { id: 'rabbit', name: 'Coelho', kind: 'Passivo', health: 3, damage: 0, element: 'Nenhum', speed: 2.4, spawn: 'Geração natural' },
  { id: 'bat', name: 'Morcego', kind: 'Passivo', health: 6, damage: 0, element: 'Nenhum', speed: 2.8, spawn: 'Cavernas' },
  { id: 'iron_golem', name: 'Golem de ferro', kind: 'Neutro', health: 100, damage: 15, element: 'Nenhum', speed: 1.2, spawn: 'Vila central' },
  { id: 'wandering_trader', name: 'Comerciante errante', kind: 'Passivo / trading', health: 20, damage: 0, element: 'Nenhum', speed: 1.25, spawn: 'Geração natural' },
  { id: 'goat', name: 'Cabra', kind: 'Passivo', health: 19, damage: 2, element: 'Nenhum', speed: 2, spawn: 'Montanhas' },
  { id: 'fox', name: 'Raposa', kind: 'Passivo', health: 10, damage: 2, element: 'Nenhum', speed: 2.4, spawn: 'Taiga' },
  { id: 'wither_skeleton', name: 'Esqueleto Wither', kind: 'Hostil', health: 20, damage: 8, element: 'Nenhum', speed: 2.8, spawn: 'Nether' },
  { id: 'piglin', name: 'Piglin', kind: 'Hostil', health: 16, damage: 5, element: 'Nenhum', speed: 2.4, spawn: 'Nether' },
  { id: 'ravager', name: 'Ravager', kind: 'Hostil', health: 100, damage: 12, element: 'Nenhum', speed: 1.5, spawn: 'Invasão' },
  { id: 'vex', name: 'Vex', kind: 'Hostil voador', health: 14, damage: 5, element: 'Nenhum', speed: 3.5, spawn: 'Evocador' },
  { id: 'illusioner', name: 'Illusioner', kind: 'Hostil à distância', health: 32, damage: 4, element: 'Nenhum', speed: 2.5, spawn: 'Invasão' },
  { id: 'evoker', name: 'Evoker', kind: 'Hostil à distância', health: 24, damage: 6, element: 'Nenhum', speed: 2, spawn: 'Invasão' },
  { id: 'vindicator', name: 'Vindicator', kind: 'Hostil', health: 24, damage: 7, element: 'Nenhum', speed: 2.5, spawn: 'Invasão' },
  { id: 'wither', name: 'Wither', kind: 'Hostil voador', health: 300, damage: 8, element: 'Explosão', speed: 1.2, spawn: 'Estrutura de almas' },
  ...Object.values(NATURALIST_MOBS).map((mob) => ({
    id: mob.id, name: mob.name, kind: mob.damage > 0 ? 'Hostil' : 'Passivo',
    health: mob.health, damage: mob.damage, element: mob.element || 'Nenhum', speed: mob.speed,
    spawn: 'Naturalist 2.0.3', naturalist: true
  }))
];

const ADMIN_MOB_IMAGES = Object.freeze({
  pig: 'pig_temperate.png', cow: 'cow_temperate.png', sheep: 'sheep.png', chicken: 'chicken_temperate.png',
  zombie: 'zombie.png', skeleton: 'skeleton.png', creeper: 'creeper.png', villager: 'villager.png',
  pillager: 'pillager.png', wolf: 'wolf_woods.png', cat: 'cat_tabby.png', horse: 'horse_brown.png', bee: 'bee.png',
  zombie_villager: 'zombie_villager.png', husk: 'husk.png', drowned: 'drowned.png', witch: 'witch.png',
  enderman: 'enderman.png', blaze: 'blaze.png', ghast: 'ghast.png', spider: 'spider.png', cave_spider: 'cave_spider.png',
  slime: 'slime.png', magma_cube: 'magmacube.png', silverfish: 'silverfish.png', guardian: 'guardian.png',
  phantom: 'phantom.png', polar_bear: 'polarbear.png', rabbit: 'rabbit_white.png', bat: 'bat.png',
  iron_golem: 'iron_golem.png', wandering_trader: 'wandering_trader.png', goat: 'goat.png', fox: 'fox.png',
  wither_skeleton: 'wither_skeleton.png', wither: 'wither.png', piglin: 'piglin.png', ravager: 'ravager.png', vex: 'vex.png',
  illusioner: 'illusioner.png', evoker: 'evoker.png', vindicator: 'vindicator.png',
  ...Object.fromEntries(Object.values(NATURALIST_MOBS).map((mob) => [mob.id, mob.image]))
});
const ADMIN_MOB_SOUNDS = Object.freeze(Object.fromEntries(Object.entries({ ...MOB_SOUND_SPECS, ...NATURALIST_SOUND_SPECS }).map(([mob, events]) => [
  mob,
  Object.entries(events).map(([event, sounds]) => `${event}: ${sounds.map(sound => String(sound).endsWith('.ogg') ? sound : `${sound}.ogg`).join(', ')}`).join(' | ')
])));

let pool;
const sessions = new Map();
const sockets = new Map();
const adminConsoleClients = new Set();
const consoleBuffer = [];
const MAX_CONSOLE_LINES = 300;
const MAX_CHAT_LENGTH = 180;
const CHAT_COOLDOWN_MS = 250;
const GAME_STATE_PATH = path.join(ROOT, 'storage', 'game-state.json');

function rememberConsole(level, args) {
  const line = `[${new Date().toISOString()}] ${args.map((arg) => {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === 'string') return arg;
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }).join(' ')}`;
  consoleBuffer.push(line);
  while (consoleBuffer.length > MAX_CONSOLE_LINES) consoleBuffer.shift();
  for (const ws of adminConsoleClients) safeSend(ws, { type: 'console', line });
}

const nativeLog = console.log.bind(console);
const nativeError = console.error.bind(console);
console.log = (...args) => { rememberConsole('log', args); nativeLog(...args); };
console.error = (...args) => { rememberConsole('error', args); nativeError(...args); };

function normalizeBasePath(value) {
  const clean = String(value || '').trim().replace(/\/+$/, '');
  if (!clean || clean === '/') return '';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function appUrl(pathname) {
  const p = String(pathname || '/');
  return `${PUBLIC_BASE_PATH}${p.startsWith('/') ? p : `/${p}`}` || '/';
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeChatText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LENGTH);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...headers
  });
  res.end(body);
}

function sendHtml(res, body, status = 200) {
  send(res, status, body, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
}

function sendJson(res, body, status = 200) {
  send(res, status, JSON.stringify(body) + '\n', { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
}

function redirect(res, location) {
  send(res, 302, '', { Location: appUrl(location), 'Cache-Control': 'no-store' });
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cookieHeader(id, maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)) {
  return `${SESSION_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function createSession(contaId) {
  const id = newToken();
  const csrf = newToken();
  sessions.set(id, { contaId, csrf, expiresAt: Date.now() + SESSION_TTL_MS });
  return { id, csrf };
}

function getSession(req) {
  const id = parseCookies(req)[SESSION_COOKIE];
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { id, ...session };
}

function destroySession(req, res) {
  const id = parseCookies(req)[SESSION_COOKIE];
  if (id) sessions.delete(id);
  res.setHeader('Set-Cookie', cookieHeader('', 0));
}

async function db() {
  if (!pool) pool = mysql.createPool(DB_CONFIG);
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await (await db()).execute(sql, params);
  return rows;
}

async function migrateDatabase() {
  const columns = await query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'contas'
       AND COLUMN_NAME = 'tipo'`
  );
  if (!Number(columns[0].total)) {
    await query('ALTER TABLE contas ADD COLUMN tipo TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER senha_hash');
    console.log('[db] coluna contas.tipo criada');
  }
  const skinColumns = await query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'personagens'
       AND COLUMN_NAME = 'skin_id'`
  );
  if (!Number(skinColumns[0].total)) {
    await query("ALTER TABLE personagens ADD COLUMN skin_id VARCHAR(20) NOT NULL DEFAULT 'security' AFTER hotbar");
    console.log('[db] coluna personagens.skin_id criada');
  }
  const spawnColumns = ['spawn_x', 'spawn_y', 'spawn_z'];
  for (const column of spawnColumns) {
    const exists = await query(
      `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'personagens'
         AND COLUMN_NAME = ?`,
      [column]
    );
    if (!Number(exists[0].total)) {
      await query(`ALTER TABLE personagens ADD COLUMN ${column} DOUBLE NULL`);
      console.log(`[db] coluna ${column} criada`);
    }
  }
  await query('UPDATE personagens SET spawn_x = COALESCE(spawn_x, pos_x), spawn_y = COALESCE(spawn_y, pos_y), spawn_z = COALESCE(spawn_z, pos_z) WHERE spawn_x IS NULL OR spawn_y IS NULL OR spawn_z IS NULL');
  await query(`CREATE TABLE IF NOT EXISTS minezera_meta (
    meta_key VARCHAR(80) NOT NULL PRIMARY KEY,
    meta_value VARCHAR(255) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const villageReset = await query('SELECT meta_value FROM minezera_meta WHERE meta_key = ?', ['village-spawn-v2']);
  if (!villageReset.length) {
    const result = await query('UPDATE personagens SET pos_x = NULL, pos_y = NULL, pos_z = NULL, spawn_x = NULL, spawn_y = NULL, spawn_z = NULL');
    await query('INSERT INTO minezera_meta (meta_key, meta_value) VALUES (?, ?)', ['village-spawn-v2', new Date().toISOString()]);
    console.log(`[db] posições resetadas para a vila central: ${result.affectedRows} personagens`);
  }
}

async function currentUser(req) {
  const session = getSession(req);
  if (!session) return null;
  if (!session.contaId) return null;
  const rows = await query(
    `SELECT
       c.id AS conta_id,
       c.login,
       c.tipo,
       p.id AS personagem_id,
       p.nome AS personagem_nome,
       p.classe_id,
       p.nivel,
       p.exp,
       p.hp,
       p.hunger,
       p.pos_x,
       p.pos_y,
       p.pos_z,
       p.spawn_x,
       p.spawn_y,
       p.spawn_z,
       p.yaw,
       p.pitch,
       p.inventory_json,
       p.hotbar,
       p.skin_id,
       p.skill_lenhador,
       p.skill_cooking,
       p.skill_mining,
       p.skill_crafting,
       p.skill_farming,
       p.forca,
       p.kills,
       p.dias_jogados,
       cl.nome AS classe_nome
     FROM contas c
     INNER JOIN personagens p ON p.conta_id = c.id
     INNER JOIN classes cl ON cl.id = p.classe_id
     WHERE c.id = ?`,
    [session.contaId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], csrf: session.csrf };
}

function validLogin(login) {
  return /^[a-zA-Z0-9_]{3,40}$/.test(login);
}

function validCharacterName(name) {
  return /^[a-zA-Z0-9_ ]{3,40}$/.test(name);
}

function validSkinId(value) {
  return Object.hasOwn(PLAYER_SKINS, String(value || ''));
}

function normalizeSkinId(value) {
  return validSkinId(value) ? String(value) : 'security';
}

async function topPlayers() {
  return query(
    `SELECT p.nome, p.nivel, p.exp, p.skin_id
     FROM personagens p
     INNER JOIN contas c ON c.id = p.conta_id
     WHERE COALESCE(c.tipo, 1) <> 3
     ORDER BY p.nivel DESC, p.exp DESC, p.kills DESC, p.atualizado_em ASC
     LIMIT 5`
  );
}

async function readBody(req, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Payload too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readForm(req) {
  const raw = await readBody(req, 128 * 1024);
  return Object.fromEntries(new URLSearchParams(raw));
}

async function readJson(req, limit = 20 * 1024 * 1024) {
  const raw = await readBody(req, limit);
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('JSON invalido'), { statusCode: 400 });
  }
}

function requireCsrf(session, form) {
  const sent = Buffer.from(String(form.csrf_token || ''));
  const expected = Buffer.from(String(session ? session.csrf : ''));
  if (!session || sent.length !== expected.length || !crypto.timingSafeEqual(sent, expected)) {
    throw Object.assign(new Error('Token de seguranca invalido.'), { statusCode: 400 });
  }
}

function renewFormSession(res) {
  const session = createSession(0);
  res.setHeader('Set-Cookie', cookieHeader(session.id));
  return session;
}

function layout(title, content, kind = 'auth') {
  const shell = kind === 'panel' ? 'panel-shell' : 'auth-shell';
  return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(title)}</title>
  <link rel="stylesheet" href="${htmlEscape(appUrl('/login/style.css'))}">
</head>
<body>
  <main class="${shell}">
${content}
  </main>
</body>
</html>`;
}

function alert(error) {
  return error ? `<div class="alert">${htmlEscape(error)}</div>` : '';
}

function isAdmin(user) {
  return Number(user && user.tipo) === 3;
}

function adminOnly(user) {
  if (!user) throw Object.assign(new Error('Login necessario.'), { statusCode: 401 });
  if (!isAdmin(user)) throw Object.assign(new Error('Acesso restrito ao admin.'), { statusCode: 403 });
}

function parseInventory(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function loginPage({ user = null, error = '', csrf = newToken(), ranking = [] } = {}) {
  const rankingRows = ranking.map((player, index) => {
    const skin = PLAYER_SKINS[normalizeSkinId(player.skin_id)];
    return `<li>
      <strong class="ranking-position">#${index + 1}</strong>
      <span class="ranking-skin" style="--player-skin: url('${htmlEscape(appUrl(`/assets/${skin}`))}')" aria-hidden="true"></span>
      <span class="ranking-player">
        <strong>${htmlEscape(player.nome)}</strong>
        <small>Nível ${Number(player.nivel)}</small>
      </span>
    </li>`;
  }).join('');
  const rankingPanel = `
    <aside class="ranking-card" aria-labelledby="ranking-title">
      <div class="ranking-heading">
        <span>Ranking</span>
        <h2 id="ranking-title">Top 5 jogadores</h2>
      </div>
      ${rankingRows ? `<ol class="ranking-list">${rankingRows}</ol>` : '<p class="ranking-empty">Os primeiros jogadores aparecerão aqui.</p>'}
    </aside>`;
  const content = user ? `
    <div class="login-home">
    <section class="auth-card">
      <h1>Minezera</h1>
      <p>Logado como ${htmlEscape(user.login)}.</p>
      <div class="action-stack">
        <a class="button-primary" href="${htmlEscape(appUrl('/game'))}">Abrir jogo</a>
        ${isAdmin(user) ? `<a class="button-secondary" href="${htmlEscape(appUrl('/admin'))}">Painel admin</a>` : ''}
        <a class="button-secondary" href="${htmlEscape(appUrl('/painel'))}">Ver personagem</a>
        <a class="link" href="${htmlEscape(appUrl('/logout'))}">Sair</a>
      </div>
    </section>
    ${rankingPanel}
    </div>` : `
    <div class="login-home">
    <section class="auth-card">
      <h1>Minezera</h1>
      <p>Entre para autenticar sua conta antes de abrir o jogo.</p>
      ${alert(error)}
      <form method="post" autocomplete="on" action="${htmlEscape(appUrl('/login'))}">
        <input type="hidden" name="csrf_token" value="${htmlEscape(csrf)}">
        <label for="login">Login</label>
        <input id="login" name="login" type="text" maxlength="40" required autofocus>
        <label for="senha">Senha</label>
        <input id="senha" name="senha" type="password" required>
        <button type="submit">Entrar</button>
      </form>
      <a class="link" href="${htmlEscape(appUrl('/registrar'))}">Criar uma conta</a>
    </section>
    ${rankingPanel}
    </div>`;
  return layout('Minezera - Login', content);
}

function registerPage({ error = '', csrf = newToken() } = {}) {
  return layout('Minezera - Criar conta', `
    <section class="auth-card">
      <h1>Criar conta</h1>
      <p>Seu personagem ja nasce com os atributos basicos salvos no banco.</p>
      ${alert(error)}
      <form method="post" autocomplete="on" action="${htmlEscape(appUrl('/registrar'))}">
        <input type="hidden" name="csrf_token" value="${htmlEscape(csrf)}">
        <label for="login">Login</label>
        <input id="login" name="login" type="text" maxlength="40" required autofocus>
        <label for="senha">Senha</label>
        <input id="senha" name="senha" type="password" minlength="6" required>
        <label for="confirmar_senha">Confirmar senha</label>
        <input id="confirmar_senha" name="confirmar_senha" type="password" minlength="6" required>
        <label for="personagem">Nome do personagem</label>
        <input id="personagem" name="personagem" type="text" maxlength="40" required>
        <button type="submit">Cadastrar</button>
      </form>
      <a class="link" href="${htmlEscape(appUrl('/'))}">Ja tenho conta</a>
    </section>`);
}

function panelPage(user) {
  const maxHp = 20 + Math.max(0, Number(user.nivel) - 1) * 2;
  let hpAtual = Number(user.hp);
  if (hpAtual > maxHp && hpAtual <= 100) hpAtual = Math.ceil(hpAtual / 5);
  hpAtual = Math.min(hpAtual, maxHp);
  return layout('Minezera - Personagem', `
    <section class="panel-heading">
      <div>
        <span>Conta: ${htmlEscape(user.login)}</span>
        <h1>${htmlEscape(user.personagem_nome)}</h1>
        <p>Classe ${Number(user.classe_id)} - ${htmlEscape(user.classe_nome)}</p>
      </div>
      <div class="panel-actions">
        <a class="button-primary" href="${htmlEscape(appUrl('/game'))}">Abrir jogo</a>
        ${isAdmin(user) ? `<a class="button-secondary" href="${htmlEscape(appUrl('/admin'))}">Painel admin</a>` : ''}
        <a class="button-secondary" href="${htmlEscape(appUrl('/logout'))}">Sair</a>
      </div>
    </section>
    <section class="stats-grid">
      <article><span>Nivel</span><strong>${Number(user.nivel)}</strong></article>
      <article><span>EXP</span><strong>${Number(user.exp)}</strong></article>
      <article><span>HP</span><strong>${hpAtual} / ${maxHp}</strong></article>
      <article><span>Forca</span><strong>${Number(user.forca)}</strong></article>
      <article><span>Kills</span><strong>${Number(user.kills)}</strong></article>
      <article><span>Dias</span><strong>${Number(user.dias_jogados)}</strong></article>
    </section>
    <section class="skills">
      <h2>Skills</h2>
      <div class="skills-list">
        <span>Lenhador <strong>${Number(user.skill_lenhador)}</strong></span>
        <span>Cooking <strong>${Number(user.skill_cooking)}</strong></span>
        <span>Mining <strong>${Number(user.skill_mining)}</strong></span>
        <span>Crafting <strong>${Number(user.skill_crafting)}</strong></span>
        <span>Farming <strong>${Number(user.skill_farming)}</strong></span>
      </div>
    </section>`, 'panel');
}

function runService(action) {
  return new Promise((resolve) => {
    const allowed = new Set(['start', 'stop', 'restart', 'status', 'is-active']);
    if (!allowed.has(action)) return resolve({ ok: false, output: 'Acao invalida.', code: 1 });
    const child = spawn('sudo', ['/usr/bin/systemctl', action, 'minezera'], { shell: false });
    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });
    child.on('close', (code) => resolve({ ok: code === 0, output: output.trim(), code }));
    child.on('error', (err) => resolve({ ok: false, output: err.message, code: 1 }));
  });
}

async function serviceStatus() {
  return await gameServerStatus();
}

function serviceStatusLabel(status) {
  return status === 'active' ? 'Ligado' : 'Desligado';
}

async function isGameServerEnabled() {
  try {
    const raw = await fs.promises.readFile(GAME_STATE_PATH, 'utf8');
    const state = JSON.parse(raw);
    return state.enabled !== false;
  } catch (e) {
    if (e.code === 'ENOENT') return true;
    throw e;
  }
}

async function gameServerStatus() {
  return await isGameServerEnabled() ? 'active' : 'inactive';
}

async function setGameServerEnabled(enabled) {
  await fs.promises.mkdir(path.dirname(GAME_STATE_PATH), { recursive: true });
  await fs.promises.writeFile(GAME_STATE_PATH, JSON.stringify({
    enabled: !!enabled,
    updatedAt: new Date().toISOString()
  }), 'utf8');
  if (!enabled) {
    for (const client of sockets.values()) {
      try { client.ws.close(1012, 'game_server_offline'); } catch (e) { /* ignore */ }
    }
    sockets.clear();
  }
  console.log(`[admin] servidor do jogo ${enabled ? 'ligado' : 'desligado'}.`);
}

function prettifyItemName(name) {
  return String(name).split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function buildItemCatalog() {
  const wool = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
  const woods = ['oak', 'birch', 'spruce'];
  const blocks = [
    'stone', 'granite', 'diorite', 'andesite', 'grass_block', 'dirt', 'cobblestone', 'mossy_cobblestone',
    'stone_bricks', 'sand', 'gravel', 'sandstone', 'bedrock',
    ...woods.flatMap((w) => [`${w}_log`, `${w}_planks`, `${w}_leaves`, `${w}_sapling`]),
    'glass', 'coal_ore', 'iron_ore', 'gold_ore', 'redstone_ore', 'lapis_ore', 'diamond_ore', 'emerald_ore',
    'coal_block', 'iron_block', 'gold_block', 'diamond_block', 'lapis_block', 'redstone_block', 'emerald_block',
    'crafting_table', 'furnace', 'chest', 'torch', 'ladder', ...wool.map((c) => `${c}_wool`),
    'glowstone', 'obsidian', 'tnt', 'bookshelf', 'farmland', 'dirt_path', 'snow', 'snow_block', 'ice',
    'cactus', 'dead_bush', 'short_grass', 'fern', 'dandelion', 'poppy', 'cornflower', 'oxeye_daisy',
    'pumpkin', 'jack_o_lantern', 'soul_sand', 'wither_skeleton_skull', 'spawner', 'netherrack', 'end_stone', 'redstone_torch', 'lever',
    'redstone_lamp', 'oak_door'
  ];
  const materials = ['stick', 'coal', 'charcoal', 'iron_ingot', 'gold_ingot', 'diamond', 'emerald', 'redstone', 'lapis_lazuli', 'glowstone_dust', 'gunpowder', 'flint', 'string', 'feather', 'leather', 'bone', 'book', 'snowball', 'wheat', 'wheat_seeds', 'egg', 'paper', 'sugar'];
  const foods = ['apple', 'bread', 'porkchop', 'cooked_porkchop', 'beef', 'cooked_beef', 'chicken', 'cooked_chicken', 'mutton', 'cooked_mutton', 'rotten_flesh', 'carrot', 'melon_slice'];
  const tiers = ['wooden', 'stone', 'iron', 'golden', 'diamond'];
  const tools = tiers.flatMap((tier) => ['pickaxe', 'axe', 'shovel', 'hoe', 'sword'].map((kind) => `${tier}_${kind}`))
    .concat(['shears', 'flint_and_steel', 'bucket', 'water_bucket', 'lava_bucket', 'bow', 'arrow']);
  const armor = tiers.flatMap((tier) => ['helmet', 'chestplate', 'leggings', 'boots'].map((kind) => `${tier}_${kind}`));
  const byCategory = [
    ['Blocos', blocks],
    ['Materiais', materials],
    ['Comida', foods],
    ['Espadas', tools.filter((id) => id.endsWith('_sword'))],
    ['Machados', tools.filter((id) => id.endsWith('_axe'))],
    ['Pas', tools.filter((id) => id.endsWith('_shovel'))],
    ['Picaretas', tools.filter((id) => id.endsWith('_pickaxe'))],
    ['Enxadas', tools.filter((id) => id.endsWith('_hoe'))],
    ['Outras ferramentas', tools.filter((id) => !/_sword$|_axe$|_shovel$|_pickaxe$/.test(id))],
    ['Armaduras', armor]
  ];
  const seen = new Set();
  return byCategory.flatMap(([category, items]) => items
    .filter((id) => !seen.has(id) && seen.add(id))
    .map((id) => ({ id, name: prettifyItemName(id), category })));
}

const ADMIN_ITEM_CATALOG_BASE = buildItemCatalog();
const ITEM_CATALOG_PATH = path.join(ROOT, 'storage', 'item-catalog.json');

async function readCustomItemCatalog() {
  try {
    const raw = await fs.promises.readFile(ITEM_CATALOG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id).map((item) => {
      // Keep generated resource-pack items in the same admin categories as
      // the base catalog, even when their source JSON only had a generic
      // "Outras ferramentas" category.
      const id = String(item.id);
      const inferredCategory = id.endsWith('_sword') ? 'Espadas'
        : id.endsWith('_axe') ? 'Machados'
          : id.endsWith('_shovel') ? 'Pas'
            : id.endsWith('_pickaxe') ? 'Picaretas'
              : id.endsWith('_hoe') ? 'Enxadas' : null;
      const category = inferredCategory && (!item.category || item.category === 'Outros' || item.category === 'Outras ferramentas')
        ? inferredCategory : (item.category || 'Outros');
      return {
        ...item,
        // Catalogs generated from resource packs may use displayName. The
        // admin UI historically used name, so normalize both forms here.
        name: item.name || item.displayName || item.id,
        category
      };
    }) : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    console.error('Nao foi possivel ler o catalogo personalizado:', e.message);
    return [];
  }
}

async function getAdminItemCatalog() {
  const custom = await readCustomItemCatalog();
  const overrides = new Map(custom.map((item) => [item.id, item]));
  const merged = ADMIN_ITEM_CATALOG_BASE.map((item) => overrides.has(item.id) ? { ...item, ...overrides.get(item.id) } : item);
  const baseIds = new Set(ADMIN_ITEM_CATALOG_BASE.map((item) => item.id));
  return merged.concat(custom.filter((item) => !baseIds.has(item.id)));
}

async function saveCustomItem(item) {
  const custom = await readCustomItemCatalog();
  const index = custom.findIndex((entry) => entry.id === item.id);
  if (index >= 0) custom[index] = item;
  else custom.push(item);
  await fs.promises.mkdir(path.dirname(ITEM_CATALOG_PATH), { recursive: true });
  await fs.promises.writeFile(ITEM_CATALOG_PATH, JSON.stringify(custom, null, 2) + '\n', 'utf8');
}

function itemPreviewClass(item) {
  if (item.category === 'Comida') return 'food';
  if (/Espadas|Machados|Pas|Picaretas|Enxadas|Outras ferramentas|Armaduras/.test(item.category)) return 'tool';
  if (item.category === 'Materiais') return 'material';
  if (item.id.includes('ore') || item.id.includes('stone') || item.id === 'bedrock' || item.id === 'obsidian') return 'stone';
  if (item.id.includes('log') || item.id.includes('planks') || item.id === 'chest' || item.id === 'crafting_table') return 'wood';
  if (item.id.includes('wool')) return 'wool';
  if (item.id.includes('leaf') || item.id.includes('grass') || item.id.includes('sapling') || item.id.includes('fern')) return 'plant';
  return 'block';
}

function itemTier(item) {
  if (item.tier) return item.tier;
  const match = String(item.id).match(/^(wooden|stone|iron|golden|diamond|netherite)_/);
  if (match) return match[1] === 'golden' ? 'Ouro' : match[1][0].toUpperCase() + match[1].slice(1);
  if (item.category !== 'Blocos' && item.category !== 'Materiais') return 'Comum';
  if (item.category === 'Comida') return 'Comida';
  return 'Comum';
}

function itemPreviewUrl(item) {
  if (item.previewUrl) return item.previewUrl;
  const folder = item.category === 'Blocos' ? 'block' : 'item';
  return 'https://assets.mcasset.cloud/1.21.8/assets/minecraft/textures/' + folder + '/' + encodeURIComponent(item.id) + '.png';
}

function adminConsoleBlock() {
  return `<div class="server-console-panel">
      <h2>Console em tempo real</h2>
      <pre id="admin-console" class="admin-console">${htmlEscape(consoleBuffer.join('\n'))}</pre>
      <script>
        const base = ${JSON.stringify(PUBLIC_BASE_PATH)};
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const out = document.getElementById('admin-console');
        const ws = new WebSocket(proto + '//' + location.host + base + '/admin/console');
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === 'snapshot') out.textContent = msg.lines.join('\\n');
          if (msg.type === 'console') out.textContent += (out.textContent ? '\\n' : '') + msg.line;
          out.scrollTop = out.scrollHeight;
        };
      </script>
    </div>`;
}

const ITEM_CATEGORIES = ['Blocos', 'Materiais', 'Comida', 'Espadas', 'Machados', 'Pas', 'Picaretas', 'Enxadas', 'Outras ferramentas', 'Armaduras', 'Outros'];

function itemPreviewMarkup(item, large = false) {
  const size = large ? ' item-preview-large' : '';
  return '<span class="item-preview ' + htmlEscape(itemPreviewClass(item)) + size + '"><img src="' + htmlEscape(itemPreviewUrl(item)) + '" alt="' + htmlEscape(item.name) + '" loading="lazy" onerror="this.hidden=true; this.parentElement.classList.add(\'missing\')"><span class="preview-fallback">' + htmlEscape(item.name[0] || '?') + '</span></span>';
}

function itemTypeOptions(selected) {
  return ['material', 'block', 'food', 'tool', 'weapon'].map((type) => '<option value="' + type + '" ' + (selected === type ? 'selected' : '') + '>' + type + '</option>').join('');
}

function itemCategoryOptions(selected) {
  return ITEM_CATEGORIES.map((category) => '<option value="' + htmlEscape(category) + '" ' + (selected === category ? 'selected' : '') + '>' + htmlEscape(category) + '</option>').join('');
}

async function adminItemsPage(user, { message = '', detailId = '' } = {}) {
  const catalog = await getAdminItemCatalog();
  const selected = detailId ? catalog.find((item) => item.id === detailId) : null;
  if (detailId && !selected) return layout('Item nao encontrado', '<section class="auth-card"><h1>Item nao encontrado</h1><a class="button-secondary" href="' + htmlEscape(appUrl('/admin?tab=itens')) + '">Voltar aos itens</a></section>', 'panel');
  if (detailId) {
    const isCustom = !!selected.custom;
    return layout('Detalhes do item', '<section class="admin-item-detail"><a class="link" href="' + htmlEscape(appUrl('/admin?tab=itens')) + '">Voltar aos itens</a><h1>' + htmlEscape(selected.name) + '</h1><div class="item-detail-preview">' + itemPreviewMarkup(selected, true) + '</div><dl class="item-properties"><dt>ID</dt><dd>' + htmlEscape(selected.id) + '</dd><dt>Nome</dt><dd>' + htmlEscape(selected.name) + '</dd><dt>Categoria</dt><dd>' + htmlEscape(selected.category) + '</dd><dt>Tier</dt><dd>' + htmlEscape(itemTier(selected)) + '</dd><dt>Tipo</dt><dd>' + htmlEscape(selected.type || 'material') + '</dd><dt>Stack maximo</dt><dd>' + Number(selected.stack || 64) + '</dd><dt>Dano</dt><dd>' + Number(selected.damage || 1) + '</dd><dt>Durabilidade</dt><dd>' + Number(selected.durability || 0) + '</dd><dt>Textura</dt><dd>' + htmlEscape(selected.previewUrl || selected.tex || selected.id) + '</dd></dl><p>' + (isCustom ? 'Este item foi criado pelo painel e pode ser editado.' : 'Item base do jogo. Salve uma alteracao para criar uma configuracao personalizada.') + '</p><a class="button-primary" href="' + htmlEscape(appUrl('/admin/item-edit?id=' + encodeURIComponent(selected.id))) + '">Editar item</a></section>', 'panel');
  }
  const grouped = ITEM_CATEGORIES.map((category) => [category, catalog.filter((item) => item.category === category)]).filter(([, items]) => items.length);
  const filter = '<div class="item-filter"><label for="item-search">Pesquisar item</label><input id="item-search" type="search" placeholder="Nome ou ID do item..." autocomplete="off"><label for="item-category-filter">Categoria</label><select id="item-category-filter"><option value="all">Todas</option>' + ITEM_CATEGORIES.map((category) => '<option value="' + htmlEscape(category) + '">' + htmlEscape(category) + '</option>').join('') + '</select></div><script>document.addEventListener("DOMContentLoaded", function () { var search = document.getElementById("item-search"); var select = document.getElementById("item-category-filter"); var sections = Array.from(document.querySelectorAll(".items-category")); function applyFilter() { var term = search.value.trim().toLocaleLowerCase(); sections.forEach(function (section) { var categoryOk = select.value === "all" || section.dataset.category === select.value; var visible = 0; section.querySelectorAll(".item-card").forEach(function (card) { var matches = !term || card.dataset.itemName.indexOf(term) !== -1; card.hidden = !(categoryOk && matches); if (!card.hidden) visible++; }); section.hidden = visible === 0; }); } sections.forEach(function (section) { section.dataset.category = section.querySelector("h3").textContent; }); search.addEventListener("input", applyFilter); select.addEventListener("change", applyFilter); });</script>';
  const grid = grouped.map(([category, items]) => '<section class="items-category"><h3>' + htmlEscape(category) + '</h3><div class="items-grid">' + items.map((item) => '<a class="item-card" data-item-name="' + htmlEscape(String(item.name + ' ' + item.id).toLocaleLowerCase('pt-BR')) + '" href="' + htmlEscape(appUrl('/admin/item?id=' + encodeURIComponent(item.id))) + '">' + itemPreviewMarkup(item) + '<strong>' + htmlEscape(item.name) + '</strong></a>').join('') + '</div></section>').join('');
  return layout('Gerenciador de itens', '<section class="skills admin-items-page"><h1>Gerenciador de itens</h1>' + (message ? '<div class="alert">' + htmlEscape(message) + '</div>' : '') + '<div class="item-page-actions"><a class="button-primary" href="' + htmlEscape(appUrl('/admin/item-new')) + '">Criar novo item</a><a class="button-secondary" href="' + htmlEscape(appUrl('/admin')) + '">Servidor</a></div>' + filter + grid + '</section>', 'panel');
}

async function adminItemEditorPage(user, { item = null, message = '' } = {}) {
  const editing = !!item;
  return layout(editing ? 'Editar item' : 'Criar item', '<section class="skills item-editor"><a class="link" href="' + htmlEscape(appUrl('/admin?tab=itens')) + '">Voltar aos itens</a><h1>' + (editing ? 'Editar item' : 'Criar novo item') + '</h1>' + (message ? '<div class="alert">' + htmlEscape(message) + '</div>' : '') + '<form method="post" action="' + htmlEscape(appUrl('/admin/items/save')) + '" class="item-editor-form"><input type="hidden" name="csrf_token" value="' + htmlEscape(user.csrf) + '"><input type="hidden" name="original_id" value="' + htmlEscape(item ? item.id : '') + '"><label>ID interno<input name="id" required pattern="[a-z0-9_]+" maxlength="50" value="' + htmlEscape(item ? item.id : '') + '"></label><label>Nome exibido<input name="name" required maxlength="80" value="' + htmlEscape(item ? item.name : '') + '"></label><label>Categoria<select name="category">' + itemCategoryOptions(item && item.category) + '</select></label><label>Tipo<select name="type">' + itemTypeOptions(item && item.type) + '</select></label><label>Tier<input name="tier" maxlength="30" placeholder="Comum, Ferro, Diamante" value="' + htmlEscape(item ? item.tier || '' : '') + '"></label><label>Stack maximo<input name="stack" type="number" min="1" max="999" value="' + Number(item ? item.stack || 64 : 64) + '"></label><label>Dano<input name="damage" type="number" min="0" max="999" step="0.5" value="' + Number(item ? item.damage || 1 : 1) + '"></label><label>Durabilidade<input name="durability" type="number" min="0" max="999999" value="' + Number(item ? item.durability || 0 : 0) + '"></label><label>Velocidade<input name="speed" type="number" min="0" max="999" step="0.1" value="' + Number(item ? item.speed || 1 : 1) + '"></label><label>Fome restaurada<input name="hunger" type="number" min="0" max="20" value="' + Number(item ? item.hunger || 0 : 0) + '"></label><label>Saturacao<input name="saturation" type="number" min="0" max="100" step="0.1" value="' + Number(item ? item.saturation || 0 : 0) + '"></label><label>URL da imagem de preview<input name="preview_url" type="url" placeholder="https://.../item.png" value="' + htmlEscape(item ? item.previewUrl || '' : '') + '"></label><button class="button-primary" type="submit">Salvar item</button></form></section>', 'panel');
}

async function adminMobBuilderPage(user) {
  const body = `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script><section class="skills mob-builder-page">
    <div class="mobs-heading"><div><span>Ferramentas do jogo</span><h2>Montador de mobs</h2></div><a class="button-secondary" href="${htmlEscape(appUrl('/admin'))}">Voltar ao admin</a></div>
    <p>Importe uma textura, recorte as partes do atlas e organize a montagem no preview. Tudo fica no navegador até você exportar o JSON.</p>
    <div class="mob-builder-toolbar">
      <label class="builder-file">Importar textura <input id="mob-texture-file" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <label class="builder-file">Importar modelo 3D <input id="mob-model-file" type="file" accept=".json,.geo.json,application/json"></label>
      <label>Nome <input id="mob-name" type="text" value="polar_bear" maxlength="40"></label>
      <label>Largura do atlas <input id="atlas-width" type="number" min="1" value="128"></label>
      <label>Altura do atlas <input id="atlas-height" type="number" min="1" value="64"></label>
      <button id="builder-add" type="button">Adicionar parte</button>
      <button id="builder-duplicate" type="button">Duplicar selecionada</button>
      <button id="builder-remove" type="button">Remover selecionada</button>
      <button id="builder-export" type="button">Exportar JSON</button>
    </div>
    <div class="mob-builder-layout">
      <aside class="builder-parts"><h3>Partes</h3><div id="builder-parts-list"></div></aside>
      <section class="builder-stage-wrap"><div class="builder-stage" id="builder-stage"><div class="builder-empty">Importe uma textura para começar</div></div><div class="builder-stage-help">Arraste uma parte para ajustar X e Y. Use a roda do mouse para zoom.</div><div class="builder-3d-title"><span>Preview 3D</span><div class="builder-3d-controls"><button id="builder-rotate-left" type="button" title="Girar para a esquerda">↶</button><button id="builder-rotate-right" type="button" title="Girar para a direita">↷</button><button id="builder-zoom-out" type="button" title="Afastar">−</button><button id="builder-zoom-in" type="button" title="Aproximar">+</button><button id="builder-reset-view" type="button" title="Restaurar vista">⟳</button></div></div><div class="builder-3d" id="builder-3d"><div class="builder-empty">Importe uma textura para visualizar o modelo</div><canvas id="builder-3d-canvas"></canvas></div></section>
      <aside class="builder-inspector"><h3>Parte selecionada</h3><div id="builder-inspector-empty">Selecione uma parte</div><div id="builder-fields" hidden>
        <label>Nome <input data-field="name" type="text"></label>
        <div class="builder-grid"><label>X <input data-field="x" type="number" step="0.1"></label><label>Y <input data-field="y" type="number" step="0.1"></label><label>Z <input data-field="z" type="number" step="0.1"></label><label>Largura <input data-field="w" type="number" min="1" step="0.1"></label><label>Altura <input data-field="h" type="number" min="1" step="0.1"></label><label>U <input data-field="u" type="number" min="0" step="0.1"></label><label>V <input data-field="v" type="number" min="0" step="0.1"></label><label>Profundidade <input data-field="d" type="number" min="1" step="0.1"></label><label>Rotacao <input data-field="r" type="number" step="1"></label></div>
      </div></aside>
    </div>
    <textarea id="builder-output" class="builder-output" readonly aria-label="JSON exportado"></textarea>
    <script>
      (() => {
        const $ = (id) => document.getElementById(id);
        const stage = $('builder-stage'), list = $('builder-parts-list'), fields = $('builder-fields');
        const empty = $('builder-inspector-empty'), output = $('builder-output');
        let image = null, selected = 0, zoom = 6, parts = [
          { name: 'corpo', x: 34, y: 180, z: 0, w: 150, h: 100, u: 0, v: 19, d: 20, r: 0 },
          { name: 'cabeca', x: 12, y: 125, z: 0, w: 70, h: 70, u: 0, v: 0, d: 7, r: 0 },
          { name: 'focinho', x: 0, y: 165, z: 0, w: 50, h: 30, u: 0, v: 44, d: 3, r: 0 }
        ];
        function atlas() { return { width: Number($('atlas-width').value) || 128, height: Number($('atlas-height').value) || 64 }; }
        let scene3d, camera3d, renderer3d, model3d, texture3d, orbit = { x: 0.6, y: 0.35, distance: 8, drag: null };
        function init3d() {
          if (!window.THREE) return;
          const host = $('builder-3d'), canvas = $('builder-3d-canvas');
          scene3d = new THREE.Scene(); scene3d.background = new THREE.Color(0x101a22);
          camera3d = new THREE.PerspectiveCamera(35, 1, 0.1, 100); renderer3d = new THREE.WebGLRenderer({ canvas, antialias: false }); renderer3d.setPixelRatio(Math.min(devicePixelRatio, 2));
          scene3d.add(new THREE.HemisphereLight(0xffffff, 0x44515a, 1.5)); const light = new THREE.DirectionalLight(0xffffff, 1.2); light.position.set(4, 8, 6); scene3d.add(light);
          model3d = new THREE.Group(); scene3d.add(model3d); const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x17232c })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.5; scene3d.add(floor);
          host.addEventListener('pointerdown', (e) => { orbit.drag = { x: e.clientX, y: e.clientY, ox: orbit.x, oy: orbit.y }; host.setPointerCapture(e.pointerId); }); host.addEventListener('pointermove', (e) => { if (!orbit.drag) return; orbit.x = orbit.drag.ox + (e.clientX - orbit.drag.x) * 0.01; orbit.y = Math.max(-1.2, Math.min(1.2, orbit.drag.oy + (e.clientY - orbit.drag.y) * 0.01)); }); host.addEventListener('pointerup', () => { orbit.drag = null; }); host.addEventListener('wheel', (e) => { e.preventDefault(); orbit.distance = Math.max(3, Math.min(20, orbit.distance + e.deltaY * 0.01)); }, { passive: false });
          const tick = () => { requestAnimationFrame(tick); if (!renderer3d) return; const aspect = host.clientWidth / Math.max(1, host.clientHeight); camera3d.aspect = aspect; camera3d.position.set(Math.sin(orbit.x) * orbit.distance, Math.sin(orbit.y) * orbit.distance, Math.cos(orbit.x) * orbit.distance); camera3d.lookAt(0, 0, 0); renderer3d.setSize(host.clientWidth, host.clientHeight, false); renderer3d.render(scene3d, camera3d); }; tick();
        }
        function render3d() {
          if (!model3d || !window.THREE) return; while (model3d.children.length) { const child = model3d.children.pop(); child.geometry?.dispose(); if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose()); else child.material?.dispose(); }
          if (image) { texture3d = texture3d || new THREE.TextureLoader().load(image, render3d); texture3d.magFilter = texture3d.minFilter = THREE.NearestFilter; }
          const a = atlas(); parts.forEach((p) => { const map = texture3d ? texture3d.clone() : null; if (map) { map.needsUpdate = true; map.magFilter = map.minFilter = THREE.NearestFilter; map.repeat.set(p.w / a.width, p.h / a.height); map.offset.set(p.u / a.width, 1 - (p.v + p.h) / a.height); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping; } const material = new THREE.MeshLambertMaterial({ color: 0xffffff, map, transparent: true, alphaTest: 0.05 }); const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.w / 16, p.h / 16, Math.max(1, p.d) / 16), material); if (p.world) mesh.position.set((p.x + p.w / 2) / 16, (p.y + p.h / 2) / 16, (p.z + p.d / 2) / 16); else mesh.position.set((p.x + p.w / 2 - a.width / 2) / 16, (a.height * 3 - p.y - p.h / 2) / 16, p.z / 16); mesh.rotation.z = p.r * Math.PI / 180; model3d.add(mesh); });
          model3d.position.set(0, 0, 0); model3d.scale.set(1, 1, 1); const bounds = new THREE.Box3().setFromObject(model3d); const center = bounds.getCenter(new THREE.Vector3()); const size = bounds.getSize(new THREE.Vector3()); model3d.position.sub(center); model3d.scale.setScalar(4 / Math.max(size.x, size.y, size.z, 1));
        }
        function render() {
          list.innerHTML = parts.map((p, i) => '<button type="button" class="builder-part ' + (i === selected ? 'selected' : '') + '" data-index="' + i + '">' + (i + 1) + '. ' + esc(p.name) + '</button>').join('');
          stage.querySelectorAll('.builder-part-preview').forEach((el) => el.remove());
          if (image) parts.forEach((p, i) => { const el = document.createElement('div'); const sx = p.world ? p.x + 220 : p.x; const sy = p.world ? 240 - p.y - p.h : p.y; el.className = 'builder-part-preview' + (i === selected ? ' selected' : ''); el.dataset.index = i; el.textContent = p.name; el.style.left = sx * zoom + 'px'; el.style.top = sy * zoom + 'px'; el.style.width = p.w * zoom + 'px'; el.style.height = p.h * zoom + 'px'; el.style.transform = 'rotate(' + p.r + 'deg)'; el.style.backgroundImage = 'url(' + image + ')'; el.style.backgroundSize = (atlas().width * zoom) + 'px ' + (atlas().height * zoom) + 'px'; el.style.backgroundPosition = (-p.u * zoom) + 'px ' + (-p.v * zoom) + 'px'; stage.appendChild(el); });
          if (!parts[selected]) selected = Math.max(0, parts.length - 1);
          if (parts[selected]) { fields.hidden = false; empty.hidden = true; document.querySelectorAll('[data-field]').forEach((input) => { input.value = parts[selected][input.dataset.field] ?? ''; }); } else { fields.hidden = true; empty.hidden = false; }
          output.value = JSON.stringify({ name: $('mob-name').value.trim(), texture: { width: atlas().width, height: atlas().height }, parts }, null, 2);
          render3d();
        }
        function esc(value) { return String(value).replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[c]); }
        $('mob-texture-file').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { image = reader.result; stage.querySelector('.builder-empty')?.remove(); render(); }; reader.readAsDataURL(file); });
        $('mob-model-file').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(reader.result); const geo = (data['minecraft:geometry'] || data.geometry || [])[0]; if (!geo) throw new Error('Modelo Bedrock nao encontrado'); const desc = geo.description || {}; $('atlas-width').value = Number(desc.texture_width || 64); $('atlas-height').value = Number(desc.texture_height || 32); const imported = []; (geo.bones || []).forEach((bone) => (bone.cubes || []).forEach((cube, i) => { const origin = cube.origin || [0, 0, 0], size = cube.size || [1, 1, 1], uv = Array.isArray(cube.uv) ? cube.uv : [0, 0]; imported.push({ name: bone.name + '_' + (i + 1), x: Number(origin[0]), y: Number(origin[1]), z: Number(origin[2]), w: Number(size[0]), h: Number(size[1]), d: Number(size[2]), u: Number(uv[0]), v: Number(uv[1]), r: 0, world: true }); })); if (!imported.length) throw new Error('O modelo nao possui cubos'); parts = imported; selected = 0; $('mob-name').value = (geo.description.identifier || file.name).replace(/^geometry\./, '').replace(/[^a-z0-9_]+/gi, '_'); render(); } catch (error) { alert('Nao foi possivel ler o modelo: ' + error.message); } }; reader.readAsText(file); });
        list.addEventListener('click', (event) => { const button = event.target.closest('[data-index]'); if (button) { selected = Number(button.dataset.index); render(); } });
        document.querySelectorAll('[data-field]').forEach((input) => input.addEventListener('input', () => { if (!parts[selected]) return; const key = input.dataset.field; parts[selected][key] = key === 'name' ? input.value : Number(input.value) || 0; render(); }));
        ['atlas-width', 'atlas-height', 'mob-name'].forEach((id) => $(id).addEventListener('input', render));
        $('builder-add').addEventListener('click', () => { parts.push({ name: 'parte_' + (parts.length + 1), x: 20, y: 20, z: 0, w: 32, h: 32, u: 0, v: 0, d: 4, r: 0 }); selected = parts.length - 1; render(); });
        $('builder-duplicate').addEventListener('click', () => { if (!parts[selected]) return; parts.splice(selected + 1, 0, { ...parts[selected], name: parts[selected].name + '_copia', x: parts[selected].x + 4, y: parts[selected].y + 4 }); selected++; render(); });
        $('builder-remove').addEventListener('click', () => { if (!parts.length) return; parts.splice(selected, 1); selected = Math.min(selected, parts.length - 1); render(); });
        $('builder-export').addEventListener('click', () => { output.select(); navigator.clipboard?.writeText(output.value); const blob = new Blob([output.value], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = ($('mob-name').value.trim() || 'mob') + '-model.json'; link.click(); URL.revokeObjectURL(link.href); });
        $('builder-rotate-left').addEventListener('click', () => { orbit.x -= 0.35; }); $('builder-rotate-right').addEventListener('click', () => { orbit.x += 0.35; }); $('builder-zoom-out').addEventListener('click', () => { orbit.distance = Math.min(20, orbit.distance + 1); }); $('builder-zoom-in').addEventListener('click', () => { orbit.distance = Math.max(3, orbit.distance - 1); }); $('builder-reset-view').addEventListener('click', () => { orbit.x = 0.6; orbit.y = 0.35; orbit.distance = 8; });
        stage.addEventListener('wheel', (event) => { event.preventDefault(); zoom = Math.max(1, Math.min(12, zoom + (event.deltaY < 0 ? 1 : -1))); render(); }, { passive: false });
        let drag = null;
        stage.addEventListener('pointerdown', (event) => { const el = event.target.closest('.builder-part-preview'); if (!el) return; selected = Number(el.dataset.index); drag = { x: event.clientX, y: event.clientY, px: parts[selected].x, py: parts[selected].y }; el.setPointerCapture(event.pointerId); render(); });
        stage.addEventListener('pointermove', (event) => { if (!drag || !parts[selected]) return; parts[selected].x = drag.px + (event.clientX - drag.x) / zoom; parts[selected].y = drag.py + (event.clientY - drag.y) / zoom; render(); });
        stage.addEventListener('pointerup', () => { drag = null; });
        init3d(); render();
      })();
    </script>
  </section>`;
  return layout('Montador de mobs', body, 'panel');
}

async function adminPage(user, { tab = 'servidor', message = '', sort = 'name', dir = 'asc' } = {}) {
  adminOnly(user);
  const status = await serviceStatus();
  const active = status === 'active';
  const nav = ['servidor', 'contas', 'itens', 'mobs', 'montador'].map((name) =>
    `<a class="button-secondary" href="${htmlEscape(appUrl(`/admin?tab=${name}`))}">${name[0].toUpperCase() + name.slice(1)}</a>`
  ).join('');
  let body = '';

  if (tab === 'contas') {
    const accounts = await query(
      `SELECT c.id, c.login, c.tipo, c.criado_em, c.ultimo_login,
              p.nome AS personagem_nome, p.nivel, p.kills
       FROM contas c
       LEFT JOIN personagens p ON p.conta_id = c.id
       ORDER BY c.id DESC
       LIMIT 200`
    );
    const accountIds = accounts.map((a) => Number(a.id)).join(',');
    body = `<section class="skills admin-accounts-page"><h2>Contas</h2>${message ? `<div class="alert">${htmlEscape(message)}</div>` : ''}
      <p class="accounts-help">Edite os campos diretamente na tabela. Use a caixa da coluna ID para marcar contas e excluir somente as selecionadas.</p>
      <form method="post" action="${htmlEscape(appUrl('/admin/accounts'))}" id="accounts-form">
        <input type="hidden" name="csrf_token" value="${htmlEscape(user.csrf)}">
        <input type="hidden" name="account_ids" value="${htmlEscape(accountIds)}">
        <input type="hidden" name="selected_ids_csv" id="selected-account-ids" value="">
        <div class="accounts-toolbar">
          <label class="accounts-select-all"><input type="checkbox" id="select-all-accounts"> Selecionar todos</label>
          <span class="accounts-selected-count" id="selected-account-count">0 selecionadas</span>
          <button class="button-primary accounts-save" name="action" value="update_batch" type="submit">Salvar alterações</button>
          <button class="button-secondary accounts-delete" name="action" value="delete_batch" type="submit" data-confirm="Excluir somente as contas selecionadas?">Excluir selecionadas</button>
        </div>
        <div class="accounts-table-wrap"><table class="accounts-table">
          <thead><tr><th>ID</th><th>Login</th><th>Personagem</th><th>Tipo</th><th>Nível</th><th>Kills</th><th>Nova senha</th></tr></thead>
          <tbody>${accounts.map((a) => `<tr>
            <td><label class="account-id-select"><input class="account-select" type="checkbox" value="${Number(a.id)}"> <strong>${Number(a.id)}</strong></label></td>
            <td><input name="login_${Number(a.id)}" value="${htmlEscape(a.login)}" required autocomplete="off"></td>
            <td><input name="personagem_${Number(a.id)}" value="${htmlEscape(a.personagem_nome || '')}" required autocomplete="off"></td>
            <td><input name="tipo_${Number(a.id)}" type="number" min="1" max="3" value="${Number(a.tipo || 1)}" title="3 = admin"></td>
            <td><input name="nivel_${Number(a.id)}" type="number" min="1" max="999999" value="${Number(a.nivel || 1)}"></td>
            <td><input name="kills_${Number(a.id)}" type="number" min="0" max="999999999" value="${Number(a.kills || 0)}"></td>
            <td><input name="senha_${Number(a.id)}" type="password" minlength="6" placeholder="Opcional" autocomplete="new-password"></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </form>
      <script>
        (() => {
          const form = document.getElementById('accounts-form');
          if (!form) return;
          const boxes = [...form.querySelectorAll('.account-select')];
          const selectAll = document.getElementById('select-all-accounts');
          const selected = document.getElementById('selected-account-ids');
          const count = document.getElementById('selected-account-count');
          const refresh = () => {
            const ids = boxes.filter((box) => box.checked).map((box) => box.value);
            selected.value = ids.join(',');
            count.textContent = ids.length + (ids.length === 1 ? ' selecionada' : ' selecionadas');
            selectAll.checked = boxes.length > 0 && ids.length === boxes.length;
            selectAll.indeterminate = ids.length > 0 && ids.length < boxes.length;
          };
          boxes.forEach((box) => box.addEventListener('change', refresh));
          selectAll.addEventListener('change', () => { boxes.forEach((box) => { box.checked = selectAll.checked; }); refresh(); });
          form.addEventListener('submit', (event) => {
            const submitter = event.submitter;
            refresh();
            if (submitter && submitter.value === 'delete_batch' && !selected.value) { event.preventDefault(); alert('Selecione pelo menos uma conta para excluir.'); return; }
            if (submitter && submitter.value === 'delete_batch' && !confirm(submitter.dataset.confirm)) event.preventDefault();
          });
        })();
      </script>
    </section>`;
  } else if (tab === 'itens') {
    return adminItemsPage(user, { message });
  } else if (tab === 'montador') {
    return adminMobBuilderPage(user);
  } else if (tab === 'mobs') {
    const validSorts = new Set(['name', 'health', 'damage', 'speed']);
    sort = validSorts.has(sort) ? sort : 'name';
    dir = dir === 'desc' ? 'desc' : 'asc';
    const nextDir = dir === 'asc' ? 'desc' : 'asc';
    const sortLink = (field, label) => {
      const marker = sort === field ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<a class="mob-sort" href="${htmlEscape(appUrl(`/admin?tab=mobs&sort=${field}&dir=${sort === field ? nextDir : 'asc'}`))}">${label}${marker}</a>`;
    };
    const compareMobs = (a, b) => {
      const av = sort === 'name' ? a.name : Number(a[sort] || 0);
      const bv = sort === 'name' ? b.name : Number(b[sort] || 0);
      const result = typeof av === 'string' ? av.localeCompare(bv, 'pt-BR') : av - bv;
      return (dir === 'asc' ? result : -result) || a.name.localeCompare(b.name, 'pt-BR');
    };
    const aggressive = ADMIN_MOB_CATALOG.filter((mob) => Number(mob.damage || 0) > 0).sort(compareMobs);
    const passive = ADMIN_MOB_CATALOG.filter((mob) => Number(mob.damage || 0) <= 0).sort(compareMobs);
    const mobTable = (title, mobs) => `<section class="mob-group"><h3>${title} <span>${mobs.length}</span></h3><div class="mobs-table-wrap"><table class="mobs-table">
        <thead><tr><th>Mob</th><th>ID</th><th>Imagem</th><th>Som</th><th>Tipo</th><th>${sortLink('health', 'Vida')}</th><th>${sortLink('damage', 'Dano')}</th><th>Elemental</th><th>${sortLink('speed', 'Velocidade')}</th><th>Geração</th><th>Status</th></tr></thead>
        <tbody>${mobs.map((mob) => `<tr>
          <td><strong>${htmlEscape(mob.name)}</strong></td>
          <td><code>${htmlEscape(mob.id)}</code></td>
          <td><code>${htmlEscape(ADMIN_MOB_IMAGES[mob.id] || 'não mapeada')}</code></td>
          <td><code>${htmlEscape(ADMIN_MOB_SOUNDS[mob.id] || 'não configurado')}</code></td>
          <td>${htmlEscape(mob.kind)}</td>
          <td>${Number(mob.health)}</td>
          <td>${Number(mob.damage || 0)}</td>
          <td>${htmlEscape(mob.element || 'Nenhum')}</td>
          <td>${Number(mob.speed)}</td>
          <td>${htmlEscape(mob.spawn)}</td>
          <td><span class="mob-status active">Ativo</span></td>
        </tr>`).join('')}</tbody>
      </table></div></section>`;
    body = `<section class="skills admin-mobs-page">
      <div class="mobs-heading"><div><span>Configuração do jogo</span><h2>Mobs ativos</h2></div><strong>${ADMIN_MOB_CATALOG.length} configurados</strong></div>
      <p>Mob com dano maior que zero é considerado agressivo. Clique em Vida, Dano ou Velocidade para ordenar; clique novamente para inverter.</p>
      ${mobTable('Agressivos', aggressive)}
      ${mobTable('Passivos', passive)}
    </section>`;
  } else if (tab === 'itens-legado') {
    const accounts = await query('SELECT p.conta_id, c.login, p.nome FROM personagens p INNER JOIN contas c ON c.id = p.conta_id ORDER BY c.login');
    body = `<section class="skills"><h2>Gerenciador de itens</h2>${message ? `<div class="alert">${htmlEscape(message)}</div>` : ''}
      <form method="post" action="${htmlEscape(appUrl('/admin/items'))}" style="display:grid; gap:10px; max-width:520px;">
        <input type="hidden" name="csrf_token" value="${htmlEscape(user.csrf)}">
        <label>Conta/personagem</label>
        <select name="conta_id">${accounts.map((a) => `<option value="${Number(a.conta_id)}">${htmlEscape(a.login)} - ${htmlEscape(a.nome)}</option>`).join('')}</select>
        <label>Item</label>
        <select name="item">${ADMIN_ITEM_CATALOG.map((item) => `<option value="${htmlEscape(item.id)}">${htmlEscape(item.name)} (${htmlEscape(item.id)})</option>`).join('')}</select>
        <label>Quantidade</label>
        <input name="count" type="number" min="1" max="999" value="64">
        <button type="submit">Adicionar ao inventario</button>
      </form>
      <h2 style="margin-top:24px;">Todos os itens</h2>
      <div class="items-catalog">
        ${['Blocos', 'Materiais', 'Comida', 'Espadas', 'Machados', 'Pas', 'Picaretas', 'Enxadas', 'Outras ferramentas', 'Armaduras'].map((category) => {
          const items = ADMIN_ITEM_CATALOG.filter((item) => item.category === category);
          return `<section class="items-category"><h3>${htmlEscape(category)}</h3>
            <div class="items-table-wrap"><table class="items-table"><thead><tr><th>ID</th><th>Preview</th><th>Nome</th><th>Tier</th></tr></thead><tbody>
            ${items.map((item) => `<tr>
              <td class="item-id">${htmlEscape(item.id)}</td>
              <td><span class="item-preview ${htmlEscape(itemPreviewClass(item))}" title="Preview de ${htmlEscape(item.name)}"><img src="${htmlEscape(itemPreviewUrl(item))}" alt="${htmlEscape(item.name)}" loading="lazy" onerror="this.hidden=true; this.parentElement.classList.add('missing')"><span class="preview-fallback">${htmlEscape(item.name[0] || '?')}</span></span></td>
              <td><strong>${htmlEscape(item.name)}</strong></td>
              <td><span class="item-tier">${htmlEscape(itemTier(item))}</span></td>
            </tr>`).join('')}
            </tbody></table></div></section>`;
        }).join('')}
      </div>
    </section>`;
  } else {
    body = `<section class="skills"><h2>Servidor</h2>${message ? `<div class="alert">${htmlEscape(message)}</div>` : ''}
      <div class="server-control-bar">
        <p>Status: <strong id="server-status" data-state="${htmlEscape(status)}">${htmlEscape(serviceStatusLabel(status))}</strong></p>
        <form method="post" action="${htmlEscape(appUrl('/admin/server'))}" class="server-buttons">
        <input type="hidden" name="csrf_token" value="${htmlEscape(user.csrf)}">
        <button id="server-start" name="action" value="start" type="submit" ${active ? 'disabled' : ''}>Ligar servidor</button>
        <button name="action" value="restart" type="submit">Reiniciar jogo</button>
        <button id="server-stop" name="action" value="stop" type="submit" ${active ? '' : 'disabled'}>Desligar servidor</button>
        <a class="button-secondary" href="${htmlEscape(appUrl('/game'))}">Entrar no jogo</a>
        </form>
      </div>
      <p class="server-help">${active ? 'Jogo online para jogadores.' : 'Jogo desligado. Login e painel admin continuam funcionando.'}</p>
      ${adminConsoleBlock()}
      <script>
        const statusEl = document.getElementById('server-status');
        const startBtn = document.getElementById('server-start');
        const stopBtn = document.getElementById('server-stop');
        async function refreshServerStatus() {
          try {
            const response = await fetch(${JSON.stringify(appUrl('/admin/server-status'))}, { cache: 'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            const active = data.status === 'active';
            statusEl.textContent = active ? 'Ligado' : 'Desligado';
            statusEl.dataset.state = data.status;
            startBtn.disabled = active;
            stopBtn.disabled = !active;
          } catch {}
        }
        refreshServerStatus();
        setInterval(refreshServerStatus, 3000);
      </script>
    </section>`;
  }

  return layout('Minezera - Admin', `
    <section class="panel-heading">
      <div><span>Admin</span><h1>Painel FP Craft</h1><p>Conta ${htmlEscape(user.login)}</p></div>
      <div class="panel-actions"><a class="button-primary" href="${htmlEscape(appUrl('/game'))}">Jogo</a><a class="button-secondary" href="${htmlEscape(appUrl('/logout'))}">Sair</a></div>
    </section>
    <section class="skills"><div class="panel-actions">${nav}</div></section>
    ${body}`, 'panel');
}

async function handleLogin(req, res) {
  const form = await readForm(req);
  const session = getSession(req);
  try {
    requireCsrf(session, form);
  } catch (err) {
    const freshSession = renewFormSession(res);
    return sendHtml(res, loginPage({
      error: 'Sua sessao expirou. O formulario foi atualizado; envie novamente.',
      csrf: freshSession.csrf,
      ranking: await topPlayers()
    }), 400);
  }
  const login = String(form.login || '').trim();
  const senha = String(form.senha || '');
  if (!login || !senha) return sendHtml(res, loginPage({ error: 'Preencha login e senha.', csrf: session.csrf, ranking: await topPlayers() }), 400);

  const rows = await query('SELECT id, senha_hash, tipo FROM contas WHERE login = ?', [login]);
  const conta = rows[0];
  const hash = conta ? String(conta.senha_hash).replace(/^\$2y\$/, '$2b$') : '';
  const ok = conta && await bcrypt.compare(senha, hash);
  if (!ok) return sendHtml(res, loginPage({ error: 'Login ou senha incorretos.', csrf: session.csrf, ranking: await topPlayers() }), 401);

  const newSession = createSession(Number(conta.id));
  res.setHeader('Set-Cookie', cookieHeader(newSession.id));
  await query('UPDATE contas SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?', [Number(conta.id)]);
  redirect(res, Number(conta.tipo) === 3 ? '/' : '/game');
}

async function handleRegister(req, res) {
  const form = await readForm(req);
  const session = getSession(req);
  try {
    requireCsrf(session, form);
  } catch (err) {
    const freshSession = renewFormSession(res);
    return sendHtml(res, registerPage({
      error: 'Sua sessao expirou. O formulario foi atualizado; envie novamente.',
      csrf: freshSession.csrf
    }), 400);
  }
  const login = String(form.login || '').trim();
  const senha = String(form.senha || '');
  const confirmarSenha = String(form.confirmar_senha || '');
  const personagem = String(form.personagem || '').trim();
  const classeId = 0;

  let error = '';
  if (!validLogin(login)) error = 'Use um login com 3 a 40 caracteres: letras, numeros e underline.';
  else if (senha.length < 6) error = 'A senha precisa ter pelo menos 6 caracteres.';
  else if (senha !== confirmarSenha) error = 'As senhas nao conferem.';
  else if (!validCharacterName(personagem)) error = 'O nome do personagem deve ter 3 a 40 caracteres.';
  if (error) return sendHtml(res, registerPage({ error, csrf: session.csrf }), 400);

  const conn = await (await db()).getConnection();
  try {
    await conn.beginTransaction();
    const [accountResult] = await conn.execute('INSERT INTO contas (login, senha_hash) VALUES (?, ?)', [login, await bcrypt.hash(senha, 12)]);
    const contaId = accountResult.insertId;
    await conn.execute(
      `INSERT INTO personagens
        (conta_id, nome, classe_id, nivel, exp, hp,
         pos_x, pos_y, pos_z,
         skill_lenhador, skill_cooking, skill_mining, skill_crafting,
         skill_farming, forca, kills)
       VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [contaId, personagem, classeId, 20, DEFAULT_SPAWN.x, DEFAULT_SPAWN.y, DEFAULT_SPAWN.z, 1, 1, 1, 1, 1, 10]
    );
    await conn.commit();
    const newSession = createSession(contaId);
    res.setHeader('Set-Cookie', cookieHeader(newSession.id));
    redirect(res, '/painel');
  } catch (e) {
    await conn.rollback();
    const msg = e && e.code === 'ER_DUP_ENTRY' ? 'Esse login ou nome de personagem ja esta em uso.' : 'Nao foi possivel criar a conta agora.';
    sendHtml(res, registerPage({ error: msg, csrf: session.csrf }), 400);
  } finally {
    conn.release();
  }
}

function publicPlayer(user) {
  return {
    conta_id: Number(user.conta_id),
    tipo: Number(user.tipo || 1),
    admin: isAdmin(user),
    personagem_id: Number(user.personagem_id),
    nome: user.personagem_nome,
    classe_id: Number(user.classe_id),
    nivel: Number(user.nivel),
    exp: Number(user.exp),
    dias_jogados: Number(user.dias_jogados),
    hp: Number(user.hp),
    hunger: Number(user.hunger),
    pos_x: user.pos_x === null ? null : Number(user.pos_x),
    pos_y: user.pos_y === null ? null : Number(user.pos_y),
    pos_z: user.pos_z === null ? null : Number(user.pos_z),
    spawn_x: user.spawn_x === null ? null : Number(user.spawn_x),
    spawn_y: user.spawn_y === null ? null : Number(user.spawn_y),
    spawn_z: user.spawn_z === null ? null : Number(user.spawn_z),
    yaw: Number(user.yaw),
    pitch: Number(user.pitch),
    inventory: parseInventory(user.inventory_json),
    hotbar: Number(user.hotbar),
    skin: normalizeSkinId(user.skin_id),
    kills: Number(user.kills)
  };
}

async function handleGame(req, res) {
  const user = await currentUser(req);
  if (!user) return redirect(res, '/');
  if (!await isGameServerEnabled()) {
    return sendHtml(res, layout('Minezera - Jogo desligado', `
      <section class="auth-card">
        <h1>Jogo desligado</h1>
        <p>O servidor do jogo esta desligado no momento. Login e painel admin continuam online.</p>
        <div class="action-stack">
          ${isAdmin(user) ? `<a class="button-primary" href="${htmlEscape(appUrl('/admin'))}">Abrir painel admin</a>` : ''}
          <a class="button-secondary" href="${htmlEscape(appUrl('/'))}">Voltar</a>
        </div>
      </section>`), 503);
  }
  const htmlPath = path.join(ROOT, 'index.html');
  const html = await fs.promises.readFile(htmlPath, 'utf8');
  const customItems = await readCustomItemCatalog();
  const bootstrap = `<script>window.MINEZERA_BASE_PATH = ${JSON.stringify(PUBLIC_BASE_PATH)}; window.MINEZERA_PLAYER = ${JSON.stringify(publicPlayer(user))}; window.MINEZERA_CUSTOM_ITEMS = ${JSON.stringify(customItems).replace(/</g, '\\u003c')};</script>`;
  sendHtml(res, html.replace('</head>', `${bootstrap}\n</head>`));
}

async function handlePersonagemApi(req, res) {
  const user = await currentUser(req);
  if (!user) return sendJson(res, { ok: false, erro: 'nao_autenticado' }, 401);
  sendJson(res, {
    ok: true,
    conta: { id: Number(user.conta_id), login: user.login },
    personagem: {
      id: Number(user.personagem_id),
      nome: user.personagem_nome,
      classe_id: Number(user.classe_id),
      classe_nome: user.classe_nome,
      nivel: Number(user.nivel),
      exp: Number(user.exp),
      hp: Number(user.hp),
      hunger: Number(user.hunger),
      posicao: {
        x: user.pos_x === null ? null : Number(user.pos_x),
        y: user.pos_y === null ? null : Number(user.pos_y),
        z: user.pos_z === null ? null : Number(user.pos_z)
      },
      spawn: {
        x: user.spawn_x === null ? null : Number(user.spawn_x),
        y: user.spawn_y === null ? null : Number(user.spawn_y),
        z: user.spawn_z === null ? null : Number(user.spawn_z)
      },
      yaw: Number(user.yaw),
      pitch: Number(user.pitch),
      inventario: parseInventory(user.inventory_json),
      hotbar: Number(user.hotbar),
      skin: normalizeSkinId(user.skin_id),
      skills: {
        lenhador: Number(user.skill_lenhador),
        cooking: Number(user.skill_cooking),
        mining: Number(user.skill_mining),
        crafting: Number(user.skill_crafting),
        farming: Number(user.skill_farming)
      },
      forca: Number(user.forca),
      kills: Number(user.kills),
      dias_jogados: Number(user.dias_jogados)
    }
  });
}

async function handleSavePersonagemApi(req, res) {
  const user = await currentUser(req);
  if (!user) return sendJson(res, { ok: false, erro: 'nao_autenticado' }, 401);
  const payload = await readJson(req);
  const inventory = Array.isArray(payload.inventory) ? JSON.stringify(payload.inventory.slice(0, 36)) : null;
  const requestedSpawn = Array.isArray(payload.spawn) ? payload.spawn.slice(0, 3).map(Number) : null;
  const validSpawn = requestedSpawn && requestedSpawn.length === 3 && requestedSpawn.every(Number.isFinite);
  const skinId = validSkinId(payload.skin) ? String(payload.skin) : normalizeSkinId(user.skin_id);
  await query(
    `UPDATE personagens
     SET dias_jogados = GREATEST(dias_jogados, ?),
         nivel = GREATEST(nivel, ?),
         exp = ?,
         hp = ?,
         hunger = ?,
         pos_x = ?,
         pos_y = ?,
         pos_z = ?,
         spawn_x = ?,
         spawn_y = ?,
         spawn_z = ?,
         yaw = ?,
         pitch = ?,
         inventory_json = COALESCE(?, inventory_json),
         hotbar = ?,
         skin_id = ?,
         kills = GREATEST(kills, ?)
     WHERE conta_id = ?`,
    [
      Math.max(1, Math.min(999999999, Number.parseInt(payload.dias_jogados ?? user.dias_jogados, 10) || 1)),
      Math.max(1, Math.min(999999, Number.parseInt(payload.nivel ?? user.nivel, 10) || 1)),
      Math.max(0, Math.min(999999999, Number.parseInt(payload.exp ?? user.exp, 10) || 0)),
      Math.max(0, Math.min(999999, Number.parseInt(payload.hp ?? user.hp, 10) || 0)),
      Math.max(0, Math.min(20, Number.parseInt(payload.hunger ?? user.hunger, 10) || 0)),
      payload.x !== undefined ? Number(payload.x) : user.pos_x,
      payload.y !== undefined ? Number(payload.y) : user.pos_y,
      payload.z !== undefined ? Number(payload.z) : user.pos_z,
      validSpawn ? requestedSpawn[0] : user.spawn_x,
      validSpawn ? requestedSpawn[1] : user.spawn_y,
      validSpawn ? requestedSpawn[2] : user.spawn_z,
      payload.yaw !== undefined ? Number(payload.yaw) : Number(user.yaw),
      payload.pitch !== undefined ? Number(payload.pitch) : Number(user.pitch),
      inventory,
      Math.max(0, Math.min(8, Number.parseInt(payload.hotbar ?? user.hotbar, 10) || 0)),
      skinId,
      Math.max(0, Math.min(999999999, Number.parseInt(payload.kills ?? user.kills, 10) || 0)),
      Number(user.conta_id)
    ]
  );
  sendJson(res, { ok: true });
}

async function handleMundoApi(req, res) {
  const user = await currentUser(req);
  if (!user) return sendJson(res, { ok: false, erro: 'nao_autenticado' }, 401);

  if (req.method === 'GET') {
    sendJson(res, { ok: true, world: worldPayload() });
    return;
  }

  const payload = await readJson(req, 100 * 1024 * 1024);
  if (!payload || payload.version !== WORLD_PAYLOAD_VERSION) return sendJson(res, { ok: false, erro: 'mundo_invalido' }, 400);
  // Compatibility endpoint for the admin save button. The server remains the
  // only process that writes world.json; clients never write that file.
  worldStore.seed = String(payload.seed || worldStore.seed);
  worldStore.time = Number(payload.time) || worldStore.time;
  worldStore.day = Number(payload.day) || worldStore.day;
  worldStore.raining = !!payload.raining;
  for (const chunk of payload.chunks || []) acceptWorldChunk(chunk);
  await saveWorldStore(true);
  sendJson(res, { ok: true });
}

async function handleAdminServer(req, res) {
  const user = await currentUser(req);
  adminOnly(user);
  const form = await readForm(req);
  requireCsrf(getSession(req), form);
  const action = String(form.action || '');

  if (!['start', 'stop', 'restart', 'status'].includes(action)) {
    return sendHtml(res, await adminPage(user, { tab: 'servidor', message: 'Acao invalida.' }), 400);
  }

  const currentStatus = await serviceStatus();
  if (action === 'start' && currentStatus === 'active') {
    return sendHtml(res, await adminPage(user, { tab: 'servidor', message: 'Servidor ja esta ligado.' }), 400);
  }
  if (action === 'stop' && currentStatus !== 'active') {
    return sendHtml(res, await adminPage(user, { tab: 'servidor', message: 'Servidor ja esta desligado.' }), 400);
  }

  if (action === 'restart') {
    await setGameServerEnabled(false);
    await setGameServerEnabled(true);
    return sendHtml(res, await adminPage(user, { tab: 'servidor', message: 'Jogo reiniciado.' }));
  }

  await setGameServerEnabled(action === 'start');
  return sendHtml(res, await adminPage(user, {
    tab: 'servidor',
    message: action === 'start' ? 'Jogo ligado.' : 'Jogo desligado.'
  }));
}

async function handleAdminServerStatus(req, res) {
  const user = await currentUser(req);
  adminOnly(user);
  const status = await serviceStatus();
  sendJson(res, { ok: true, status, label: serviceStatusLabel(status) });
}

async function handleAdminAccounts(req, res) {
  const user = await currentUser(req);
  adminOnly(user);
  const form = await readForm(req);
  requireCsrf(getSession(req), form);

  const action = String(form.action || '');
  const parseIds = (value) => [...new Set(String(value || '').split(',').map((raw) => Number.parseInt(raw.trim(), 10)).filter((value) => Number.isInteger(value) && value > 0))];

  if (action === 'delete_batch') {
    const ids = parseIds(form.selected_ids_csv);
    if (!ids.length) return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Selecione pelo menos uma conta para excluir.' }), 400);
    const deletable = ids.filter((accountId) => accountId !== Number(user.conta_id));
    if (deletable.length) await query('DELETE FROM contas WHERE id IN (' + deletable.map(() => '?').join(',') + ')', deletable);
    const skipped = ids.length - deletable.length;
    const suffix = skipped ? ' Sua conta logada foi preservada.' : '';
    return sendHtml(res, await adminPage(user, { tab: 'contas', message: `${deletable.length} conta(s) excluida(s).${suffix}` }));
  }

  if (action === 'update_batch') {
    const ids = parseIds(form.account_ids);
    if (!ids.length) return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Nenhuma conta para atualizar.' }), 400);
    const updates = [];
    for (const accountId of ids) {
      const login = String(form[`login_${accountId}`] || '').trim();
      const personagem = String(form[`personagem_${accountId}`] || '').trim();
      const tipo = Number.parseInt(form[`tipo_${accountId}`], 10);
      const nivel = Number.parseInt(form[`nivel_${accountId}`], 10);
      const kills = Number.parseInt(form[`kills_${accountId}`], 10);
      const senha = String(form[`senha_${accountId}`] || '');
      if (!validLogin(login)) return sendHtml(res, await adminPage(user, { tab: 'contas', message: `Login invalido na conta ${accountId}.` }), 400);
      if (!validCharacterName(personagem)) return sendHtml(res, await adminPage(user, { tab: 'contas', message: `Personagem invalido na conta ${accountId}.` }), 400);
      if (![1, 2, 3].includes(tipo)) return sendHtml(res, await adminPage(user, { tab: 'contas', message: `Tipo invalido na conta ${accountId}. Use 1, 2 ou 3.` }), 400);
      if (!Number.isInteger(nivel) || nivel < 1 || nivel > 999999) return sendHtml(res, await adminPage(user, { tab: 'contas', message: `Nivel invalido na conta ${accountId}.` }), 400);
      if (!Number.isInteger(kills) || kills < 0 || kills > 999999999) return sendHtml(res, await adminPage(user, { tab: 'contas', message: `Kills invalidos na conta ${accountId}.` }), 400);
      if (senha && senha.length < 6) return sendHtml(res, await adminPage(user, { tab: 'contas', message: `A nova senha da conta ${accountId} precisa ter pelo menos 6 caracteres.` }), 400);
      updates.push({ accountId, login, personagem, tipo, nivel, kills, senha });
    }
    const conn = await (await db()).getConnection();
    try {
      await conn.beginTransaction();
      for (const update of updates) {
        if (update.senha) {
          await conn.execute('UPDATE contas SET login = ?, tipo = ?, senha_hash = ? WHERE id = ?', [update.login, update.tipo, await bcrypt.hash(update.senha, 12), update.accountId]);
        } else {
          await conn.execute('UPDATE contas SET login = ?, tipo = ? WHERE id = ?', [update.login, update.tipo, update.accountId]);
        }
        await conn.execute('UPDATE personagens SET nome = ?, nivel = ?, kills = ? WHERE conta_id = ?', [update.personagem, update.nivel, update.kills, update.accountId]);
      }
      await conn.commit();
      return sendHtml(res, await adminPage(user, { tab: 'contas', message: `${updates.length} conta(s) atualizada(s).` }));
    } catch (e) {
      await conn.rollback();
      const msg = e && e.code === 'ER_DUP_ENTRY' ? 'Login ou personagem ja existe.' : 'Nao foi possivel atualizar as contas.';
      return sendHtml(res, await adminPage(user, { tab: 'contas', message: msg }), 400);
    } finally {
      conn.release();
    }
  }

  const id = Number.parseInt(form.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Conta invalida.' }), 400);
  }

  if (action === 'delete') {
    if (id === Number(user.conta_id)) {
      return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Voce nao pode excluir a propria conta logada.' }), 400);
    }
    await query('DELETE FROM contas WHERE id = ?', [id]);
    return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Conta excluida.' }));
  }

  if (action !== 'update') {
    return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Acao invalida.' }), 400);
  }

  const login = String(form.login || '').trim();
  const personagem = String(form.personagem || '').trim();
  const tipo = Number.parseInt(form.tipo, 10);
  const senha = String(form.senha || '');

  if (!validLogin(login)) return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Login invalido.' }), 400);
  if (!validCharacterName(personagem)) return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Nome de personagem invalido.' }), 400);
  if (![1, 2, 3].includes(tipo)) return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Tipo invalido. Use 1, 2 ou 3.' }), 400);
  if (senha && senha.length < 6) return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Nova senha precisa ter pelo menos 6 caracteres.' }), 400);

  const conn = await (await db()).getConnection();
  try {
    await conn.beginTransaction();
    if (senha) {
      await conn.execute('UPDATE contas SET login = ?, tipo = ?, senha_hash = ? WHERE id = ?', [login, tipo, await bcrypt.hash(senha, 12), id]);
    } else {
      await conn.execute('UPDATE contas SET login = ?, tipo = ? WHERE id = ?', [login, tipo, id]);
    }
    await conn.execute('UPDATE personagens SET nome = ? WHERE conta_id = ?', [personagem, id]);
    await conn.commit();
    return sendHtml(res, await adminPage(user, { tab: 'contas', message: 'Conta atualizada.' }));
  } catch (e) {
    await conn.rollback();
    const msg = e && e.code === 'ER_DUP_ENTRY' ? 'Login ou personagem ja existe.' : 'Nao foi possivel atualizar a conta.';
    return sendHtml(res, await adminPage(user, { tab: 'contas', message: msg }), 400);
  } finally {
    conn.release();
  }
}

async function handleAdminItems(req, res) {
  const user = await currentUser(req);
  adminOnly(user);
  const form = await readForm(req);
  requireCsrf(getSession(req), form);

  const contaId = Number.parseInt(form.conta_id, 10);
  const item = String(form.item || '');
  const count = Math.max(1, Math.min(999, Number.parseInt(form.count, 10) || 1));
  const catalog = await getAdminItemCatalog();

  if (!Number.isInteger(contaId) || contaId <= 0 || !catalog.some((entry) => entry.id === item)) {
    return sendHtml(res, await adminPage(user, { tab: 'itens', message: 'Item ou conta invalida.' }), 400);
  }

  const rows = await query('SELECT inventory_json FROM personagens WHERE conta_id = ?', [contaId]);
  if (!rows[0]) return sendHtml(res, await adminPage(user, { tab: 'itens', message: 'Personagem nao encontrado.' }), 404);

  let inventory;
  inventory = parseInventory(rows[0].inventory_json, []);
  if (!Array.isArray(inventory)) inventory = [];
  while (inventory.length < 36) inventory.push(null);

  let remaining = count;
  for (const slot of inventory) {
    if (remaining <= 0) break;
    if (slot && slot.id === item && Number(slot.count) < 64) {
      const add = Math.min(remaining, 64 - Number(slot.count));
      slot.count = Number(slot.count) + add;
      remaining -= add;
    }
  }
  for (let i = 0; i < inventory.length && remaining > 0; i += 1) {
    if (!inventory[i]) {
      const add = Math.min(remaining, 64);
      inventory[i] = { id: item, count: add };
      remaining -= add;
    }
  }

  await query('UPDATE personagens SET inventory_json = ? WHERE conta_id = ?', [JSON.stringify(inventory.slice(0, 36)), contaId]);
  return sendHtml(res, await adminPage(user, { tab: 'itens', message: 'Item adicionado ao inventario.' }));
}

async function handleAdminItemSave(req, res) {
  const user = await currentUser(req);
  adminOnly(user);
  const form = await readForm(req);
  requireCsrf(getSession(req), form);
  const id = String(form.id || '').trim().toLowerCase();
  const originalId = String(form.original_id || '').trim().toLowerCase();
  const name = String(form.name || '').trim();
  const category = ITEM_CATEGORIES.includes(String(form.category || '')) ? String(form.category) : 'Outros';
  const type = ['material', 'block', 'food', 'tool', 'weapon'].includes(String(form.type || '')) ? String(form.type) : 'material';
  const previewUrl = String(form.preview_url || '').trim();
  if (!/^[a-z0-9_]{1,50}$/.test(id) || !name || name.length > 80) return sendHtml(res, await adminItemEditorPage(user, { item: { id, name, category, type }, message: 'Informe um ID valido e um nome.' }), 400);
  if (previewUrl && !/^https:\/\//i.test(previewUrl)) return sendHtml(res, await adminItemEditorPage(user, { item: { id, name, category, type, previewUrl }, message: 'A imagem precisa usar uma URL HTTPS.' }), 400);
  const catalog = await getAdminItemCatalog();
  if (!originalId && catalog.some((entry) => entry.id === id)) return sendHtml(res, await adminItemEditorPage(user, { item: { id, name, category, type }, message: 'Esse ID ja existe.' }), 400);
  const custom = await readCustomItemCatalog();
  const entry = {
    id,
    name,
    displayName: name,
    category,
    tier: String(form.tier || '').trim(),
    type,
    stack: Math.max(1, Math.min(999, Number.parseInt(form.stack, 10) || 64)),
    damage: Math.max(0, Math.min(999, Number(form.damage) || 0)),
    durability: Math.max(0, Math.min(999999, Number.parseInt(form.durability, 10) || 0)),
    speed: Math.max(0, Math.min(999, Number(form.speed) || 1)),
    hunger: Math.max(0, Math.min(20, Number(form.hunger) || 0)),
    saturation: Math.max(0, Math.min(100, Number(form.saturation) || 0)),
    previewUrl,
    custom: true
  };
  const oldIndex = custom.findIndex((item) => item.id === (originalId || id));
  if (oldIndex >= 0) custom.splice(oldIndex, 1);
  custom.push(entry);
  await fs.promises.mkdir(path.dirname(ITEM_CATALOG_PATH), { recursive: true });
  await fs.promises.writeFile(ITEM_CATALOG_PATH, JSON.stringify(custom, null, 2) + '\n', 'utf8');
  console.log(`[admin] ${user.login} salvou o item ${id}.`);
  return sendHtml(res, await adminItemsPage(user, { message: 'Item salvo com sucesso.' }));
}

function resolvePublicFile(requestPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  if (pathname === '/login/style.css') pathname = '/login/style.css';
  if (pathname === '/documentacao/') pathname = '/documentacao/README.md';

  const allowed =
    pathname === '/resourcepack.zip' ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/docs/') ||
    pathname.startsWith('/documentacao/') ||
    pathname === '/login/style.css';

  if (!allowed || pathname.includes('\0')) return null;

  const filePath = path.resolve(ROOT, pathname.replace(/^\/+/, ''));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) return null;
  return filePath;
}

function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, '404 Not Found\n', { 'Content-Type': MIME['.txt'] });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
    };

    if (req.method === 'HEAD') {
      send(res, 200, '', headers);
      return;
    }

    res.writeHead(200, {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      ...headers
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function ensureSessionCookie(req, res) {
  const session = getSession(req);
  if (session) return session;
  const created = createSession(0);
  res.setHeader('Set-Cookie', cookieHeader(created.id));
  return created;
}

async function route(req, res) {
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
    return send(res, 405, '405 Method Not Allowed\n', { Allow: 'GET, HEAD, POST', 'Content-Type': MIME['.txt'] });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method === 'HEAD' ? 'GET' : req.method;

  if (pathname === '/health') return sendJson(res, { ok: true, app: 'Minezera', server: 'node' });

  if (method === 'GET' && (pathname === '/' || pathname === '/index.php' || pathname === '/login')) {
    const user = await currentUser(req);
    const session = ensureSessionCookie(req, res);
    return sendHtml(res, loginPage({ user, csrf: session.csrf, ranking: await topPlayers() }));
  }
  if (req.method === 'POST' && (pathname === '/login' || pathname === '/index.php')) return handleLogin(req, res);
  if (method === 'GET' && (pathname === '/registrar' || pathname === '/login/registrar.php')) {
    if (await currentUser(req)) return redirect(res, '/painel');
    const session = ensureSessionCookie(req, res);
    return sendHtml(res, registerPage({ csrf: session.csrf }));
  }
  if (req.method === 'POST' && (pathname === '/registrar' || pathname === '/login/registrar.php')) return handleRegister(req, res);
  if (method === 'GET' && (pathname === '/painel' || pathname === '/login/painel.php')) {
    const user = await currentUser(req);
    return user ? sendHtml(res, panelPage(user)) : redirect(res, '/');
  }
  if (method === 'GET' && pathname === '/admin') {
    const user = await currentUser(req);
    if (!user) return redirect(res, '/');
    return sendHtml(res, await adminPage(user, {
      tab: String(url.searchParams.get('tab') || 'servidor'),
      sort: String(url.searchParams.get('sort') || 'name'),
      dir: String(url.searchParams.get('dir') || 'asc')
    }));
  }
  if (method === 'GET' && pathname === '/admin/item') {
    const user = await currentUser(req);
    adminOnly(user);
    return sendHtml(res, await adminItemsPage(user, { detailId: String(url.searchParams.get('id') || '') }));
  }
  if (method === 'GET' && pathname === '/admin/item-new') {
    const user = await currentUser(req);
    adminOnly(user);
    return sendHtml(res, await adminItemEditorPage(user));
  }
  if (method === 'GET' && pathname === '/admin/item-edit') {
    const user = await currentUser(req);
    adminOnly(user);
    const catalog = await getAdminItemCatalog();
    const item = catalog.find((entry) => entry.id === String(url.searchParams.get('id') || ''));
    return sendHtml(res, item ? await adminItemEditorPage(user, { item }) : await adminItemsPage(user, { message: 'Item nao encontrado.' }));
  }
  if (method === 'GET' && pathname === '/admin/server-status') return handleAdminServerStatus(req, res);
  if (req.method === 'POST' && pathname === '/admin/server') return handleAdminServer(req, res);
  if (req.method === 'POST' && pathname === '/admin/accounts') return handleAdminAccounts(req, res);
  if (req.method === 'POST' && pathname === '/admin/items') return handleAdminItems(req, res);
  if (req.method === 'POST' && pathname === '/admin/items/save') return handleAdminItemSave(req, res);
  if (method === 'GET' && (pathname === '/logout' || pathname === '/login/logout.php')) {
    destroySession(req, res);
    return redirect(res, '/');
  }
  if (method === 'GET' && (pathname === '/game' || pathname === '/game.php')) return handleGame(req, res);
  if (pathname === '/login/api/personagem.php' && method === 'GET') return handlePersonagemApi(req, res);
  if (pathname === '/login/api/salvar_personagem.php' && req.method === 'POST') return handleSavePersonagemApi(req, res);
  if (pathname === '/login/api/mundo.php' && ['GET', 'POST'].includes(req.method)) return handleMundoApi(req, res);

  const filePath = resolvePublicFile(url.pathname);
  if (filePath) return serveFile(req, res, filePath);
  return send(res, 404, '404 Not Found\n', { 'Content-Type': MIME['.txt'] });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((err) => {
    const status = err.statusCode || 500;
    console.error(err);
    if (res.headersSent) {
      res.end();
      return;
    }
    if ((req.headers.accept || '').includes('application/json')) sendJson(res, { ok: false, erro: status === 500 ? 'erro_servidor' : err.message }, status);
    else sendHtml(res, layout('Minezera - Erro', `<section class="auth-card"><h1>Erro</h1><p>${htmlEscape(status === 500 ? 'Erro interno do servidor.' : err.message)}</p><a class="link" href="${htmlEscape(appUrl('/'))}">Voltar</a></section>`), status);
  });
});

const wss = new WebSocket.Server({ noServer: true });

function safeSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function multiplayerSnapshot(exceptId = null) {
  return [...sockets.values()]
    .filter((client) => client.id !== exceptId)
    .map((client) => ({
      id: client.id,
      nome: client.nome,
      state: client.state
    }));
}

function broadcast(data, exceptId = null) {
  for (const client of sockets.values()) {
    if (client.id === exceptId) continue;
    safeSend(client.ws, data);
  }
}

const mobAuthority = createMobAuthority({
  catalog: ADMIN_MOB_CATALOG,
  getBlockId: worldBlockId,
  getPlayers: () => sockets.values(),
  broadcast,
  send: safeSend,
  log: (...args) => console.log(...args),
  config: MOB_SPAWN_CONFIG
});
mobAuthority.start();

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/multiplayer' && url.pathname !== '/admin/console') {
    socket.destroy();
    return;
  }

  currentUser(req).then((user) => {
    if (!user || (url.pathname === '/admin/console' && !isAdmin(user))) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    if (url.pathname === '/multiplayer') {
      isGameServerEnabled().then((enabled) => {
        if (!enabled) {
          socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req, user);
        });
      }).catch((err) => {
        console.error('Erro ao verificar status do jogo:', err);
        socket.destroy();
      });
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('admin-console', ws, req, user);
    });
  }).catch((err) => {
    console.error('Erro no upgrade websocket:', err);
    socket.destroy();
  });
});

wss.on('admin-console', (ws, req, user) => {
  adminConsoleClients.add(ws);
  safeSend(ws, { type: 'snapshot', lines: consoleBuffer });
  console.log(`[admin] ${user.login} abriu o console em tempo real.`);
  ws.on('close', () => adminConsoleClients.delete(ws));
  ws.on('error', () => adminConsoleClients.delete(ws));
});

wss.on('connection', (ws, req, user) => {
  const id = String(user.personagem_id);
  const nome = String(user.personagem_nome || user.login || `Jogador ${id}`);
  const previous = sockets.get(id);
  if (previous && previous.ws.readyState === WebSocket.OPEN) previous.ws.close(4000, 'nova_conexao');

  const client = { id, nome, ws, state: null, lastChatAt: 0, lastWorldAt: 0 };
  sockets.set(id, client);
  console.log(`[multiplayer] ${nome} conectado (conta ${user.conta_id}, personagem ${id}). Online: ${sockets.size}`);
  const initialMobs = mobAuthority.snapshotFor(client);
  safeSend(ws, { type: 'welcome', id, peers: multiplayerSnapshot(id), mobs: initialMobs, nearbyMobs: initialMobs.length, ...mobAuthority.stats() });
  broadcast({ type: 'player_joined', id, nome, state: null }, id);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'chat') {
      if (sockets.get(id) !== client) return;
      const text = sanitizeChatText(msg.text);
      const now = Date.now();
      if (!text || now - client.lastChatAt < CHAT_COOLDOWN_MS) return;
      client.lastChatAt = now;
      if (text.startsWith('/')) {
        if (!isAdmin(user)) {
          safeSend(ws, { type: 'chat', id: 'server', nome: 'Servidor', text: 'Apenas administradores podem usar comandos.' });
          return;
        }
        const parsed = parseAdminCommand(text);
        if (!parsed.ok) {
          safeSend(ws, { type: 'chat', id: 'server', nome: 'Servidor', text: parsed.error });
          return;
        }
        if (parsed.command === 'help') {
          safeSend(ws, { type: 'chat', id: 'server', nome: 'Servidor', text: helpText(parsed.topic) });
          return;
        }
        const action = { type: 'admin_command', command: parsed.command };
        if (parsed.command === 'time') {
          action.value = parsed.value;
          mobAuthority.setTime(parsed.value);
        } else if (parsed.command === 'weather') {
          action.weather = parsed.weather;
        } else if (parsed.command === 'm') {
          if (parsed.list) {
            safeSend(ws, { type: 'mob_list', id: 'server', nome: 'Servidor', names: MOB_TYPES, total: MOB_TYPES.length });
            return;
          }
          const state = client.state || {};
          const x = Number.isFinite(Number(state.x)) ? Number(state.x) : 0;
          const y = Number.isFinite(Number(state.y)) ? Number(state.y) : 80;
          const z = Number.isFinite(Number(state.z)) ? Number(state.z) : 0;
          const yaw = Number.isFinite(Number(state.yaw)) ? Number(state.yaw) : 0;
          // Minecraft's forward vector is -sin(yaw), -cos(yaw). Keep the
          // command authoritative on the server and place the mob in front
          // of the admin instead of at the admin's feet.
          const frontDistance = 3;
          const position = parsed.coordinates || [x - Math.sin(yaw) * frontDistance, y, z - Math.cos(yaw) * frontDistance];
          const mob = mobAuthority.spawn(parsed.entity, position[0], position[1], position[2], 'command');
          if (!mob) {
            safeSend(ws, { type: 'chat', id: 'server', nome: 'Servidor', text: `Nao foi possivel criar a criatura: ${parsed.entity}.` });
            return;
          }
          broadcast({ type: 'chat', id: 'server', nome: 'Servidor', text: `${nome} executou ${text}` });
          return;
        } else if (parsed.command === 'killall') {
          mobAuthority.clear('admin');
        } else if (parsed.command === 'tp') {
          let position = parsed.coordinates;
          if (parsed.targetSpawn) {
            action.targetSpawn = true;
          } else if (parsed.targetPlayer) {
            const targetName = parsed.targetPlayer.toLowerCase();
            const target = [...sockets.values()].find((online) => online.nome.toLowerCase() === targetName);
            if (!target || !target.state) {
              safeSend(ws, { type: 'chat', id: 'server', nome: 'Servidor', text: `Jogador online nao encontrado: ${parsed.targetPlayer}.` });
              return;
            }
            position = [target.state.x, target.state.y, target.state.z];
          }
          if (position) [action.x, action.y, action.z] = position;
        } else if (parsed.command === 'give') {
          action.item = parsed.item;
          action.count = parsed.count;
        } else if (parsed.command === 'gamemode') {
          action.mode = parsed.mode;
        }
        const global = ['time', 'weather', 'killall'].includes(parsed.command);
        if (global) {
          broadcast(action);
          broadcast({ type: 'chat', id: 'server', nome: 'Servidor', text: `${nome} executou ${text}` });
        } else {
          safeSend(ws, action);
          safeSend(ws, { type: 'chat', id: 'server', nome: 'Servidor', text: `Comando executado: ${text}` });
        }
        return;
      }
      broadcast({ type: 'chat', id, nome, text, at: now });
      return;
    }
    if (msg.type === 'pvp_hit') {
      const targetId = String(msg.targetId || '');
      const target = sockets.get(targetId);
      if (!target || target.id === id) return;
      const amount = Math.max(0, Math.min(100, Number(msg.amount) || 0));
      if (amount <= 0) return;
      const kb = Array.isArray(msg.knockback) ? msg.knockback.slice(0, 3).map((n) => Number(n) || 0) : [0, 0, 0];
      console.log(`[pvp] ${nome} atacou ${target.nome} causando ${amount} de dano.`);
      safeSend(target.ws, { type: 'pvp_damage', fromId: id, fromName: nome, amount, knockback: kb });
      return;
    }
    if (msg.type === 'mob_hit') {
      mobAuthority.handleHit(client, msg);
      return;
    }
    if (msg.type === 'mob_action') {
      mobAuthority.handleAction(client, msg);
      return;
    }
    if (msg.type === 'structure_construct') {
      const structure = String(msg.structure || '');
      const allowed = new Set(['iron_golem', 'wither']);
      const x = Number(msg.x), y = Number(msg.y), z = Number(msg.z);
      if (!allowed.has(structure) || ![x, y, z].every(Number.isFinite) || !client.state) return;
      if (Math.hypot(client.state.x - x, client.state.y - y, client.state.z - z) > 8) return;
      const mob = mobAuthority.spawnStructure(structure, x, y, z);
      if (mob) broadcast({ type: 'chat', id: 'server', nome: 'Servidor', text: `${nome} criou ${structure === 'wither' ? 'um Wither' : 'um Golem de ferro'} com uma estrutura.` });
      return;
    }
    if (msg.type === 'world_chunk') {
      const now = Date.now();
      if (now - client.lastWorldAt < 100) return;
      client.lastWorldAt = now;
      const chunk = acceptWorldChunk(msg.chunk);
      if (!chunk) return;
      safeSend(ws, { type: 'world_chunk_ack', cx: chunk.cx, cz: chunk.cz });
      broadcast({ type: 'world_chunk', chunk }, id);
      return;
    }
    if (msg.type !== 'state' || typeof msg.state !== 'object') return;
    const s = msg.state;
    const state = {
      x: Number(s.x) || 0,
      y: Number(s.y) || 0,
      z: Number(s.z) || 0,
      yaw: Number(s.yaw) || 0,
      pitch: Number(s.pitch) || 0,
      health: Math.max(0, Number(s.health) || 0),
      maxHealth: Math.max(1, Number(s.maxHealth) || 20),
      level: Math.max(1, Number.parseInt(s.level, 10) || 1),
      dead: !!s.dead,
      mode: s.mode === 'creative' ? 'creative' : 'survival',
      skinId: /^[a-zA-Z0-9_-]{1,40}$/.test(String(s.skinId || '')) ? String(s.skinId) : 'security',
      t: Date.now()
    };
    client.state = state;
    broadcast({ type: 'player_state', id, nome, state }, id);
  });

  ws.on('close', () => {
    const current = sockets.get(id);
    if (current && current.ws === ws) {
      sockets.delete(id);
      console.log(`[multiplayer] ${nome} desconectou. Online: ${sockets.size}`);
      broadcast({ type: 'player_left', id, nome }, id);
    }
  });

  ws.on('error', (err) => {
    console.error(`[multiplayer] erro com ${nome}:`, err.message);
  });
});

async function start() {
  await migrateDatabase();
  await loadWorldStore();
  const worldAutosave = setInterval(() => { saveWorldStore().catch(() => {}); }, WORLD_AUTOSAVE_MS);
  worldAutosave.unref();
  server.listen(PORT, HOST, () => {
    console.log(`Minezera Node server running at http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/`);
    console.log(`[world] autoridade do mapa ativa; autosave a cada ${WORLD_AUTOSAVE_MS / 1000}s.`);
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar o Minezera:', err);
  process.exit(1);
});

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down Minezera server...`);
  mobAuthority.stop();
  for (const client of sockets.values()) {
    try { client.ws.close(1001, 'server_shutdown'); } catch (e) { /* ignore */ }
  }
  wss.close();
  await saveWorldStore(true);
  const forceExit = setTimeout(() => process.exit(0), 2500);
  forceExit.unref();
  server.close(async () => {
    if (pool) await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);


