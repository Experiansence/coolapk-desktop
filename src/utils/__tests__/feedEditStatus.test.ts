import { describe, expect, it } from 'vitest';
import { isFeedEdited } from '../feedEditStatus';

describe('动态编辑状态', () => {
  it.each([
    { isModified: true }, { isModified: 1 }, { is_modified: '1' },
    { changeCount: 2 }, { change_count: '1' },
    { lastChangeTime: 1786000000 }, { last_change_time: '1786000000' },
  ])('识别接口编辑字段 %j', (feed) => {
    expect(isFeedEdited(feed)).toBe(true);
  });
  it.each([null, undefined, {}, { isModified: 0 }, { is_modified: '0', change_count: 0 }, { lastChangeTime: '' }])('不标记未编辑动态 %j', (feed) => {
    expect(isFeedEdited(feed)).toBe(false);
  });
});
