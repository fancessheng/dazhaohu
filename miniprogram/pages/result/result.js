// 结果页逻辑
Page({
  data: {
    script: '',
    jobTitle: '',
    highlights: [],
    copied: false
  },

  onLoad(options) {
    // 接收页面参数
    if (options.script) {
      const script = decodeURIComponent(options.script);
      const jobTitle = options.jobTitle ? decodeURIComponent(options.jobTitle) : '';

      this.setData({
        script: script,
        jobTitle: jobTitle,
        highlights: this.extractHighlights(script)
      });

      // 自动复制到剪贴板
      this.autoCopy(script);
    }
  },

  // 提取话术亮点
  extractHighlights(script) {
    const highlights = [];
    const lines = script.split('\n').filter(line => line.trim());

    // 简单的亮点识别逻辑
    if (script.includes('经历') || script.includes('经验')) {
      highlights.push('关联了你的工作经验');
    }
    if (script.includes('技能') || script.includes('能力')) {
      highlights.push('突出了你的核心技能');
    }
    if (script.includes('贵公司') || script.includes('贵司')) {
      highlights.push('表达了对公司的认可');
    }
    if (script.includes('岗位') || script.includes('职位')) {
      highlights.push('明确了对岗位的理解');
    }
    if (script.length < 200) {
      highlights.push('话术简洁有力，易于阅读');
    } else if (script.length > 500) {
      highlights.push('内容详尽，展现了充分准备');
    }

    if (highlights.length === 0) {
      highlights.push('个性化定制的求职话术');
    }

    return highlights;
  },

  // 自动复制
  autoCopy(script) {
    wx.setClipboardData({
      data: script,
      success: () => {
        this.setData({ copied: true });
      }
    });
  },

  // 手动复制
  copyScript() {
    wx.setClipboardData({
      data: this.data.script,
      success: () => {
        this.setData({ copied: true });
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
      }
    });
  },

  // 重新生成
  regenerate() {
    wx.navigateBack();
  },

  // 返回首页
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '求职打招呼 - AI帮你写出让HR心动的话术',
      path: '/pages/index/index'
    };
  }
});
