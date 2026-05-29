// 岗位信息解析云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { action, fileID } = event;

  try {
    switch (action) {
      case 'ocr':
        return await parseJDScreenshot(fileID);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('parseJD error:', err);
    return { success: false, message: err.message || '识别失败' };
  }
};

// ==================== 识别岗位截图 ====================

async function parseJDScreenshot(fileID) {
  if (!fileID) {
    return { success: false, message: '请提供截图' };
  }

  try {
    // 下载图片
    const downloadRes = await cloud.downloadFile({
      fileID: fileID
    });

    const buffer = downloadRes.fileContent;

    // 调用 OCR
    let ocrText = '';
    try {
      ocrText = await callJDOCR(buffer);
    } catch (err) {
      console.error('OCR调用失败:', err.message);
      ocrText = '';
    }

    if (!ocrText || ocrText.trim().length === 0) {
      return { success: false, message: '未能识别截图中的文字，请尝试粘贴JD' };
    }

    // 提取结构化岗位信息
    const jobInfo = extractJobInfo(ocrText);

    // 构建格式化的岗位描述
    const formattedJD = formatJobDescription(jobInfo, ocrText);

    return {
      success: true,
      data: {
        content: formattedJD,
        rawText: ocrText,
        jobInfo: jobInfo
      }
    };
  } catch (err) {
    console.error('解析失败:', err);
    return { success: false, message: '截图识别失败，请尝试手动粘贴JD文字' };
  }
}

// ==================== OCR 调用 ====================

async function callJDOCR(imageBuffer) {
  const crypto = require('crypto');
  const https = require('https');

  const SECRET_ID = process.env.TENCENT_SECRET_ID;
  const SECRET_KEY = process.env.TENCENT_SECRET_KEY;

  if (!SECRET_ID || !SECRET_KEY) {
    console.warn('未配置腾讯云密钥，无法进行 OCR 识别');
    return '';
  }

  const base64Image = imageBuffer.toString('base64');

  const payload = JSON.stringify({
    ImageBase64: base64Image
  });

  const service = 'ocr';
  const host = 'ocr.tencentcloudapi.com';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().substring(0, 10);

  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQuerystring = '';
  const contentType = 'application/json; charset=utf-8';
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:generalbasicocr\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    httpRequestMethod, canonicalUri, canonicalQuerystring,
    canonicalHeaders, signedHeaders, hashedRequestPayload
  ].join('\n');

  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

  const secretDate = crypto.createHmac('sha256', `TC3${SECRET_KEY}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: host, port: 443, path: '/', method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Host': host,
        'X-TC-Action': 'GeneralBasicOCR',
        'X-TC-Version': '2018-11-19',
        'X-TC-Timestamp': timestamp,
        'X-TC-Region': 'ap-guangzhou',
        'Authorization': authorization
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.Response && response.Response.Error) {
            reject(new Error(response.Response.Error.Message));
            return;
          }
          const textDetections = response.Response && response.Response.TextDetections;
          if (textDetections && textDetections.length > 0) {
            const text = textDetections.map(item => item.DetectedText).join('\n');
            resolve(text);
          } else {
            resolve('');
          }
        } catch (e) {
          reject(new Error(`响应解析失败: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ==================== 岗位信息提取 ====================

function extractJobInfo(rawText) {
  const info = {
    position: '',
    company: '',
    salary: '',
    location: '',
    requirements: [],
    responsibilities: []
  };

  const lines = rawText.split(/\n/).map(l => l.trim()).filter(l => l);

  // 提取岗位名称（通常在第一行或包含"招聘"的行）
  for (const line of lines.slice(0, 5)) {
    if (line.includes('招聘') || line.includes('急招') || line.includes('诚聘')) {
      info.position = line.replace(/招聘|急招|诚聘/g, '').trim().slice(0, 30);
      break;
    }
  }
  if (!info.position && lines.length > 0) {
    info.position = lines[0].slice(0, 30);
  }

  // 提取公司名
  for (const line of lines) {
    if (line.includes('公司') || line.includes('科技') || line.includes('集团')) {
      if (info.company.length < line.length && line.length < 30) {
        info.company = line.trim();
      }
    }
  }

  // 提取薪资
  const salaryMatch = rawText.match(/(\d+[kK千]?\s*[-~到]\s*\d+[kK千]?)/);
  if (salaryMatch) {
    info.salary = salaryMatch[0];
  }

  // 提取地点
  const locationMatch = rawText.match(/(?:地点|地址|工作地点)[：:]\s*(.+)/);
  if (locationMatch) {
    info.location = locationMatch[1].trim().slice(0, 20);
  }

  // 提取任职要求
  const reqSection = extractSection(rawText, ['任职要求', '岗位要求', '职位要求', '能力要求']);
  if (reqSection) {
    info.requirements = extractListItems(reqSection);
  }

  // 提取岗位职责
  const respSection = extractSection(rawText, ['岗位职责', '工作职责', '职位描述', '工作内容']);
  if (respSection) {
    info.responsibilities = extractListItems(respSection);
  }

  return info;
}

// 从文本中提取某个章节
function extractSection(text, keywords) {
  for (const keyword of keywords) {
    const idx = text.indexOf(keyword);
    if (idx !== -1) {
      const sectionText = text.substring(idx);
      // 找到下一个章节标题
      const nextSectionPattern = /(?:岗位职责|工作职责|任职要求|职位要求|薪资福利|工作地点|公司介绍|职位描述|工作内容)/;
      const nextMatch = sectionText.substring(keyword.length).match(nextSectionPattern);
      if (nextMatch) {
        return sectionText.substring(0, keyword.length + nextMatch.index);
      }
      return sectionText;
    }
  }
  return null;
}

// 提取列表项
function extractListItems(text) {
  const items = [];
  const lines = text.split(/\n/);
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;

    // 检测列表项：以数字、点、破折号开头
    if (/^[\d\.、\-\•●◆►]/.test(trimmed) || /^\d+[\.\、]/.test(trimmed)) {
      started = true;
      const item = trimmed.replace(/^[\d\.、\-\•●◆►\s]+/, '').trim();
      if (item.length > 2) {
        items.push(item);
      }
    } else if (started && items.length > 0) {
      // 可能已经过了列表区域
      break;
    }
  }

  return items.slice(0, 10); // 最多取10条
}

// ==================== 格式化输出 ====================

function formatJobDescription(jobInfo, rawText) {
  const parts = [];

  if (jobInfo.position) {
    parts.push(`【岗位名称】${jobInfo.position}`);
  }
  if (jobInfo.company) {
    parts.push(`【公司】${jobInfo.company}`);
  }
  if (jobInfo.salary) {
    parts.push(`【薪资范围】${jobInfo.salary}`);
  }
  if (jobInfo.location) {
    parts.push(`【工作地点】${jobInfo.location}`);
  }
  if (jobInfo.responsibilities.length > 0) {
    parts.push(`【岗位职责】\n${jobInfo.responsibilities.map(r => `- ${r}`).join('\n')}`);
  }
  if (jobInfo.requirements.length > 0) {
    parts.push(`【任职要求】\n${jobInfo.requirements.map(r => `- ${r}`).join('\n')}`);
  }

  // 如果结构化提取不完整，附加部分原始文本
  if (parts.length === 0 || parts.join('\n').length < rawText.length * 0.3) {
    parts.push(`【完整信息】\n${rawText}`);
  }

  return parts.join('\n\n');
}
