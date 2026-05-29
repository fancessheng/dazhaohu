// 首页逻辑 - 简历上传 + 岗位信息 + 生成话术
const app = getApp();

Page({
  data: {
    // 用户信息
    dailyCount: 0,
    isPremium: false,

    // 简历
    resumeMode: 'paste',        // 'upload' | 'paste'
    resumeFile: null,           // 上传的文件对象
    resumeText: '',             // 粘贴的简历文字
    resumeParsed: false,        // 简历是否已解析
    resumeContent: '',          // 解析后的简历内容

    // 岗位信息
    jdMode: 'paste',            // 'screenshot' | 'paste'
    jdImage: '',                // 截图临时路径
    jdText: '',                 // 粘贴的JD文字
    jdParsed: false,            // JD是否已识别
    jdContent: '',              // 解析后的JD内容

    // 生成状态
    isGenerating: false,
    currentStep: 0,             // 当前生成步骤

    // 广告
    showAd: false
  },

  // ==================== 生命周期 ====================

  onLoad() {
    this.loadUserData();
  },

  onShow() {
    // 每次显示页面刷新次数
    this.loadUserData();
  },

  // ==================== 计算属性 ====================

  get canGenerate() {
    return this.data.dailyCount > 0
      || (this.data.dailyCount === 0 && this.data.isPremium);
  },

  get hasResume() {
    return this.data.resumeParsed || this.data.resumeText.trim().length > 10;
  },

  get hasJD() {
    return this.data.jdParsed || this.data.jdText.trim().length > 10;
  },

  // ==================== 用户数据 ====================

  async loadUserData() {
    const userData = app.globalData;
    this.setData({
      dailyCount: userData.dailyCount || 0,
      isPremium: userData.isPremium || false
    });
  },

  // ==================== 简历操作 ====================

  switchResumeMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ resumeMode: mode });
  },

  // 上传简历文件
  uploadResume() {
    const that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'],
      success(res) {
        const file = res.tempFiles[0];
        that.setData({ 
          resumeFile: file,
          resumeParsed: false
        });

        // 显示加载中
        wx.showLoading({ title: '解析简历中…' });

        // 上传到云存储并解析
        that.parseResumeFile(file.path, file.name);
      },
      fail(err) {
        if (err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择文件失败', icon: 'none' });
        }
      }
    });
  },

  // 解析简历文件
  async parseResumeFile(filePath, fileName) {
    try {
      // 先上传到云存储
      const cloudPath = `resumes/${Date.now()}_${fileName}`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
      });

      // 调用云函数解析
      const parseRes = await wx.cloud.callFunction({
        name: 'parseResume',
        data: {
          action: 'parse',
          fileID: uploadRes.fileID,
          fileName: fileName
        }
      });

      if (parseRes.result && parseRes.result.success) {
        this.setData({
          resumeParsed: true,
          resumeContent: parseRes.result.data.content,
          resumeText: parseRes.result.data.content  // 同步到粘贴框
        });
        wx.hideLoading();
        wx.showToast({ title: '简历解析成功', icon: 'success' });
      } else {
        throw new Error(parseRes.result.message || '解析失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('简历解析失败:', err);
      wx.showToast({ 
        title: '简历解析失败，请尝试粘贴文字', 
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 粘贴简历文字
  onResumeInput(e) {
    this.setData({ 
      resumeText: e.detail.value,
      resumeParsed: false
    });
  },

  // ==================== 岗位信息操作 ====================

  switchJDMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ jdMode: mode });
  },

  // 上传岗位截图
  uploadScreenshot() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempPath = res.tempFiles[0].tempFilePath;
        that.setData({ 
          jdImage: tempPath,
          jdParsed: false
        });

        wx.showLoading({ title: '识别岗位信息…' });
        that.parseJDScreenshot(tempPath);
      },
      fail(err) {
        if (err.errMsg.indexOf('cancel') === -1) {
          wx.showToast({ title: '选择图片失败', icon: 'none' });
        }
      }
    });
  },

  // 解析岗位截图
  async parseJDScreenshot(imagePath) {
    try {
      // 先上传到云存储
      const cloudPath = `screenshots/${Date.now()}.png`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: imagePath
      });

      // 调用云函数OCR识别
      const parseRes = await wx.cloud.callFunction({
        name: 'parseJD',
        data: {
          action: 'ocr',
          fileID: uploadRes.fileID
        }
      });

      if (parseRes.result && parseRes.result.success) {
        this.setData({
          jdParsed: true,
          jdContent: parseRes.result.data.content,
          jdText: parseRes.result.data.content  // 同步到粘贴框
        });
        wx.hideLoading();
        wx.showToast({ title: '岗位信息识别成功', icon: 'success' });
      } else {
        throw new Error(parseRes.result.message || '识别失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('岗位识别失败:', err);
      wx.showToast({ 
        title: '识别失败，请尝试粘贴文字', 
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 粘贴JD文字
  onJDInput(e) {
    this.setData({ 
      jdText: e.detail.value,
      jdParsed: false
    });
  },

  // ==================== 生成话术 ====================

  generateScript() {
    // 前置检查
    if (this.data.dailyCount <= 0 && !this.data.isPremium) {
      wx.showToast({ title: '今日次数已用完', icon: 'none' });
      return;
    }

    const resumeContent = this.data.resumeParsed 
      ? this.data.resumeContent 
      : this.data.resumeText.trim();
    const jdContent = this.data.jdParsed 
      ? this.data.jdContent 
      : this.data.jdText.trim();

    if (!resumeContent || resumeContent.length < 10) {
      wx.showToast({ title: '请先输入简历内容', icon: 'none' });
      return;
    }
    if (!jdContent || jdContent.length < 10) {
      wx.showToast({ title: '请先输入岗位信息', icon: 'none' });
      return;
    }

    // 开始生成
    this.setData({ isGenerating: true, currentStep: 0 });

    // 模拟步骤动画
    this.simulateSteps();

    // 调用云函数
    this.callGenerateAPI(resumeContent, jdContent);
  },

  // 模拟生成步骤动画
  simulateSteps() {
    const steps = [1, 2, 3];
    steps.forEach((step, index) => {
      setTimeout(() => {
        if (this.data.isGenerating) {
          this.setData({ currentStep: step });
        }
      }, (index + 1) * 800);
    });
  },

  // 调用 AI 生成接口
  async callGenerateAPI(resumeContent, jdContent) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'generateScript',
        data: {
          action: 'generate',
          resume: resumeContent,
          jd: jdContent
        }
      });

      this.setData({ isGenerating: false, currentStep: 3 });

      if (res.result && res.result.success) {
        // 减少可用次数
        this.setData({ dailyCount: this.data.dailyCount - 1 });
        app.globalData.dailyCount = this.data.dailyCount;

        // 跳转到结果页
        wx.navigateTo({
          url: `/pages/result/result?script=${encodeURIComponent(res.result.data.script)}&jobTitle=${encodeURIComponent(res.result.data.jobTitle || '')}`
        });
      } else {
        throw new Error(res.result.message || '生成失败');
      }
    } catch (err) {
      this.setData({ isGenerating: false });
      console.error('生成话术失败:', err);
      wx.showToast({ 
        title: '生成失败，请稍后重试', 
        icon: 'none' 
      });
    }
  },

  // ==================== 广告 ====================

  watchAd() {
    this.setData({ showAd: true });
  },

  onAdLoad() {
    console.log('广告加载成功');
  },

  onAdError(err) {
    console.error('广告加载失败:', err);
    wx.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' });
    this.setData({ showAd: false });
  },

  onAdClose() {
    this.setData({ showAd: false });
    // 广告看完 → 调用后端解锁
    this.unlockPremium();
  },

  async unlockPremium() {
    try {
      wx.showLoading({ title: '解锁中…' });
      const res = await wx.cloud.callFunction({
        name: 'userManager',
        data: {
          action: 'unlockPremium'
        }
      });

      wx.hideLoading();
      if (res.result && res.result.success) {
        this.setData({
          isPremium: true,
          dailyCount: res.result.data.dailyCount
        });
        app.globalData.isPremium = true;
        app.globalData.dailyCount = res.result.data.dailyCount;
        wx.showToast({ title: '高级会员已解锁！+10次', icon: 'success' });
      } else {
        throw new Error(res.result.message || '解锁失败');
      }
    } catch (err) {
      wx.hideLoading();
      console.error('解锁失败:', err);
      wx.showToast({ title: '解锁失败，请稍后重试', icon: 'none' });
    }
  }
});
