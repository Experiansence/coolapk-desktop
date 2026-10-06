import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sourceUrl = 'https://storage.googleapis.com/play_public/supported_devices.csv';
const sourcePath = new URL('../data/android-devices/supported_devices.csv', import.meta.url);
const outputPath = new URL('../data/android-devices/catalog.json', import.meta.url);
const download = process.argv.includes('--download');
const previous = await readFile(outputPath, 'utf8').then(JSON.parse).catch(() => null);
let bytes;
if (download) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
} else {
  bytes = await readFile(sourcePath);
}

// Google 原表为带 BOM 的 UTF-16 CSV，支持引号、逗号与引号转义。
const text = new TextDecoder(bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8').decode(bytes);
const rows = [];
let row = [], field = '', quoted = false;
for (let i = 0; i < text.length; i++) {
  const char = text[i];
  if (char === '"') {
    if (quoted && text[i + 1] === '"') { field += '"'; i++; }
    else quoted = !quoted;
  } else if (!quoted && (char === ',' || char === '\n')) {
    row.push(field.replace(/\r$/, '')); field = '';
    if (char === '\n') { rows.push(row); row = []; }
  } else field += char;
}
if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
if (quoted) throw new Error('Unclosed CSV quote');
const columns = rows.shift();
if (columns?.join('|') !== 'Retail Branding|Marketing Name|Device|Model') throw new Error('Unexpected official table schema');
if (!rows.length || rows.some(item => item.length !== 4)) throw new Error('Incomplete official table');
const catalog = {
  sourceUrl,
  downloadedOn: download ? new Date().toISOString().slice(0, 10) : previous?.downloadedOn ?? null,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  columns,
  rows,
};
// 校验全部完成后才替换快照，失败保留现有表。
if (download) await writeFile(sourcePath, bytes);
await writeFile(outputPath, JSON.stringify(catalog) + '\n');
console.log(`Official device catalog: ${rows.length} rows, SHA-256 ${catalog.sha256}`);
