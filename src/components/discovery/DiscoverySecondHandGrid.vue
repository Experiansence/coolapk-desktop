<template>
  <div class="secondhand-waterfall">
    <div v-for="(item,index) in items" :key="getEntityKey(item,index)" :ref="el => observeCard(el as HTMLElement | null, getEntityKey(item,index))" class="secondhand-grid-item" :style="{ gridRowEnd: `span ${spans[getEntityKey(item,index)] || 1}` }">
      <DiscoverySecondHandCard :entity="item" @open="$emit('open', $event)" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { onUnmounted, reactive } from 'vue';
import type { DiscoveryEntity } from '../../types/discovery';
import { getEntityKey } from '../../utils/discovery';
import { observeResizeOnFrame } from '../../utils/observeResizeOnFrame';
import DiscoverySecondHandCard from './DiscoverySecondHandCard.vue';
defineProps<{ items: DiscoveryEntity[] }>();
defineEmits<{ open: [entity: DiscoveryEntity] }>();
const spans = reactive<Record<string,number>>({});
const observed = new Map<string,{ element:Element; stop:()=>void }>();
function observeCard(wrapper:HTMLElement|null,key:string) {
  const element = wrapper?.firstElementChild;
  const previous = observed.get(key);
  if (previous?.element === element) return;
  previous?.stop(); observed.delete(key);
  if (!element) { delete spans[key]; return; }
  const stop = observeResizeOnFrame(element,()=> { spans[key] = Math.max(1,Math.ceil((element.getBoundingClientRect().height + 8) / 12)); });
  observed.set(key,{element,stop});
}
onUnmounted(()=> { observed.forEach(item=>item.stop()); observed.clear(); });
</script>
<style scoped>
.secondhand-waterfall { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-auto-rows:4px; gap:8px; }
.secondhand-grid-item { min-width:0; align-self:start; }
@media(max-width:1100px) { .secondhand-waterfall { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media(max-width:720px) { .secondhand-waterfall { grid-template-columns:repeat(2,minmax(0,1fr)); } }
</style>
