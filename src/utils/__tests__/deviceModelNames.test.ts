import { computed } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import catalog from '../../../data/android-devices/catalog.json';
import type { DevicePreset } from '../devicePresets';
import { buildDeviceModelIndex, resolveDeviceModelName, useDeviceModelNames } from '../deviceModelNames';

const rows = catalog.rows.map(([brand, label, device, model], index) => ({ id: String(index), brand, label, device, model }));
const index = buildDeviceModelIndex(rows);

describe('机型名称显示', () => {
  it('从已下载的完整表还原截图中的机型及其他品牌', () => {
    expect(resolveDeviceModelName('Redmi 23090RA98C', index)).toBe('Redmi Note 13 Pro+');
    expect(resolveDeviceModelName('Redmi 25102RKBEC', index)).toBe('REDMI K90 Pro Max');
    expect(resolveDeviceModelName('Xiaomi 23090RA98C', index)).toBe('Redmi Note 13 Pro+');
    expect(resolveDeviceModelName('samsung SM-S9280', index)).toBe('Galaxy S24 Ultra');
  });
  it('完整匹配，未知、截断编号及已有销售名称保留原文', () => {
    for (const raw of ['Redmi 25102RKBE', '未知设备', 'Redmi Note 13 Pro+', '小米 13 Pro', 'Samsung Galaxy S24 Ultra', 'Xiaomi 13 Pro', 'Apple iPhone17,3']) expect(resolveDeviceModelName(raw, index)).toBe(raw);
  });
  it('已有机型名称与另一条型号字段冲突时，优先原样显示名称', () => {
    const collision = buildDeviceModelIndex([
      { id: '1', brand: 'Brand', label: 'Phone 12', model: 'MODEL-123', device: '' },
      { id: '2', brand: 'Other', label: 'Other Phone', model: 'Phone 12', device: '' },
    ]);
    expect(resolveDeviceModelName('Phone 12', collision)).toBe('Phone 12');
    expect(resolveDeviceModelName('Brand Phone 12', collision)).toBe('Brand Phone 12');
    expect(resolveDeviceModelName('Brand MODEL-123', collision)).toBe('Phone 12');
  });
  it('跨品牌冲突可用品牌消歧，同品牌多个销售名称不猜测', () => {
    const make = (brand: string, label: string): DevicePreset => ({ id: label, brand, label, device: '', model: 'ABC-123' });
    const conflicting = buildDeviceModelIndex([make('A', 'A Phone'), make('B', 'B Phone'), make('B', 'Other Phone')]);
    expect(resolveDeviceModelName('ABC-123', conflicting)).toBe('ABC-123');
    expect(resolveDeviceModelName('A ABC-123', conflicting)).toBe('A Phone');
    expect(resolveDeviceModelName('B ABC-123', conflicting)).toBe('B ABC-123');
  });
  it('多个使用者只加载一次，加载完成后已显示的名称自动更新', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => catalog });
    vi.stubGlobal('fetch', fetch);
    try {
      const display = useDeviceModelNames();
      const name = computed(() => display('Redmi 23090RA98C'));
      expect(name.value).toBe('Redmi 23090RA98C');
      useDeviceModelNames();
      await vi.waitFor(() => expect(name.value).toBe('Redmi Note 13 Pro+'));
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
});
