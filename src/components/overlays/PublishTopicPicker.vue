<template>
  <section class="topic-picker" aria-label="选择话题">
    <input v-model="query" placeholder="搜索话题" aria-label="搜索话题" @keydown.enter.prevent="search(true)" />
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="search(true)">重试</button></p>
    <template v-if="!query.trim() && recent.length">
      <div class="picker-heading">最近参与 <button type="button" @click="clearRecent">清空</button></div>
      <button v-for="topic in recent" :key="topic.id" type="button" class="topic-choice" @mousedown.prevent @click="choose(topic)">#{{ topic.title }}#</button>
    </template>
    <div class="picker-heading">{{ query.trim() ? '搜索结果' : '热门话题' }}</div>
    <button v-for="topic in topics" :key="topic.id" type="button" class="topic-choice" @mousedown.prevent @click="choose(topic)">#{{ topic.title }}#</button>
    <p v-if="loading">正在获取话题…</p>
    <p v-else-if="!topics.length && !error">暂无话题</p>
    <button v-if="hasMore && !loading" type="button" @click="search(false)">加载更多</button>
    <button v-if="query.trim()" type="button" @mousedown.prevent @click="emit('select', { id: '', title: query.trim().replace(/^#|#$/g, '') })">插入自定义话题 #{{ query.trim() }}#</button>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { normalizePublishTopics, loadRecentPublishTopics, rememberPublishTopic, clearRecentPublishTopics, type PublishTopic } from '../../utils/publishTopics';

const props = defineProps<{ uid: string; initialQuery?: string }>();
const emit = defineEmits<{ select: [topic: PublishTopic] }>();
const query = ref(props.initialQuery || '');
const topics = ref<PublishTopic[]>([]);
const recent = ref<PublishTopic[]>([]);
const loading = ref(false);
const error = ref('');
const hasMore = ref(false);
let page = 0;
let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

// 搜索响应按请求序号校验，防止旧关键词覆盖新结果。
async function search(reset: boolean) {
  clearTimeout(timer);
  const request = ++revision;
  const nextPage = reset ? 1 : page + 1;
  if (reset) { topics.value = []; hasMore.value = false; }
  loading.value = true;
  error.value = '';
  try {
    const response = await CoolapkTauriAPI.searchPublishTopics(query.value.trim(), nextPage, query.value.trim() ? '' : recent.value.map((item) => item.id).join(','));
    if (request !== revision) return;
    if (response?.code !== 200) throw new Error(response?.message || '获取话题失败');
    const items = normalizePublishTopics(response.data);
    const previous = reset ? [] : topics.value;
    topics.value = [...new Map([...previous, ...items].map((item) => [item.id, item])).values()];
    page = nextPage;
    hasMore.value = items.length > 0 && (reset || topics.value.length > previous.length);
  } catch (failure) {
    if (request === revision) error.value = String(failure instanceof Error ? failure.message : failure);
  } finally {
    if (request === revision) loading.value = false;
  }
}

async function choose(topic: PublishTopic) {
  // 存储失败不阻止用户插入话题。
  emit('select', topic);
  try { await rememberPublishTopic(props.uid, topic); } catch (failure) { console.warn('保存最近话题失败', failure); }
}
async function clearRecent() { await clearRecentPublishTopics(props.uid); recent.value = []; await search(true); }
watch(query, () => { ++revision; loading.value = false; topics.value = []; hasMore.value = false; clearTimeout(timer); timer = setTimeout(() => void search(true), 500); });
watch(() => props.initialQuery, (value) => { if (value !== undefined) query.value = value; });
watch(() => props.uid, async (uid) => { ++revision; recent.value = await loadRecentPublishTopics(uid); await search(true); }, { immediate: true });
onBeforeUnmount(() => { ++revision; clearTimeout(timer); });
</script>

<style scoped>
.topic-picker { margin-top: 12px; padding: 12px; max-height: 280px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-control); }
input { width: 100%; padding: 8px; background: var(--surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-control); }
.picker-heading { margin: 10px 0; color: var(--text-secondary); }
.picker-heading button { float: right; }
button { color: var(--brand-primary); padding: 5px 9px; }
.topic-choice { margin: 3px; border: 1px solid var(--border); border-radius: var(--radius-pill); }
p { color: var(--text-secondary); }
</style>
