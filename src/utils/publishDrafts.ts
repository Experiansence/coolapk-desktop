import { readTauriStoreValue, updateTauriStoreValue } from './tauriStore';
import { readFilePreview, type PublishImage } from './publishMedia';
import type { PublishTarget, PublishOptions } from '../types/publish';

export interface PublishDraftState {
  text: string;
  images: PublishImage[];
  target: PublishTarget | null;
  productOptions: PublishOptions;
  visibleStatus: 1 | -1;
  largeCover: boolean;
  extraOptions: PublishOptions;
  attachmentTitle: string;
}
interface StoredFile { data: string; name: string; type: string; lastModified: number }
interface StoredImage { preview: string; url?: string; file?: StoredFile; liveVideo?: StoredFile; liveEnabled?: boolean; hdr?: number }
export interface FullPublishDraft { id: string; title: string; updatedAt: number; state: Omit<PublishDraftState, 'images'> & { images: StoredImage[] } }
type FullDraftMap = Record<string, FullPublishDraft[]>;
const serializedFiles = new WeakMap<File, Promise<StoredFile>>();
const draftWrites = new Map<string, Promise<void>>();

// 文件编码按对象缓存，输入正文时不重复读取已选择的图片和视频。
function serializeFile(file: File): Promise<StoredFile> {
  let value = serializedFiles.get(file);
  if (!value) { value = readFilePreview(file).then((data) => ({ data, name: file.name, type: file.type, lastModified: file.lastModified })); serializedFiles.set(file, value); }
  return value;
}
function restoreFile(file: StoredFile): File {
  const comma = file.data.indexOf(',');
  if (comma < 0 || !file.data.slice(0, comma).endsWith(';base64')) throw new Error('草稿媒体数据格式无效');
  const bytes = Uint8Array.from(atob(file.data.slice(comma + 1)), (char) => char.charCodeAt(0));
  return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
}

export async function listFullPublishDrafts(uid: string): Promise<FullPublishDraft[]> {
  const map = await readTauriStoreValue<FullDraftMap>('publish_drafts.json', 'fullDrafts');
  const existing = Array.isArray(map?.[uid]) ? map[uid].filter((draft) => draft && draft.id && draft.state && typeof draft.state.text === 'string') : [];
  if (existing.length) return [...existing].sort((a, b) => b.updatedAt - a.updatedAt);
  // 迁移旧版单篇文字草稿；保存成功后才清除旧记录。
  const text = await loadPublishDraft(uid);
  if (!text.trim()) return [];
  await saveFullPublishDraft(uid, crypto.randomUUID(), { text, images: [], target: null, productOptions: {}, visibleStatus: 1, largeCover: false, extraOptions: {}, attachmentTitle: '' });
  await clearPublishDraft(uid);
  const migrated = await readTauriStoreValue<FullDraftMap>('publish_drafts.json', 'fullDrafts');
  return migrated?.[uid] || [];
}

export function saveFullPublishDraft(uid: string, id: string, state: PublishDraftState): Promise<void> {
  const key = `${uid}:${id}`;
  const previous = draftWrites.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(() => writeFullPublishDraft(uid, id, state));
  draftWrites.set(key, next);
  return next;
}

async function writeFullPublishDraft(uid: string, id: string, state: PublishDraftState): Promise<void> {
  const images: StoredImage[] = await Promise.all(state.images.map(async (image) => ({ preview: image.preview, url: image.url, liveEnabled: image.liveEnabled, hdr: image.hdr, file: image.file ? await serializeFile(image.file) : undefined, liveVideo: image.liveVideo ? await serializeFile(image.liveVideo) : undefined })));
  const storedState = { ...state, images };
  const draft: FullPublishDraft = { id, title: state.text.trim().slice(0, 40) || state.target?.title || state.attachmentTitle || (images.length ? '图片草稿' : '新草稿'), updatedAt: Date.now(), state: storedState };
  await updateTauriStoreValue<FullDraftMap>('publish_drafts.json', 'fullDrafts', {}, (map) => ({ ...map, [uid]: [draft, ...(map[uid] || []).filter((item) => item.id !== id)] }));
}

export async function deleteFullPublishDraft(uid: string, id: string): Promise<void> {
  await draftWrites.get(`${uid}:${id}`)?.catch(() => undefined);
  await updateTauriStoreValue<FullDraftMap>('publish_drafts.json', 'fullDrafts', {}, (map) => ({ ...map, [uid]: (map[uid] || []).filter((item) => item.id !== id) }));
}

export function restoreFullPublishDraft(draft: FullPublishDraft): PublishDraftState {
  // 任意媒体损坏时整体停止恢复，防止用户不知情地发布缺图草稿。
  const state = draft.state;
  return { ...state, images: state.images.map((image) => ({ ...image, file: image.file ? restoreFile(image.file) : undefined, liveVideo: image.liveVideo ? restoreFile(image.liveVideo) : undefined })) };
}

interface PublishDraft {
  text: string;
  updatedAt: number;
}

type PublishDraftMap = Record<string, PublishDraft>;

const STORE_FILE = 'publish_drafts.json';
const STORE_KEY = 'drafts';
const drafts: PublishDraftMap = {};
let readyPromise: Promise<void> | null = null;

function accountKey(userUid: string | number | null | undefined): string {
  return String(userUid || 'guest');
}

function loadDraftMap(value: unknown): PublishDraftMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: PublishDraftMap = {};
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object' && typeof (item as PublishDraft).text === 'string') {
      result[key] = { text: (item as PublishDraft).text, updatedAt: Number((item as PublishDraft).updatedAt) || 0 };
    }
  }
  return result;
}

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = readTauriStoreValue<unknown>(STORE_FILE, STORE_KEY).then((value) => {
      Object.assign(drafts, loadDraftMap(value));
    }).catch((error) => {
      console.warn('加载发布动态草稿失败:', error);
    });
  }
  return readyPromise;
}

export async function loadPublishDraft(userUid: string | number | null | undefined): Promise<string> {
  await ensureReady();
  return drafts[accountKey(userUid)]?.text || '';
}

export async function savePublishDraft(userUid: string | number | null | undefined, text: string): Promise<void> {
  await ensureReady();
  const key = accountKey(userUid);
  if (!text.trim()) delete drafts[key];
  else drafts[key] = { text, updatedAt: Date.now() };
  await updateTauriStoreValue(STORE_FILE, STORE_KEY, {}, () => ({ ...drafts }));
}

export async function clearPublishDraft(userUid: string | number | null | undefined): Promise<void> {
  await savePublishDraft(userUid, '');
}
