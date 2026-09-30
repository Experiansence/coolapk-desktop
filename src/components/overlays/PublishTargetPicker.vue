<template>
  <section class="target-picker">
    <div class="target-current">
      <span>发布到：{{ modelValue?.title || '普通动态' }}</span>
      <button type="button" @click="expanded = !expanded">{{ expanded ? '收起' : '选择板块' }}</button>
      <button v-if="modelValue" type="button" @click="emit('update:modelValue', null)">移除</button>
    </div>
    <template v-if="expanded">
      <div class="tabs"><button v-for="tab in tabs" :key="tab.type" type="button" :class="{ active: type === tab.type }" @click="type = tab.type">{{ tab.title }}</button></div>
      <input v-model="query" aria-label="搜索发布板块" placeholder="搜索话题、应用或产品" />
      <p v-if="error" role="alert">{{ error }} <button type="button" @click="load(true)">重试</button></p>
      <button v-for="target in targets" :key="target.id" type="button" class="target-choice" @click="choose(target)">{{ target.title }}</button>
      <p v-if="loading">正在读取板块…</p>
      <p v-else-if="!targets.length && !error">{{ query.trim() ? '没有找到板块' : '输入名称搜索板块' }}</p>
      <button v-if="hasMore && !loading" type="button" @click="load(false)">加载更多</button>
    </template>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { normalizePublishTopics } from '../../utils/publishTopics';
import type { PublishTarget } from '../../types/publish';
defineProps<{ modelValue: PublishTarget | null }>();
const emit = defineEmits<{ 'update:modelValue': [target: PublishTarget | null] }>();
const tabs = [{ type: 'tag', title: '话题' }, { type: 'apk', title: '应用' }, { type: 'product_phone', title: '产品' }] as const;
const expanded = ref(false);
const type = ref<PublishTarget['type']>('tag');
const query = ref('');
const targets = ref<PublishTarget[]>([]);
const error = ref('');
const loading = ref(false);
const hasMore = ref(false);
let revision = 0;
let page = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
async function load(reset: boolean) {
  clearTimeout(timer);
  const request = ++revision;
  const nextPage = reset ? 1 : page + 1;
  if (reset) { targets.value = []; hasMore.value = false; }
  if (!query.value.trim() && type.value !== 'tag') { loading.value = false; return; }
  loading.value = true;
  error.value = '';
  try {
    const response = type.value === 'tag' ? await CoolapkTauriAPI.searchPublishTopics(query.value.trim(), nextPage) : type.value === 'apk' ? await CoolapkTauriAPI.searchApks(query.value.trim(), nextPage) : await CoolapkTauriAPI.searchByType({ searchType: 'product', query: query.value.trim(), page: nextPage });
    if (request !== revision) return;
    if (response?.code !== 200) throw new Error(response?.message || '搜索板块失败');
    const items: PublishTarget[] = type.value === 'tag' ? normalizePublishTopics(response.data).map((topic) => ({ ...topic, type: 'tag' })) : (Array.isArray(response.data) ? response.data : []).flatMap((item: any) => {
      const id = String(type.value === 'apk' ? item.targetId || item.id || '' : item.id || '');
      const title = String(item.appName || item.title || item.name || '');
      return id && title ? [{ type: type.value, id, title, logo: item.logo }] : [];
    });
    const previous = reset ? [] : targets.value;
    targets.value = [...new Map([...previous, ...items].map((item) => [item.id, item])).values()];
    page = nextPage;
    hasMore.value = items.length > 0 && (reset || targets.value.length > previous.length);
  } catch (failure) { if (request === revision) error.value = String(failure instanceof Error ? failure.message : failure); }
  finally { if (request === revision) loading.value = false; }
}
async function choose(target: PublishTarget) {
  const request = ++revision;
  loading.value = true;
  error.value = '';
  try {
    // 产品详情中的子板块及填写规则必须取服务端配置，不能由搜索结果猜测。
    if (target.type === 'product_phone') {
      const response = await CoolapkTauriAPI.getProductDetail(target.id);
      if (request !== revision) return;
      if (response?.code !== 200 || !response.data) throw new Error(response?.message || '读取产品详情失败');
      target = { ...target, subTabs: response.data.subTab || [], configRows: response.data.configRows || [], isOwner: response.data.isOwner };
    }
    emit('update:modelValue', target);
    expanded.value = false;
  } catch (failure) { if (request === revision) error.value = String(failure instanceof Error ? failure.message : failure); }
  finally { if (request === revision) loading.value = false; }
}
watch([query, type], () => { ++revision; loading.value = false; targets.value = []; hasMore.value = false; error.value = ''; clearTimeout(timer); timer = setTimeout(() => void load(true), 500); });
watch(expanded, (value) => { if (value) void load(true); else { ++revision; clearTimeout(timer); loading.value = false; } });
onBeforeUnmount(() => { ++revision; clearTimeout(timer); });
</script>
<style scoped>
.target-picker { margin-top: 12px; color: var(--text-secondary); font-size: var(--font-size-sub); }
.target-current, .tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
button { color: var(--brand-primary); padding: 5px 9px; }
.target-choice { border: 1px solid var(--border); border-radius: var(--radius-pill); margin: 4px; }
.active { background: var(--brand-soft); }
input { width: 100%; padding: 8px; background: var(--surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-control); }
</style>
