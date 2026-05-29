// 个人中心页
const app = getApp();

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    userId: '',
    dailyCount: 0,
    isPremium: false,
    resumeContent: '',
    showAd: false
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userData = app.globalData;
    this.setData({
      dailyCount: userData.dailyCount || 0,
      isPremium: userData.isPremium || false,
      userId: (userData.userInfo && userData.userInfo._id) || '',
      nickName: (userData.userInfo && userData.userInfo.nickName) || '',
      avatarUrl: (userData.userInfo && userData.userInfo.avatarUrl) || '',
      resumeContent: (userData.userInfo && userData.userInfo.resumeContent) || ''
    });
  },

  // 看广告解锁高级会员
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
      }
    } catch (err) {
      wx.hideLoading();
      console.error('解锁失败:', err);
      wx.showToast({ title: '解锁失败，请稍后重试', icon: 'none' });
    }
  },

  // 编辑简历
  editResume() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 清空简历
  async clearResume() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空已保存的简历吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await wx.cloud.callFunction({
              name: 'userManager',
              data: {
                action: 'clearResume'
              }
            });
            this.setData({ resumeContent: '' });
            app.globalData.userInfo.resumeContent = '';
            wx.showToast({ title: '已清空', icon: 'success' });
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 跳转编辑简历
  goToEditResume() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
