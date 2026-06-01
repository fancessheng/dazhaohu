// 首页逻辑 - 求职打招呼
const app = getApp();

// 10个 0-3年求职者最常选择的岗位（基于BOSS直聘热门岗位调研）
const JOB_TYPES = [
  { id: 'media', name: '新媒体运营', icon: '📱', desc: '内容创作、社媒运营、粉丝增长' },
  { id: 'design', name: '平面设计', icon: '🎨', desc: 'VI设计、海报、品牌视觉' },
  { id: 'fe', name: '前端开发', icon: '💻', desc: 'HTML/CSS/JS、Vue、React' },
  { id: 'product', name: '产品助理', icon: '📊', desc: '需求分析、原型设计、产品迭代' },
  { id: 'operate', name: '电商运营', icon: '🛒', desc: '淘宝/抖店运营、直播带货' },
  { id: 'sale', name: '销售/BD', icon: '🤝', desc: '客户开发、商务拓展、销售转化' },
  { id: 'advert', name: '信息流优化', icon: '📈', desc: '竞价推广、ROI优化、数据分析' },
  { id: 'hr', name: 'HR招聘', icon: '👥', desc: '简历筛选、面试安排、员工关系' },
  { id: 'finance', name: '财务/会计', icon: '💰', desc: '会计核算、财务报表、税务申报' },
  { id: 'customer', name: '客服/运营', icon: '🎧', desc: '用户服务、投诉处理、满意度提升' },
];

Page({
  data: {
    // 用户状态
    dailyCount: 0,
    isPremium: false,

    // 岗位选择
    jobTypes: JOB_TYPES,
    selectedJobId: '',       // 快选标签id
    currentJobName: '',      // 最终使用的岗位名称
    currentJobDesc: '',      // 岗位描述
    customJobExpanded: false, // 是否展开自定义输入
    customJobName: '',        // 自定义岗位名

    // 简历
    resumeExpanded: false,
    resumeMode: 'paste',
    resumeFile: null,
    resumeText: '',
    resumeParsed: false,
    resumeContent: '',

    // 岗位信息 JD
    jdMode: 'paste',
    jdImage: '',
    jdText: '',
    jdParsed: false,
    jdContent: '',

    // 生成状态
    isGenerating: false,
    currentStep: 0,

    // 广告
    showAd: false,
  },

  // ======= 生命周期 =======

  onLoad() {
    this.loadUserData();
  },

  onShow() {
    this.loadUserData();
  },

  // ======= 用户数据 =======

  loadUserData() {
    const g = app.globalData || {};
    this.setData({
      dailyCount: g.dailyCount || 0,
      isPremium: g.isPremium || false,
    });
  },

  // 点击次数区域
  onQuotaTap() {
    const { dailyCount, isPremium } = this.data;
    if (dailyCount <= 0 && !isPremium) {
      wx.showModal({
        title: '今日次数已用完',
        content: '观看一段短视频，解锁今日额外 10 次使用机会',
        confirmText: '看广告解锁',
        cancelText: '算了',
        success: (res) => {
          if (res.confirm) this.watchAd();
        }
      });
    } else {
      wx.showToast({
        title: `今日还剩 ${dailyCount} 次`,
        icon: 'none',
      });
    }
  },

  // ======= 岗位选择 =======

  selectJob(e) {
    const { id, name, desc } = e.currentTarget.dataset;
    const isSame = this.data.selectedJobId === id;
    this.setData({
      selectedJobId: isSame ? '' : id,
      currentJobName: isSame ? '' : name,
      currentJobDesc: isSame ? '' : desc,
      customJobExpanded: false,
      customJobName: '',
    });
  },

  toggleCustomJob() {
    const expand = !this.data.customJobExpanded;
    this.setData({
      customJobExpanded: expand,
      // 展开时清空快选
      selectedJobId: expand ? '' : this.data.selectedJobId,
      currentJobName: expand ? (this.data.customJobName || '') : this.data.currentJobName,
    });
  },

  onCustomJobInput(e) {
    const val = e.detail.value;
    this.setData({
      customJobName: val,
      currentJobName: val,
      currentJobDesc: '',
      selectedJobId: '',
    });
  },

  // ======= 简历 =======

  toggleResume() {
    this.setData({ resumeExpanded: !this.data.resumeExpanded });
  },

  switchResumeMode(e) {
    this.setData({ resumeMode: e.currentTarget.dataset.mode });
  },

  onResumeInput(e) {
    this.setData({ resumeText: e.detail.value, resumeParsed: false });
  },

  uploadResume() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'],
      success: (res) => {
        const file = res.tempFiles[0];
        this.setData({ resumeFile: file, resumeParsed: false });
        wx.showLoading({ title: '解析简历中…' });
        this.parseResumeFile(file.path, file.name);
      },
      fail: (err) => {
        if (!err.errMsg.includes('cancel')) {
          wx.showToast({ title: '选择文件失败', icon: 'none' });
        }
      }
    });
  },

  async parseResumeFile(filePath, fileName) {
    try {
      const cloudPath = `resumes/${Date.now()}_${fileName}`;
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath });
      const parseRes = await wx.cloud.callFunction({
        name: 'parseResume',
        data: { action: 'parse', fileID: uploadRes.fileID, fileName }
      });
      if (parseRes.result && parseRes.result.success) {
        this.setData({
          resumeParsed: true,
          resumeContent: parseRes.result.data.content,
          resumeText: parseRes.result.data.content,
        });
        wx.hideLoading();
        wx.showToast({ title: '简历解析成功', icon: 'success' });
      } else {
        throw new Error(parseRes.result.message || '解析失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '解析失败，可手动粘贴文字', icon: 'none', duration: 3000 });
    }
  },

  // ======= 岗位信息 JD =======

  switchJDMode(e) {
    this.setData({ jdMode: e.currentTarget.dataset.mode });
  },

  onJDInput(e) {
    this.setData({ jdText: e.detail.value, jdParsed: false });
  },

  uploadScreenshot() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.setData({ jdImage: tempPath, jdParsed: false });
        wx.showLoading({ title: '识别岗位信息…' });
        this.parseJDScreenshot(tempPath);
      },
      fail: (err) => {
        if (!err.errMsg.includes('cancel')) {
          wx.showToast({ title: '选择图片失败', icon: 'none' });
        }
      }
    });
  },

  async parseJDScreenshot(imagePath) {
    try {
      const cloudPath = `screenshots/${Date.now()}.png`;
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: imagePath });
      const parseRes = await wx.cloud.callFunction({
        name: 'parseJD',
        data: { action: 'ocr', fileID: uploadRes.fileID }
      });
      if (parseRes.result && parseRes.result.success) {
        this.setData({
          jdParsed: true,
          jdContent: parseRes.result.data.content,
          jdText: parseRes.result.data.content,
        });
        wx.hideLoading();
        wx.showToast({ title: '岗位信息识别成功', icon: 'success' });
      } else {
        throw new Error('识别失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '识别失败，请粘贴文字', icon: 'none', duration: 3000 });
    }
  },

  // ======= 生成话术 =======

  get canGenerate() {
    const { dailyCount, isPremium, currentJobName, jdText, jdParsed } = this.data;
    const countOk = dailyCount > 0 || isPremium;
    const jobOk = (currentJobName || '').length > 0;
    const jdOk = jdParsed || (jdText || '').trim().length > 10;
    return countOk && jobOk && jdOk;
  },

  get hasJD() {
    return this.data.jdParsed || (this.data.jdText || '').trim().length > 10;
  },

  generateScript() {
    if (!this.canGenerate) {
      if (this.data.dailyCount <= 0 && !this.data.isPremium) {
        this.watchAd();
      } else if (!this.data.currentJobName) {
        wx.showToast({ title: '请先选择目标岗位', icon: 'none' });
      } else {
        wx.showToast({ title: '请填写投递职位信息', icon: 'none' });
      }
      return;
    }

    const resumeContent = this.data.resumeParsed
      ? this.data.resumeContent
      : this.data.resumeText.trim();

    const jdContent = this.data.jdParsed
      ? this.data.jdContent
      : this.data.jdText.trim();

    this.setData({ isGenerating: true, currentStep: 0 });
    this.simulateSteps();
    this.callGenerateAPI(resumeContent, jdContent);
  },

  simulateSteps() {
    [1, 2, 3].forEach((step, i) => {
      setTimeout(() => {
        if (this.data.isGenerating) this.setData({ currentStep: step });
      }, (i + 1) * 900);
    });
  },

  async callGenerateAPI(resumeContent, jdContent) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'generateScript',
        data: {
          action: 'generate',
          resume: resumeContent,
          jd: jdContent,
          jobType: this.data.currentJobName,
        }
      });

      this.setData({ isGenerating: false, currentStep: 3 });

      if (res.result && res.result.success) {
        // 扣减次数
        const newCount = Math.max(0, this.data.dailyCount - 1);
        this.setData({ dailyCount: newCount });
        app.globalData.dailyCount = newCount;

        wx.navigateTo({
          url: `/pages/result/result?script=${encodeURIComponent(res.result.data.script)}&jobTitle=${encodeURIComponent(this.data.currentJobName || '')}`
        });
      } else {
        throw new Error(res.result.message || '生成失败');
      }
    } catch (err) {
      this.setData({ isGenerating: false });
      wx.showToast({ title: '生成失败，请稍后重试', icon: 'none' });
    }
  },

  // ======= 广告 =======

  watchAd() {
    this.setData({ showAd: true });
  },

  onAdLoad() {
    console.log('广告加载成功');
  },

  onAdError(err) {
    console.error('广告加载失败:', err);
    wx.showToast({ title: '广告暂时不可用，请稍后再试', icon: 'none' });
    this.setData({ showAd: false });
  },

  onAdClose() {
    this.setData({ showAd: false });
    this.unlockPremium();
  },

  async unlockPremium() {
    try {
      wx.showLoading({ title: '解锁中…' });
      const res = await wx.cloud.callFunction({
        name: 'userManager',
        data: { action: 'unlockPremium' }
      });
      wx.hideLoading();
      if (res.result && res.result.success) {
        const newCount = res.result.data.dailyCount;
        this.setData({ isPremium: true, dailyCount: newCount });
        app.globalData.isPremium = true;
        app.globalData.dailyCount = newCount;
        wx.showToast({ title: '已解锁！今日额外 +10 次', icon: 'success' });
      } else {
        throw new Error('解锁失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '解锁失败，请稍后重试', icon: 'none' });
    }
  }
});
