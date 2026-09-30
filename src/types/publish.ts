export interface PublishTarget {
  type: 'tag' | 'apk' | 'product_phone';
  id: string;
  title: string;
  logo?: string;
  subTabs?: { id?: string; subTypeId?: string; title?: string; name?: string; subTabRule?: string }[];
  configRows?: unknown[];
  isOwner?: number;
}

// 仅传递已明确设置的发布选项，重新编辑时由服务端读取原始值。
export interface PublishOptions {
  targetType?: PublishTarget['type'] | '';
  targetId?: string;
}
