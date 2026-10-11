import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import PublishArticleComposer from '../PublishArticleComposer.vue';
import type { PublishArticleState } from '../../../utils/publishArticle';

afterEach(() => vi.restoreAllMocks());

it('重新挂载长草稿时等待输入框进入布局后测量，不缓存未挂载时的 44px 高度', async () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.isConnected ? 600 : 0; });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.isConnected ? 7000 : 0; });
  const state: PublishArticleState = { title: '', cover: null, blocks: [{ id: 'saved', type: 'text', text: '保存的长正文'.repeat(2000) }] };
  for (let reopened = 0; reopened < 2; reopened++) {
    const wrapper = mount(PublishArticleComposer, { props: { modelValue: state }, attachTo: document.body });
    try {
      await flushPromises();
      expect(wrapper.get('textarea').element.style.height).toBe('7000px');
      expect(wrapper.get('textarea').element.value).toBe(state.blocks[0].type === 'text' ? state.blocks[0].text : '');
    } finally { wrapper.unmount(); }
  }
});

it('长正文增删和草稿状态重渲染保留滚动位置、光标及输入框高度', async () => {
  const state: PublishArticleState = { title: '标题', cover: null, blocks: [{ id: 'body', type: 'text', text: '长正文'.repeat(500) }] };
  const wrapper = mount(PublishArticleComposer, { props: { modelValue: state }, attachTo: document.body });
  try {
    const input = wrapper.get('textarea');
    const textarea = input.element;
    const scroll = wrapper.element as HTMLElement;
    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, get: () => 3000 });
    Object.defineProperty(textarea, 'clientWidth', { configurable: true, get: () => 600 });
    let measuredHeight = textarea.style.height;
    // jsdom has no layout. Model the browser clamping the scroll offset when
    // the long textarea temporarily collapses during measurement.
    const heights: string[] = [];
    Object.defineProperty(textarea.style, 'height', {
      configurable: true,
      get: () => measuredHeight,
      set: (value: string) => {
        heights.push(value);
        measuredHeight = value;
        if (value === 'auto') scroll.scrollTop = 0;
      },
    });
    for (const text of ['长正文'.repeat(500) + '新增', '长正文'.repeat(450)]) {
      scroll.scrollTop = 1600;
      textarea.value = text;
      textarea.focus();
      textarea.setSelectionRange(text.length, text.length);
      await input.trigger('input');
      const next = wrapper.emitted('update:modelValue')!.at(-1)![0] as PublishArticleState;
      await wrapper.setProps({ modelValue: next });
      expect(scroll.scrollTop).toBe(1600);
      expect(textarea.selectionStart).toBe(text.length);
      expect(textarea.style.height).toBe('3000px');
      const measurements = heights.length;
      // Autosave changes the surrounding dialog state without changing text.
      wrapper.vm.$forceUpdate();
      await wrapper.vm.$nextTick();
      expect(heights).toHaveLength(measurements);
      expect(scroll.scrollTop).toBe(1600);
    }
    // Switching/restoring a draft with the same block ID still resizes it.
    await wrapper.setProps({ modelValue: { ...state, blocks: [{ id: 'body', type: 'text', text: '新草稿正文' }] } });
    expect(textarea.value).toBe('新草稿正文');
    expect(heights.at(-1)).toBe('3000px');
  } finally { wrapper.unmount(); }
});
