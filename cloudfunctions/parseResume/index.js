// 简历解析云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, fileID, fileName } = event;

  try {
    switch (action) {
      case 'parse':
        return await parseResume(fileID, fileName);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('parseResume error:', err);
    return { success: false, message: err.message || '解析失败' };
  }
};

async function parseResume(fileID, fileName) {
  if (!fileID) {
    return { success: false, message: '请提供文件' };
  }

  // 根据文件类型选择解析方式
  const ext = (fileName || '').toLowerCase().split('.').pop();

  let content = '';

  if (['png', 'jpg', 'jpeg', 'bmp'].includes(ext)) {
    // 图片类型：OCR 识别
    content = await parseImage(fileID);
  } else if (['pdf', 'doc', 'docx'].includes(ext)) {
    // 文档类型：文本提取
    content = await parseDocument(fileID, ext);
  } else if (['txt'].includes(ext)) {
    // 纯文本
    content = await parseTextFile(fileID);
  } else {
    return { success: false, message: `不支持的文件格式: ${ext}` };
  }

  if (!content || content.trim().length === 0) {
    return { success: false, message: '未能从文件中提取到文字内容' };
  }

  // 保存解析结果到用户数据
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (openid) {
    await db.collection('users').where({ openid }).update({
      data: {
        resumeContent: content,
        resumeFileID: fileID,
        updateTime: db.serverDate()
      }
    });
  }

  return {
    success: true,
    data: {
      content: content,
      fileName: fileName
    }
  };
}

// ==================== 图片 OCR 解析 ====================

async function parseImage(fileID) {
  try {
    // 下载文件到临时路径
    const downloadRes = await cloud.downloadFile({
      fileID: fileID
    });

    const buffer = downloadRes.fileContent;

    // 调用腾讯云 OCR
    const result = await callOCR(buffer);

    if (result && result.length > 0) {
      return result;
    }

    // OCR 失败时返回空
    return '';
  } catch (err) {
    console.error('OCR解析失败:', err);
    throw new Error('图片识别失败，请尝试粘贴文字');
  }
}

async function callOCR(imageBuffer) {
  const crypto = require('crypto');
  const https = require('https');

  const SECRET_ID = process.env.TENCENT_SECRET_ID;
  const SECRET_KEY = process.env.TENCENT_SECRET_KEY;

  if (!SECRET_ID || !SECRET_KEY) {
    // 没有配置 OCR 密钥时，返回降级提示
    console.warn('未配置 OCR 密钥，无法进行图片识别');
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
          reject(new Error(`OCR响应解析失败: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ==================== 文档解析 ====================

async function parseDocument(fileID, ext) {
  try {
    // 对于 PDF 和 Word，直接下载文件并尝试提取文字
    const downloadRes = await cloud.downloadFile({
      fileID: fileID
    });

    const buffer = downloadRes.fileContent;

    // 尝试作为文本解析
    let text = '';
    try {
      text = buffer.toString('utf-8');
      // 如果包含太多乱码，说明是二进制文件
      if (containsGarbled(text)) {
        text = '';
      }
    } catch (e) {
      text = '';
    }

    if (text && text.trim().length > 10) {
      return text.trim();
    }

    // 二进制文档无法直接解析时
    return ''; // 返回空，前端会提示用户使用粘贴方式
  } catch (err) {
    console.error('文档解析失败:', err);
    return '';
  }
}

// 检测乱码
function containsGarbled(text) {
  const garbledPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return true;
  const garbledLines = lines.filter(l => garbledPattern.test(l));
  return garbledLines.length > lines.length * 0.3;
}

// ==================== 文本文件解析 ====================

async function parseTextFile(fileID) {
  const downloadRes = await cloud.downloadFile({
    fileID: fileID
  });
  return downloadRes.fileContent.toString('utf-8').trim();
}
