'use strict';

const MOB_TYPES = Object.freeze(['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper']);
const TIME_VALUES = Object.freeze({ day: 1000, noon: 6000, night: 13000, midnight: 18000 });

const COMMANDS = Object.freeze({
  help: { aliases: ['ajuda', 'commands'], usage: '/help', description: 'Lista os comandos de admin.' },
  time: { aliases: ['hora'], usage: '/time <day|noon|night|midnight|ticks> ou /time set <valor>', description: 'Muda o horario para todos.' },
  weather: { aliases: ['clima'], usage: '/weather <clear|rain>', description: 'Muda o clima para todos.' },
  killall: { aliases: ['kill-all', 'removerentidades'], usage: '/killall', description: 'Remove mobs, itens, flechas e TNT.' },
  summon: { aliases: ['invocar'], usage: '/summon <mob> [x y z]', description: 'Invoca um mob para todos.' },
  tp: { aliases: ['teleport', 'teleportar'], usage: '/tp <jogador> ou /tp <x> <y> <z>', description: 'Teleporta o admin para jogador ou coordenadas.' },
  give: { aliases: ['dar'], usage: '/give <item> [quantidade]', description: 'Entrega um item ao admin.' },
  heal: { aliases: ['curar'], usage: '/heal', description: 'Restaura vida, fome e ar.' },
  kill: { aliases: ['matar'], usage: '/kill', description: 'Mata o proprio personagem.' },
  spawn: { aliases: ['home'], usage: '/spawn', description: 'Volta o admin ao ponto de spawn.' },
  gamemode: { aliases: ['modo'], usage: '/gamemode <survival|creative>', description: 'Muda o modo do admin.' }
});

const ALIASES = Object.freeze(Object.entries(COMMANDS).reduce((out, [name, command]) => {
  for (const alias of command.aliases || []) out[alias] = name;
  return out;
}, {}));

function tokenize(value) {
  const tokens = String(value || '').trim().match(/"[^\"]*"|'[^']*'|\S+/g) || [];
  return tokens.map((token) => token.length >= 2 && ((token[0] === '"' && token[token.length - 1] === '"') || (token[0] === "'" && token[token.length - 1] === "'")) ? token.slice(1, -1) : token);
}

function numberArg(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function noArguments(name, args) {
  return args.length ? { ok: false, error: `${COMMANDS[name].usage}` } : null;
}

function parseAdminCommand(input) {
  const raw = String(input || '').trim();
  if (!raw.startsWith('/')) return { ok: false, error: 'Comandos precisam comecar por /.' };
  const tokens = tokenize(raw.slice(1));
  const typedName = String(tokens.shift() || '').toLowerCase();
  const name = ALIASES[typedName] || typedName;
  const command = COMMANDS[name];
  if (!command) return { ok: false, error: `Comando desconhecido: /${typedName}. Use /help.` };
  const args = tokens;

  if (name === 'help') {
    return args.length <= 1 ? { ok: true, command: name, topic: args[0] ? String(args[0]).toLowerCase() : '' } : { ok: false, error: command.usage };
  }
  if (name === 'time') {
    if (![1, 2].includes(args.length) || (args.length === 2 && String(args[0]).toLowerCase() !== 'set')) return { ok: false, error: command.usage };
    const key = String(args[args.length - 1]).toLowerCase();
    const value = Object.prototype.hasOwnProperty.call(TIME_VALUES, key) ? TIME_VALUES[key] : numberArg(key);
    if (value === null || value < 0 || value >= 24000) return { ok: false, error: 'Use day, noon, night, midnight ou ticks entre 0 e 23999.' };
    return { ok: true, command: name, value: Math.floor(value), label: key };
  }
  if (name === 'weather') {
    if (args.length !== 1) return { ok: false, error: command.usage };
    const weather = String(args[0]).toLowerCase();
    if (!['clear', 'rain'].includes(weather)) return { ok: false, error: 'Use clear ou rain.' };
    return { ok: true, command: name, weather };
  }
  if (name === 'killall') {
    return noArguments(name, args) || { ok: true, command: name };
  }
  if (name === 'summon') {
    if (![1, 4].includes(args.length)) return { ok: false, error: command.usage };
    const entity = String(args[0]).toLowerCase();
    if (!MOB_TYPES.includes(entity)) return { ok: false, error: `Mob invalido. Use: ${MOB_TYPES.join(', ')}.` };
    if (args.length === 1) return { ok: true, command: name, entity, coordinates: null };
    const coordinates = args.slice(1).map(numberArg);
    if (coordinates.some((value) => value === null)) return { ok: false, error: command.usage };
    return { ok: true, command: name, entity, coordinates };
  }
  if (name === 'tp') {
    if (args.length === 1) return { ok: true, command: name, targetPlayer: String(args[0]).trim() };
    if (args.length !== 3) return { ok: false, error: command.usage };
    const coordinates = args.map(numberArg);
    if (coordinates.some((value) => value === null) || coordinates[1] < 1 || coordinates[1] > 127) return { ok: false, error: 'Coordenadas invalidas. Y deve ficar entre 1 e 127.' };
    return { ok: true, command: name, coordinates };
  }
  if (name === 'give') {
    if (![1, 2].includes(args.length)) return { ok: false, error: command.usage };
    const count = args[1] === undefined ? 1 : numberArg(args[1]);
    if (count === null || count < 1 || count > 999) return { ok: false, error: 'A quantidade deve ficar entre 1 e 999.' };
    return { ok: true, command: name, item: String(args[0]).toLowerCase(), count: Math.floor(count) };
  }
  if (name === 'gamemode') {
    if (args.length !== 1 || !['survival', 'creative'].includes(String(args[0]).toLowerCase())) return { ok: false, error: command.usage };
    return { ok: true, command: name, mode: String(args[0]).toLowerCase() };
  }
  return noArguments(name, args) || { ok: true, command: name };
}

function helpText(topic = '') {
  const key = ALIASES[topic] || topic;
  if (key && COMMANDS[key]) return `${COMMANDS[key].usage} - ${COMMANDS[key].description}`;
  return Object.values(COMMANDS).map((command) => command.usage).join(' | ');
}

module.exports = { COMMANDS, MOB_TYPES, parseAdminCommand, helpText };
