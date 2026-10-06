// 台灣職棒・球探模擬器 - 核心資料庫模組 (Database Entry Point)

window.DB = {
  // 六大球團定義 (使用在地球迷熟知之趣味代稱與象徵)
  TEAMS: [
    {
      id: "hawks",
      name: "南方雄鷹",
      shortName: "雄鷹",
      color: "#0c5a3d",
      accent: "#e5a823",
      icon: "🦅",
      personalityDesc: "偏好「南部/高屏子弟」、「實用即戰力」",
      baseWins: 55,
      currentWins: 55,
      draftPreference: {
        southernBonus: 30,
        immediateBonus: 25,
        catcherNeed: 20,
        riskTolerance: 10
      }
    },
    {
      id: "guardians",
      name: "北方王者",
      shortName: "北方",
      color: "#004889",
      accent: "#76a6cf",
      icon: "🛡️",
      personalityDesc: "偏好「成熟即戰力」、「高年級大專/海歸履歷」",
      baseWins: 57,
      currentWins: 57,
      draftPreference: {
        immediateBonus: 40,
        reputationBonus: 25,
        returneeBonus: 35,
        riskTolerance: 15
      }
    },
    {
      id: "dragons",
      name: "天空龍",
      shortName: "天龍",
      color: "#c8102e",
      accent: "#ffd100",
      icon: "🐉",
      personalityDesc: "偏好「投手」（直球轉速、特殊球路、怪腕）",
      baseWins: 59,
      currentWins: 59,
      draftPreference: {
        pitcherBonus: 45,
        spinVeloBonus: 35,
        projectBonus: 25,
        riskTolerance: 30
      }
    },
    {
      id: "lions",
      name: "南霸天猛獅",
      shortName: "猛獅",
      color: "#e65a00",
      accent: "#70bf41",
      icon: "🦁",
      personalityDesc: "偏好「帥氣外型/領袖氣質」、「高球商內野手」",
      baseWins: 61,
      currentWins: 61,
      draftPreference: {
        charismaBonus: 35,
        infielderBonus: 30,
        contactBonus: 25,
        riskTolerance: 15
      }
    },
    {
      id: "monkeys",
      name: "暴力狂猿",
      shortName: "狂猿",
      color: "#8c001a",
      accent: "#c49a45",
      icon: "🐒",
      personalityDesc: "偏好「怪力砲手」、「擊球初速破表者」",
      baseWins: 63,
      currentWins: 63,
      draftPreference: {
        powerBonus: 50,
        exitVeloBonus: 40,
        sluggerBonus: 30,
        riskTolerance: 20
      }
    },
    {
      id: "brothers",
      name: "黃衫大象",
      shortName: "黃衫",
      color: "#fdb813",
      accent: "#002b49",
      icon: "🐘",
      personalityDesc: "偏好「高天花板 (Ceiling)」、「高挑骨架璞玉」",
      baseWins: 65,
      currentWins: 65,
      draftPreference: {
        ceilingBonus: 45,
        frameBonus: 30,
        defenseBonus: 25,
        riskTolerance: 25
      }
    }
  ],

  // 每次新開局時隨機打亂初始戰績 (總和固定 360 勝，各隊強弱均勻洗牌，每名次間恰差 2 勝)
  shuffleInitialStandings: function() {
    // 6 個真實且差距細微的基準勝場 (各隊相鄰差 2 勝，總勝場剛好 360 勝)
    const baseWinPool = [55, 57, 59, 61, 63, 65];
    
    // Fisher-Yates 洗牌
    for (let i = baseWinPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [baseWinPool[i], baseWinPool[j]] = [baseWinPool[j], baseWinPool[i]];
    }

    this.TEAMS.forEach((team, idx) => {
      team.baseWins = baseWinPool[idx];
      team.currentWins = baseWinPool[idx];
    });

    return this.TEAMS;
  },

  // 取得完整大母庫
  getMasterPool: function() {
    return {
      superstars: window.SUPERSTARS_DATA || [],
      regulars: window.REGULARS_DATA || [],
      busts: window.BUSTS_DATA || [],
      ordinary: window.ORDINARY_DATA || []
    };
  },

  // 取得母庫總人數驗證
  getTotalCount: function() {
    const pool = this.getMasterPool();
    return {
      superstars: pool.superstars.length,
      regulars: pool.regulars.length,
      busts: pool.busts.length,
      ordinary: pool.ordinary.length,
      total: pool.superstars.length + pool.regulars.length + pool.busts.length + pool.ordinary.length
    };
  }
};
