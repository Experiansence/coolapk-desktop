/** Both native API naming styles are used by feed and detail responses. */
export function isFeedEdited(feed: Record<string, any> | null | undefined): boolean {
  if (!feed) return false;
  const flag = feed.isModified ?? feed.is_modified;
  return flag === true || flag === 1 || flag === '1'
    || Number(feed.changeCount ?? feed.change_count ?? 0) > 0
    || Number(feed.lastChangeTime ?? feed.last_change_time ?? 0) > 0;
}
