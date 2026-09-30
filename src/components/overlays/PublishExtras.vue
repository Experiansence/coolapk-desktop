<template>
  <section class="publish-extras" aria-label="内容声明和附加内容">
    <label>内容声明 <select :value="declaration" @change="setDeclaration"><option value="0">无需声明</option><option value="1">内容原创</option><option value="3">内容转载</option></select></label>
    <label v-if="declaration === 1"><input type="checkbox" :checked="modelValue.originalType === 2" @change="setRepost" />未经允许，禁止转载</label>
    <div class="goods-selection"><button type="button" @click="showGoods = true">添加商品</button><span v-if="goodsTitle">{{ goodsTitle }}</span><button v-if="modelValue.extraUrl" type="button" @click="removeGoods">移除商品</button></div>
    <label>订阅号 <select :value="modelValue.dyhId || ''" @change="setDyh"><option value="">不发布到订阅号</option><option v-for="dyh in dyhs" :key="dyh.id" :value="String(dyh.id)">{{ dyh.title }}</option></select></label>
    <button v-if="hasMoreDyhs && !loading" type="button" @click="loadDyhs(false)">更多订阅号</button>
    <p v-if="loading">正在读取可编辑订阅号…</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="loadDyhs(true)">重试</button></p>
    <GoodsSearchPickerDialog :is-open="showGoods" title="选择动态附加商品" @close="showGoods = false" @pick="chooseGoods" />
  </section>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PublishOptions } from '../../types/publish';
import { CoolapkTauriAPI } from '../../api/coolapk';
import GoodsSearchPickerDialog from '../goods/GoodsSearchPickerDialog.vue';
const props = defineProps<{ uid: string; modelValue: PublishOptions; attachmentTitle?: string }>();
const emit = defineEmits<{ 'update:modelValue': [options: PublishOptions]; 'attachment-title': [title: string] }>();
const declaration = computed(() => props.modelValue.originalType === 2 ? 1 : props.modelValue.originalType || 0);
const showGoods = ref(false);
const goodsTitle = ref(props.attachmentTitle || '');
const dyhs = ref<{ id: string; title: string }[]>([]);
const loading = ref(false);
const error = ref('');
const hasMoreDyhs = ref(false);
let page = 0;
let revision = 0;
function update(options: Partial<PublishOptions>) { emit('update:modelValue', { ...props.modelValue, ...options }); }
function setDeclaration(event: Event) { update({ originalType: Number((event.target as HTMLSelectElement).value) as 0 | 1 | 3 }); }
function setRepost(event: Event) { update({ originalType: (event.target as HTMLInputElement).checked ? 2 : 1 }); }
function setDyh(event: Event) { update({ dyhId: (event.target as HTMLSelectElement).value }); }
function removeGoods() { goodsTitle.value = ''; emit('attachment-title', ''); update({ extraUrl: '' }); }
async function chooseGoods(goods: any) {
  showGoods.value = false;
  error.value = '';
  try {
    // 搜索结果缺少实体链接时补读详情，不能猜测商城跳转地址。
    const item = goods.url ? goods : (await CoolapkTauriAPI.getGoodsDetail(String(goods.id || goods.entityId)))?.data;
    if (!item?.url) throw new Error('商品缺少可附加的链接，请换一个商品');
    goodsTitle.value = item.goods_title || item.title || goods.goods_title || goods.title || '已附加商品';
    emit('attachment-title', goodsTitle.value);
    update({ extraUrl: String(item.url) });
  } catch (failure) { error.value = failure instanceof Error ? failure.message : String(failure); }
}
async function loadDyhs(reset: boolean) {
  const request = ++revision;
  const next = reset ? 1 : page + 1;
  loading.value = true;
  error.value = '';
  try {
    const response = await CoolapkTauriAPI.getMyDyhEditorList(next);
    if (request !== revision) return;
    if (response?.code !== 200) throw new Error(response?.message || '读取可编辑订阅号失败');
    const items = (Array.isArray(response.data) ? response.data : []).filter((item: any) => item.id && item.title);
    const previous = reset ? [] : dyhs.value;
    dyhs.value = [...new Map([...previous, ...items].map((item) => [String(item.id), item])).values()];
    hasMoreDyhs.value = items.length > 0 && (reset || dyhs.value.length > previous.length);
    page = next;
  } catch (failure) { if (request === revision) error.value = failure instanceof Error ? failure.message : String(failure); }
  finally { if (request === revision) loading.value = false; }
}
watch(() => props.uid, () => { dyhs.value = []; void loadDyhs(true); }, { immediate: true });
watch(() => props.attachmentTitle, (value) => { goodsTitle.value = value || ''; });
</script>
<style scoped>
.publish-extras { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; font-size: var(--font-size-sub); color: var(--text-secondary); }
label, .goods-selection { display: flex; gap: 6px; align-items: center; }
select { padding: 6px; max-width: 220px; background: var(--surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-control); }
button { color: var(--brand-primary); }
</style>
