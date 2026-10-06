// 台灣職棒・球探模擬器 - 動態選秀池抽樣與洗牌引擎 (Generator Engine)

window.Generator = {
  // 記錄已被選走的球員 ID（跨年度不重複出現在池中）
  draftedPlayerIds: new Set(),

  // 重設遊戲記錄（重新開局時清空）
  reset: function() {
    this.draftedPlayerIds.clear();
  },

  // 隨機從陣列中抽取 N 個不重複元素
  sampleArray: function(array, n, excludedIds) {
    const available = array.filter(item => !excludedIds.has(item.id));
    // 如果可用人數不足，退回全陣列抽取
    const pool = available.length >= n ? available : array;
    
    // Fisher-Yates 隨機洗牌淺拷貝
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
  },

  // 核心方法：動態生成一屆 18 人的選秀名單
  generateDraftClass: function(seasonYear = 1) {
    const pool = window.DB.getMasterPool();
    
    // 依黃金比例抽樣：2 神獸 + 6 中堅 + 4 地雷 + 6 普通人
    const sampledSuperstars = this.sampleArray(pool.superstars, 2, this.draftedPlayerIds);
    const sampledRegulars = this.sampleArray(pool.regulars, 6, this.draftedPlayerIds);
    const sampledBusts = this.sampleArray(pool.busts, 4, this.draftedPlayerIds);
    const sampledOrdinary = this.sampleArray(pool.ordinary, 6, this.draftedPlayerIds);

    // 合併 18 位新秀
    const rawClass = [
      ...sampledSuperstars,
      ...sampledRegulars,
      ...sampledBusts,
      ...sampledOrdinary
    ];

    // 全體 18 人進行徹底的隨機洗牌打亂（大物不再固定在前面！）
    for (let i = rawClass.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawClass[i], rawClass[j]] = [rawClass[j], rawClass[i]];
    }

    // 為當屆 18 位選手編號，並封裝公開情資與未公開暗屬性
    const draftClass = rawClass.map((player, index) => {
      const displayIndex = String(index + 1).padStart(2, "0");
      return {
        // 公開情資（玩家選秀時看到的真實高三情報）
        displayId: displayIndex,
        displayCode: `新秀 ${displayIndex}`,
        title: player.title,
        pos: player.pos,
        bats: player.bats,
        height: player.height,
        weight: player.weight,
        school: player.school,
        stats: player.stats,
        scout_pros: player.scout_pros,
        scout_cons: player.scout_cons,

        // 隱藏屬性（開箱時才會解鎖）
        id: player.id,
        tier: player.tier,
        real_nickname: player.real_nickname,
        real_name_hint: player.real_name_hint,
        career_story: player.career_story,
        y1_war: player.y1_war,
        y2_war: player.y2_war,
        y3_war: player.y3_war,
        y4_war: player.y4_war,
        y5_war: player.y5_war,
        is_returnee: player.is_returnee || false,

        // 選秀狀態
        isDrafted: false,
        draftedBy: null, // 被哪隊指名
        draftRound: null // 第幾輪
      };
    });

    return draftClass;
  },

  // 標記某位選手已被指名
  markDrafted: function(playerId) {
    this.draftedPlayerIds.add(playerId);
  }
};
