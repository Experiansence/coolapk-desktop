<template>
  <div v-if="recommendations.length" class="recommendations" aria-label="推荐话题">
    <span>推荐话题</span>
    <button v-for="item in recommendations" :key="item.title" type="button" :title="item.source + '话题'" @mousedown.prevent @click="emit('select', item.title)">#{{ item.title }}# <small>{{ item.source }}</small></button>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { parseTopicRecommendations, recommendPublishTopics, type TopicRecommendationConfig } from '../../utils/publishRecommendations';
import { loadRecentPublishTopics, normalizePublishTopics, type PublishTopic } from '../../utils/publishTopics';
const props = defineProps<{ uid: string; text: string; cursor: number; nodeType?: string; nodeName?: string; refresh?: number }>();
const emit = defineEmits<{ select: [title: string] }>();
const config = ref<TopicRecommendationConfig>({ recommended: [], rules: [] });
const hot = ref<PublishTopic[]>([]);
const recent = ref<PublishTopic[]>([]);
let revision = 0;
const recommendations = computed(() => recommendPublishTopics(config.value, props.text, props.cursor, recent.value, hot.value, props.nodeType, props.nodeName));
// 两个来源独立读取，其中一个失败仍显示另一个来源的推荐。
watch(() => props.uid, async (uid) => {
  const request = ++revision;
  const results = await Promise.allSettled([CoolapkTauriAPI.getTabConfig(), CoolapkTauriAPI.searchPublishTopics('', 1), loadRecentPublishTopics(uid)]);
  if (request !== revision) return;
  if (results[0].status === 'fulfilled') config.value = parseTopicRecommendations(results[0].value);
  if (results[1].status === 'fulfilled') hot.value = normalizePublishTopics(results[1].value?.data);
  if (results[2].status === 'fulfilled') recent.value = results[2].value;
}, { immediate: true });
watch(() => props.refresh, async () => { const uid = props.uid; const value = await loadRecentPublishTopics(uid); if (uid === props.uid) recent.value = value; });
</script>
<style scoped>
.recommendations { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; font-size: var(--font-size-caption); color: var(--text-secondary); align-items: center; }
button { padding: 4px 8px; border-radius: var(--radius-pill); background: var(--surface); color: var(--brand-primary); }
small { color: var(--text-tertiary); }
</style>
