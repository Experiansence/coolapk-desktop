import type { InjectionKey, Ref } from 'vue';

/** 缓存的栏目保留内容，但固定浮层只能属于当前可交互页面。 */
export const feedPageVisibleKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('feed-page-visible');
/** 翻页动画期间仍需绘制相邻栏目，不能用浮层的交互可见状态回收内容。 */
export const feedPageRenderKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('feed-page-render');
export const homePagerMovingKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('home-pager-moving');
