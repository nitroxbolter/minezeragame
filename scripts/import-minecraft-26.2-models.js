/*
 * Convert the entity model layer definitions shipped in Minecraft Java 26.2
 * into a renderer-neutral JSON manifest for Minezera.
 *
 * The 26.2 client does not store entity geometry as OBJ/GLTF/Bedrock JSON.
 * Vanilla builds it from Java ModelPart/CubeListBuilder calls. javap is used
 * only as an offline reader; the browser never executes Minecraft classes.
 */
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const MINECRAFT = path.join(ROOT, '26.2');
const MODEL_ROOT = path.join(MINECRAFT, 'net', 'minecraft', 'client', 'model');
const TEXTURE_ROOT = path.join(MINECRAFT, 'assets', 'minecraft', 'textures', 'entity');
const OUTPUT = path.join(ROOT, 'assets', 'entity-models-26.2.json');

const JAVAP_CANDIDATES = [
  process.env.JAVAP,
  path.join(process.env.JAVA_HOME || '', 'bin', process.platform === 'win32' ? 'javap.exe' : 'javap'),
  path.join(process.env.APPDATA || '', '.minecraft', 'runtime', 'java-runtime-epsilon', 'windows', 'java-runtime-epsilon', 'bin', 'javap.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Minecraft', 'runtime', 'java-runtime-delta', 'windows', 'java-runtime-delta', 'bin', 'javap.exe'),
  path.join(process.env.APPDATA || '', '._minecraft', 'runtime', 'java-runtime-delta', 'windows', 'java-runtime-delta', 'bin', 'javap.exe'),
  path.join(process.env.APPDATA || '', '.minecraft', 'runtime', 'java-runtime-delta', 'windows', 'java-runtime-delta', 'bin', 'javap.exe')
].filter(Boolean);

function findJavap() {
  for (const candidate of JAVAP_CANDIDATES) if (fs.existsSync(candidate)) return candidate;
  try { childProcess.execFileSync(process.platform === 'win32' ? 'where' : 'which', ['javap'], { stdio: 'ignore' }); return 'javap'; }
  catch { throw new Error('javap nao encontrado. Informe JAVAP apontando para o javap do Java usado pelo Minecraft.'); }
}

function findJava() {
  const javap = findJavap();
  if (javap !== 'javap' && path.dirname(javap)) {
    const candidate = path.join(path.dirname(javap), process.platform === 'win32' ? 'java.exe' : 'java');
    if (fs.existsSync(candidate)) return candidate;
  }
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

function minecraftRuntimeClasspath() {
  const libraryRoot = path.join(process.env.APPDATA || '', '.minecraft', 'libraries');
  const duplicateFamilies = /(?:authlib|joml|gson|guava|fastutil|datafixerupper)[\\/]/i;
  const libraries = walk(libraryRoot).filter((file) => file.toLowerCase().endsWith('.jar') && !duplicateFamilies.test(file));
  const preferred = [
    path.join(libraryRoot, 'org', 'joml', 'joml', '1.10.8', 'joml-1.10.8.jar'),
    path.join(libraryRoot, 'com', 'google', 'guava', 'guava', '33.6.0-jre', 'guava-33.6.0-jre.jar'),
    path.join(libraryRoot, 'com', 'mojang', 'datafixerupper', '10.0.21', 'datafixerupper-10.0.21.jar'),
    path.join(libraryRoot, 'it', 'unimi', 'dsi', 'fastutil', '8.5.18', 'fastutil-8.5.18.jar'),
    path.join(libraryRoot, 'com', 'google', 'code', 'gson', 'gson', '2.14.0', 'gson-2.14.0.jar'),
    path.join(libraryRoot, 'com', 'mojang', 'authlib', '9.0.75', 'authlib-9.0.75.jar')
  ].filter((file) => fs.existsSync(file));
  return [MINECRAFT, ...libraries, ...preferred].join(path.delimiter);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function classFiles() {
  const result = new Set();
  for (const file of walk(MODEL_ROOT)) {
    if (!file.endsWith('.class') || file.includes('$')) continue;
    result.add(path.relative(MINECRAFT, file).replace(/\\/g, '/').replace(/\.class$/, '').replaceAll('/', '.'));
  }
  return result;
}

function parseNumber(line) {
  const comment = line.match(/\/\/\s+(?:float|double|int|long)\s+(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)[fFdDlL]?\s*$/);
  if (comment) return Number(comment[1]);
  const ins = line.match(/:\s+(iconst_m1|iconst_[0-5]|bipush\s+-?\d+|sipush\s+-?\d+|fconst_[0-2])(?:\s|$)/);
  if (!ins) return null;
  const value = ins[1];
  if (value === 'iconst_m1') return -1;
  if (value.startsWith('iconst_')) return Number(value.slice(7));
  if (value.startsWith('bipush') || value.startsWith('sipush')) return Number(value.split(/\s+/)[1]);
  return Number(value.slice(7));
}

function pushedNumbers(lines, end, count, start = 0) {
  const values = [];
  for (let i = end - 1; i >= start; i--) {
    const value = parseNumber(lines[i]);
    if (value === null) continue;
    values.unshift(value);
    if (values.length === count) return values;
  }
  return null;
}

function localSlot(line) {
  const match = line.match(/:\s+aload(?:_(\d)|\s+(\d+))/);
  return match ? Number(match[1] ?? match[2]) : null;
}

function stringConstant(line) {
  const match = line.match(/\/\/\s+String\s+(.+)$/);
  return match ? match[1] : null;
}

function instructionLines(methodText) {
  return methodText.split(/\r?\n/).filter((line) => /^\s*\d+:\s+/.test(line));
}

function methodBody(javapOutput) {
  const lines = javapOutput.split(/\r?\n/);
  const start = lines.findIndex((line) => /createBodyLayer\(/.test(line));
  if (start < 0) return [];
  const code = lines.findIndex((line, index) => index > start && /^\s*Code:$/.test(line));
  if (code < 0) return [];
  const body = [];
  for (let i = code + 1; i < lines.length; i++) {
    if (body.length && /^\s*(?:public|protected|private|static|final)\s+/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return instructionLines(body.join('\n'));
}

function parsePose(lines, start, end) {
  let poseAt = -1, poseKind = '';
  for (let i = start; i < end; i++) {
    if (/PartPose\.offsetAndRotation/.test(lines[i])) { poseAt = i; poseKind = 'rotation'; }
    else if (/PartPose\.offset:/.test(lines[i])) { poseAt = i; poseKind = 'offset'; }
    else if (/PartPose\.ZERO/.test(lines[i])) { poseAt = i; poseKind = 'zero'; }
  }
  if (poseAt < 0 || poseKind === 'zero') return { pivot: [0, 0, 0], rotation: [0, 0, 0] };
  const numbers = pushedNumbers(lines, poseAt, poseKind === 'rotation' ? 6 : 3, start);
  if (!numbers) return { pivot: [0, 0, 0], rotation: [0, 0, 0] };
  return poseKind === 'rotation'
    ? { pivot: numbers.slice(0, 3), rotation: numbers.slice(3, 6) }
    : { pivot: numbers, rotation: [0, 0, 0] };
}

function parseBoxes(lines, start, end) {
  const boxes = [];
  for (let i = start; i < end; i++) {
    if (!/CubeListBuilder\.addBox/.test(lines[i])) continue;
    const values = pushedNumbers(lines, i, 6, start);
    if (!values) continue;
    let uv = [0, 0];
    for (let j = i - 1; j >= start; j--) {
      if (!/CubeListBuilder\.texOffs/.test(lines[j])) continue;
      uv = pushedNumbers(lines, j, 2, start) || uv;
      break;
    }
    let mirrored = false;
    for (let j = i - 1; j >= start; j--) {
      if (/CubeListBuilder\.create/.test(lines[j])) break;
      if (/CubeListBuilder\.mirror/.test(lines[j])) mirrored = true;
    }
    boxes.push({ from: values.slice(0, 3), size: values.slice(3, 6), uv, mirror: mirrored });
  }
  return boxes;
}

function parseModel(output, sourceClass) {
  const lines = methodBody(output);
  if (!lines.length) return null;
  const parts = [], locals = new Map([[2, 'root']]);
  let previousChild = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/PartDefinition\.addOrReplaceChild/.test(lines[i])) continue;
    const regionStart = previousChild;
    let name = null, nameAt = -1;
    for (let j = regionStart; j < i; j++) {
      const value = stringConstant(lines[j]);
      if (value) { name = value; nameAt = j; }
    }
    if (!name) { previousChild = i + 1; continue; }
    const parentLoad = nameAt >= 0 ? [...Array(nameAt - regionStart).keys()].map((offset) => regionStart + offset).reverse().map((at) => localSlot(lines[at])).find((slot) => slot !== null) : null;
    const pose = parsePose(lines, regionStart, i);
    const part = { name, parent: locals.get(parentLoad) || 'root', pivot: pose.pivot, rotation: pose.rotation, cubes: parseBoxes(lines, regionStart, i) };
    parts.push(part);
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      const match = lines[j].match(/:\s+astore(?:_(\d)|\s+(\d+))/);
      if (match) { locals.set(Number(match[1] ?? match[2]), name); break; }
    }
    previousChild = i + 1;
  }
  return { sourceClass, coordinateSystem: 'minecraft-model-part', root: 'root', parts };
}

function imageSize(file) {
  try {
    const header = fs.readFileSync(file);
    if (header.length >= 24 && header.toString('ascii', 1, 4) === 'PNG') return [header.readUInt32BE(16), header.readUInt32BE(20)];
  } catch { /* ignore malformed optional texture */ }
  return null;
}

function textureFiles() {
  return walk(TEXTURE_ROOT).filter((file) => file.toLowerCase().endsWith('.png')).map((file) => ({
    path: path.relative(MINECRAFT, file).replace(/\\/g, '/'),
    size: imageSize(file)
  }));
}

function extractBakedModels(requests) {
  const java = findJava();
  const javac = path.join(path.dirname(java), process.platform === 'win32' ? 'javac.exe' : 'javac');
  if (!fs.existsSync(javac) || !fs.existsSync(java)) return new Map();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'minezera-26-2-models-'));
  const source = path.join(ROOT, 'scripts', 'MinecraftModelExtractor.java');
  const result = new Map();
  try {
    childProcess.execFileSync(javac, ['-cp', MINECRAFT, '-d', tempDir, source], { stdio: 'ignore' });
    const args = ['-cp', [MINECRAFT, tempDir, minecraftRuntimeClasspath()].join(path.delimiter), 'MinecraftModelExtractor', ...requests.map((request) => `${request.className}|${request.textureSize[0]}|${request.textureSize[1]}`)];
    const output = childProcess.execFileSync(java, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    for (const line of output.split(/\r?\n/)) {
      if (!line.startsWith('OK\t')) continue;
      const firstTab = line.indexOf('\t');
      const secondTab = line.indexOf('\t', firstTab + 1);
      if (secondTab < 0) continue;
      const className = line.slice(firstTab + 1, secondTab);
      try { result.set(className, JSON.parse(line.slice(secondTab + 1))); }
      catch { /* ignore one malformed model and keep the rest */ }
    }
  } catch (error) {
    console.warn(`Extracao baked 26.2 indisponivel: ${String(error.message || error).split(/\r?\n/)[0]}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return result;
}

const MODEL_CLASSES = {
  pig: 'net.minecraft.client.model.animal.pig.PigModel', cow: 'net.minecraft.client.model.animal.cow.CowModel',
  sheep: 'net.minecraft.client.model.animal.sheep.SheepModel', chicken: 'net.minecraft.client.model.animal.chicken.AdultChickenModel',
  wolf: 'net.minecraft.client.model.animal.wolf.AdultWolfModel', cat: 'net.minecraft.client.model.animal.feline.AdultCatModel',
  horse: 'net.minecraft.client.model.animal.equine.HorseModel', rabbit: 'net.minecraft.client.model.animal.rabbit.AdultRabbitModel',
  polar_bear: 'net.minecraft.client.model.animal.polarbear.PolarBearModel', bee: 'net.minecraft.client.model.animal.bee.AdultBeeModel',
  fox: 'net.minecraft.client.model.animal.fox.AdultFoxModel', goat: 'net.minecraft.client.model.animal.goat.GoatModel',
  villager: 'net.minecraft.client.model.npc.VillagerModel', wandering_trader: 'net.minecraft.client.model.npc.VillagerModel',
  zombie: 'net.minecraft.client.model.monster.zombie.ZombieModel', zombie_villager: 'net.minecraft.client.model.monster.zombie.ZombieVillagerModel',
  husk: 'net.minecraft.client.model.monster.zombie.ZombieModel', drowned: 'net.minecraft.client.model.monster.zombie.DrownedModel',
  skeleton: 'net.minecraft.client.model.monster.skeleton.SkeletonModel', wither_skeleton: 'net.minecraft.client.model.monster.skeleton.SkeletonModel',
  creeper: 'net.minecraft.client.model.monster.creeper.CreeperModel', spider: 'net.minecraft.client.model.monster.spider.SpiderModel',
  cave_spider: 'net.minecraft.client.model.monster.spider.SpiderModel', enderman: 'net.minecraft.client.model.monster.enderman.EndermanModel',
  blaze: 'net.minecraft.client.model.monster.blaze.BlazeModel', ghast: 'net.minecraft.client.model.monster.ghast.GhastModel',
  guardian: 'net.minecraft.client.model.monster.guardian.GuardianModel', phantom: 'net.minecraft.client.model.monster.phantom.PhantomModel',
  witch: 'net.minecraft.client.model.monster.witch.WitchModel', slime: 'net.minecraft.client.model.monster.slime.SlimeModel',
  magma_cube: 'net.minecraft.client.model.monster.slime.MagmaCubeModel', silverfish: 'net.minecraft.client.model.monster.silverfish.SilverfishModel',
  pillager: 'net.minecraft.client.model.monster.illager.IllagerModel', vindicator: 'net.minecraft.client.model.monster.illager.IllagerModel',
  evoker: 'net.minecraft.client.model.monster.illager.IllagerModel', illusioner: 'net.minecraft.client.model.monster.illager.IllagerModel',
  piglin: 'net.minecraft.client.model.monster.piglin.AdultPiglinModel', ravager: 'net.minecraft.client.model.monster.ravager.RavagerModel',
  vex: 'net.minecraft.client.model.monster.vex.VexModel', bat: 'net.minecraft.client.model.ambient.BatModel', iron_golem: 'net.minecraft.client.model.animal.golem.IronGolemModel'
};

const TEXTURE_HINTS = {
  pig: 'pig/', cow: 'cow/', sheep: 'sheep/', chicken: 'chicken/', wolf: 'wolf/', cat: 'cat/', horse: 'horse/', rabbit: 'rabbit/',
  polar_bear: 'bear/', bee: 'bee/', fox: 'fox/', goat: 'goat/', villager: 'villager/', wandering_trader: 'wandering_trader/',
  zombie: 'zombie/', zombie_villager: 'zombie_villager/', husk: 'zombie/', drowned: 'zombie/', skeleton: 'skeleton/', wither_skeleton: 'skeleton/',
  creeper: 'creeper/', spider: 'spider/', cave_spider: 'spider/', enderman: 'enderman/', blaze: 'blaze/', ghast: 'ghast/', guardian: 'guardian/',
  phantom: 'phantom/', witch: 'witch/', slime: 'slime/', magma_cube: 'slime/', silverfish: 'silverfish/', pillager: 'illager/',
  vindicator: 'illager/', evoker: 'illager/', illusioner: 'illager/', piglin: 'piglin/', ravager: 'illager/', vex: 'illager/', bat: 'bat/', iron_golem: 'iron_golem/'
};

const javap = findJavap();
const available = classFiles();
const textures = textureFiles();
const textureSizeFor = (type, variants) => variants.find((variant) => variant.size)?.size || [64, 32];
const bakedRequests = [...new Map(Object.entries(MODEL_CLASSES).map(([type, sourceClass]) => {
  const hint = TEXTURE_HINTS[type];
  const variants = textures.filter((texture) => texture.path.includes('/entity/' + hint));
  return [sourceClass, { className: sourceClass, textureSize: textureSizeFor(type, variants) }];
})).values()];
const bakedModels = extractBakedModels(bakedRequests);
const entities = {};
for (const [type, sourceClass] of Object.entries(MODEL_CLASSES)) {
  const classFile = sourceClass.replaceAll('.', '/') + '.class';
  let geometry = null, error = null;
  const hint = TEXTURE_HINTS[type];
  const variants = textures.filter((texture) => texture.path.includes('/entity/' + hint));
  geometry = bakedModels.get(sourceClass) || null;
  if (geometry) error = null;
  else if (!available.has(sourceClass)) error = 'class-not-found';
  else {
    try {
      const output = childProcess.execFileSync(javap, ['-classpath', MINECRAFT, '-c', '-p', sourceClass], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      geometry = parseModel(output, sourceClass);
      if (!geometry) error = 'createBodyLayer-not-found';
    } catch (cause) { error = String(cause.message || cause).split(/\r?\n/)[0]; }
  }
  entities[type] = {
    source: 'minecraft-java-26.2', modelClass: sourceClass, classFile,
    textureVariants: variants.map((texture) => texture.path),
    textureSize: variants.find((texture) => texture.size)?.size || [64, 32],
    geometry, error
  };
}

const output = {
  schema: 'minezera.entity-models.v1', source: 'Minecraft Java 26.2',
  coordinateSystem: 'minecraft-model-part', generatedBy: 'scripts/import-minecraft-26.2-models.js', entities
};
fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
const parsed = Object.values(entities).filter((entity) => entity.geometry).length;
console.log(`Modelos exportados: ${parsed}/${Object.keys(entities).length}`);
console.log(`Manifesto: ${path.relative(ROOT, OUTPUT)}`);
