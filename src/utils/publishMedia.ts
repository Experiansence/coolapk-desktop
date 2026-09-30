export interface PublishImage { file?: File; preview: string; url?: string; liveVideo?: File; liveEnabled?: boolean; hdr?: number }

// JPEG 动态照片将标准 MP4 追加在图片尾部；保留视频字节，封面只上传 JPEG 部分。
export function motionPhotoOffset(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return -1;
  const header = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 131072)));
  const length = header.match(/(?:MicroVideoOffset|MotionPhotoVideoLength)=["'](\d+)["']/)?.[1];
  const offset = length ? bytes.length - Number(length) : -1;
  const isMp4 = (at: number) => at >= 2 && at + 12 <= bytes.length && String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === 'ftyp';
  if (isMp4(offset)) return offset;
  // 容器格式无偏移字段时，只接受紧邻 JPEG 结束标记的标准 MP4。
  for (let at = 2; at + 12 <= bytes.length; at++) if (bytes[at - 2] === 0xff && bytes[at - 1] === 0xd9 && isMp4(at)) return at;
  return -1;
}

export function readFilePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('读取图片失败')); reader.readAsDataURL(file); });
}

export async function validateLiveVideo(file: File): Promise<void> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (header.length < 12 || String.fromCharCode(...header.subarray(4, 8)) !== 'ftyp') throw new Error('实况视频必须是标准 MP4 文件');
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video');
      const timer = setTimeout(() => { video.removeAttribute('src'); video.load(); reject(new Error('读取实况视频超时')); }, 10000);
      video.preload = 'metadata';
      const finish = () => { clearTimeout(timer); video.removeAttribute('src'); video.load(); };
      video.onloadedmetadata = () => { const value = video.duration; finish(); resolve(value); };
      video.onerror = () => { finish(); reject(new Error('无法解析实况视频，请使用标准 MP4')); };
      video.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0 || duration > 10) throw new Error('实况视频时长必须在 10 秒以内');
  } finally { URL.revokeObjectURL(url); }
}

export async function preparePublishImage(file: File): Promise<PublishImage> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const offset = motionPhotoOffset(bytes);
  if (offset >= 0) {
    const image = new File([bytes.slice(0, offset)], file.name, { type: 'image/jpeg' });
    const liveVideo = new File([bytes.slice(offset)], file.name.replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4' });
    await validateLiveVideo(liveVideo);
    return { file: image, preview: await readFilePreview(image), liveVideo, liveEnabled: true };
  }
  return { file, preview: await readFilePreview(file) };
}

// 拖动和按钮排序都使用同一函数，返回新数组方便草稿监听完整变化。
export function movePublishImage(images: PublishImage[], from: number, to: number): PublishImage[] {
  if (from < 0 || to < 0 || from >= images.length || to >= images.length || from === to) return images;
  const result = [...images];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}
