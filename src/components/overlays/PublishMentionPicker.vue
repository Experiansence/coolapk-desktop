<template>
  <section class="mention-picker" aria-label="选择提醒的酷友">
    <input v-model="query" placeholder="搜索酷友昵称" aria-label="搜索酷友昵称" />
    <div class="tabs" v-if="!query.trim()">
      <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: source === tab.key }" @click="source = tab.key">{{ tab.title }}</button>
    </div>
    <p v-if="error" role="alert">{{ error }} <button @click="load(true)">重试</button></p>
    <button v-if="source === 'recent' && !query.trim() && users.length" type="button" @click="clearRecent">清空最近联系人</button>
    <label v-for="user in users" :key="user.uid" class="user-choice">
      <input type="checkbox" :checked="selected.has(user.uid)" @change="toggle(user)" />
      <AppImage v-if="user.avatar" :src="user.avatar" alt="头像" class="avatar" />
      <span>{{ user.username }}</span>
    </label>
    <p v-if="loading">正在获取酷友…</p>
    <p v-else-if="!users.length && !error">暂无酷友</p>
    <button v-if="hasMore && !loading" type="button" @click="load(false)">加载更多</button>
    <div class="selection"><span v-for="user in selected.values()" :key="user.uid">@{{ user.username }} <button type="button" @click="toggle(user)">移除</button></span></div>
    <button type="button" :disabled="!selected.size" @click="confirm">插入 {{ selected.size }} 位酷友</button>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import AppImage from '../common/AppImage.vue';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { readTauriStoreValue, writeTauriStoreValue } from '../../utils/tauriStore';
export interface MentionUser { uid: string; username: string; avatar?: string }
const props = defineProps<{ uid: string; initialQuery?: string }>();
const emit = defineEmits<{ select: [users: MentionUser[]] }>();
const tabs = [{ key: 'recent', title: '最近提醒' }, { key: 'following', title: '我关注的' }, { key: 'fans', title: '关注我的' }];
const source = ref('recent');
const query = ref(props.initialQuery || '');
const users = ref<MentionUser[]>([]);
const selected = ref(new Map<string, MentionUser>());
const loading = ref(false);
const error = ref('');
const hasMore = ref(false);
let page = 0;
let revision = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
function normalize(value: any): MentionUser[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const user = item.userInfo || item;
    const uid = String(user.uid || item.fuid || '');
    const username = String(user.username || user.userName || item.fusername || '');
    return uid && username ? [{ uid, username, avatar: user.userAvatar || user.avatar || item.fUserAvatar }] : [];
  });
}
async function load(reset: boolean) {
  clearTimeout(timer);
  const request = ++revision;
  const nextPage = reset ? 1 : page + 1;
  if (reset) { users.value = []; hasMore.value = false; }
  loading.value = true;
  error.value = '';
  try {
    let items: MentionUser[];
    if (!query.value.trim() && source.value === 'recent') items = normalize(await readTauriStoreValue('publish_mentions.json', props.uid));
    else {
      const response = query.value.trim() ? await CoolapkTauriAPI.searchUsers(query.value.trim(), nextPage) : source.value === 'following' ? await CoolapkTauriAPI.getFollowUserList(props.uid, nextPage) : await CoolapkTauriAPI.getFansList(props.uid, nextPage);
      if (response?.code !== 200) throw new Error(response?.message || '获取酷友失败');
      items = normalize(response.data);
    }
    if (request !== revision) return;
    const previous = reset ? [] : users.value;
    users.value = [...new Map([...previous, ...items].map((item) => [item.uid, item])).values()];
    page = nextPage;
    hasMore.value = (query.value.trim() !== '' || source.value !== 'recent') && items.length > 0 && (reset || users.value.length > previous.length);
  } catch (failure) { if (request === revision) error.value = String(failure instanceof Error ? failure.message : failure); }
  finally { if (request === revision) loading.value = false; }
}
function toggle(user: MentionUser) { if (selected.value.has(user.uid)) selected.value.delete(user.uid); else selected.value.set(user.uid, user); }
async function confirm() {
  const picked = [...selected.value.values()];
  emit('select', picked);
  // 最近提醒按账号保存，切换账号不会混用联系人。
  try {
    const recent = normalize(await readTauriStoreValue('publish_mentions.json', props.uid));
    await writeTauriStoreValue('publish_mentions.json', props.uid, [...new Map([...picked, ...recent].map((item) => [item.uid, item])).values()].slice(0, 50));
  } catch (failure) { console.warn('保存最近联系人失败', failure); }
}
async function clearRecent() { await writeTauriStoreValue('publish_mentions.json', props.uid, []); await load(true); }
watch(query, () => { ++revision; users.value = []; hasMore.value = false; loading.value = false; clearTimeout(timer); timer = setTimeout(() => void load(true), 500); });
watch(() => props.initialQuery, (value) => { if (value !== undefined) query.value = value; });
watch(source, () => { void load(true); });
watch(() => props.uid, () => { selected.value.clear(); void load(true); }, { immediate: true });
onBeforeUnmount(() => { ++revision; clearTimeout(timer); });
</script>
<style scoped>
.mention-picker { margin-top: 12px; padding: 12px; max-height: 300px; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius-control); }
input[type=text], input:not([type]) { width: 100%; padding: 8px; background: var(--surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-control); }
.tabs, .selection { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
button { color: var(--brand-primary); padding: 5px 9px; }
button:disabled { opacity: .5; }
.active { background: var(--brand-soft); }
.user-choice { display: flex; align-items: center; gap: 8px; padding: 6px; cursor: pointer; }
.avatar { width: 28px; height: 28px; border-radius: 50%; }
</style>
