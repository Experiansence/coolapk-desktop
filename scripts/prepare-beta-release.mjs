import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { allocateBetaVersion } from './release-version.mjs';

const target = process.env.TARGET_VERSION || '';
const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
const releases = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp',
  `repos/${process.env.GITHUB_REPOSITORY}/releases?per_page=100`], { encoding: 'utf8' })).flat();
const refs = execFileSync('git', ['ls-remote', '--tags', 'origin'], { encoding: 'utf8' });
const versions = [...releases.map((release) => release.tag_name),
  ...[...refs.matchAll(/refs\/tags\/v([^\s^]+)/g)].map((match) => `v${match[1]}`)];
const version = allocateBetaVersion(target, current, versions);
appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\nsha=${process.env.GITHUB_SHA}\n`);
console.log(`测试版本 v${version}，源码 ${process.env.GITHUB_SHA}`);
