// 用户管理云函数 - 登录、次数管理、会员解锁
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { success: false, message: '未获取到用户身份' };
  }

  try {
    switch (action) {
      case 'login':
        return await handleLogin(openid, event);
      case 'getCount':
        return await getDailyCount(openid);
      case 'unlockPremium':
        return await unlockPremium(openid);
      case 'saveResume':
        return await saveResume(openid, event);
      case 'clearResume':
        return await clearResume(openid);
      case 'deductCount':
        return await deductCount(openid);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('userManager error:', err);
    return { success: false, message: err.message || '服务器错误' };
  }
};

// ==================== 用户登录 ====================

async function handleLogin(openid, event) {
  const usersCollection = db.collection('users');
  const today = getTodayDate();

  // 查找用户
  const userRes = await usersCollection.where({ openid }).get();

  if (userRes.data.length === 0) {
    // 新用户，创建记录
    const newUser = {
      openid,
      nickName: event.nickName || '',
      avatarUrl: event.avatarUrl || '',
      dailyCount: 10,
      totalCount: 10,          // 基础免费额度
      isPremium: false,
      premiumExtraCount: 0,    // 高级会员额外次数
      resetDate: today,
      resumeContent: '',
      resumeFileID: '',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    await usersCollection.add({ data: newUser });

    return {
      success: true,
      data: {
        user: newUser,
        dailyCount: 10,
        isPremium: false
      }
    };
  }

  // 老用户，检查是否需要重置次数
  const user = userRes.data[0];
  let dailyCount = user.dailyCount;
  let isPremium = user.isPremium;
  let premiumExtraCount = user.premiumExtraCount || 0;

  if (user.resetDate !== today) {
    // 新的一天，重置次数
    dailyCount = 10;
    isPremium = false;
    premiumExtraCount = 0;

    await usersCollection.doc(user._id).update({
      data: {
        dailyCount,
        isPremium,
        premiumExtraCount,
        resetDate: today,
        updateTime: db.serverDate()
      }
    });
  } else {
    dailyCount = user.dailyCount;
    isPremium = user.isPremium;
    premiumExtraCount = user.premiumExtraCount || 0;
  }

  return {
    success: true,
    data: {
      user: user,
      dailyCount: dailyCount + premiumExtraCount,
      isPremium
    }
  };
}

// ==================== 获取次数 ====================

async function getDailyCount(openid) {
  const usersCollection = db.collection('users');
  const today = getTodayDate();

  const userRes = await usersCollection.where({ openid }).get();
  if (userRes.data.length === 0) {
    return { success: true, data: { dailyCount: 10, isPremium: false } };
  }

  const user = userRes.data[0];

  // 跨天重置
  if (user.resetDate !== today) {
    await usersCollection.doc(user._id).update({
      data: {
        dailyCount: 10,
        isPremium: false,
        premiumExtraCount: 0,
        resetDate: today,
        updateTime: db.serverDate()
      }
    });
    return { success: true, data: { dailyCount: 10, isPremium: false } };
  }

  return {
    success: true,
    data: {
      dailyCount: user.dailyCount + (user.premiumExtraCount || 0),
      isPremium: user.isPremium
    }
  };
}

// ==================== 解锁高级会员 ====================

async function unlockPremium(openid) {
  const usersCollection = db.collection('users');
  const today = getTodayDate();

  const userRes = await usersCollection.where({ openid }).get();
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' };
  }

  const user = userRes.data[0];

  if (user.resetDate !== today) {
    // 跨天，先重置
    await usersCollection.doc(user._id).update({
      data: {
        dailyCount: 10,
        isPremium: true,
        premiumExtraCount: 10,
        resetDate: today,
        updateTime: db.serverDate()
      }
    });
    return {
      success: true,
      data: { dailyCount: 20, isPremium: true }
    };
  }

  if (user.isPremium) {
    return { success: false, message: '已经是高级会员' };
  }

  // 解锁
  await usersCollection.doc(user._id).update({
    data: {
      isPremium: true,
      premiumExtraCount: 10,
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    data: {
      dailyCount: user.dailyCount + 10,
      isPremium: true
    }
  };
}

// ==================== 扣减次数 ====================

async function deductCount(openid) {
  const usersCollection = db.collection('users');
  const today = getTodayDate();

  const userRes = await usersCollection.where({ openid }).get();
  if (userRes.data.length === 0) {
    return { success: false, message: '用户不存在' };
  }

  const user = userRes.data[0];

  // 跨天重置
  if (user.resetDate !== today) {
    await usersCollection.doc(user._id).update({
      data: {
        dailyCount: 9,
        isPremium: false,
        premiumExtraCount: 0,
        resetDate: today,
        updateTime: db.serverDate()
      }
    });
    return { success: true, data: { dailyCount: 9, isPremium: false } };
  }

  const totalRemaining = user.dailyCount + (user.premiumExtraCount || 0);

  if (totalRemaining <= 0) {
    return { success: false, message: '今日次数已用完' };
  }

  // 先扣高级会员的额外次数
  let newPremiumExtra = user.premiumExtraCount || 0;
  let newDailyCount = user.dailyCount;

  if (newPremiumExtra > 0) {
    newPremiumExtra -= 1;
  } else {
    newDailyCount -= 1;
  }

  await usersCollection.doc(user._id).update({
    data: {
      dailyCount: newDailyCount,
      premiumExtraCount: newPremiumExtra,
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    data: {
      dailyCount: newDailyCount + newPremiumExtra,
      isPremium: user.isPremium
    }
  };
}

// ==================== 简历管理 ====================

async function saveResume(openid, event) {
  const usersCollection = db.collection('users');

  await usersCollection.where({ openid }).update({
    data: {
      resumeContent: event.resumeContent || '',
      resumeFileID: event.resumeFileID || '',
      updateTime: db.serverDate()
    }
  });

  return { success: true, message: '简历已保存' };
}

async function clearResume(openid) {
  const usersCollection = db.collection('users');

  await usersCollection.where({ openid }).update({
    data: {
      resumeContent: '',
      resumeFileID: '',
      updateTime: db.serverDate()
    }
  });

  return { success: true, message: '简历已清空' };
}

// ==================== 辅助函数 ====================

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
