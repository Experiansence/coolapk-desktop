<template>
  <section class="product-options" aria-label="产品子板块">
    <label>子板块 <select v-model="subType"><option value="">普通讨论</option><option v-for="tab in tabs" :key="tab.pageName" :value="tab.pageName">{{ tab.title }}</option></select></label>
    <label v-if="subType === '1'">亮屏续航（小时）<input v-model="hours" type="number" step="0.1" :min="currentTab?.subTabRule?.min || 2" :max="currentTab?.subTabRule?.max || 17" /></label>
    <div v-if="subType === '2'" class="scores"><label v-for="field in BENCHMARK_FIELDS" :key="field.key">{{ field.title }}<input v-model="scores[field.key]" type="number" min="1" step="1" /></label></div>
    <p v-if="subType === '3' || subType === '4'">{{ currentTab?.title }}必须附上图片。</p>
    <label v-if="subType === '5'">问题严重度 <select v-model="level"><option value="">请选择</option><option v-for="(title, index) in ['较低', '一般', '次要', '严重', '致命']" :key="title" :value="String(index + 1)">{{ title }}</option></select></label>
    <template v-if="subType === '6'">
      <label>到手价（元）<input v-model="price" type="number" min="0.01" max="9999999.99" step="0.01" /></label>
      <label>产品配置 <select v-model="configId"><option value="">请选择配置</option><option v-for="config in versions" :key="config.id" :value="String(config.id)">{{ config.title }}</option></select></label>
      <p v-if="loading">正在读取产品配置…</p><p v-if="error" role="alert">{{ error }} <button type="button" @click="loadVersions">重试</button></p>
    </template>
  </section>
</template>
<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import type { PublishTarget, PublishOptions } from '../../types/publish';
import { BENCHMARK_FIELDS } from '../../utils/publishProduct';
import { CoolapkTauriAPI } from '../../api/coolapk';
const props = defineProps<{ target: PublishTarget; modelValue: PublishOptions }>();
const emit = defineEmits<{ 'update:modelValue': [options: PublishOptions] }>();
const subType = ref('');
const hours = ref('');
const level = ref('');
const price = ref('');
const configId = ref('');
const scores = reactive<Record<string, string>>({});
const versions = ref<{ id: string | number; title: string }[]>([]);
const loading = ref(false);
const error = ref('');
let revision = 0;
const tabs = computed(() => (props.target.subTabs || []).filter((tab) => /^[0-6]$/.test(tab.pageName)));
const currentTab = computed(() => tabs.value.find((tab) => tab.pageName === subType.value));
async function loadVersions() {
  const request = ++revision;
  loading.value = true;
  error.value = '';
  try {
    const response = await CoolapkTauriAPI.getProductVersions(props.target.id);
    if (request !== revision) return;
    if (response?.code !== 200) throw new Error(response?.message || '获取配置失败');
    versions.value = (Array.isArray(response.data) ? response.data : []).filter((item: any) => Number(item.id) > 0 && item.title);
  } catch (failure) { if (request === revision) error.value = String(failure instanceof Error ? failure.message : failure); }
  finally { if (request === revision) loading.value = false; }
}
// 切换产品清空专属信息，避免把上一个产品的续航、分数和配置传到新产品。
watch(() => props.target.id, () => { ++revision; subType.value = ''; hours.value = ''; level.value = ''; price.value = ''; configId.value = ''; versions.value = []; Object.keys(scores).forEach((key) => delete scores[key]); }, { immediate: true });
watch(subType, (id) => { if (id === '6' && !versions.value.length) void loadVersions(); });
watch([subType, hours, level, price, configId, scores], () => {
  let data = '';
  if (subType.value === '1') data = String(hours.value);
  if (subType.value === '2') data = JSON.stringify(Object.fromEntries(Object.entries(scores).filter(([, value]) => Number(value) > 0).map(([key, value]) => [key, Number(value)])));
  if (subType.value === '5') data = level.value;
  if (subType.value === '6') { const config = versions.value.find((item) => String(item.id) === configId.value); data = JSON.stringify({ final_price: Number(price.value), config_id: Number(configId.value), config_name: config?.title || '' }); }
  emit('update:modelValue', { subTypeId: subType.value, subData: data });
}, { deep: true });
</script>
<style scoped>
.product-options { display: flex; flex-wrap: wrap; gap: 10px; padding: 10px 0; color: var(--text-secondary); font-size: var(--font-size-sub); }
label { display: flex; align-items: center; gap: 8px; }
input, select { padding: 6px; border: 1px solid var(--border); border-radius: var(--radius-control); background: var(--surface); color: var(--text-primary); max-width: 210px; }
.scores { display: flex; flex-wrap: wrap; gap: 8px; }
button { color: var(--brand-primary); }
</style>
