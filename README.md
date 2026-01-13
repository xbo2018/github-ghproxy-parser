# GitHub 加速地址自动解析项目

## 项目目标
解析各类 GitHub 加速地址，输出结构化的 JSON/文本文件。

## 解析结果
解析结果存储在 `dist/` 目录下：
- `download_url_us.json`: Release/Code(ZIP) 加速地址（美国节点）
- `clone_url.json`: Git Clone（HTTPS）加速地址
- `clone_ssh_url.json`: Git Clone（SSH）加速地址
- `raw_url.json`: Raw 文件加速地址
- `download_url.json`: 混合地域加速地址
- `all_proxies.json`: 所有加速地址汇总（推荐第三方使用）
- `all_proxies.txt`: 纯文本格式（便于 bash 读取）
