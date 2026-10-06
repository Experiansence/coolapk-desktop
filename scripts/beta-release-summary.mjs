import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseReleaseVersion } from './release-version.mjs';

export function archiveBetaNotes(repository, tag, summaryPath, run = execFileSync, append = appendFileSync) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('缺少有效仓库名称');
  if (!tag?.startsWith('v') || parseReleaseVersion(tag.slice(1)).beta === null) throw new Error('必须指定测试标签');
  if (!summaryPath) throw new Error('缺少构建 Summary 路径，不能保存更新日志');
  const body = run('gh', ['release', 'view', tag, '--repo', repository, '--json', 'body', '--jq', '.body'], { encoding: 'utf8' });
  append(summaryPath, `\n## ${tag} 更新日志\n\n${body.trim() || '此版本未填写更新日志。'}\n\n---\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  archiveBetaNotes(process.env.GITHUB_REPOSITORY, process.env.BETA_TAG, process.env.GITHUB_STEP_SUMMARY);
}
