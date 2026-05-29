# 求职打招呼 - 微信小程序

> AI 驱动的 BOSS 直聘打招呼话术生成工具

## 📋 项目简介

帮助求职者在 BOSS 直聘平台上生成个性化的招呼话术。上传简历 + 输入岗位信息，AI 自动生成打动 HR 的专属打招呼话术。

## 🏗️ 技术架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | 微信原生 (WXML + WXSS + JS) | 无需额外框架 |
| 后端 | 微信云开发 CloudBase | 云函数 + 云数据库 + 云存储 |
| AI | 腾讯混元大模型 | 国内合规，调用链路最短 |
| OCR | 腾讯云 OCR | 简历/截图文字识别 |

## 📁 项目结构

```
dazhaohu/
├── project.config.json          # 小程序项目配置
├── cloudfunctions/              # 云函数
│   ├── userManager/             # 用户管理 + 次数控制
│   ├── generateScript/          # AI 话术生成（混元）
│   ├── parseResume/             # 简历解析（PDF/Word/OCR）
│   └── parseJD/                 # 岗位截图 OCR 识别
├── miniprogram/                 # 小程序前端
│   ├── app.js                   # 小程序入口
│   ├── app.json                 # 全局配置
│   ├── app.wxss                 # 全局样式
│   ├── pages/
│   │   ├── index/               # 首页（生成话术）
│   │   ├── result/              # 结果页（展示话术）
│   │   └── profile/             # 个人中心
│   └── images/                  # 图标资源
└── README.md                    # 本文件
```

## 🚀 快速开始

### 1. 准备工作

- 注册微信小程序账号（个人认证）：https://mp.weixin.qq.com
- 获取 AppID
- 开通云开发：小程序后台 → 开发 → 云开发 → 开通

### 2. 配置项目

1. 修改 `project.config.json` 中的 `appid` 为你的小程序 AppID
2. 修改 `miniprogram/app.js` 中的 `env` 为你的云开发环境 ID
3. 更新 `miniprogram/pages/index/index.wxml` 中的广告位 `unit-id`
4. 在微信云开发控制台创建以下数据库集合：
   - `users`（用户数据）
5. 配置云函数环境变量：
   - `TENCENT_SECRET_ID`：腾讯云 API 密钥 ID
   - `TENCENT_SECRET_KEY`：腾讯云 API 密钥 Key

### 3. 部署云函数

在微信开发者工具中，右键每个云函数文件夹 → "上传并部署：云端安装依赖"

### 4. 开启广告

1. 小程序后台 → 流量主 → 开通流量主
2. 创建激励视频广告位
3. 将广告位 ID 填入 `pages/index/index.wxml` 和 `pages/profile/profile.wxml` 的 `<ad>` 组件

### 5. 预览

点击开发者工具中的"预览"，扫码体验。

## 📊 数据库设计

### users 集合

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | 自动生成 |
| openid | string | 微信用户唯一标识 |
| nickName | string | 微信昵称 |
| avatarUrl | string | 微信头像 |
| dailyCount | number | 当日剩余免费次数 |
| isPremium | boolean | 是否高级会员 |
| premiumExtraCount | number | 高级会员额外次数 |
| resetDate | string | 次数重置日期 YYYY-MM-DD |
| resumeContent | string | 简历文字内容 |
| resumeFileID | string | 简历文件云存储 ID |
| createTime | date | 创建时间 |
| updateTime | date | 更新时间 |

## 🎯 会员逻辑

```
免费用户：每日 10 次生成机会
         ↓ 看激励视频广告
高级会员：额外获得 10 次（总共 20 次/天）
         ↓ 次日 00:00
自动重置为免费用户（10 次）
```

## 💰 费用估算

| 项目 | 启动 | 月运营（千用户级） |
|------|------|-------------------|
| 小程序认证 | ¥30/年 | ¥0 |
| 云开发 | 免费额度 | ¥0-50 |
| 混元 AI | 免费额度 | ¥10-50 |
| 腾讯云 OCR | 1000次/月免费 | ¥0-30 |
| **合计** | **¥30** | **¥30-130** |

## 📝 开发备忘录

- 个人认证小程序：不支持微信支付，通过激励视频广告变现
- 两个 tabBar 页面：首页（话术生成）、我的（个人中心）
- AI 降级方案：当混元 API 不可用时，使用本地模板兜底
- 简历文件解析：OCR 需要配置腾讯云密钥，否则仅支持粘贴文字
- 广告解锁：用户主动观看激励视频广告后解锁高级会员

## 🔧 待优化

- [ ] 话术生成支持多轮对话微调
- [ ] 简历解析支持更精确的 PDF 文字提取
- [ ] 添加话术历史记录
- [ ] 支持多份简历切换
- [ ] 分享功能优化（分享得额外次数）
