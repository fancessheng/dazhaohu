// app.js - 求职打招呼小程序入口
App({
  onLaunch: function () {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d5gjfl3hc0e326b0f',
        traceUser: true
      });
    }

    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = systemInfo;
    this.globalData.statusBarHeight = systemInfo.statusBarHeight;

    // 初始化用户信息
    this.initUserInfo();
  },

  // 初始化用户信息
  async initUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManager',
        data: {
          action: 'login'
        }
      });
      if (res.result && res.result.success) {
        this.globalData.userInfo = res.result.data.user;
        this.globalData.dailyCount = res.result.data.dailyCount;
        this.globalData.isPremium = res.result.data.isPremium;
      }
    } catch (err) {
      console.error('初始化用户信息失败:', err);
    }
  },

  // 刷新用户次数
  async refreshUserCount() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManager',
        data: {
          action: 'getCount'
        }
      });
      if (res.result && res.result.success) {
        this.globalData.dailyCount = res.result.data.dailyCount;
        this.globalData.isPremium = res.result.data.isPremium;
      }
    } catch (err) {
      console.error('刷新次数失败:', err);
    }
  },

  globalData: {
    userInfo: null,
    dailyCount: 0,
    isPremium: false,
    systemInfo: null,
    statusBarHeight: 0
  }
});
