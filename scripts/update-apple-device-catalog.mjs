import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sourceUrl = 'https://api.appledb.dev/device/main.json';
const directory = new URL('../data/apple-devices/', import.meta.url);
const sourcePath = new URL('devices.json', directory);
const outputPath = new URL('catalog.json', directory);
const download = process.argv.includes('--download');
const previous = await readFile(outputPath, 'utf8').then(JSON.parse).catch(() => null);
let bytes;
if (download) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`下载苹果设备表失败：HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
} else bytes = await readFile(sourcePath);
const devices = JSON.parse(bytes.toString('utf8'));
if (!Array.isArray(devices) || !devices.length) throw new Error('苹果设备表为空或格式错误');
const rows = [];
const seen = new Set();
for (const device of devices) {
  if (typeof device.name !== 'string' || !device.name.trim() || typeof device.type !== 'string') throw new Error('苹果设备缺少名称或分类');
  // 原表同时提供系统硬件编号和机身型号；全部保留，不生成原表没有的编号。
  for (const field of ['identifier', 'model']) {
    const values = device[field] ?? [];
    if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error(`苹果设备编号格式错误：${device.name}`);
    for (const model of values) {
      if (!model.trim()) continue;
      const row = ['Apple', device.name, device.type, model];
      const key = JSON.stringify(row);
      if (!seen.has(key)) { seen.add(key); rows.push(row); }
    }
  }
}
if (!rows.length) throw new Error('苹果设备表没有可用型号');
rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
const catalog = { sourceUrl, downloadedOn: download ? new Date().toISOString().slice(0, 10) : previous?.downloadedOn ?? null, sha256: createHash('sha256').update(bytes).digest('hex'), sourceDeviceCount: devices.length, columns: ['Retail Branding', 'Marketing Name', 'Device', 'Model'], rows };
// 完整校验后写入；原始快照留在仓库，运行时只加载精简目录。
await mkdir(directory, { recursive: true });
if (download) await writeFile(sourcePath, bytes);
await writeFile(outputPath, JSON.stringify(catalog) + '\n');
console.log(`苹果设备目录：${devices.length} 个源设备，${rows.length} 条型号记录，SHA-256 ${catalog.sha256}`);
