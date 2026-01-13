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

// ========== 新增：独立的脚本内容预处理函数（只执行一次） ==========
/**
 * 预处理脚本内容，移除干扰项，便于后续解析
 * @param {string} content 原始脚本内容
 * @returns {string} 预处理后的干净内容
 */
function preprocessScriptContent(content) {
  try {
    const cleanContent = content
      // 移除行首的单行注释（保留数组内的注释）
      .replace(/^\s*\/\/.*$/gm, '')
      // 移除多行注释（/* ... */）
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // 合并多余的空白字符（空格、制表符、换行）为单个空格
      .replace(/\s+/g, ' ')
      // 还原数组项之间的换行（便于后续拆分数组）
      .replace(/\], /g, '],\n')
      // 移除首尾空白
      .trim();
    return cleanContent;
  } catch (err) {
    console.error('❌ 脚本内容预处理失败：', err.message);
    return '';
  }
}

// ========== 核心解析函数：基于预处理后的内容解析指定数组 ==========
/**
 * 提取脚本中指定数组的内容
 * @param {string} cleanContent 预处理后的脚本内容
 * @param {string} arrayName 要提取的数组名
 * @returns {Array<{url: string, region: string, description: string}>} 解析结果
 */
function extractProxyArray(cleanContent, arrayName) {
  if (!cleanContent) {
    console.warn(`⚠️ 预处理后的脚本内容为空，无法解析 ${arrayName}`);
    return [];
  }

  try {
    // 第一步：截取所有数组定义的核心区域（到 svg = [ 为止）
    const arrayDefMatch = cleanContent.match(/const\s+([\s\S]*?)(?=svg = \[)/);
    if (!arrayDefMatch) {
      console.warn(`⚠️ 未找到数组定义区域，无法解析 ${arrayName}`);
      return [];
    }
    const allArrays = arrayDefMatch[1];

    // 第二步：拆分连续定义的数组（const A=[...], B=[...], C=[...] → 拆分为单个数组）
    const arrayLines = allArrays.split(/,\s*(?=\w+ = \[)/);

    // 第三步：查找目标数组的内容
    let targetArrayStr = '';
    for (const line of arrayLines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith(`${arrayName} = [`)) {
        // 提取数组内容（去掉 xxx = [ 和 ]; ）
        targetArrayStr = trimmedLine
          .replace(`${arrayName} = [`, '')
          .replace(/\];?$/, '')
          .trim();
        break;
      }
    }

    if (!targetArrayStr) {
      console.warn(`⚠️ 未找到数组 ${arrayName} 的定义`);
      return [];
    }

    // 第四步：解析数组中的每一项（['url', '地域', '描述'] 格式）
    const itemRegex = /\['([^']+)',\s*'([^']+)',\s*'([\s\S]*?)'\]/g;
    const matches = targetArrayStr.matchAll(itemRegex);

    const result = [];
    const seenUrls = new Set(); // 去重集合

    // 格式化每一项并去重
    for (const match of matches) {
      const url = match[1]?.trim() || '';
      const region = match[2]?.trim() || '';
      const description = match[3]?.trim().replace(/&#10;/g, '\n') || '';

      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        result.push({ url, region, description });
      }
    }

    return result;
  } catch (err) {
    console.error(`❌ 解析数组 ${arrayName} 出错：`, err.message);
    return [];
  }
}

// ========== 主逻辑：先预处理，再循环解析所有数组 ==========
// 1. 预处理脚本内容（只执行一次）
const cleanScriptContent = preprocessScriptContent(scriptContent);

// 2. 定义需要解析的代理数组类型
const proxyTypes = [
  { name: 'download_url_us', filename: 'download_url_us.json' },
  { name: 'clone_url', filename: 'clone_url.json' },
  { name: 'clone_ssh_url', filename: 'clone_ssh_url.json' },
  { name: 'raw_url', filename: 'raw_url.json' },
  { name: 'download_url', filename: 'download_url.json' }
];

// 3. 初始化结构化汇总对象（核心修改：以 type 为 key）
const structuredAllProxies = {};
// 初始化所有类型的空数组，避免 key 缺失
proxyTypes.forEach(type => {
  structuredAllProxies[type.name] = [];
});


// 4. 循环解析每个数组（复用预处理后的内容，避免重复处理）
proxyTypes.forEach(type => {
  const proxies = extractProxyArray(cleanScriptContent, type.name);
  // 写入单独的 JSON 文件
  fs.writeFileSync(
    path.join(distDir, type.filename),
    JSON.stringify(proxies, null, 2),
    'utf8'
  );
  structuredAllProxies[type.name] = proxies;
  console.log(`✅ 解析 ${type.name} 完成，共 ${proxies.length} 个有效地址`);
});

// 5. 写入汇总文件（便于第三方统一调用）
fs.writeFileSync(
  path.join(distDir, 'all_proxies.json'),
  JSON.stringify(structuredAllProxies, null, 2),
  'utf8'
);

const allProxiesTxt = [];
Object.keys(structuredAllProxies).forEach(type => {
  const proxies = structuredAllProxies[type];
  proxies.forEach(proxy => {
    // 格式化：类型\t地址\t地区（去除换行符，便于单行读取）
    const line = `${type}\t${proxy.url}\t${proxy.region.replace(/\n/g, ' ')}`;
    allProxiesTxt.push(line);
  });
});
fs.writeFileSync(
  path.join(distDir, 'all_proxies.txt'),
  allProxiesTxt.join('\n'),
  'utf8'
);

console.log(`✅ 所有文件生成完成！
- 结构化汇总文件：${path.join(distDir, 'all_proxies.json')}
- 便捷读取的 TXT 文件：${path.join(distDir, 'all_proxies.txt')}`);