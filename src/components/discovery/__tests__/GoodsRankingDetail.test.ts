import { shallowMount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ getFeedDetail: vi.fn(), getFeedReplies: vi.fn(), setFeedCloudFavorite: vi.fn() }));
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
vi.mock('../../../stores/auth', () => ({ useAuthStore: () => ({ isLoggedIn: true, user: { uid: 9 } }) }));
vi.mock('../../../stores/settings', () => ({ useSettingsStore: () => ({ settings: { commentDefaultSortMode: 'hot' } }) }));
vi.mock('../../../utils/toast', () => ({ showToast: vi.fn() }));
import GoodsListDetailBody from '../../goods/GoodsListDetailBody.vue';
import FeedActionBar from '../../feed/FeedActionBar.vue';
import GoodsListItemCard from '../../goods/GoodsListItemCard.vue';
import FeedCommentSection from '../../feed/FeedCommentSection.vue';

describe('好物榜详情', () => {
  beforeEach(() => {
    api.getFeedDetail.mockReset();
    api.getFeedReplies.mockReset().mockResolvedValue({ data: [] });
    api.setFeedCloudFavorite.mockReset();
  });
  it('进入时并行加载评论，失败后显示重试，取消手动加载入口', async () => {
    let resolveDetail!: (value: unknown) => void;
    api.getFeedDetail.mockImplementation(() => new Promise(resolve => { resolveDetail = resolve; }));
    api.getFeedReplies.mockRejectedValueOnce(new Error('评论网络中断'));
    const w = shallowMount(GoodsListDetailBody, { props: { feedId: '123', kind: 'ranking' } });
    expect(api.getFeedReplies).toHaveBeenCalledWith('123', 1, expect.any(Object));
    await flushPromises();
    resolveDetail({ data: { id: 123, goodsListInfo: { title: '鼠标榜' } } });
    await flushPromises();
    const section = w.findComponent(FeedCommentSection);
    expect(section.exists()).toBe(true);
    expect(section.props('officialDetail')).toBe(true);
    expect(w.find('.replies-section > .section-header').exists()).toBe(false);
    expect(section.props('error')).toBe('评论网络中断');
    expect(w.text()).not.toContain('加载回复');
    api.getFeedReplies.mockResolvedValueOnce({ data: [{ id: 99, message: '评论内容' }] });
    section.vm.$emit('retry-comments'); await flushPromises();
    expect(section.props('error')).toBe('');
    expect(section.props('comments')).toEqual([{ id: 99, message: '评论内容' }]);
    w.unmount();
  });
  it('保留服务器排名，收藏失败不更新状态，成功后更新', async () => {
    api.getFeedDetail.mockResolvedValue({ data: { id: 123, uid: 8, goodsListInfo: { title: '鼠标榜' }, goodsListItem: [{ id: 1, vote_num: 1 }, { id: 2, vote_num: 100 }] } });
    api.setFeedCloudFavorite.mockRejectedValueOnce(new Error('断网')).mockResolvedValueOnce({ code: 200 });
    const openComposer = vi.fn();
    const w = shallowMount(GoodsListDetailBody, { props: { feedId: '123', kind: 'ranking' }, global: { stubs: { FeedCommentSection: { name: 'FeedCommentSection', props: ['officialDetail'], setup(_props: unknown, { expose }: any) { expose({ openComposer }); }, template: '<div />' } } } });
    await flushPromises();
    expect(w.findAllComponents(GoodsListItemCard).map(card => card.props('item').id)).toEqual([1, 2]);
    expect(w.findAllComponents(GoodsListItemCard).map(card => card.props('rank'))).toEqual([1, 2]);
    const actions = w.findComponent(FeedActionBar);
    actions.vm.$emit('toggle-fav'); await flushPromises();
    expect(actions.props('favorited')).toBe(false);
    actions.vm.$emit('toggle-fav'); await flushPromises();
    expect(api.setFeedCloudFavorite).toHaveBeenLastCalledWith('123', true, 'goodsList');
    expect(actions.props('favorited')).toBe(true);
    actions.vm.$emit('write-comment'); await flushPromises();
    expect(openComposer).toHaveBeenCalledOnce();
    w.unmount();
  });
});
