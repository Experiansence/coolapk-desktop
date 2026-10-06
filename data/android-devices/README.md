# 官方 Android 机型表

原始表来自 [Google Play 官方支持设备目录](https://support.google.com/googleplay/answer/1727131)，下载地址为 https://storage.googleapis.com/play_public/supported_devices.csv 。

`supported_devices.csv` 保留完整原文件（UTF-16），`catalog.json` 保留全部四列与记录，并记录下载日期及原文件 SHA-256。客户端随安装包携带 JSON，进入设备设置时读取本地资源，按品牌 → 系列 → 机型 → 型号逐级展示，不截断搜索结果。系列按销售名称推断；无法识别系列的归入“其他机型”，同名机型的不同地区型号完整保留。原 CSV 仅作为来源快照，不进入前端安装资源。

更新整张表：

```powershell
node scripts/update-device-catalog.mjs --download
```

仅从已有原文件重新生成：

```powershell
node scripts/update-device-catalog.mjs
```

此表列出 Google Play 支持的设备，不涵盖所有手机。销售品牌不一定等于系统的制造商字段；制造商允许手动覆盖。表中没有 Android 版本、SDK、Build 号，选择机型不会修改这些系统信息。未收录的设备可使用自定义型号。
