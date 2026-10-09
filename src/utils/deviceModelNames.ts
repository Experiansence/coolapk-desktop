import { shallowRef } from 'vue';
import { appleDevicePresets, loadDevicePresets, type DevicePreset } from './devicePresets';

const keyOf = (value: string) => value.trim().replace(/\s+/g, '').toLowerCase();
type ModelIndex = {
  models: Map<string, string | null>;
  marketingNames: Set<string>;
};

/** 只按完整型号匹配；同一编号对应不同销售名称时保留原文。 */
export function buildDeviceModelIndex(rows: DevicePreset[]): ModelIndex {
  const index = new Map<string, string | null>();
  const marketingNames = new Set<string>();
  // 苹果完整快照随包携带，Android 目录加载失败时也能识别；重复记录不影响索引。
  for (const row of [...appleDevicePresets, ...rows]) {
    if (!row.model.trim() || !row.label.trim()) continue;
    const name = row.label.trim();
    marketingNames.add(keyOf(name));
    marketingNames.add(keyOf(`${row.brand} ${name}`));
    if (keyOf(name) === keyOf(row.model)) continue;
    const aliases = [row.model, `${row.brand} ${row.model}`];
    if (/^(redmi|poco)$/i.test(row.brand.trim())) aliases.push(`Xiaomi ${row.model}`);
    for (const alias of aliases) {
      const key = keyOf(alias);
      if (!index.has(key)) index.set(key, name);
      else if (keyOf(index.get(key) ?? '') !== keyOf(name)) index.set(key, null);
    }
  }
  return { models: index, marketingNames };
}

export function resolveDeviceModelName(raw: string, index: ModelIndex): string {
  const key = keyOf(raw);
  // 已有销售名称优先，哪怕恰好也是另一条记录的 Model，也不覆盖。
  if (index.marketingNames.has(key)) return raw;
  return index.models.get(key) || raw;
}

const modelIndex = shallowRef<ModelIndex>(buildDeviceModelIndex([]));
let loading: Promise<void> | undefined;

/** 全局只加载、索引一次；失败保留原文，下次挂载时可重试。 */
export function useDeviceModelNames(): (raw: string) => string {
  loading ??= Promise.resolve().then(loadDevicePresets).then(rows => {
    modelIndex.value = buildDeviceModelIndex(rows);
  }).catch(() => { loading = undefined; });
  return raw => resolveDeviceModelName(raw, modelIndex.value);
}
