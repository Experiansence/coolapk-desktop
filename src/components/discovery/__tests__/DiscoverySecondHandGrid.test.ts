import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DiscoverySecondHandGrid from '../DiscoverySecondHandGrid.vue';

afterEach(()=>vi.unstubAllGlobals());
describe('二手瀑布流',()=> {
  it('图片高度改变后在下一帧重新排列，移除卡片时释放观察任务',async()=> {
    const observers:Array<{notify:()=>void;disconnect:ReturnType<typeof vi.fn>}> = [];
    const frames = new Map<number,FrameRequestCallback>(); let id=0;
    vi.stubGlobal('ResizeObserver',class {
      disconnect=vi.fn();
      constructor(notify:()=>void) { observers.push({notify,disconnect:this.disconnect}); }
      observe() {}
    });
    vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=> { frames.set(++id,callback); return id; });
    vi.stubGlobal('cancelAnimationFrame',(handle:number)=>frames.delete(handle));
    const w=mount(DiscoverySecondHandGrid,{props:{items:[{id:1},{id:2}]},global:{stubs:{DiscoverySecondHandCard:{template:'<button>商品</button>'}}}});
    const card=w.find('button').element;
    let height=200;
    vi.spyOn(card,'getBoundingClientRect').mockImplementation(()=>({height}) as DOMRect);
    const paint=async()=> { const callbacks=[...frames.values()]; frames.clear(); callbacks.forEach(callback=>callback(0)); await w.vm.$nextTick(); };
    observers[0].notify(); await paint();
    const oldSpan=w.find('.secondhand-grid-item').attributes('style');
    height=350; observers[0].notify(); await paint();
    expect(w.find('.secondhand-grid-item').attributes('style')).not.toBe(oldSpan);
    observers[1].notify(); await w.setProps({items:[{id:1}]});
    expect(observers[1].disconnect).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
    w.unmount(); expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });
});
