import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FeedTabs from '../FeedTabs.vue';

afterEach(() => vi.restoreAllMocks());
describe('频道指示条滑动性能', () => {
  it('滑动复用已测量的位置，不重复读取布局或滚动栏目栏', async () => {
    const left = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(360);
    const w = mount(FeedTabs, { props: { activeKey: 'life', tabs: [{ page_name: 'life', title: '生活', url: 'life' }, { page_name: 'picture', title: '酷图', url: 'picture' }], showManage: false }, global: { stubs: { TabManagerModal: true } } });
    await flushPromises();
    const reads = left.mock.calls.length;
    for (let progress = 0; progress <= 1; progress += .1) w.vm.setSwipeProgress(progress);
    expect(left).toHaveBeenCalledTimes(reads);
    expect(w.get('.sliding-indicator').attributes('style')).toContain('translate3d');
    w.unmount();
  });
});
