import catalog from '../../../data/android-devices/catalog.json';
import { describe, it, expect, vi } from 'vitest';
import { searchDevicePresets, groupDevicePresets, getDeviceSeries, loadDevicePresets, resolveDeviceIdentity, getAndroidSdkWarning } from '../devicePresets';

const rows = catalog.rows.map(([brand, label, device, model]: string[], index: number) => ({ id: String(index), brand, label, device, model }));

describe('official device catalog', () => {
  it('retains the complete downloaded table and its source hash', () => {
    expect(catalog.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(rows.length).toBeGreaterThan(50000);
    expect(catalog.columns).toEqual(['Retail Branding', 'Marketing Name', 'Device', 'Model']);
    expect(rows.every((row: { model: string }) => typeof row.model === 'string')).toBe(true);
  });

  it('finds official model mappings across the full table', () => {
    for (const [name, model] of [['Xiaomi 13 Pro', '2210132C'], ['Xiaomi 14', '23127PN0CC'], ['Redmi K80', '24117RK2CC']]) {
      expect(rows.some((row: { label: string; model: string }) => row.label.toLowerCase() === name.toLowerCase() && row.model === model)).toBe(true);
      expect(searchDevicePresets(rows, model).some(row => row.model === model)).toBe(true);
    }
    expect(searchDevicePresets(rows, 'caiman').some(row => row.label === 'Pixel 9 Pro')).toBe(true);
    expect(searchDevicePresets(rows, '', 100)).toHaveLength(100);
    expect(searchDevicePresets(rows, '')).toHaveLength(rows.length);
    expect(searchDevicePresets(rows, 'xiaomi 13 pro').some(row => row.model === '2210132C')).toBe(true);
  });

  it('groups every record without dropping variants or truncating large series', () => {
    const grouped = groupDevicePresets(rows);
    const restored = grouped.flatMap(brand => [...brand.series.values()].flatMap(series => [...series.values()].flat()));
    expect(restored).toHaveLength(rows.length);
    expect(new Set(restored.map(row => row.id)).size).toBe(rows.length);
    const xiaomi = grouped.find(brand => brand.key === 'xiaomi')!;
    const numeric = xiaomi.series.get('数字系列')!;
    expect([...numeric.values()].flat().some(row => row.model === '2210132C')).toBe(true);
    expect(getDeviceSeries({ id: 'test', brand: 'Xiaomi', label: 'Mi 11', device: 'venus', model: 'M2011K2C' })).toBe('数字系列');
    expect(grouped.find(brand => brand.key === 'redmi')?.series.get('K 系列')).toBeDefined();
  });

  it('loads the packaged table once', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => catalog });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const [first, second] = await Promise.all([loadDevicePresets(), loadDevicePresets()]);
      expect(first).toBe(second);
      expect(first.length).toBe(rows.filter((row: { model: string }) => row.model.trim()).length);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const reloaded = await loadDevicePresets();
      expect(reloaded).toEqual(first);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { vi.unstubAllGlobals(); }
  });

  it('keeps explicit manufacturer overrides and detects inconsistent SDK versions', () => {
    expect(resolveDeviceIdentity({ model: '24117RK2CC', brand: 'Redmi' })).toEqual({ manufacturer: 'Xiaomi', brand: 'Redmi' });
    expect(resolveDeviceIdentity({ model: 'SM-S9280', brand: 'samsung', manufacturer: 'Samsung' })).toEqual({ manufacturer: 'Samsung', brand: 'samsung' });
    expect(getAndroidSdkWarning('15', '36')).toContain('SDK 35');
    expect(getAndroidSdkWarning('16', '36')).toBe('');
  });
});
