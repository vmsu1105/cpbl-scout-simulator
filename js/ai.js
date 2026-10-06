// 台灣職棒・球探模擬器 - 電腦球團個性化選秀 AI 決策模組 (AI Engine)

window.DraftAI = {
  // 為某支球團評估目前選秀板上所有可用新秀，挑出最符合該隊風格的第一人選
  pickBestProspect: function(team, availableProspects, round = 1) {
    if (!availableProspects || availableProspects.length === 0) return null;

    let bestProspect = null;
    let highestScore = -Infinity;

    availableProspects.forEach(prospect => {
      const score = this.calculateProspectScore(team, prospect, round);
      if (score > highestScore) {
        highestScore = score;
        bestProspect = prospect;
      }
    });

    return bestProspect;
  },

  // 核心打分演算法：結合公開情資、關鍵字比對、球隊偏好與隨機性
  calculateProspectScore: function(team, prospect, round) {
    let score = 50; // 基準分

    const title = prospect.title || "";
    const stats = prospect.stats || "";
    const pros = prospect.scout_pros || "";
    const cons = prospect.scout_cons || "";
    const school = prospect.school || "";
    const fullText = `${title} ${stats} ${pros} ${cons} ${school}`;

    // ==========================================
    // 1. 各隊專屬特色加權 (Team Personalities)
    // ==========================================
    
    switch (team.id) {
      case "guardians": // 🛡️ 富邦悍將：愛即戰力、愛名氣火球
        if (fullText.includes("即戰力") || fullText.includes("成熟") || fullText.includes("大專") || fullText.includes("完成度高")) {
          score += 35;
        }
        if (stats.includes("15") || fullText.includes("最速") || fullText.includes("火球") || fullText.includes("150km/h") || fullText.includes("151") || fullText.includes("152") || fullText.includes("153")) {
          score += 30; // 容易被 150+ 火球吸引（即使有地雷發炎隱憂！）
        }
        if (fullText.includes("海歸") || fullText.includes("成棒") || fullText.includes("MVP")) {
          score += 25;
        }
        break;

      case "lions": // 🦁 統一獅：愛帥哥、愛高球商內野
        if (fullText.includes("俊俏") || fullText.includes("帥氣") || fullText.includes("領袖氣質") || fullText.includes("瀟灑")) {
          score += 40; // 帥哥無條件加權！
        }
        if (prospect.pos === "野手" && (fullText.includes("內野") || fullText.includes("三壘") || fullText.includes("游擊") || fullText.includes("二壘"))) {
          score += 25;
        }
        if (fullText.includes("球商") || fullText.includes("手眼協調") || fullText.includes("柔軟") || fullText.includes("手腕")) {
          score += 25;
        }
        break;

      case "dragons": // 🐉 味全龍：葉總愛投手、愛轉速、怪腕
        if (prospect.pos === "投手") {
          score += 35;
        }
        if (fullText.includes("轉速") || fullText.includes("2400") || fullText.includes("2500") || fullText.includes("尾勁")) {
          score += 30;
        }
        if (fullText.includes("怪投") || fullText.includes("下勾") || fullText.includes("側投") || fullText.includes("變速球") || fullText.includes("藏球")) {
          score += 30; // 葉總對怪投抵抗力為零
        }
        if (cons.includes("手術") || cons.includes("微創") || cons.includes("機制")) {
          score += 15; // 葉總相信自己能修好機制
        }
        break;

      case "brothers": // 🐘 中信兄弟：農場天賦控、高天花板、防守基石
        if (fullText.includes("天花板") || fullText.includes("骨架") || fullText.includes("長身") || fullText.includes("天賦")) {
          score += 35;
        }
        if (fullText.includes("零失誤") || fullText.includes("基本功") || fullText.includes("教科書") || fullText.includes("守備率 1.000")) {
          score += 30;
        }
        if (prospect.height >= 183) {
          score += 15; // 偏好大骨架
        }
        break;

      case "monkeys": // 🐒 樂天桃猿：暴力猿打線、愛大砲、擊球初速
        if (fullText.includes("全壘打") || fullText.includes("怪力") || fullText.includes("重砲") || fullText.includes("長打率")) {
          score += 40;
        }
        if (fullText.includes("初速") || fullText.includes("160km/h") || fullText.includes("165") || fullText.includes("大牆") || fullText.includes("計分板")) {
          score += 35; // 聽到破表初速就想要
        }
        if (prospect.weight >= 85) {
          score += 15;
        }
        break;

      case "hawks": // 🦅 台鋼雄鷹：南部子弟優先、即戰力捕手/投手
        if (school.includes("南部") || school.includes("高屏") || fullText.includes("高屏") || fullText.includes("屏東") || fullText.includes("台南") || fullText.includes("高雄")) {
          score += 35; // 南部球員優先
        }
        if (prospect.pos === "捕手" || fullText.includes("捕手") || fullText.includes("阻殺")) {
          score += 30; // 新球團極度渴望捕手基石
        }
        if (fullText.includes("即戰力") || fullText.includes("成熟") || fullText.includes("隊長")) {
          score += 20;
        }
        break;
    }

    // ==========================================
    // 2. 盃賽亮眼數據誘因 (Stat Hype)
    // ==========================================
    if (stats.includes("MVP") || stats.includes("打破大會紀錄") || stats.includes("全壘打王") || stats.includes("最佳十人")) {
      score += 20;
    }

    // ==========================================
    // 3. 輪次考量 (Round Strategy)
    // ==========================================
    if (round === 1) {
      // 第一輪各隊更敢賭名氣與大天賦
      if (stats.includes("15") || fullText.includes("大物") || fullText.includes("怪力")) {
        score += 15;
      }
    } else {
      // 第二輪各隊傾向補齊功能性或實用組
      if (fullText.includes("中繼") || fullText.includes("工具人") || fullText.includes("短打") || fullText.includes("跑速")) {
        score += 15;
      }
    }

    // ==========================================
    // 4. 真實隨機擾動 (Human/Scout Variance: ±10 分)
    // 模擬不同球探當天看球的眼緣與主觀偏好
    // ==========================================
    const randomNoise = (Math.random() * 20) - 10;
    score += randomNoise;

    return score;
  }
};
