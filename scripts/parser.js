const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// 确保输出目录存在
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 读取目标脚本内容
const scriptPath = path.join(__dirname, '../temp/ghproxy.user.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// 核心解析函数：提取指定数组的内容
function extractProxyArray(scriptContent, arrayName) {
  // 正则匹配数组定义（匹配格式：const xxx = [['url', '地域', '描述'], ...]）
  const regex = new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)];`, 'g');
  const match = regex.exec(scriptContent);
  
  if (!match) return [];
  
  // 提取数组内容并处理注释/无效行
  const arrayContent = match[1]
    .split('\n')
    .map(line => line.trim())
    // 过滤注释行和空行
    .filter(line => !line.startsWith('//') && line !== '' && line !== ',' && line !== '],');
  
  // 解析每一行的内容
  const result = [];
  arrayContent.forEach(line => {
    // 匹配 ['url', '地域', '描述'] 格式
    const itemRegex = /\['([^']+)',\s*'([^']+)',\s*'([^']+)']/;
    const itemMatch = itemRegex.exec(line);
    if (itemMatch) {
      result.push({
        url: itemMatch[1],
        region: itemMatch[2],
        description: itemMatch[3].replace(/&#10;/g, '\n') // 还原换行符
      });
    }
  });
  
  return result;
}

// 解析所有类型的加速地址
const proxyTypes = [
  { name: 'download_url_us', filename: 'download_url_us.json' },
  { name: 'clone_url', filename: 'clone_url.json' },
  { name: 'clone_ssh_url', filename: 'clone_ssh_url.json' },
  { name: 'raw_url', filename: 'raw_url.json' },
  { name: 'download_url', filename: 'download_url.json' }
];

// 存储所有加速地址的汇总
const allProxies = [];

// 逐个解析并写入文件
proxyTypes.forEach(type => {
  const proxies = extractProxyArray(scriptContent, type.name);
  // 写入单独的 JSON 文件
  fs.writeFileSync(
    path.join(distDir, type.filename),
    JSON.stringify(proxies, null, 2),
    'utf8'
  );
  // 加入汇总数组（添加类型标识）
  proxies.forEach(proxy => {
    allProxies.push({
      type: type.name,
      ...proxy
    });
  });
  console.log(`✅ 解析 ${type.name} 完成，共 ${proxies.length} 个有效地址`);
});

// 写入汇总文件（便于第三方统一调用）
fs.writeFileSync(
  path.join(distDir, 'all_proxies.json'),
  JSON.stringify(allProxies, null, 2),
  'utf8'
);

// 额外生成便于 bash 读取的纯文本格式（可选）
const txtContent = allProxies.map(p => `${p.type}\t${p.url}\t${p.region}`).join('\n');
fs.writeFileSync(
  path.join(distDir, 'all_proxies.txt'),
  txtContent,
  'utf8'
);

console.log(`🎉 所有解析完成！总计 ${allProxies.length} 个有效加速地址`);
console.log(`📁 结果已输出到 ${distDir} 目录`);