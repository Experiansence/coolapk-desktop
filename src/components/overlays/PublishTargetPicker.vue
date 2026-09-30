<template>
  <section class="target-picker">
    <div class="target-current"><button type="button" class="publish-setting-row" @click="expanded = true"><PublishIcon name="add" class="setting-icon" /><span class="setting-title">{{ modelValue?.title || '发布到' }}</span><span class="setting-value" :class="{ selected: modelValue }">{{ modelValue ? '更换板块' : '选择合适的板块会有更多的赞' }}</span><i class="fas fa-chevron-right setting-arrow"></i></button><button v-if="modelValue" type="button" class="target-remove" aria-label="移除发布板块" @click="emit('update:modelValue', null)"><PublishIcon name="close" /></button></div>
    <PublishOptionSheet :is-open="expanded" title="发布到" @close="expanded = false">
      <div class="publish-search"><i class="fas fa-search"></i><input v-model="query" aria-label="搜索发布板块" placeholder="搜索话题、应用或产品" /></div>
      <div class="tabs publish-picker-tabs"><button v-for="tab in tabs" :key="tab.type" type="button" :class="{ active: type === tab.type }" @click="type = tab.type">{{ tab.title }}</button></div>
      <p v-if="error" class="publish-picker-state" role="alert">{{ error }} <button type="button" @click="load(true)">重试</button></p>
      <button v-for="target in targets" :key="target.id" type="button" class="target-choice publish-picker-item" :disabled="loading" @click="choose(target)"><AppImage v-if="target.logo" :src="target.logo" class="target-logo" alt="板块图标" /><span v-else class="publish-picker-icon"><i :class="type === 'tag' ? 'fas fa-hashtag' : type === 'apk' ? 'fas fa-th-large' : 'fas fa-mobile-alt'"></i></span><span class="publish-picker-name">{{ target.title }}</span><i class="fas fa-chevron-right publish-picker-arrow"></i></button>
      <p v-if="loading" class="publish-picker-state">正在读取板块…</p><p v-else-if="!targets.length && !error" class="publish-picker-state">{{ query.trim() ? '没有找到板块' : '输入名称搜索板块' }}</p>
      <button v-if="hasMore && !loading" type="button" class="publish-picker-more" @click="load(false)">加载更多</button>
    </PublishOptionSheet>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import PublishOptionSheet from './PublishOptionSheet.vue';
import PublishIcon from './PublishIcon.vue';
import AppImage from '../common/AppImage.vue';
import '../../styles/publish.css';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { normalizePublishTopics } from '../../utils/publishTopics';
import { normalizeProductPublishTabs } from '../../utils/publishProduct';
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
      target = { ...target, subTabs: normalizeProductPublishTabs(response.data.subTab), configRows: response.data.configRows || [], isOwner: response.data.isOwner };
    }
    emit('update:modelValue', target);
    expanded.value = false;
  } catch (failure) { if (request === revision) error.value = String(failure instanceof Error ? failure.message : failure); }
  finally { if (request === revision) loading.value = false; }
}
watch([query, type], () => { ++revision; loading.value = false; targets.value = []; hasMore.value = false; error.value = ''; clearTimeout(timer); timer = setTimeout(() => void load(true), 500); });
watch(expanded, (value) => { if (value) void load(true); else { ++revision; clearTimeout(timer); loading.value = false; } });
onBeforeUnmount(() => { ++revision; clearTimeout(timer); });
// 工具栏的应用入口复用同一个选择器，并直接定位到应用页签。
defineExpose({ openPicker: (targetType: PublishTarget['type'] = 'tag') => { type.value = targetType; expanded.value = true; } });
</script>
<style scoped>
.target-current { display: flex; align-items: center; }
.target-remove { padding: 10px; color: var(--text-tertiary); }
.target-logo { width: 36px; height: 36px; border-radius: 8px; }
@media (max-width: 600px) { .target-current .publish-setting-row { height: 56px; padding: 0 16px; border: 0; } .target-current .setting-icon { width: 32px; height: 32px; padding: 4px; } .target-current .setting-value { font-size: 12px; } .target-remove { padding-right: 16px; } .target-remove .publish-icon { width: 16px; height: 16px; } }
</style>
