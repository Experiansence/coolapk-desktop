import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { allocateBetaVersion, parseReleaseVersion, resolveBetaTarget } from './release-version.mjs';
import { readReleaseTags } from './release-tags.mjs';

test('Release 查询在 gh 内提取标签，避免完整发布信息撑满子进程缓冲区', () => {
  const tags = readReleaseTags('example/desktop', (command, args, options) => {
    assert.equal(command, 'gh');
    assert.ok(args.includes('--paginate'));
    assert.equal(args[args.indexOf('--jq') + 1], '.[].tag_name');
    assert.equal(options.encoding, 'utf8');
    return 'v1.31.0-beta.9\nv1.31.0-beta.101\r\nv1.30.0\n';
  });
  assert.equal(allocateBetaVersion('1.31.0', '1.30.0', tags), '1.31.0-beta.102');
});

test('beta 编号检查所有标签，并拒绝回退或正式版已发布的目标', () => {
  assert.equal(allocateBetaVersion('1.31.0', '1.30.0', ['v1.31.0-beta.9', 'v1.31.0-beta.101']), '1.31.0-beta.102');
  for (const tags of [['v1.31.0'], ['v1.32.0-beta.1']]) {
    assert.throws(() => allocateBetaVersion('1.31.0', '1.30.0', tags));
  }
  assert.throws(() => allocateBetaVersion('1.30.0', '1.30.0', []));
  assert.throws(() => allocateBetaVersion('1.31.0', '1.30.0', ['v1.31.0-beta.998']));
  assert.throws(() => parseReleaseVersion('1.31.0-beta.01'));
});

test('Android 编码支持正式版到多次 beta 再到正式版', () => {
  const versions = ['1.30.0', '1.31.0-beta.1', '1.31.0-beta.101', '1.31.0-beta.998', '1.31.0', '1.31.1-beta.1'];
  const codes = versions.map((version) => parseReleaseVersion(version).code);
  assert.ok(codes.every((code, index) => index === 0 || code > codes[index - 1]));
});

test('版本增量基于正式版计算，次版本递增清零补丁，连续构建只递增 beta', () => {
  assert.equal(resolveBetaTarget('1.30.0', [], '+0.0.1'), '1.30.1');
  assert.equal(resolveBetaTarget('1.30.7', [], '+0.1'), '1.31.0');
  assert.equal(resolveBetaTarget('1.30.0', ['v1.30.2', 'v1.31.0-beta.9'], '+0.0.1'), '1.30.3');
  const tags = ['v1.30.1-beta.1', 'v1.30.1-beta.2'];
  const target = resolveBetaTarget('1.30.0', tags, '+0.0.1');
  assert.equal(target, '1.30.1');
  assert.equal(allocateBetaVersion(target, '1.30.0', tags), '1.30.1-beta.3');
  assert.equal(resolveBetaTarget('1.30.2', ['v1.30.0'], '+0.0.1'), '1.30.3');
});

test('手动目标覆盖自动计算，并拒绝遗漏或错误的输入', () => {
  assert.equal(resolveBetaTarget('1.30.0', [], '+0.0.1', ' 1.32.0 '), '1.32.0');
  assert.equal(resolveBetaTarget('1.30.0', [], '手动填写', '1.31.0'), '1.31.0');
  assert.throws(() => resolveBetaTarget('1.30.0', [], '手动填写'));
  assert.throws(() => resolveBetaTarget('1.30.0', [], '+0.1', '1.31.0-beta.1'));
  assert.throws(() => resolveBetaTarget('1.30.0', [], '+0.2'));
});

test('版本脚本在隔离目录同步六个文件，并保持无参数 beta 构建', () => {
  const root = mkdtempSync(join(tmpdir(), 'coolapk-beta-version-'));
  const files = ['scripts/set-version.mjs', 'scripts/release-version.mjs', 'package.json', 'package-lock.json',
    'src/constants/version.ts', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'];
  try {
    for (const file of files) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      copyFileSync(resolve(file), join(root, file));
    }
    const run = (args) => spawnSync(process.execPath, ['scripts/set-version.mjs', ...args], { cwd: root, encoding: 'utf8' });
    assert.notEqual(run(['1.31.0-beta.101']).status, 0);
    assert.equal(run(['1.31.0-beta.101', '--beta']).status, 0);
    assert.equal(run([]).status, 0);
    for (const file of files.slice(2)) assert.ok(readFileSync(join(root, file), 'utf8').includes('1.31.0-beta.101'), file);
    const config = JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json')));
    assert.equal(config.bundle.android.versionCode, parseReleaseVersion('1.31.0-beta.101').code);
    assert.equal(config.bundle.iOS.bundleVersion, '131.1.1');
    assert.equal(config.bundle.macOS.bundleVersion, '131.1.1');
    assert.equal(run(['1.31.0']).status, 0);
    assert.equal(JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'))).bundle.android.versionCode, parseReleaseVersion('1.31.0').code);
    assert.equal(JSON.parse(readFileSync(join(root, 'src-tauri/tauri.conf.json'))).bundle.iOS.bundleVersion, '131.9.99');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('产物收集需要全部十二个平台包，缺失或重复时失败', () => {
  const root = mkdtempSync(join(tmpdir(), 'coolapk-beta-assets-'));
  const version = '1.31.0-beta.101';
  const names = [
    ...['x64-setup.exe', 'arm64-setup.exe', 'x64-portable.exe', 'arm64-portable.exe', 'x64.dmg', 'aarch64.dmg', 'amd64.AppImage', 'amd64.deb'].map((suffix) => `coolapk-desktop_${version}_${suffix}`),
    `coolapk-desktop-${version}-1.x86_64.rpm`,
    ...['android-arm64.apk', 'android-arm64.aab', 'ios-arm64-unsigned.ipa'].map((suffix) => `coolapk-v${version}-${suffix}`),
  ];
  const run = () => spawnSync(process.execPath, [resolve('scripts/collect-beta-assets.mjs')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, BETA_VERSION: version },
  });
  try {
    mkdirSync(join(root, 'beta-artifacts'));
    for (const name of names.slice(1)) writeFileSync(join(root, 'beta-artifacts', name), 'fixture');
    assert.notEqual(run().status, 0);
    writeFileSync(join(root, 'beta-artifacts', names[0]), 'fixture');
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(root, 'beta-release/SHA256SUMS'), 'utf8').trim().split('\n').length, 12);
    mkdirSync(join(root, 'beta-artifacts/duplicate'));
    writeFileSync(join(root, 'beta-artifacts/duplicate', names[0]), 'fixture');
    assert.notEqual(run().status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
