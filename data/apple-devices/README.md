# 苹果设备型号表

来源为 [AppleDB](https://github.com/littlebyteorg/appledb) 的[完整设备接口](https://api.appledb.dev/device/main.json)，使用其 MIT 许可（见本目录 LICENSE）。这是一份社区维护的数据，不是苹果官方完整目录。

参考 Android 目录的处理方式：`devices.json` 保留下载原文，`catalog.json` 记录来源 URL、下载日期、原文 SHA-256 和源设备数量。四列为品牌、销售名称、设备分类、型号。将源表 `identifier`（系统硬件编号）和 `model`（机身型号）分别展开，保留所有不同记录，不自行推算编号或修改设备名称。没有这两类编号的源设备仅保留在原始快照，不虚构型号。

客户端随包携带精简目录，用于评论、动态等位置的型号名称识别，以及设置中的品牌 → 分类 → 机型 → 型号选择和完整搜索。未知或对应多个不同名称的编号保留原文。苹果目录只提供设备信息，不提供 Android 系统参数；选择苹果型号不会自动转换请求系统。

更新来源快照并重新生成：

```powershell
node scripts/update-apple-device-catalog.mjs --download
```

从已有快照重新生成（不联网）：

```powershell
node scripts/update-apple-device-catalog.mjs
```

覆盖范围以下载时源表实际收录为准，不宣称收录所有历史或未来苹果产品。完整保留源表分类，包括 iPhone、iPad、Mac、Apple Watch、Apple TV、HomePod、Vision、iPod、AirPods 及其他有型号的配件。
