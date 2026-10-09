import catalogUrl from '../../data/android-devices/catalog.json?url';
import appleCatalog from '../../data/apple-devices/catalog.json';

/** 苹果表与安卓表使用相同四列；Device 列保留来源提供的设备分类。 */
export const appleDevicePresets: DevicePreset[] = appleCatalog.rows.map(([brand, label, device, model], index) => ({ id: `apple-${index}`, brand, label, device, model }));

export interface DevicePreset {
  id: string;
  label: string;
  brand: string;
  device: string;
  model: string;
}

let catalogPromise: Promise<DevicePreset[]> | null = null;
/** 从随安装包提供的 Google 官方表和 AppleDB 快照读取设备信息。 */
export function loadDevicePresets(): Promise<DevicePreset[]> {
  return catalogPromise ??= fetch(catalogUrl).then(async response => {
    if (!response.ok) throw new Error('机型表加载失败');
    const data = await response.json() as { rows: [string, string, string, string][] };
    return data.rows.map(([brand, label, device, model], index) => ({
      id: String(index), brand, label: label || model || device, device, model,
    })).filter(item => item.model.trim()).concat(appleDevicePresets);
  }).finally(() => {
    // 只合并正在读取的请求；调用方保留需要的表，机型名称索引不额外常驻五万行对象。
    catalogPromise = null;
  });
}

const normalize = (value: string) => value.trim().replace(/\s+/g, '').toLowerCase();
/** 搜索整张表，不截断匹配结果；由品牌、系列和机型分级展示。 */
export function searchDevicePresets(rows: DevicePreset[], query: string, limit = Infinity): DevicePreset[] {
  const value = normalize(query);
  const result: DevicePreset[] = [];
  for (const row of rows) {
    if (!value || [row.label, row.brand, row.device, row.model].some(field => normalize(field).includes(value))) {
      result.push(row);
      if (result.length >= limit) break;
    }
  }
  return result;
}

/** 官方表不含系列字段，仅根据销售名称归类，不修改官方型号映射。 */
export function getDeviceSeries(row: DevicePreset): string {
  const brand = row.brand.toLowerCase();
  const name = row.label.trim();
  // 苹果分类直接使用源表的设备类别，不从型号编号猜测产品系列。
  if (brand === 'apple') return row.device || '其他机型';
  if (brand === 'xiaomi') {
    if (/\b(?:pad|mipad)\b/i.test(name)) return '平板系列';
    if (/^(?:xiaomi|mi)\s*mix\b/i.test(name)) return 'MIX 系列';
    if (/^(?:xiaomi|mi)\s*max\b/i.test(name)) return 'Max 系列';
    if (/^(?:xiaomi|mi)\s*note\b/i.test(name)) return 'Note 系列';
    if (/^(?:xiaomi|mi)\s*\d/i.test(name)) return '数字系列';
  }
  if (brand === 'redmi') {
    if (/\bpad\b/i.test(name)) return '平板系列';
    if (/\bnote\s*\d/i.test(name)) return 'Note 系列';
    if (/\bk\d/i.test(name)) return 'K 系列';
    if (/\ba\d/i.test(name)) return 'A 系列';
    if (/\bturbo\b/i.test(name)) return 'Turbo 系列';
    if (/^redmi\s*\d/i.test(name)) return '数字系列';
  }
  if (brand === 'poco') {
    const family = name.match(/\b([CFMX])\s*\d/i)?.[1];
    if (family) return `${family.toUpperCase()} 系列`;
  }
  if (brand === 'samsung') {
    if (/galaxy\s*(?:z\b|fold|flip)/i.test(name)) return 'Galaxy Z 折叠系列';
    if (/galaxy\s*tab/i.test(name)) return 'Galaxy Tab 平板系列';
    const family = name.match(/galaxy\s*([SAFMJN])\s*\d/i)?.[1];
    if (family) return `Galaxy ${family.toUpperCase()} 系列`;
  }
  if (brand === 'google' && /^pixel/i.test(name)) {
    if (/tablet/i.test(name)) return 'Pixel Tablet 系列';
    if (/fold/i.test(name)) return 'Pixel 折叠系列';
    return 'Pixel 数字系列';
  }
  // 其他品牌按名称的字母系列分组；没有可识别系列的仍完整保留。
  const stripped = name.toLowerCase().startsWith(brand) ? name.slice(row.brand.length).trim() : name;
  const family = stripped.match(/^([a-z][a-z -]*?)\s*\d/i)?.[1]?.trim();
  return family ? `${family.toUpperCase()} 系列` : '其他机型';
}

export interface DeviceCatalogBrand {
  key: string;
  label: string;
  series: Map<string, Map<string, DevicePreset[]>>;
}

export function groupDevicePresets(rows: DevicePreset[]): DeviceCatalogBrand[] {
  const brands = new Map<string, DeviceCatalogBrand>();
  for (const row of rows) {
    const key = row.brand.trim().toLowerCase() || 'unknown';
    let brand = brands.get(key);
    if (!brand) {
      brand = { key, label: row.brand.trim() || '未注明品牌', series: new Map() };
      brands.set(key, brand);
    }
    const seriesName = getDeviceSeries(row);
    let series = brand.series.get(seriesName);
    if (!series) { series = new Map(); brand.series.set(seriesName, series); }
    const name = row.label.trim() || row.model;
    const variants = series.get(name) ?? [];
    variants.push(row);
    series.set(name, variants);
  }
  return [...brands.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN', { numeric: true }));
}

/** Google 表中的 Retail Branding 是销售品牌，制造商可另行按实际设备覆盖。 */
export function resolveDeviceIdentity(f: { model: string; manufacturer?: string; brand?: string }) {
  const brand = f.brand?.trim() || (f.model.trim() === '23113RKC6C' ? 'Redmi' : 'Xiaomi');
  const manufacturer = f.manufacturer?.trim() || (/^(redmi|poco|xiaomi)$/i.test(brand) ? 'Xiaomi' : brand);
  return { manufacturer, brand };
}

export function getAndroidSdkWarning(androidVersion: string, sdkInt: string): string {
  const sdk = ({ '12': '31', '12.1': '32', '13': '33', '14': '34', '15': '35', '16': '36', '17': '37' } as Record<string, string>)[androidVersion.trim()];
  return sdk && sdkInt.trim() && sdkInt.trim() !== sdk
    ? `Android ${androidVersion.trim()} 通常对应 SDK ${sdk}，当前填写 ${sdkInt.trim()}，请按设备实际系统核对。` : '';
}
