// AI话术生成云函数 - 调用腾讯混元
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 腾讯混元配置
const HUNYUAN_CONFIG = {
  // 你的腾讯云 SecretId 和 SecretKey
  // 从 https://console.cloud.tencent.com/cam/capi 获取
  secretId: process.env.TENCENT_SECRET_ID || 'your-secret-id',
  secretKey: process.env.TENCENT_SECRET_KEY || 'your-secret-key',
  // 混元 API 端点
  endpoint: 'hunyuan.tencentcloudapi.com',
  // 模型版本
  model: 'hunyuan-lite',
  // 区域
  region: 'ap-guangzhou'
};

exports.main = async (event, context) => {
  const { action, resume, jd } = event;

  try {
    switch (action) {
      case 'generate':
        return await generateScript(resume, jd);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('generateScript error:', err);
    return { success: false, message: err.message || '生成失败' };
  }
};

// ==================== 生成话术 ====================

async function generateScript(resume, jd) {
  if (!resume || !jd) {
    return { success: false, message: '简历和岗位信息不能为空' };
  }

  // 构建 Prompt
  const prompt = buildPrompt(resume, jd);

  // 调用混元 API
  let result;
  try {
    result = await callHunyuan(prompt);
  } catch (err) {
    console.error('混元API调用失败:', err.message);
    // 降级方案：使用更简单的生成逻辑
    result = generateFallbackScript(resume, jd);
  }

  // 后处理：提取话术内容和岗位名称
  const processed = processResult(result, jd);

  return {
    success: true,
    data: {
      script: processed.script,
      jobTitle: processed.jobTitle
    }
  };
}

// ==================== Prompt 构建 ====================

function buildPrompt(resume, jd) {
  return `你是专业的求职顾问，擅长撰写 BOSS 直聘的打招呼话术。

## 任务
根据下面提供的【候选人简历】和【岗位要求】，撰写一段 BOSS 直聘的"打招呼"话术。

## 要求
1. 字数控制在 100-250 字之间
2. 必须体现候选人经历与岗位要求的匹配点
3. 语气自信但不傲慢，真诚但不卑微
4. 突出候选人的核心优势（至少 2 个亮点）
5. 开头要有吸引力，让 HR 愿意继续看
6. 可以用"您好"或"你好"开头
7. 结尾可以礼貌表达期待回复
8. 不可用"尊敬的领导"这类过于正式的称呼
9. 纯文本格式，不要 Markdown 标记

## 候选人简历
${resume}

## 岗位要求
${jd}

## 输出格式
请直接输出打招呼话术内容，不要包含任何解释或前缀。`;
}

// ==================== 调用腾讯混元 ====================

async function callHunyuan(prompt) {
  // 使用腾讯云 API 3.0 签名方式
  const crypto = require('crypto');

  const SECRET_ID = HUNYUAN_CONFIG.secretId;
  const SECRET_KEY = HUNYUAN_CONFIG.secretKey;

  if (!SECRET_ID || SECRET_ID === 'your-secret-id') {
    throw new Error('未配置腾讯云密钥，请在云函数环境变量中设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY');
  }

  const service = 'hunyuan';
  const host = HUNYUAN_CONFIG.endpoint;
  const region = HUNYUAN_CONFIG.region;

  // API 参数
  const payload = JSON.stringify({
    Model: HUNYUAN_CONFIG.model,
    Messages: [
      {
        Role: 'user',
        Content: prompt
      }
    ],
    TopP: 0.8,
    Temperature: 0.8,
    Stream: false
  });

  // 构建请求
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().substring(0, 10);

  // 签名
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQuerystring = '';
  const contentType = 'application/json; charset=utf-8';
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:chatcompletions\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload
  ].join('\n');

  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    hashedCanonicalRequest
  ].join('\n');

  const secretDate = crypto.createHmac('sha256', `TC3${SECRET_KEY}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // 发送请求
  const https = require('https');
  const options = {
    hostname: host,
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Host': host,
      'X-TC-Action': 'ChatCompletions',
      'X-TC-Version': '2023-09-01',
      'X-TC-Timestamp': timestamp,
      'X-TC-Region': region,
      'Authorization': authorization
    }
  };

  return new Promise((resolve, reject) => {
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
          // 提取回复内容
          const content = response.Response
            && response.Response.Choices
            && response.Response.Choices[0]
            && response.Response.Choices[0].Message
            && response.Response.Choices[0].Message.Content;
          resolve(content || '');
        } catch (e) {
          reject(new Error(`解析响应失败: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ==================== 降级方案 ====================

function generateFallbackScript(resume, jd) {
  // 从简历中提取关键信息
  const resumeHighlights = extractHighlights(resume);
  const jdKeywords = extractJDKeywords(jd);

  // 构建降级话术模板
  const templates = [
    `您好，看到贵司的${jdKeywords.position || '岗位'}招聘信息，非常感兴趣。我拥有${resumeHighlights.experience || '相关行业经验'}，擅长${resumeHighlights.skills || '相关工作技能'}，与岗位要求高度匹配。曾${resumeHighlights.achievement || '取得过不错的工作成绩'}，相信能为团队带来价值。期待与您进一步沟通，谢谢！`,

    `您好！我对${jdKeywords.position || '这个岗位'}很感兴趣。我有${resumeHighlights.experience || '多年相关经验'}，在${resumeHighlights.skills || '核心技能方面'}能力突出。做过${resumeHighlights.achievement || '相关的项目/工作'}。希望有机会详细聊聊，感谢您的时间～`,

    `您好，申请${jdKeywords.position || '贵司岗位'}。我有${resumeHighlights.experience || '相关行业背景'}，擅长${resumeHighlights.skills || '核心能力'}。${resumeHighlights.achievement || '过往成绩不错'}，期待进一步交流。谢谢！`
  ];

  // 随机选一个
  return templates[Math.floor(Math.random() * templates.length)];
}

function extractHighlights(resume) {
  const highlights = {};
  const text = resume.toLowerCase();

  // 提取经验年限
  const yearMatch = resume.match(/(\d+)\s*年/);
  if (yearMatch) {
    highlights.experience = `${yearMatch[1]}年工作经验`;
  }

  // 提取技能关键词
  const skillKeywords = ['Python', 'Java', 'JavaScript', 'React', 'Vue', 'Node.js', '数据分析',
    '项目管理', '运营', '销售', '市场', '设计', '产品', '开发', '测试', '管理'];
  const foundSkills = skillKeywords.filter(k => text.includes(k.toLowerCase()));
  if (foundSkills.length > 0) {
    highlights.skills = foundSkills.slice(0, 2).join('、');
  }

  // 提取成就关键词
  const achievementKeywords = ['负责', '主导', '完成', '提升', '优化', '实现', '达成'];
  highlights.achievement = '有相关项目/工作经历';

  return highlights;
}

function extractJDKeywords(jd) {
  const keywords = {};

  // 提取岗位名称
  const positionMatch = jd.match(/(?:岗位|职位|招聘)[：:]\s*(.+)|(.+?)(?:招聘|急招|诚聘)/);
  if (positionMatch) {
    keywords.position = (positionMatch[1] || positionMatch[2] || '').trim().slice(0, 20);
  }

  return keywords;
}

// ==================== 结果后处理 ====================

function processResult(rawScript, jd) {
  let script = rawScript.trim();

  // 清理可能的 Markdown 标记
  script = script.replace(/^#+\s*/gm, '');
  script = script.replace(/\*\*/g, '');
  script = script.replace(/^[-*]\s/gm, '');
  script = script.replace(/```[\s\S]*?```/g, '');

  // 提取岗位名称
  const jdKeywords = extractJDKeywords(jd);

  return {
    script: script,
    jobTitle: jdKeywords.position || ''
  };
}
