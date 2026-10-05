// Android reserves 1..998 for beta builds and 999 for the final release.
export function parseReleaseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/.exec(version);
  if (!match) throw new Error('版本格式必须为 X.Y.Z 或 X.Y.Z-beta.N');
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const beta = match[4] ? Number(match[4]) : null;
  const code = major * 100000000 + minor * 1000000 + patch * 1000 + (beta ?? 999);
  if (minor > 99 || patch > 999 || (beta !== null && beta > 998) || !Number.isSafeInteger(code) || code > 2100000000) {
    throw new Error('超出 Android 版本编码范围：次版本 <= 99，补丁 <= 999，每个目标版本最多 998 个测试版');
  }
  return { major, minor, patch, beta, code, base: `${major}.${minor}.${patch}` };
}

export function compareBaseVersions(left, right) {
  const a = parseReleaseVersion(left);
  const b = parseReleaseVersion(right);
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }
  return 0;
}

export function allocateBetaVersion(target, current, tags) {
  if (parseReleaseVersion(target).beta !== null || compareBaseVersions(target, current) <= 0) {
    throw new Error(`目标正式版本必须高于当前版本 ${current}`);
  }
  let sequence = 0;
  for (const tag of tags) {
    let candidate;
    try { candidate = parseReleaseVersion(tag.replace(/^v/, '')); } catch { continue; }
    const comparison = compareBaseVersions(target, candidate.base);
    if ((candidate.beta === null && comparison <= 0) || (candidate.beta !== null && comparison < 0)) {
      throw new Error(`目标版本不高于已有版本 ${tag}`);
    }
    if (candidate.base === target && candidate.beta !== null) sequence = Math.max(sequence, candidate.beta);
  }
  const version = `${target}-beta.${sequence + 1}`;
  parseReleaseVersion(version);
  return version;
}
