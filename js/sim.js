// 台灣職棒・球探模擬器 - 三年賽季戰績模擬引擎 (Simulation Engine)

window.SeasonSim = {
  TOTAL_GAMES: 120,
  TOTAL_LEAGUE_GAMES: 360, // 6 隊各自打 120 場，聯盟總場次 = 360 場，總勝場必須等於 360

  // 模擬單一賽季 120 場例行賽 (嚴格零和閉環系統)
  simulateSeason: function(teams, draftedRosterByTeam, seasonYear = 1) {
    // 1. 各年度初始基底權重衰減表 (保留初始梯隊體質效應，反映各隊原生老將陣容與球團底蘊：首年 100% 各差 2 場，隨選秀逐步深化但長年保留球團體質加成)
    const baseDecayFactors = { 1: 1.0, 2: 0.80, 3: 0.60, 4: 0.45, 5: 0.35 };
    const decay = baseDecayFactors[seasonYear] !== undefined ? baseDecayFactors[seasonYear] : 0.35;

    // 2. 計算各隊歷年新秀實質 WAR 貢獻 (空間擠壓機制：前 4 高 100%，第 5 名以後 50%)
    const teamWarData = teams.map(team => {
      const draftedPlayers = draftedRosterByTeam[team.id] || [];
      const playerWars = [];

      draftedPlayers.forEach(draftRecord => {
        const player = draftRecord.player;
        const draftedInYear = draftRecord.year;
        const yearsInPro = (seasonYear - draftedInYear) + 1;

        let singleSeasonWar = 0;
        if (player.tier === "legend" || player.tier === "superstar") {
          const war = player[`y${Math.min(5, yearsInPro)}_war`];
          singleSeasonWar = (war !== undefined ? war : (player.is_returnee ? 5 : 4));
        } else if (player.tier === "regular") {
          const war = player[`y${Math.min(5, yearsInPro)}_war`];
          singleSeasonWar = (war !== undefined ? war : (player.is_returnee ? 3 : 3));
        } else if (player.tier === "ordinary") {
          const war = player[`y${Math.min(5, yearsInPro)}_war`];
          singleSeasonWar = (war !== undefined ? war : 1);
        } else if (player.tier === "bust") {
          singleSeasonWar = 0;
        }

        playerWars.push(singleSeasonWar);
      });

      // 依單季 WAR 由大到小排序 (前四高 vs 空間擠壓席次)
      playerWars.sort((a, b) => b - a);

      let rookieWarContribution = 0;
      playerWars.forEach((war, index) => {
        if (index < 4) {
          // 前四高：全額計入 (100%)
          rookieWarContribution += war;
        } else {
          // 第五位及以後：空間擠壓，減半計入 (50%)
          rookieWarContribution += (war * 0.5);
        }
      });

      // 取至一位小數 (如 +23.5 勝)
      rookieWarContribution = Math.round(rookieWarContribution * 10) / 10;

      return {
        team: team,
        rookieWar: rookieWarContribution
      };
    });

    // 3. 聯盟平均新秀 WAR 基準 (閉環零和基準線)
    const avgRookieWar = teamWarData.reduce((sum, t) => sum + t.rookieWar, 0) / teamWarData.length;

    // 4. 計算各隊浮點預期勝場 (中位基準 60 勝 + 新秀淨貢獻 + 衰減初始基底差 + 零和賽季運氣值)
    // 零和賽季運氣：全聯盟 6 隊運氣總和嚴格為 0.0 場（有人走運必然代表有人倒楣，絕不出現全員同時負運氣）
    const luckValues = this.generateZeroSumLuck(teamWarData.length, 3.0);

    const rawData = teamWarData.map((t, idx) => {
      const netRookie = t.rookieWar - avgRookieWar;
      const baseDiff = ((t.team.baseWins || 60) - 60) * decay;
      const luck = luckValues[idx];
      const expectedWins = 60 + netRookie + baseDiff + luck;
      const intWins = Math.max(35, Math.min(85, Math.round(expectedWins)));

      return {
        team: t.team,
        rookieWar: t.rookieWar,
        netRookie: netRookie,
        luck: luck,
        expectedWins: expectedWins,
        wins: intWins
      };
    });

    // 5. 最大餘數法 (Hare-Niemeyer Method) 配平全聯盟總勝場至嚴格 360 勝 (含防越界取模安全配平)
    let totalWins = rawData.reduce((sum, t) => sum + t.wins, 0);
    let diff = this.TOTAL_LEAGUE_GAMES - totalWins;

    if (diff > 0) {
      // 依四捨五入吃虧程度 (expectedWins - wins) 由大到小補勝場
      const sorted = [...rawData].sort((a, b) => (b.expectedWins - b.wins) - (a.expectedWins - a.wins));
      for (let i = 0; i < diff; i++) {
        sorted[i % sorted.length].wins++;
      }
    } else if (diff < 0) {
      // 依四捨五入多賺程度 (wins - expectedWins) 由大到小扣勝場
      const sorted = [...rawData].sort((a, b) => (b.wins - b.expectedWins) - (a.wins - a.expectedWins));
      for (let i = 0; i < Math.abs(diff); i++) {
        sorted[i % sorted.length].wins--;
      }
    }

    // 6. 建構戰績排行榜物件
    const standings = rawData.map(t => {
      const wins = t.wins;
      const losses = this.TOTAL_GAMES - wins;
      const winRate = Number((wins / this.TOTAL_GAMES).toFixed(3));

      return {
        teamId: t.team.id,
        teamName: t.team.name,
        shortName: t.team.shortName,
        icon: t.team.icon,
        color: t.team.color,
        accent: t.team.accent,
        wins: wins,
        losses: losses,
        winRate: winRate,
        rookieWar: t.rookieWar,
        luck: Number(t.luck.toFixed(1)),
        strength: t.expectedWins,
        gamesBack: 0
      };
    });

    // 依勝率排序 (同勝率時以團隊實力評分做 Tie-breaker)
    standings.sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.strength - a.strength;
    });

    // 計算勝差 (Games Back)
    const leaderWins = standings[0].wins;
    const leaderLosses = standings[0].losses;

    standings.forEach((teamStanding, index) => {
      teamStanding.rank = index + 1;
      if (index === 0) {
        teamStanding.gamesBack = "-";
      } else {
        const gb = ((leaderWins - teamStanding.wins) + (teamStanding.losses - leaderLosses)) / 2;
        teamStanding.gamesBack = gb.toFixed(1);
      }
    });

    // 4. 模擬季後賽與台灣大賽 (產生詳細比分與對戰紀錄)
    const playoffResult = this.simulatePlayoffs(standings);

    // 5. 決定下一賽季選秀順位：
    // - 墊底（第 6 名）獲得狀元籤 (Pick 1)
    // - 年度總冠軍固定落入最後一個順位 (Pick 6)
    // - 其餘非冠軍隊伍依例行賽戰績倒序排列
    const nextYearDraftOrder = this.calculateNextDraftOrder(standings, playoffResult.champion);

    return {
      seasonYear: seasonYear,
      standings: standings,
      champion: playoffResult.champion,
      playoffs: playoffResult,
      nextYearDraftOrder: nextYearDraftOrder
    };
  },

  // 模擬季後賽（季後挑戰賽 + 台灣大賽）
  simulatePlayoffs: function(standings) {
    const rank1 = standings[0];
    const rank2 = standings[1];
    const rank3 = standings[2];

    // ==========================================
    // 第一階段：季後挑戰賽 (5戰3勝制，第2名保底先享1勝)
    // ==========================================
    // 第 2 名領先 1 勝，僅需再勝 2 場；第 3 名需連取 3 場
    let r2Wins = 1;
    let r3Wins = 0;
    
    // 計算單場勝率 (依例行賽勝率差異加權)
    const probR2 = Math.min(0.70, Math.max(0.45, 0.55 + (rank2.winRate - rank3.winRate) * 0.5));
    
    while (r2Wins < 3 && r3Wins < 3) {
      if (Math.random() < probR2) {
        r2Wins++;
      } else {
        r3Wins++;
      }
    }

    const challengerWinner = (r2Wins >= 3) ? rank2 : rank3;
    const challengerLoser = (r2Wins >= 3) ? rank3 : rank2;
    const challengerSeriesScore = `${challengerWinner.teamName} ${Math.max(r2Wins, r3Wins)} - ${Math.min(r2Wins, r3Wins)} ${challengerLoser.teamName}`;

    // ==========================================
    // 第二階段：台灣大賽 (7戰4勝制)
    // ==========================================
    // 例行賽第 1 名擁有戰力與主場優勢
    let r1Wins = 0;
    let chalWins = 0;

    // 計算第 1 名對上挑戰賽勝者的單場勝率
    const probR1 = Math.min(0.75, Math.max(0.50, 0.58 + (rank1.winRate - challengerWinner.winRate) * 0.6));

    while (r1Wins < 4 && chalWins < 4) {
      if (Math.random() < probR1) {
        r1Wins++;
      } else {
        chalWins++;
      }
    }

    const isUpset = (chalWins >= 4);
    const champion = isUpset ? challengerWinner : rank1;
    const runnerUp = isUpset ? rank1 : challengerWinner;
    const tsWinnerScore = Math.max(r1Wins, chalWins);
    const tsLoserScore = Math.min(r1Wins, chalWins);
    const taiwanSeriesScore = `${champion.teamName} ${tsWinnerScore} - ${tsLoserScore} ${runnerUp.teamName}`;

    return {
      champion: {
        teamId: champion.teamId,
        teamName: champion.teamName,
        shortName: champion.shortName,
        icon: champion.icon,
        color: champion.color,
        isUpset: isUpset
      },
      runnerUp: {
        teamId: runnerUp.teamId,
        teamName: runnerUp.teamName,
        icon: runnerUp.icon
      },
      rank1Team: rank1,
      challengerWinner: challengerWinner,
      challengerScore: challengerSeriesScore,
      taiwanSeriesScore: taiwanSeriesScore,
      isUpset: isUpset
    };
  },

  // 依當季戰績與總冠軍決定「下一賽季選秀順位」
  // 規則：墊底獲得狀元籤，總冠軍落入第 6 順位，其餘 4 隊依例行賽戰績倒序排列
  calculateNextDraftOrder: function(standings, champion) {
    // 1. 先將 6 支球隊依例行賽戰績倒序 (第 6 名排前面)
    const nonChampions = standings
      .filter(st => st.teamId !== champion.teamId)
      .sort((a, b) => b.rank - a.rank);

    // 2. 找到總冠軍隊伍的物件
    const champTeam = standings.find(st => st.teamId === champion.teamId);

    // 3. 合併名單：非冠軍隊伍排前 1~5 位，總冠軍隊固定排在第 6 位
    const ordered = [...nonChampions, champTeam];

    return ordered.map((st, idx) => ({
      pickNumber: idx + 1,
      teamId: st.teamId,
      teamName: st.teamName,
      icon: st.icon,
      color: st.color,
      isFirstPick: idx === 0, // 狀元籤
      isChampLastPick: idx === 5 // 總冠軍最後籤
    }));
  },

  // 零和賽季運氣產生器 (閉環聯賽中，一支球隊的好運必然來自對手的壞運，全聯盟 6 隊運氣總和必嚴格為 0.0 場)
  generateZeroSumLuck: function(count = 6, maxAbs = 3.0) {
    let raw = [];
    for (let i = 0; i < count; i++) {
      raw.push((Math.random() * 5.0) - 2.5);
    }
    const avg = raw.reduce((a, b) => a + b, 0) / count;
    let centered = raw.map(v => v - avg);

    // 若有單一極端值超出 maxAbs，等比例縮放以保有完整相對關係
    const maxVal = Math.max(...centered.map(v => Math.abs(v)));
    if (maxVal > maxAbs) {
      centered = centered.map(v => (v / maxVal) * maxAbs);
    }

    // 放大 10 倍使用整數運算，杜絕 JavaScript 浮點數微小精度誤差
    let ints = centered.map(v => Math.round(v * 10));
    let sumInt = ints.reduce((a, b) => a + b, 0);

    // 消除四捨五入整數殘差，嚴格確保總和為 0
    while (sumInt !== 0) {
      if (sumInt > 0) {
        let maxIdx = ints.indexOf(Math.max(...ints));
        ints[maxIdx]--;
        sumInt--;
      } else {
        let minIdx = ints.indexOf(Math.min(...ints));
        ints[minIdx]++;
        sumInt++;
      }
    }

    return ints.map(v => Number((v / 10).toFixed(1)));
  }
};

