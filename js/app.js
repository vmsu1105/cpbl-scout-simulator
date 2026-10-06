// 台灣職棒・球探模擬器 - 主程式控制器 (App Controller)

window.App = {
  // 遊戲全域狀態
  state: {
    currentYear: 1,
    maxYears: 5,
    playerTeamId: null,
    teams: [],
    draftOrder: [], // 當年度 6 隊順位
    currentRound: 1, // 1 或 2
    currentPickIndex: 0, // 0 ~ 5 (對應 draftOrder 索引)
    draftClass: [], // 當屆動態抽樣之 18 位選手
    draftedRosterByTeam: {}, // 各隊歷年選秀名單 { [teamId]: [{ player, year, round }] }
    selectedProspect: null, // 目前彈窗檢視的新秀
    isAiPicking: false,
    lastSimResult: null
  },

  // 初始化
  init: function() {
    // 每次新局隨機打亂六隊初始戰績 (使每隊都有機會抽到狀元籤或衛冕，黃衫大象不再固定第一)
    const shuffledTeams = window.DB.shuffleInitialStandings();
    this.state.teams = JSON.parse(JSON.stringify(shuffledTeams));
    this.state.teams.forEach(t => {
      this.state.draftedRosterByTeam[t.id] = [];
    });
    this.state.seasonHistory = []; // 清空五年歷史檔案

    this.bindEvents();
    this.renderTeamSelectScreen();
    this.updateMarquee("選秀大會即將開始，請選擇您想接掌的職棒球團！");
  },

  // 綁定按鈕與互動事件 (確保全域終生僅綁定一次，防止重複開局導致事件堆疊)
  bindEvents: function() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    // 重新開局
    document.getElementById("btn-restart").addEventListener("click", () => {
      if (confirm("確定要放棄目前進度，重新開始新局嗎？")) {
        window.Generator.reset();
        this.state.currentYear = 1;
        this.init();
      }
    });

    // 關閉球探檔案彈窗
    document.getElementById("btn-close-modal").addEventListener("click", () => {
      this.closeModal();
    });

    // 彈窗背景點擊關閉
    document.getElementById("modal-dossier").addEventListener("click", (e) => {
      if (e.target.id === "modal-dossier") this.closeModal();
    });

    // 彈窗內指名按鈕
    document.getElementById("btn-modal-draft").addEventListener("click", () => {
      if (this.state.selectedProspect) {
        this.draftProspect(this.state.selectedProspect, this.getPlayerTeam());
        this.closeModal();
      }
    });

    // 進入下一年度按鈕 (五年屆滿時開啟名人堂總考評彈窗，加入防連點防抖鎖)
    const nextBtn = document.getElementById("btn-next-season");
    nextBtn.addEventListener("click", () => {
      if (nextBtn.disabled) return;
      nextBtn.disabled = true; // 點擊瞬間鎖定，防止連點跳過選秀
      setTimeout(() => { nextBtn.disabled = false; }, 800);

      if (this.state.currentYear < this.state.maxYears) {
        this.startNextSeason();
      } else {
        this.showFinaleModal();
      }
    });
  },

  // 輔助取得玩家球隊物件
  getPlayerTeam: function() {
    return this.state.teams.find(t => t.id === this.state.playerTeamId);
  },

  // 畫面 1：渲染球團選擇大廳
  renderTeamSelectScreen: function() {
    this.showView("view-team-select");
    const container = document.getElementById("team-cards-grid");
    container.innerHTML = "";

    // 依照初始基準戰力倒序排列選秀順位 (墊底獲狀元籤 -> 戰績最佳者最後順位)
    const initialDraftOrder = [...this.state.teams].sort((a, b) => a.baseWins - b.baseWins);

    initialDraftOrder.forEach((team, idx) => {
      const card = document.createElement("div");
      card.className = "bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 cursor-pointer transition transform hover:-translate-y-1 shadow-xl flex flex-col justify-between";
      card.style.borderLeft = `6px solid ${team.color}`;

      card.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-3xl">${team.icon}</span>
            <span class="text-xs bg-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded-full font-num">
              第 ${idx + 1} 順位${idx === 0 ? "・狀元籤 👑" : ""}
            </span>
          </div>
          <div>
            <h3 class="text-xl font-black text-white">${team.name}</h3>
            <p class="text-xs text-slate-400 mt-0.5">上季戰績：${team.baseWins} 勝 ${120 - team.baseWins} 敗</p>
          </div>
          <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs flex items-center justify-between">
            <span class="text-slate-500 font-medium">球探情蒐會議：</span>
            <span class="text-amber-400/90 font-mono text-[11px] font-bold">最高機密 🔒</span>
          </div>
        </div>

        <button class="mt-5 w-full bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition duration-200 flex items-center justify-center space-x-1.5">
          <span>擔任首席球探</span>
          <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>
      `;

      card.addEventListener("click", () => {
        this.selectTeam(team.id, initialDraftOrder);
      });

      container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  },

  // 選擇球團並開啟第 1 年選秀大會
  selectTeam: function(teamId, draftOrder) {
    this.state.playerTeamId = teamId;
    this.state.draftOrder = draftOrder;
    this.startDraftYear(this.state.currentYear);
  },

  // 開始特定年份選秀
  startDraftYear: function(year) {
    this.state.currentYear = year;
    this.state.currentRound = 1;
    this.state.currentPickIndex = 0;
    this.state.isAiPicking = false;

    document.getElementById("current-year-badge").innerText = `第 ${year} 年選秀大會`;
    this.showView("view-draft-arena");

    // 1. 動態由 400 人大母庫抽樣 18 位選手並洗牌
    this.state.draftClass = window.Generator.generateDraftClass(year);

    // 2. 渲染 UI
    this.renderDraftOrderBoard();
    this.renderProspectsGrid();
    this.updateMarquee(`第 ${year} 年選秀大會正式開始！全體 18 位高中新秀準備就緒！`);

    // 3. 推進到第一個順位
    this.advanceDraftStep();
  },

  // 渲染頂部六隊選秀順位看板
  renderDraftOrderBoard: function() {
    const container = document.getElementById("draft-order-board");
    container.innerHTML = "";

    document.getElementById("draft-round-text").innerText = `【第 ${this.state.currentRound === 1 ? "一" : "二"} 輪】`;

    this.state.draftOrder.forEach((team, idx) => {
      const isCurrentPick = (idx === this.state.currentPickIndex);
      const isPlayer = (team.id === this.state.playerTeamId);

      const item = document.createElement("div");
      item.className = `p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-between ${
        isCurrentPick 
          ? "border-amber-400 bg-amber-500/10 shadow-lg ring-2 ring-amber-400/40 transform scale-105" 
          : "border-slate-800 bg-slate-950/60 opacity-80"
      }`;

      item.innerHTML = `
        <span class="text-xs text-slate-500 font-num font-bold">#${idx + 1}</span>
        <span class="text-xl my-1">${team.icon}</span>
        <span class="text-xs font-bold text-slate-200 truncate w-full">${team.shortName}</span>
        ${isPlayer ? '<span class="text-[10px] bg-amber-500 text-slate-950 font-bold px-1 rounded mt-1">你</span>' : ''}
      `;

      container.appendChild(item);
    });

    const currentTeam = this.state.draftOrder[this.state.currentPickIndex];
    document.getElementById("current-pick-info").innerText = `第 ${this.state.currentPickIndex + 1} 順位・${currentTeam.name}`;
  },

  // 渲染當屆 18 張隨機洗牌新秀卡片
  renderProspectsGrid: function() {
    const container = document.getElementById("prospects-grid");
    container.innerHTML = "";

    let remainingCount = 0;

    this.state.draftClass.forEach(prospect => {
      if (!prospect.isDrafted) remainingCount++;

      const card = document.createElement("div");
      card.className = `prospect-card rounded-xl p-4 cursor-pointer flex flex-col justify-between ${
        prospect.isDrafted ? "drafted" : ""
      }`;

      card.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-num font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
              ${prospect.displayCode}
            </span>
            <div class="flex items-center space-x-1.5 text-xs text-slate-400">
              <span>${prospect.pos}</span>
              <span>•</span>
              <span>${prospect.bats}</span>
            </div>
          </div>

          <h4 class="text-sm font-bold text-white leading-tight">
            ${prospect.title}
          </h4>

          <div class="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300 line-clamp-2">
            ${prospect.stats}
          </div>

          <div class="text-[11px] text-slate-400 space-y-1">
            <div class="flex items-start space-x-1 text-emerald-400/90">
              <span class="font-bold shrink-0">優點:</span>
              <span class="line-clamp-1 text-slate-300">${prospect.scout_pros}</span>
            </div>
            <div class="flex items-start space-x-1 text-rose-400/90">
              <span class="font-bold shrink-0">隱憂:</span>
              <span class="line-clamp-1 text-slate-400">${prospect.scout_cons}</span>
            </div>
          </div>
        </div>

        ${prospect.isDrafted ? `
          <div class="mt-3 pt-2 border-t border-slate-800 text-center text-xs text-amber-400 font-bold">
            已被 ${prospect.draftedBy.name} 指名！
          </div>
        ` : `
          <div class="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>身高: ${prospect.height}cm</span>
            <span class="text-amber-400/80 flex items-center space-x-0.5">
              <span>查看檔案</span>
              <i data-lucide="chevron-right" class="w-3 h-3"></i>
            </span>
          </div>
        `}
      `;

      card.addEventListener("click", () => {
        if (!prospect.isDrafted) {
          this.openModal(prospect);
        }
      });

      container.appendChild(card);
    });

    document.getElementById("remaining-count").innerText = remainingCount;
    if (window.lucide) lucide.createIcons();
  },

  // 推進選秀輪次邏輯 (Core Draft Step Loop)
  advanceDraftStep: function() {
    // 檢查兩輪選秀是否全部結束 (6隊 × 2輪 = 12人次)
    if (this.state.currentRound > 2) {
      this.finishDraftAndSimulate();
      return;
    }

    const currentTeam = this.state.draftOrder[this.state.currentPickIndex];
    const isPlayerTurn = (currentTeam.id === this.state.playerTeamId);

    this.renderDraftOrderBoard();

    const playerBanner = document.getElementById("player-turn-banner");
    const aiBanner = document.getElementById("ai-turn-banner");

    if (isPlayerTurn) {
      // 輪到玩家回合
      this.state.isAiPicking = false;
      aiBanner.classList.add("hidden");
      playerBanner.classList.remove("hidden");
      document.getElementById("player-pick-banner-team").innerText = currentTeam.name;
      this.updateMarquee(`🔔 輪到 ${currentTeam.name} 挑選！請在下方點選新秀卡片進行指名！`);
    } else {
      // 輪到電腦 AI 回合
      this.state.isAiPicking = true;
      playerBanner.classList.add("hidden");
      aiBanner.classList.remove("hidden");
      document.getElementById("ai-turn-text").innerText = `${currentTeam.name} 球探團隊正在評估選秀情資...`;
      this.updateMarquee(`⏳ 第 ${this.state.currentPickIndex + 1} 順位：${currentTeam.name} 思考中...`);

      // 模擬電腦思考時間 (約 900 毫秒)
      setTimeout(() => {
        const available = this.state.draftClass.filter(p => !p.isDrafted);
        const bestPick = window.DraftAI.pickBestProspect(currentTeam, available, this.state.currentRound);
        if (bestPick) {
          this.draftProspect(bestPick, currentTeam);
        }
      }, 900);
    }
  },

  // 執行選手指名
  draftProspect: function(prospect, team) {
    prospect.isDrafted = true;
    prospect.draftedBy = team;
    prospect.draftRound = this.state.currentRound;

    // 加入該隊歷年名冊
    this.state.draftedRosterByTeam[team.id].push({
      player: prospect,
      year: this.state.currentYear,
      round: this.state.currentRound
    });

    // 標記至全局母庫抽樣防重複器
    window.Generator.markDrafted(prospect.id);

    // 轉播跑馬燈公告
    this.updateMarquee(`🎉 【選秀快報】第 ${this.state.currentPickIndex + 1} 順位：${team.name} 正式指名【${prospect.displayCode}】${prospect.title}！`);

    // 重新渲染新秀板
    this.renderProspectsGrid();

    // 移動到下一個順位
    this.state.currentPickIndex++;
    if (this.state.currentPickIndex >= this.state.draftOrder.length) {
      // 本輪結束，進入下一輪
      this.state.currentPickIndex = 0;
      this.state.currentRound++;
    }

    // 稍微延遲後推進下一步
    setTimeout(() => {
      this.advanceDraftStep();
    }, 400);
  },

  // 開啟球探檔案彈窗
  openModal: function(prospect) {
    this.state.selectedProspect = prospect;

    document.getElementById("modal-display-code").innerText = prospect.displayCode;
    document.getElementById("modal-school-badge").innerText = prospect.school;
    document.getElementById("modal-pos-badge").innerText = prospect.pos;
    document.getElementById("modal-title").innerText = prospect.title;

    document.getElementById("modal-size").innerText = `${prospect.height}cm / ${prospect.weight}kg`;
    document.getElementById("modal-bats").innerText = prospect.bats;
    document.getElementById("modal-pos").innerText = prospect.pos;

    document.getElementById("modal-stats").innerText = prospect.stats;
    document.getElementById("modal-pros").innerText = prospect.scout_pros;
    document.getElementById("modal-cons").innerText = prospect.scout_cons;

    // 指名按鈕控制：只有當輪到玩家時才可指名
    const currentTeam = this.state.draftOrder[this.state.currentPickIndex];
    const isPlayerTurn = (currentTeam && currentTeam.id === this.state.playerTeamId && !this.state.isAiPicking);
    const draftBtn = document.getElementById("btn-modal-draft");

    if (isPlayerTurn) {
      draftBtn.classList.remove("hidden");
      draftBtn.innerText = `指名 ${prospect.displayCode}（${currentTeam.name}）`;
    } else {
      draftBtn.classList.add("hidden");
    }

    document.getElementById("modal-dossier").classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  },

  closeModal: function() {
    document.getElementById("modal-dossier").classList.add("hidden");
    this.state.selectedProspect = null;
  },

  // 選秀結束，執行賽季 120 場戰績模擬並進入開箱盛典
  finishDraftAndSimulate: function() {
    this.updateMarquee(`🏆 選秀大會圓滿落幕！球隊展開春訓，120 場例行賽火熱開打！`);

    // 呼叫模擬引擎跑出 120 場戰績
    const simResult = window.SeasonSim.simulateSeason(
      this.state.teams,
      this.state.draftedRosterByTeam,
      this.state.currentYear
    );
    this.state.lastSimResult = simResult;

    // 儲存該年度的戰績與選秀歷史
    if (!this.state.seasonHistory) this.state.seasonHistory = [];
    this.state.seasonHistory.push({
      year: this.state.currentYear,
      simResult: simResult,
      draftClass: JSON.parse(JSON.stringify(this.state.draftClass))
    });

    // 切換至開箱與戰績視圖
    this.showView("view-reveal-standings");
    this.renderRevealAndStandings(simResult);
  },

  // 畫面 3：渲染季末開箱與戰績榜
  renderRevealAndStandings: function(simResult) {
    const playerTeam = this.getPlayerTeam();
    const currentYearDrafted = (this.state.draftedRosterByTeam[playerTeam.id] || [])
      .filter(record => record.year === this.state.currentYear);

    // 1. 渲染總冠軍封王條與季後賽比分
    const champ = simResult.champion;
    const playoffs = simResult.playoffs;
    const isPlayerChamp = (champ.teamId === playerTeam.id);
    const isPlayerRunnerUp = (playoffs.runnerUp && playoffs.runnerUp.teamId === playerTeam.id);
    const playerStanding = simResult.standings.find(st => st.teamId === playerTeam.id);

    const champBanner = document.getElementById("champion-banner");
    champBanner.style.backgroundColor = champ.color;

    // 敘述文字
    let narrative = `由 ${champ.teamName} 勇奪年度總冠軍桂冠！全隊開香檳慶祝！`;
    if (isPlayerChamp) {
      narrative = `🎉 滿天彩帶拋下！在您的神級選秀與陣容佈局下，${champ.teamName} 成功捧起年度總冠軍金盃！`;
    } else if (isPlayerRunnerUp && playerStanding.rank === 1) {
      narrative = `😢 例行賽霸主【${playerTeam.name}】（${playerStanding.wins}勝）在台灣大賽鏖戰後惜敗給下剋上的【${champ.teamName}】，抱憾奪得年度亞軍！`;
    }

    champBanner.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-center space-x-2">
          <span class="text-xs bg-black/50 text-amber-300 font-bold px-3 py-1 rounded-full uppercase tracking-wider font-num">
            第 ${this.state.currentYear} 季 中華職棒年度總冠軍
          </span>
          ${playoffs.isUpset ? '<span class="text-xs bg-rose-600/90 text-white font-black px-2.5 py-0.5 rounded-full">🔥 下剋上爆冷奪冠</span>' : ''}
        </div>
        
        <h2 class="text-3xl md:text-4xl font-black text-white flex items-center justify-center space-x-3">
          <span>${champ.icon}</span>
          <span>${champ.teamName} 勇奪年度總冠軍！</span>
        </h2>
        
        <p class="text-xs md:text-sm text-slate-100 max-w-xl mx-auto font-medium">
          ${narrative}
        </p>

        <!-- 季後賽對戰比分盒 -->
        <div class="inline-flex flex-wrap items-center justify-center gap-2 bg-black/40 px-4 py-2 rounded-xl text-xs text-slate-200 border border-white/10 font-num">
          <span class="text-amber-300 font-bold">【台灣大賽】</span>
          <span>${playoffs.taiwanSeriesScore}</span>
          <span class="text-slate-500">|</span>
          <span class="text-amber-300 font-bold">【季後挑戰賽】</span>
          <span>${playoffs.challengerScore}</span>
        </div>
      </div>
    `;

    // 2. 渲染玩家選中的 2 張 3D 翻牌開箱卡
    const revealContainer = document.getElementById("reveal-cards-container");
    revealContainer.innerHTML = "";

    currentYearDrafted.forEach((record, idx) => {
      const p = record.player;
      const flipContainer = document.createElement("div");
      flipContainer.className = "card-flip-container cursor-pointer";

      // 依階層套用不同光暈樣式
      let tierClass = "ordinary-tint";
      let tierBadge = "🌾 普通人";
      let tierBadgeBg = "bg-slate-700 text-slate-300";

      if (p.tier === "legend") {
        tierClass = "legend-glow border-amber-400 bg-gradient-to-b from-purple-950/60 via-amber-950/40 to-slate-950 shadow-[0_0_35px_rgba(245,158,11,0.4)] ring-1 ring-amber-400/50";
        tierBadge = "👑 ＳＳ級殿堂超神獸";
        tierBadgeBg = "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black tracking-wide shadow-md";
      } else if (p.tier === "superstar") {
        tierClass = "superstar-glow";
        tierBadge = "🌟 Ｓ級頂級神獸";
        tierBadgeBg = "bg-amber-500 text-slate-950 font-black";
      } else if (p.tier === "regular") {
        tierClass = "border-emerald-500/50 bg-emerald-950/20";
        tierBadge = "⚾ Ａ級中堅骨幹";
        tierBadgeBg = "bg-emerald-500 text-slate-950 font-bold";
      } else if (p.tier === "bust") {
        tierClass = "bust-glow";
        tierBadge = "💣 致命地雷";
        tierBadgeBg = "bg-rose-500 text-white font-bold";
      }

      flipContainer.innerHTML = `
        <div class="card-flip-inner relative w-full h-[480px] rounded-2xl shadow-2xl transition duration-500">
          
          <!-- 正面：高三球探卡 (點擊翻牌) -->
          <div class="card-front absolute inset-0 bg-slate-900 border border-slate-700 rounded-2xl p-5 flex flex-col justify-between">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs bg-slate-800 text-amber-400 font-bold px-2 py-0.5 rounded font-num">
                  【第 ${record.round} 輪指名】${p.displayCode}
                </span>
                <span class="text-xs text-slate-400">${p.pos} • ${p.bats}</span>
              </div>
              <h4 class="text-lg font-black text-white">${p.title}</h4>
              <p class="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                ${p.stats}
              </p>
              <div class="text-xs text-slate-400">
                <span class="text-emerald-400 font-bold">高三球探評語：</span>
                <p class="line-clamp-2 mt-0.5 text-slate-300">${p.scout_pros}</p>
              </div>
            </div>

            <div class="text-center pt-3 border-t border-slate-800">
              <span class="inline-flex items-center space-x-1.5 text-xs text-amber-400 font-bold animate-pulse">
                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                <span>點擊翻牌・揭曉命運</span>
              </span>
            </div>
          </div>

          <!-- 背面：真實綽號與命運開箱 (含三年成長曲線) -->
          <div class="card-back absolute inset-0 bg-slate-900 ${tierClass} rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
            <div class="space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs ${tierBadgeBg} px-2.5 py-0.5 rounded-full font-bold">
                  ${tierBadge}
                </span>
                <span class="text-xs text-slate-400 font-num">第 ${this.state.currentYear} 季成果</span>
              </div>

              <div>
                <span class="text-[11px] text-slate-400 block font-bold">真實稱號揭曉：</span>
                <h3 class="text-2xl font-black text-white mt-0.5">
                  「${p.real_nickname}」
                </h3>
                <span class="text-xs text-amber-400 block mt-0.5 font-bold">原型：${p.real_name_hint || ""}</span>
              </div>

              <div class="bg-slate-950/80 p-2.5 rounded-xl border border-white/10 text-xs text-slate-200 leading-relaxed line-clamp-2">
                ${p.career_story}
              </div>

              <!-- 核心：三年養成爆發曲線階梯圖 -->
              ${this.buildGrowthCurveHtml(p)}
            </div>

            <div class="text-center text-[10px] text-slate-400 border-t border-white/10 pt-1.5">
              已解鎖至球團歷史檔案 • 點擊可翻回正面
            </div>
          </div>

        </div>
      `;

      // 點擊翻牌
      flipContainer.addEventListener("click", () => {
        const inner = flipContainer.querySelector(".card-flip-inner");
        inner.classList.toggle("is-flipped");
      });

      revealContainer.appendChild(flipContainer);
    });

    // 2.2 渲染歷屆新秀成長追蹤看板 (阿坤第2、3年的爆炸性成長)
    this.renderRosterGrowthTracker(playerTeam);

    // 2.5 渲染當屆選秀全貌大揭密（對手開箱＆落選遺珠）
    this.renderMissedProspects(this.state.draftClass, playerTeam);

    // 3. 渲染 120 場戰績榜表格
    document.getElementById("standings-year-tag").innerText = `第 ${this.state.currentYear} 賽季`;
    const tbody = document.getElementById("standings-table-body");
    tbody.innerHTML = "";

    simResult.standings.forEach(st => {
      const isPlayer = (st.teamId === playerTeam.id);
      const tr = document.createElement("tr");
      tr.className = `${isPlayer ? "bg-amber-500/10 font-bold text-white" : "text-slate-300 hover:bg-slate-800/40"} transition`;

      tr.innerHTML = `
        <td class="px-4 py-3 font-num font-bold">
          ${st.rank === 1 ? "🥇 1" : st.rank === 2 ? "🥈 2" : st.rank === 3 ? "🥉 3" : st.rank}
        </td>
        <td class="px-4 py-3 flex items-center space-x-1.5 flex-wrap">
          <span>${st.icon}</span>
          <span>${st.teamName}</span>
          ${isPlayer ? '<span class="text-[10px] bg-amber-500 text-slate-950 px-1 rounded font-bold">你</span>' : ''}
          ${st.rank === 1 ? '<span class="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1 py-0.2 rounded font-bold">晉級台灣大賽</span>' : ''}
          ${(st.rank === 2 || st.rank === 3) ? '<span class="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/40 px-1 py-0.2 rounded">季後挑戰賽</span>' : ''}
        </td>
        <td class="px-4 py-3 font-num">${st.wins}</td>
        <td class="px-4 py-3 font-num">${st.losses}</td>
        <td class="px-4 py-3 font-num text-amber-400">${st.winRate.toFixed(3)}</td>
        <td class="px-4 py-3 font-num">${st.gamesBack}</td>
        <td class="px-4 py-3 font-num text-emerald-400 font-bold">+${st.rookieWar}</td>
        <td class="px-4 py-3 font-num ${st.luck > 0 ? 'text-amber-400' : st.luck < 0 ? 'text-blue-400' : 'text-slate-400'} font-bold">
          ${st.luck > 0 ? '+' : ''}${st.luck.toFixed(1)} 場
        </td>
      `;

      tbody.appendChild(tr);
    });

    // 4. 渲染 PTT 鄉民推噓文
    this.renderPttComments(simResult, currentYearDrafted);

    // 5. 下一賽季按鈕與順位連動文字
    const nextOrder = simResult.nextYearDraftOrder;
    const firstPickTeam = nextOrder[0];
    const playerPickObj = nextOrder.find(t => t.teamId === playerTeam.id);
    const playerRankInNext = playerPickObj ? playerPickObj.pickNumber : 6;

    let orderNote = `下一年度選秀狀元籤：${firstPickTeam.icon} ${firstPickTeam.teamName}（例行賽墊底）！`;
    if (playerPickObj && playerPickObj.isChampLastPick) {
      orderNote += ` 貴隊（${playerTeam.shortName}）榮膺總冠軍，依規章下一屆排在最後第 6 順位！`;
    } else {
      orderNote += ` 貴隊（${playerTeam.shortName}）下一屆將排在第 ${playerRankInNext} 順位挑選！`;
    }
    document.getElementById("next-draft-order-summary").innerText = orderNote;

    const nextBtn = document.getElementById("btn-next-season");
    const nextBtnText = document.getElementById("btn-next-season-text");
    if (nextBtn) nextBtn.disabled = false; // 每次進入開箱頁面，重置啟用狀態

    if (this.state.currentYear < this.state.maxYears) {
      nextBtnText.innerText = `進入第 ${this.state.currentYear + 1} 年選秀大會`;
    } else {
      nextBtnText.innerText = `完成五年任期・結算成績`;
    }

    // 綁定單季戰績截圖按鈕
    const captureSeasonBtn = document.getElementById("btn-capture-season");
    if (captureSeasonBtn) {
      captureSeasonBtn.onclick = () => {
        this.captureAndSaveCard("view-season-result", `CPBL_第${this.state.currentYear}賽季_${playerTeam.name}_戰績榜.png`);
      };
    }

    if (window.lucide) lucide.createIcons();
  },

  // 渲染幽默 PTT 棒球版留言
  renderPttComments: function(simResult, currentYearDrafted) {
    const list = document.getElementById("ptt-comments-list");
    list.innerHTML = "";

    const comments = [];
    const playerTeam = this.getPlayerTeam();

    // 依選中的球員階層生成 PTT 留言
    const hasLegend = currentYearDrafted.some(r => r.player.tier === "legend");
    const hasSuperstar = currentYearDrafted.some(r => r.player.tier === "superstar");
    const hasBust = currentYearDrafted.some(r => r.player.tier === "bust");
    const hasOrdinary = currentYearDrafted.some(r => r.player.tier === "ordinary");

    if (hasLegend) {
      comments.push({ type: "push", user: "baseball_god", text: `爆！全台灣球迷暴動啦！${playerTeam.shortName}居然迎來SS級殿堂神獸！這五年準備建立王朝了！` });
      comments.push({ type: "push", user: "cpbl_analyst", text: `推！這隻SS級是跨世代的歷史核武，根本是大聯盟級別降臨中職！` });
    } else if (hasSuperstar) {
      comments.push({ type: "push", user: "cpbl_fan99", text: `推！${playerTeam.shortName}球探部到底怎麼挖到的？這隻神獸根本是搶劫！` });
      comments.push({ type: "push", user: "homerun_king", text: `二軍打擊教練要跪著感謝球探了，直接選到建隊基石。` });
    }

    if (hasBust) {
      comments.push({ type: "boo", user: "angry_hater", text: `噓！那個火球男春訓就開刀，球探可以滾蛋了沒？簽約金放水流！` });
      comments.push({ type: "boo", user: "ptt_baselover", text: `電風扇揮空率40%也能選？我阿嬤去揮都打得比他好！` });
    }

    if (hasOrdinary) {
      comments.push({ type: "arrow", user: "amateur_scout", text: `→ 普通人新秀每年穩定貢獻 +1 WAR，撐起牛棚與防守板凳深度也是球隊基石啦！` });
      comments.push({ type: "arrow", user: "baseball_nerd", text: `→ 每年選秀能挑到穩定吃局數的公務員綠葉就很補了，陣容深度真的很重要。` });
    }

    // 戰績與季後賽相關留言
    const playerStanding = simResult.standings.find(st => st.teamId === playerTeam.id);
    const champ = simResult.champion;
    const isPlayerChamp = (champ.teamId === playerTeam.id);
    const isPlayerRunnerUp = (simResult.playoffs.runnerUp && simResult.playoffs.runnerUp.teamId === playerTeam.id);

    if (isPlayerChamp) {
      comments.push({ type: "push", user: "champ_forever", text: `【爆卦】總冠軍遊行路線公佈！${playerTeam.shortName}封王全城拋彩帶太爽啦！` });
      comments.push({ type: "push", user: "cpbl_glory", text: `實至名歸！從季賽一路統治到台灣大賽，今年真的無敵！` });
    } else if (isPlayerRunnerUp && playerStanding.rank === 1) {
      comments.push({ type: "boo", user: "angry_fan", text: `【崩潰】例行賽狂拿 ${playerStanding.wins} 勝第一名，結果台灣大賽竟然被 ${champ.teamName} 下剋上？！` });
      comments.push({ type: "arrow", user: "cpbl_observer", text: `→ 短期賽就是看投手壓制與手感，${champ.teamName} 挑戰賽打上來正燙，例行賽休太久冷掉了啦。` });
    } else if (!isPlayerChamp && champ.isUpset) {
      comments.push({ type: "push", user: "miracle_fan", text: `太扯了！${champ.teamName} 季後挑戰賽一路下剋上殺出奪冠，今年劇本有夠燃！` });
    } else if (playerStanding.rank >= 5) {
      comments.push({ type: "boo", user: "rebuild_fan", text: `坦隊一年換狀元籤啦，明年再不選即戰力我就不進場了！` });
    }

    comments.forEach(c => {
      const line = document.createElement("div");
      let prefix = '<span class="ptt-push">推</span>';
      if (c.type === "boo") prefix = '<span class="ptt-boo">噓</span>';
      if (c.type === "arrow") prefix = '<span class="ptt-arrow">→</span>';

      line.innerHTML = `${prefix} <span class="text-zinc-300 font-bold">${c.user}</span>: ${c.text}`;
      list.appendChild(line);
    });
  },

  // 推進至下一年度選秀 (嚴格防護不可越界)
  startNextSeason: function() {
    if (this.state.currentYear >= this.state.maxYears) {
      this.showFinaleModal();
      return;
    }

    const nextYear = this.state.currentYear + 1;
    // 下一季的選秀順位由本季戰績倒序決定！
    let newDraftOrder = [];
    if (this.state.lastSimResult && this.state.lastSimResult.nextYearDraftOrder) {
      newDraftOrder = this.state.lastSimResult.nextYearDraftOrder.map(item => {
        return this.state.teams.find(t => t.id === item.teamId);
      }).filter(Boolean);
    }

    // 若無有效順位則沿用原順位作為保底
    if (!newDraftOrder || newDraftOrder.length !== this.state.teams.length) {
      newDraftOrder = [...this.state.teams];
    }

    this.state.draftOrder = newDraftOrder;
    this.startDraftYear(nextYear);
  },

  // 更新跑馬燈文字
  updateMarquee: function(text) {
    const el = document.getElementById("marquee-text");
    if (el) el.innerText = text;
  },

  // 視圖切換助手
  showView: function(viewId) {
    ["view-team-select", "view-draft-arena", "view-reveal-standings"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === viewId) el.classList.remove("hidden");
        else el.classList.add("hidden");
      }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // 渲染當屆選秀全貌大揭密：你錯過了誰？
  renderMissedProspects: function(draftClass, playerTeam) {
    const grid = document.getElementById("missed-prospects-grid");
    if (!grid) return;
    grid.innerHTML = "";

    // 排除玩家自己指名的 2 位選手，剩下 16 位
    const others = draftClass.filter(p => !(p.draftedBy && p.draftedBy.id === playerTeam.id));

    if (!this.state.missedFilter) this.state.missedFilter = "all";

    // 綁定篩選按鈕事件 (僅綁定一次)
    const filterContainer = document.getElementById("missed-filter-buttons");
    if (filterContainer && !filterContainer.dataset.bound) {
      filterContainer.dataset.bound = "true";
      const buttons = filterContainer.querySelectorAll(".missed-filter-btn");
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          buttons.forEach(b => {
            b.classList.remove("active", "bg-amber-500", "text-slate-950");
            b.classList.add("bg-slate-800", "text-slate-300");
          });
          btn.classList.add("active", "bg-amber-500", "text-slate-950");
          btn.classList.remove("bg-slate-800", "text-slate-300");

          this.state.missedFilter = btn.dataset.filter;
          this.renderMissedProspectsCards(others, playerTeam, this.state.missedFilter);
        });
      });
    }

    this.renderMissedProspectsCards(others, playerTeam, this.state.missedFilter);
  },

  // 渲染 16 人卡片網格
  renderMissedProspectsCards: function(prospects, playerTeam, filter) {
    const grid = document.getElementById("missed-prospects-grid");
    grid.innerHTML = "";

    const filtered = prospects.filter(p => {
      const isRivalDrafted = p.isDrafted;
      if (filter === "all") return true;
      if (filter === "missed-gem") return isRivalDrafted && (p.tier === "legend" || p.tier === "superstar" || p.tier === "regular");
      if (filter === "rival-bust") return isRivalDrafted && p.tier === "bust";
      if (filter === "undrafted") return !p.isDrafted;
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-slate-500">此分類無符合的新秀</div>`;
      return;
    }

    filtered.forEach(p => {
      const card = document.createElement("div");
      
      let borderClass = "border-slate-800 bg-slate-950/60";
      let badgeHtml = "";
      let reactionHtml = "";
      let warTotal = (p.y1_war || 0) + (p.y2_war || 0) + (p.y3_war || 0) + (p.y4_war || 0) + (p.y5_war || 0);

      if (p.isDrafted) {
        const team = p.draftedBy;
        if (p.tier === "legend") {
          borderClass = "border-amber-400/80 bg-gradient-to-b from-purple-950/40 via-amber-950/30 to-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/40";
          badgeHtml = `<span class="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded">👑 SS 級超神獸</span>`;
          reactionHtml = `<span class="text-amber-300 font-black">💔 痛失殿堂超神獸！已被【${team.name}】第 ${p.draftRound} 輪搶走！</span>`;
        } else if (p.tier === "superstar") {
          borderClass = "border-amber-500/60 bg-gradient-to-b from-amber-950/30 to-slate-950";
          badgeHtml = `<span class="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded">🌟 Ｓ 級神獸</span>`;
          reactionHtml = `<span class="text-rose-400 font-bold">💔 痛失神獸！已被【${team.name}】第 ${p.draftRound} 輪搶走！</span>`;
        } else if (p.tier === "regular") {
          borderClass = "border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 to-slate-950";
          badgeHtml = `<span class="bg-emerald-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.5 rounded">⚾ Ａ級中堅</span>`;
          reactionHtml = `<span class="text-emerald-400 font-medium">已被【${team.name}】指名（即戰力先發）</span>`;
        } else if (p.tier === "bust") {
          borderClass = "border-rose-500/50 bg-gradient-to-b from-rose-950/20 to-slate-950";
          badgeHtml = `<span class="bg-rose-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded">💣 致命地雷</span>`;
          reactionHtml = `<span class="text-amber-400 font-bold">😆 對手踩雷！【${team.name}】吞下炸彈！</span>`;
        } else {
          borderClass = "border-slate-800 bg-slate-950";
          badgeHtml = `<span class="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded">🌾 普通人</span>`;
          reactionHtml = `<span class="text-slate-300">已被【${team.name}】指名（板凳深度 +5 WAR）</span>`;
        }
      } else {
        // 落選
        borderClass = "border-slate-800/80 bg-slate-950/40 opacity-80 hover:opacity-100 transition";
        badgeHtml = `<span class="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded">落選秀</span>`;
        if (p.tier === "legend") {
          reactionHtml = `<span class="text-amber-300 font-black">😱 歷史級大遺珠！全聯盟竟然放過 SS 級殿堂神獸！</span>`;
        } else if (p.tier === "superstar") {
          reactionHtml = `<span class="text-rose-400 font-bold">😱 世紀大遺珠！全聯盟都看走眼的 Ｓ 級神獸！</span>`;
        } else if (p.tier === "regular") {
          reactionHtml = `<span class="text-emerald-400 font-medium">優質即戰力落選・令人惋惜的先發人才</span>`;
        } else {
          reactionHtml = `<span class="text-slate-400">未獲指名・投身民間職場</span>`;
        }
      }

      card.className = `rounded-xl p-3.5 border ${borderClass} shadow-md flex flex-col justify-between space-y-2.5 text-xs`;

      card.innerHTML = `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-mono text-[11px] text-slate-500">${p.displayCode}</span>
            ${badgeHtml}
          </div>

          <div>
            <h4 class="font-bold text-white text-sm line-clamp-1">${p.title}</h4>
            <div class="text-[11px] text-amber-400/90 font-bold font-num mt-0.5">
              真實身分：${p.real_nickname || p.real_name_hint}
            </div>
          </div>

          <div class="text-[11px] bg-black/40 p-2 rounded-lg border border-white/5 space-y-1">
            <div class="text-slate-300 font-medium">${reactionHtml}</div>
            <p class="text-slate-400 line-clamp-2 text-[10px] leading-relaxed">${p.career_story}</p>
          </div>
        </div>

        <div class="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-num">
          <span>五年戰力: ${warTotal > 0 ? `+${warTotal} WAR` : `0 WAR`}</span>
          <span>${p.isDrafted ? `第 ${p.draftRound} 輪・${p.draftedBy.shortName}` : '落選'}</span>
        </div>
      `;

      grid.appendChild(card);
    });
  },

  // 顯示五年任期歷史總考評彈窗
  showFinaleModal: function() {
    const playerTeam = this.getPlayerTeam();
    const history = this.state.seasonHistory || [];
    const modal = document.getElementById("modal-finale");
    if (!modal) return;

    // 1. 累計戰績與冠軍數
    let totalWins = 0;
    let championships = 0;
    history.forEach(h => {
      const st = h.simResult.standings.find(s => s.teamId === playerTeam.id);
      if (st) totalWins += st.wins;
      if (h.simResult.champion && h.simResult.champion.teamId === playerTeam.id) {
        championships++;
      }
    });

    // 2. 玩家五年選秀總攬 (10 位新秀)
    const playerPicks = (this.state.draftedRosterByTeam[playerTeam.id] || []).map(r => r.player);
    const countLegend = playerPicks.filter(p => p.tier === "legend").length;
    const countSuperstar = playerPicks.filter(p => p.tier === "superstar").length;
    const countRegular = playerPicks.filter(p => p.tier === "regular").length;
    const countOrdinary = playerPicks.filter(p => p.tier === "ordinary").length;
    const countBust = playerPicks.filter(p => p.tier === "bust").length;

    // 3. 評鑑等級 (5年 10位新秀)
    let grade = "B";
    let gradeTitle = "恪盡職守・及格球探";
    let gradeColor = "text-blue-400";
    if ((countLegend >= 2 || (countLegend >= 1 && countSuperstar >= 2) || countSuperstar >= 3) && countBust <= 2 && championships >= 2) {
      grade = "SS";
      gradeTitle = "傳奇鷹眼・開創歷史王朝 👑";
      gradeColor = "text-amber-300";
    } else if (countLegend >= 1 || countSuperstar >= 2 || (countRegular >= 5 && countBust <= 1)) {
      grade = "S";
      gradeTitle = "金牌球探・豪門推手 🎖️";
      gradeColor = "text-amber-400";
    } else if (countRegular >= 4 && countBust <= 2) {
      grade = "A";
      gradeTitle = "穩健建隊・中流砥柱 ⚾";
      gradeColor = "text-emerald-400";
    } else if (countBust >= 3) {
      grade = "F";
      gradeTitle = "地雷磁鐵・痛心疾首 💣";
      gradeColor = "text-rose-400";
    }

    document.getElementById("finale-team-title").innerText = `${playerTeam.name} 首席球探五年任期考評`;
    document.getElementById("finale-subtitle").innerText = `執掌 ${playerTeam.name} 經歷 600 場例行賽與 5 屆選秀盛會之歷史總回顧`;
    
    const gradeEl = document.getElementById("finale-grade");
    gradeEl.innerText = grade;
    gradeEl.className = `text-3xl font-black font-num ${gradeColor}`;
    document.getElementById("finale-grade-title").innerText = gradeTitle;
    document.getElementById("finale-wins").innerText = totalWins;
    document.getElementById("finale-championships").innerText = championships;
    
    let summaryParts = [];
    if (countLegend > 0) summaryParts.push(`<span class="text-amber-300 font-black">${countLegend} SS級超神獸</span>`);
    if (countSuperstar > 0) summaryParts.push(`<span class="text-amber-400 font-bold">${countSuperstar} S級神獸</span>`);
    summaryParts.push(`<span class="text-emerald-400 font-bold">${countRegular} 中堅</span>`);
    if (countOrdinary > 0) summaryParts.push(`<span class="text-slate-300">${countOrdinary} 普通</span>`);
    summaryParts.push(`<span class="text-rose-400 font-bold">${countBust} 地雷</span>`);
    document.getElementById("finale-roster-summary").innerHTML = summaryParts.join(' · ');

    // 3.5 渲染執掌球團五年選秀全陣容 (10 位新秀生涯累計戰果)
    const rosterGrid = document.getElementById("finale-drafted-roster-grid");
    const playerDraftRecords = (this.state.draftedRosterByTeam[playerTeam.id] || []);
    
    // 計算每位選手的累積與巔峰 WAR 並排序
    const sortedDraftRecords = [...playerDraftRecords].map(r => {
      const p = r.player;
      const wars = [p.y1_war || 0, p.y2_war || 0, p.y3_war || 0, p.y4_war || 0, p.y5_war || 0];
      const totalWar = Math.round(wars.reduce((a, b) => a + b, 0) * 10) / 10;
      const peakWar = Math.max(...wars);
      return { ...r, totalWar, peakWar };
    }).sort((a, b) => b.totalWar - a.totalWar);

    if (rosterGrid) {
      rosterGrid.innerHTML = "";
      sortedDraftRecords.forEach(rec => {
        const p = rec.player;
        let tierBadge = "";
        let borderClass = "border-slate-800";
        if (p.tier === "legend") {
          tierBadge = '<span class="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-black">👑 SS級超神獸</span>';
          borderClass = "border-purple-500/40 bg-purple-950/20";
        } else if (p.tier === "superstar") {
          tierBadge = '<span class="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded font-bold">🌟 S級神獸</span>';
          borderClass = "border-amber-500/40 bg-amber-950/20";
        } else if (p.tier === "regular") {
          tierBadge = '<span class="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.5 rounded font-bold">💎 中流砥柱</span>';
          borderClass = "border-emerald-900/40";
        } else if (p.tier === "ordinary") {
          tierBadge = '<span class="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded">💼 普通公務員</span>';
        } else if (p.tier === "bust") {
          tierBadge = '<span class="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold">💣 致命地雷</span>';
          borderClass = "border-rose-900/40";
        }

        const warColor = rec.totalWar >= 20 ? 'text-amber-400' : rec.totalWar >= 10 ? 'text-emerald-400' : rec.totalWar > 0 ? 'text-blue-400' : 'text-rose-400';

        const card = document.createElement("div");
        card.className = `p-3.5 rounded-2xl border ${borderClass} bg-slate-950/80 flex items-start justify-between gap-3 text-xs transition hover:border-amber-500/50`;
        card.innerHTML = `
          <div class="space-y-1.5 min-w-0">
            <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <span class="text-[10px] bg-slate-800 text-amber-400/90 font-num px-1.5 py-0.5 rounded font-bold">
                第${rec.year}年·第${rec.round}輪
              </span>
              <span class="font-bold text-white text-sm truncate">${p.title}</span>
              ${tierBadge}
              <span class="text-amber-300 font-bold text-[11px]">(${p.real_nickname || p.real_name_hint})</span>
            </div>
            <div class="text-[11px] text-slate-400 flex items-center space-x-2">
              <span>${p.pos}・${p.bats}</span>
              <span>•</span>
              <span class="text-slate-300">單季最高：<b class="text-white font-num">+${rec.peakWar} WAR</b></span>
            </div>
            <p class="text-slate-400 text-[11px] line-clamp-1 leading-relaxed">${p.career_story}</p>
          </div>
          <div class="text-right shrink-0">
            <span class="text-base font-black ${warColor} font-num block">
              +${rec.totalWar} WAR
            </span>
            <span class="text-[10px] text-slate-500">生涯五年累計</span>
          </div>
        `;
        rosterGrid.appendChild(card);
      });
    }

    // 4. 五年最痛心錯過榜 (Top Missed Gems)
    const missedList = document.getElementById("finale-missed-list");
    missedList.innerHTML = "";

    const missedGems = [];
    history.forEach(h => {
      h.draftClass.forEach(p => {
        if (p.draftedBy && p.draftedBy.id !== playerTeam.id && (p.tier === "legend" || p.tier === "superstar" || p.tier === "regular")) {
          const war = (p.y1_war || 0) + (p.y2_war || 0) + (p.y3_war || 0) + (p.y4_war || 0) + (p.y5_war || 0);
          missedGems.push({
            year: h.year,
            player: p,
            team: p.draftedBy,
            war: war
          });
        }
      });
    });

    missedGems.sort((a, b) => b.war - a.war);
    const topMissed = missedGems.slice(0, 3);

    if (topMissed.length === 0) {
      missedList.innerHTML = `<div class="p-3 bg-slate-950 rounded-xl text-xs text-slate-500 text-center">五年內對手未截胡任何關鍵大物</div>`;
    } else {
      topMissed.forEach(item => {
        const row = document.createElement("div");
        row.className = "bg-slate-950 p-3 rounded-xl border border-rose-950/40 flex items-start justify-between gap-3 text-xs";
        row.innerHTML = `
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <span class="text-rose-400 font-bold">第 ${item.year} 年</span>
              <span class="text-white font-bold text-sm">${item.player.title}</span>
              <span class="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.2 rounded font-bold">${item.player.real_nickname || item.player.real_name_hint}</span>
            </div>
            <p class="text-slate-400 text-[11px] line-clamp-1 leading-relaxed">${item.player.career_story}</p>
          </div>
          <div class="text-right shrink-0">
            <span class="text-rose-400 font-bold block font-num">+${item.war} WAR</span>
            <span class="text-[10px] text-slate-500">被【${item.team.shortName}】截胡</span>
          </div>
        `;
        missedList.appendChild(row);
      });
    }

    // 5. 五年最英明避雷榜 (Top Dodged Traps)
    const dodgedList = document.getElementById("finale-dodged-list");
    dodgedList.innerHTML = "";

    const dodgedTraps = [];
    history.forEach(h => {
      h.draftClass.forEach(p => {
        if (p.draftedBy && p.draftedBy.id !== playerTeam.id && p.tier === "bust") {
          dodgedTraps.push({
            year: h.year,
            player: p,
            team: p.draftedBy
          });
        }
      });
    });

    const topDodged = dodgedTraps.slice(0, 3);
    if (topDodged.length === 0) {
      dodgedList.innerHTML = `<div class="p-3 bg-slate-950 rounded-xl text-xs text-slate-500 text-center">五年內對手未踩中任何致命地雷</div>`;
    } else {
      topDodged.forEach(item => {
        const row = document.createElement("div");
        row.className = "bg-slate-950 p-3 rounded-xl border border-emerald-950/40 flex items-start justify-between gap-3 text-xs";
        row.innerHTML = `
          <div class="space-y-1">
            <div class="flex items-center space-x-2">
              <span class="text-emerald-400 font-bold">第 ${item.year} 年</span>
              <span class="text-white font-bold text-sm">${item.player.title}</span>
              <span class="bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1.5 py-0.2 rounded font-bold">${item.player.real_nickname || item.player.real_name_hint}</span>
            </div>
            <p class="text-slate-400 text-[11px] line-clamp-1 leading-relaxed">${item.player.career_story}</p>
          </div>
          <div class="text-right shrink-0">
            <span class="text-emerald-400 font-bold block font-num">0 WAR 炸彈</span>
            <span class="text-[10px] text-slate-500">【${item.team.shortName}】踩雷</span>
          </div>
        `;
        dodgedList.appendChild(row);
      });
    }

    // 6. 同步渲染離屏高解析分享卡片 (finale-share-card)
    const scCard = document.getElementById("finale-share-card");
    if (scCard) {
      document.getElementById("sc-team-icon").innerText = playerTeam.icon;
      document.getElementById("sc-team-name").innerText = `${playerTeam.name}・首席球探任期考評`;
      const now = new Date();
      document.getElementById("sc-date-stamp").innerText = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} 官方核發`;
      document.getElementById("sc-grade").innerText = grade;
      document.getElementById("sc-grade-title").innerText = gradeTitle;
      document.getElementById("sc-subtitle").innerText = document.getElementById("finale-subtitle").innerText;
      document.getElementById("sc-championships-badge").innerText = `${championships} 座總冠軍`;
      
      document.getElementById("sc-wins-rate").innerText = `${((totalWins / 600) * 100).toFixed(1)}% 勝率`;
      document.getElementById("sc-wins-count").innerText = `${totalWins} 勝 ${600 - totalWins} 敗`;
      document.getElementById("sc-champ-count").innerText = `${championships}`;
      
      const totalRookieWar = playerPicks.reduce((sum, p) => sum + (p.y1_war || 0) + (p.y2_war || 0) + (p.y3_war || 0) + (p.y4_war || 0) + (p.y5_war || 0), 0);
      document.getElementById("sc-rookie-war").innerText = `+${totalRookieWar.toFixed(1)} WAR`;
      document.getElementById("sc-draft-summary").innerText = `${countLegend + countSuperstar} 神獸 / ${countBust} 地雷`;

      // 執掌球團五年選秀全陣容 (10 位新秀注入離屏分享卡)
      const scRosterDiv = document.getElementById("sc-drafted-roster");
      if (scRosterDiv) {
        scRosterDiv.innerHTML = sortedDraftRecords.map(rec => {
          const p = rec.player;
          let tierBadge = "";
          let bgClass = "bg-slate-950/60 border-slate-800";
          if (p.tier === "legend") {
            tierBadge = '<span class="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1 py-0.2 rounded font-black">SS級</span>';
            bgClass = "bg-purple-950/20 border-purple-500/30";
          } else if (p.tier === "superstar") {
            tierBadge = '<span class="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1 py-0.2 rounded font-bold">S級</span>';
            bgClass = "bg-amber-950/20 border-amber-500/30";
          } else if (p.tier === "regular") {
            tierBadge = '<span class="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1 py-0.2 rounded font-bold">中堅</span>';
            bgClass = "bg-emerald-950/20 border-emerald-900/40";
          } else if (p.tier === "ordinary") {
            tierBadge = '<span class="text-[9px] bg-slate-800 text-slate-300 border border-slate-700 px-1 py-0.2 rounded">普通</span>';
            bgClass = "bg-slate-900/60 border-slate-800";
          } else if (p.tier === "bust") {
            tierBadge = '<span class="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1 py-0.2 rounded font-bold">地雷</span>';
            bgClass = "bg-rose-950/20 border-rose-900/40";
          }

          const warColor = rec.totalWar >= 20 ? 'text-amber-400 font-black' : rec.totalWar >= 10 ? 'text-emerald-400 font-bold' : rec.totalWar > 0 ? 'text-blue-400 font-bold' : 'text-rose-400 font-bold';

          return `
            <div class="p-2 rounded-xl border ${bgClass} flex items-center justify-between text-xs">
              <div class="flex items-center space-x-1.5 min-w-0">
                <span class="text-[9px] bg-slate-800 text-amber-400/90 font-num px-1 py-0.2 rounded font-bold shrink-0">
                  Y${rec.year} R${rec.round}
                </span>
                <span class="text-white font-bold truncate">${p.title}</span>
                ${tierBadge}
                <span class="text-amber-300 font-medium text-[11px] shrink-0">(${p.real_nickname || p.real_name_hint})</span>
              </div>
              <div class="text-right shrink-0 ml-2">
                <span class="${warColor} font-num text-xs">+${rec.totalWar} W</span>
              </div>
            </div>
          `;
        }).join('');
      }

      // 核心台柱 (取累積 WAR 前 3 名新秀)
      const sortedPicks = [...playerPicks].map(p => ({
        p,
        war: (p.y1_war || 0) + (p.y2_war || 0) + (p.y3_war || 0) + (p.y4_war || 0) + (p.y5_war || 0)
      })).sort((a, b) => b.war - a.war);

      const coreDiv = document.getElementById("sc-core-players");
      coreDiv.innerHTML = sortedPicks.slice(0, 3).map(item => `
        <div class="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <div class="flex items-center space-x-1.5">
            <span class="text-white font-bold">${item.p.title}</span>
            <span class="text-amber-400 font-bold text-[11px]">(${item.p.real_nickname || item.p.real_name_hint})</span>
          </div>
          <span class="text-amber-400 font-bold font-num">+${item.war} WAR</span>
        </div>
      `).join('');

      // 英明避雷
      const dodgedDiv = document.getElementById("sc-dodged-traps");
      if (topDodged.length === 0) {
        dodgedDiv.innerHTML = `<div class="p-2 bg-slate-950/60 rounded-lg text-slate-500 text-center">聯盟五年間無重大地雷</div>`;
      } else {
        dodgedDiv.innerHTML = topDodged.slice(0, 2).map(item => `
          <div class="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-800">
            <div class="flex items-center space-x-1.5">
              <span class="text-slate-300 font-medium">${item.player.title}</span>
              <span class="text-rose-400 text-[11px]">(${item.player.real_nickname || item.player.real_name_hint})</span>
            </div>
            <span class="text-emerald-400 font-bold text-[11px]">【${item.team.shortName}】踩雷</span>
          </div>
        `).join('');
      }
    }

    // 7. 綁定截圖下載與複製按鈕
    const exportCardBtn = document.getElementById("btn-export-finale-card");
    if (exportCardBtn) {
      exportCardBtn.onclick = () => {
        this.captureAndSaveCard("finale-share-card", `CPBL球探總管_${playerTeam.name}_五年歷史考評戰報.png`);
      };
    }

    const copyCardBtn = document.getElementById("btn-copy-finale-card");
    if (copyCardBtn) {
      copyCardBtn.onclick = () => {
        this.captureAndCopyCard("finale-share-card");
      };
    }

    // 8. 綁定重啟按鈕
    const restartBtn = document.getElementById("btn-finale-restart");
    restartBtn.onclick = () => {
      modal.classList.add("hidden");
      window.Generator.reset();
      this.state.currentYear = 1;
      this.init();
    };

    modal.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
  },

  // 建立五年養成曲線階梯 HTML
  buildGrowthCurveHtml: function(p) {
    if (p.tier === "legend") {
      const isReturnee = p.is_returnee;
      const y1 = p.y1_war || (isReturnee ? 6 : 2);
      const y2 = p.y2_war || (isReturnee ? 8 : 7);
      const y3 = p.y3_war || (isReturnee ? 8 : 8);
      const y4 = p.y4_war || (isReturnee ? 7 : 9);
      const y5 = p.y5_war || (isReturnee ? 6 : 9);
      const totalWar = y1 + y2 + y3 + y4 + y5;

      return `
        <div class="bg-gradient-to-r from-purple-950/70 via-black to-amber-950/70 p-2.5 rounded-xl border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.25)] space-y-1.5 text-xs font-num">
          <div class="flex items-center justify-between text-amber-300 font-bold border-b border-amber-400/20 pb-1">
            <span class="flex items-center space-x-1 text-[11px]">
              <i data-lucide="crown" class="w-3.5 h-3.5 text-amber-300"></i>
              <span class="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent font-black">👑 ＳＳ級殿堂超神獸・巔峰統治曲線</span>
            </span>
            <span class="text-xs text-amber-300 font-black">五年累計 +${totalWar} WAR</span>
          </div>
          <div class="grid grid-cols-5 gap-1 text-center">
            <div class="bg-slate-900/90 p-1 rounded border border-amber-500/60">
              <span class="text-[9px] text-amber-400/80 block">第 1 年</span>
              <span class="text-amber-300 font-black block text-xs">+${y1}</span>
              <span class="text-[8px] text-amber-300/80">${isReturnee ? '核武即戰力⚡' : '天才初啼🌱'}</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-amber-500/60">
              <span class="text-[9px] text-amber-400/80 block">第 2 年</span>
              <span class="text-amber-300 font-black block text-xs">+${y2}</span>
              <span class="text-[8px] text-amber-300/80">核心爆發🔥</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-amber-500/60">
              <span class="text-[9px] text-amber-400/80 block">第 3 年</span>
              <span class="text-yellow-300 font-black block text-xs">+${y3}</span>
              <span class="text-[8px] text-yellow-300/90">MVP巔峰👑</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-amber-500/60">
              <span class="text-[9px] text-amber-400/80 block">第 4 年</span>
              <span class="text-yellow-300 font-black block text-xs">+${y4}</span>
              <span class="text-[8px] text-yellow-300/90">王朝基石🏆</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-amber-500/60">
              <span class="text-[9px] text-amber-400/80 block">第 5 年</span>
              <span class="text-amber-200 font-black block text-xs">+${y5}</span>
              <span class="text-[8px] text-amber-200/90">傳奇隊魂🎖️</span>
            </div>
          </div>
          <p class="text-[10px] text-amber-200/90 leading-tight pt-0.5">
            💡 球探心法：SS 級殿堂神獸具備跨世代大聯盟與國家隊看板級實力，五年總貢獻突破 +34~36 WAR，單人即可改寫球隊命運！
          </p>
        </div>
      `;
    } else if (p.tier === "superstar") {
      const isReturnee = p.is_returnee;
      const y1 = p.y1_war || (isReturnee ? 4 : 1);
      const y2 = p.y2_war || (isReturnee ? 6 : 5);
      const y3 = p.y3_war || (isReturnee ? 7 : 7);
      const y4 = p.y4_war || (isReturnee ? 6 : 7);
      const y5 = p.y5_war || (isReturnee ? 5 : 7);
      const totalWar = y1 + y2 + y3 + y4 + y5;

      if (isReturnee) {
        return `
        <div class="bg-black/60 p-2.5 rounded-xl border border-amber-500/40 space-y-1.5 text-xs font-num">
          <div class="flex items-center justify-between text-amber-300 font-bold border-b border-white/10 pb-1">
            <span class="flex items-center space-x-1 text-[11px]">
              <i data-lucide="crown" class="w-3.5 h-3.5 text-amber-400"></i>
              <span>🌟 Ｓ級海歸神獸・即戰力巔峰曲線</span>
            </span>
            <span class="text-xs text-amber-400 font-black">五年累計 +${totalWar} WAR</span>
          </div>
          <div class="grid grid-cols-5 gap-1 text-center">
            <div class="bg-slate-900/90 p-1 rounded border border-amber-500/50">
              <span class="text-[9px] text-slate-400 block">第 1 年</span>
              <span class="text-emerald-400 font-bold block text-xs">+${y1}</span>
              <span class="text-[8px] text-emerald-400/90 font-medium">即插即用⚡</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 2 年</span>
              <span class="text-amber-400 font-bold block text-xs">+${y2}</span>
              <span class="text-[8px] text-amber-400/80">核心爆發🚀</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 3 年</span>
              <span class="text-amber-300 font-bold block text-xs">+${y3}</span>
              <span class="text-[8px] text-amber-300/80">MVP高峰👑</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 4 年</span>
              <span class="text-amber-300 font-bold block text-xs">+${y4}</span>
              <span class="text-[8px] text-amber-300/80">主力先發🏆</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 5 年</span>
              <span class="text-amber-200 font-bold block text-xs">+${y5}</span>
              <span class="text-[8px] text-amber-200/80">隊魂老將🎖️</span>
            </div>
          </div>
          <p class="text-[10px] text-amber-200/90 leading-tight pt-0.5">
            💡 球探心法：S 級海歸神獸首年即具備優秀戰力(+4 WAR)，第 2~3 年迎來全明星巔峰(+7 WAR)！
          </p>
        </div>
        `;
      }

      return `
        <div class="bg-black/60 p-2.5 rounded-xl border border-amber-500/40 space-y-1.5 text-xs font-num">
          <div class="flex items-center justify-between text-amber-300 font-bold border-b border-white/10 pb-1">
            <span class="flex items-center space-x-1 text-[11px]">
              <i data-lucide="trending-up" class="w-3.5 h-3.5 text-amber-400"></i>
              <span>🌟 Ｓ級高中神獸・五年成長曲線</span>
            </span>
            <span class="text-xs text-amber-400 font-black">五年累計 +${totalWar} WAR</span>
          </div>
          <div class="grid grid-cols-5 gap-1 text-center">
            <div class="bg-slate-900/90 p-1 rounded border border-amber-500/50">
              <span class="text-[9px] text-slate-400 block">第 1 年</span>
              <span class="text-emerald-400 font-bold block text-xs">+${y1}</span>
              <span class="text-[8px] text-slate-400">二軍磨練🌱</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 2 年</span>
              <span class="text-amber-400 font-bold block text-xs">+${y2}</span>
              <span class="text-[8px] text-amber-400/80">站穩主力🚀</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 3 年</span>
              <span class="text-amber-300 font-bold block text-xs">+${y3}</span>
              <span class="text-[8px] text-amber-300/80">完全體👑</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 4 年</span>
              <span class="text-amber-300 font-bold block text-xs">+${y4}</span>
              <span class="text-[8px] text-amber-300/80">明星統治🏆</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 5 年</span>
              <span class="text-amber-200 font-bold block text-xs">+${y5}</span>
              <span class="text-[8px] text-amber-200/80">聯盟看板🌟</span>
            </div>
          </div>
          <p class="text-[10px] text-amber-200/90 leading-tight pt-0.5">
            💡 球探心法：S 級高中神獸首年蓄力磨練(+1 WAR)，第 3~5 年迎來穩定全明星貢獻(+7 WAR)！
          </p>
        </div>
      `;
    } else if (p.tier === "regular") {
      const isReturnee = p.is_returnee;
      const y1 = p.y1_war || (isReturnee ? 3 : 1);
      const y2 = p.y2_war || (isReturnee ? 4 : 3);
      const y3 = p.y3_war || (isReturnee ? 4 : 4);
      const y4 = p.y4_war || (isReturnee ? 3 : 4);
      const y5 = p.y5_war || (isReturnee ? 3 : 4);
      const totalWar = y1 + y2 + y3 + y4 + y5;

      if (isReturnee) {
        return `
        <div class="bg-black/60 p-2.5 rounded-xl border border-emerald-500/40 space-y-1.5 text-xs font-num">
          <div class="flex items-center justify-between text-emerald-300 font-bold border-b border-white/10 pb-1">
            <span class="flex items-center space-x-1 text-[11px]">
              <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>⚾ Ａ級海歸中堅・五年穩定輸出</span>
            </span>
            <span class="text-xs text-emerald-400 font-black">五年累計 +${totalWar} WAR</span>
          </div>
          <div class="grid grid-cols-5 gap-1 text-center">
            <div class="bg-slate-900/90 p-1 rounded border border-emerald-500/50">
              <span class="text-[9px] text-slate-400 block">第 1 年</span>
              <span class="text-emerald-400 font-bold block text-xs">+${y1}</span>
              <span class="text-[8px] text-emerald-400/80">即戰力⚡</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 2 年</span>
              <span class="text-emerald-400 font-bold block text-xs">+${y2}</span>
              <span class="text-[8px] text-emerald-400/80">先發骨幹</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 3 年</span>
              <span class="text-emerald-300 font-bold block text-xs">+${y3}</span>
              <span class="text-[8px] text-emerald-300/80">巔峰封頂👑</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 4 年</span>
              <span class="text-slate-300 font-bold block text-xs">+${y4}</span>
              <span class="text-[8px] text-slate-400">穩定輪替</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 5 年</span>
              <span class="text-slate-400 font-bold block text-xs">+${y5}</span>
              <span class="text-[8px] text-slate-500">資深老將</span>
            </div>
          </div>
          <p class="text-[10px] text-emerald-200/90 leading-tight pt-0.5">
            💡 球探心法：海歸中堅首兩年即具備先發即戰力，第 2~3 年封頂(+4 WAR)，是穩定隊伍的中流砥柱。
          </p>
        </div>
        `;
      }

      return `
        <div class="bg-black/60 p-2.5 rounded-xl border border-emerald-500/40 space-y-1.5 text-xs font-num">
          <div class="flex items-center justify-between text-emerald-300 font-bold border-b border-white/10 pb-1">
            <span class="flex items-center space-x-1 text-[11px]">
              <i data-lucide="activity" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>⚾ Ａ級本土中堅・五年養成先發</span>
            </span>
            <span class="text-xs text-emerald-400 font-black">五年累計 +${totalWar} WAR</span>
          </div>
          <div class="grid grid-cols-5 gap-1 text-center">
            <div class="bg-slate-900/90 p-1 rounded border border-emerald-500/50">
              <span class="text-[9px] text-slate-400 block">第 1 年</span>
              <span class="text-emerald-400 font-bold block text-xs">+${y1}</span>
              <span class="text-[8px] text-slate-400">二軍磨練🌱</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 2 年</span>
              <span class="text-emerald-400 font-bold block text-xs">+${y2}</span>
              <span class="text-[8px] text-emerald-400/80">站穩先發🚀</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 3 年</span>
              <span class="text-emerald-300 font-bold block text-xs">+${y3}</span>
              <span class="text-[8px] text-emerald-300/80">生涯巔峰👑</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 4 年</span>
              <span class="text-slate-300 font-bold block text-xs">+${y4}</span>
              <span class="text-[8px] text-slate-400">核心骨幹</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 5 年</span>
              <span class="text-emerald-400 font-bold block text-xs">+${y5}</span>
              <span class="text-[8px] text-emerald-400/80">長效中堅🌟</span>
            </div>
          </div>
          <p class="text-[10px] text-emerald-200/90 leading-tight pt-0.5">
            💡 球探心法：本土中堅首年打底(+1 WAR)，第 3~5 年維持優質先發輸出(+4 WAR)，長效投資回報高！
          </p>
        </div>
      `;
    } else if (p.tier === "ordinary") {
      const y1 = p.y1_war || 1;
      const y2 = p.y2_war || 1;
      const y3 = p.y3_war || 1;
      const y4 = p.y4_war || 1;
      const y5 = p.y5_war || 1;
      const totalWar = y1 + y2 + y3 + y4 + y5;
      return `
        <div class="bg-black/60 p-2.5 rounded-xl border border-slate-600/40 space-y-1.5 text-xs font-num">
          <div class="flex items-center justify-between text-slate-300 font-bold border-b border-white/10 pb-1">
            <span class="flex items-center space-x-1 text-[11px]">
              <i data-lucide="shield" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>🌾 普通綠葉・穩定深度工兵</span>
            </span>
            <span class="text-xs text-slate-300 font-black">五年累計 +${totalWar} WAR</span>
          </div>
          <div class="grid grid-cols-5 gap-1 text-center">
            <div class="bg-slate-900/90 p-1 rounded border border-slate-700">
              <span class="text-[9px] text-slate-400 block">第 1 年</span>
              <span class="text-slate-200 font-bold block text-xs">+${y1}</span>
              <span class="text-[8px] text-slate-400">吃局代打🌾</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 2 年</span>
              <span class="text-slate-200 font-bold block text-xs">+${y2}</span>
              <span class="text-[8px] text-slate-400">替補防守🛡️</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 3 年</span>
              <span class="text-slate-200 font-bold block text-xs">+${y3}</span>
              <span class="text-[8px] text-slate-400">板凳深度⚾</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 4 年</span>
              <span class="text-slate-200 font-bold block text-xs">+${y4}</span>
              <span class="text-[8px] text-slate-400">輪替工兵🔧</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-slate-800">
              <span class="text-[9px] text-slate-400 block">第 5 年</span>
              <span class="text-slate-200 font-bold block text-xs">+${y5}</span>
              <span class="text-[8px] text-slate-400">長效綠葉🌱</span>
            </div>
          </div>
          <p class="text-[10px] text-slate-300/90 leading-tight pt-0.5">
            💡 球探心法：普通球員每年穩定貢獻 +1 WAR，提供板凳深度、戰術執行與長中繼局數，是漫長賽季不崩盤的陣容深度保證！
          </p>
        </div>
      `;
    } else if (p.tier === "bust") {
      return `
        <div class="bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/40 space-y-1.5 text-xs font-num">
          <div class="flex items-center justify-between text-rose-300 font-bold border-b border-rose-500/20 pb-1">
            <span class="flex items-center space-x-1 text-[11px]">
              <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-400"></i>
              <span>⚠️ 致命地雷・未能立足一軍</span>
            </span>
            <span class="text-xs text-rose-400 font-black">五年累計 +0 WAR</span>
          </div>
          <div class="grid grid-cols-5 gap-1 text-center">
            <div class="bg-slate-900/90 p-1 rounded border border-rose-900/50">
              <span class="text-[9px] text-slate-500 block">第 1 年</span>
              <span class="text-rose-400 font-bold block text-xs">0</span>
              <span class="text-[8px] text-slate-500">二軍掙扎</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-rose-900/50">
              <span class="text-[9px] text-slate-500 block">第 2 年</span>
              <span class="text-rose-400 font-bold block text-xs">0</span>
              <span class="text-[8px] text-slate-500">無法突破</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-rose-900/50">
              <span class="text-[9px] text-slate-500 block">第 3 年</span>
              <span class="text-rose-400 font-bold block text-xs">0</span>
              <span class="text-[8px] text-slate-500">未上一軍</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-rose-900/50">
              <span class="text-[9px] text-slate-500 block">第 4 年</span>
              <span class="text-rose-400 font-bold block text-xs">0</span>
              <span class="text-[8px] text-slate-500">釋出邊緣</span>
            </div>
            <div class="bg-slate-900/90 p-1 rounded border border-rose-900/50">
              <span class="text-[9px] text-slate-500 block">第 5 年</span>
              <span class="text-rose-400 font-bold block text-xs">0</span>
              <span class="text-[8px] text-slate-500">離開職棒</span>
            </div>
          </div>
          <p class="text-[10px] text-rose-300/80 leading-tight pt-0.5">
            ⚠️ 球探警示：技術或適應問題未能突破，五年間未能在職棒一軍貢獻實質勝場。
          </p>
        </div>
      `;
    } else {
      return "";
    }
  },

  renderRosterGrowthTracker: function(playerTeam) {
    const container = document.getElementById("roster-growth-tracker");
    const list = document.getElementById("roster-growth-list");
    const badge = document.getElementById("roster-total-war-badge");
    if (!container || !list) return;

    // 取得玩家歷年選入的所有新秀
    const allRecords = this.state.draftedRosterByTeam[playerTeam.id] || [];
    
    // 如果只有第 1 年，隱藏追蹤看板（因為上面翻開的 2 張就是全部）
    if (this.state.currentYear < 2 || allRecords.length === 0) {
      container.classList.add("hidden");
      return;
    }

    container.classList.remove("hidden");
    list.innerHTML = "";

    // 1. 計算每位新秀在當季的單季 WAR 並封裝
    const evaluatedRecords = allRecords.map(rec => {
      const p = rec.player;
      const draftedYear = rec.year;
      const yearsInPro = (this.state.currentYear - draftedYear) + 1; // 職棒第幾年

      let currentSeasonWar = 0;
      let trajectoryHtml = "";

      if (p.tier === "legend") {
        const isReturnee = p.is_returnee;
        const y1 = p.y1_war || (isReturnee ? 6 : 2);
        const y2 = p.y2_war || (isReturnee ? 8 : 7);
        const y3 = p.y3_war || (isReturnee ? 8 : 8);
        const y4 = p.y4_war || (isReturnee ? 7 : 9);
        const y5 = p.y5_war || (isReturnee ? 6 : 9);
        currentSeasonWar = p[`y${Math.min(5, yearsInPro)}_war`] || (yearsInPro === 1 ? y1 : yearsInPro === 2 ? y2 : yearsInPro === 3 ? y3 : yearsInPro === 4 ? y4 : y5);

        if (yearsInPro === 1) {
          trajectoryHtml = isReturnee
            ? `<span class="text-amber-300 font-black">+${currentSeasonWar} WAR ⚡</span> <span class="text-amber-300 font-bold">(SS級即戰力・震撼聯盟！)</span>`
            : `<span class="text-emerald-400 font-bold">+${currentSeasonWar} WAR</span> <span class="text-amber-300">(SS級青澀磨練・蓄勢待發)</span>`;
        } else if (yearsInPro === 2) {
          trajectoryHtml = `<span class="text-slate-400">第1年 +${y1}</span> ➔ <span class="text-amber-300 font-black">+${currentSeasonWar} WAR 🔥</span> <span class="text-amber-200 font-bold">(SS級MVP統治！)</span>`;
        } else if (yearsInPro === 3) {
          trajectoryHtml = `<span class="text-slate-400">前兩年 +${y1+y2}</span> ➔ <span class="text-yellow-300 font-black">+${currentSeasonWar} WAR 👑</span> <span class="text-amber-100 font-bold">(歷史級完全體！)</span>`;
        } else if (yearsInPro >= 4) {
          trajectoryHtml = `<span class="text-slate-400">歷年核心</span> ➔ <span class="text-yellow-300 font-black">+${currentSeasonWar} WAR 🏆</span> <span class="text-amber-100 font-bold">(王朝霸王隊魂！)</span>`;
        }
      } else if (p.tier === "superstar") {
        const isReturnee = p.is_returnee;
        const y1 = p.y1_war || (isReturnee ? 4 : 1);
        const y2 = p.y2_war || (isReturnee ? 6 : 5);
        const y3 = p.y3_war || (isReturnee ? 7 : 7);
        const y4 = p.y4_war || (isReturnee ? 6 : 7);
        const y5 = p.y5_war || (isReturnee ? 5 : 7);
        currentSeasonWar = p[`y${Math.min(5, yearsInPro)}_war`] || (yearsInPro === 1 ? y1 : yearsInPro === 2 ? y2 : yearsInPro === 3 ? y3 : yearsInPro === 4 ? y4 : y5);

        if (yearsInPro === 1) {
          trajectoryHtml = isReturnee
            ? `<span class="text-emerald-400 font-bold">+${currentSeasonWar} WAR ⚡</span> <span class="text-amber-300 font-bold">(海歸即戰力・首年即用)</span>`
            : `<span class="text-emerald-400 font-bold">+${currentSeasonWar} WAR</span> <span class="text-slate-400">(首年二軍磨練繳學費)</span>`;
        } else if (yearsInPro === 2) {
          trajectoryHtml = `<span class="text-slate-400">第1年 +${y1}</span> ➔ <span class="text-amber-400 font-bold">+${currentSeasonWar} WAR 🚀</span> <span class="text-amber-300 font-bold">(站穩先發明星！)</span>`;
        } else if (yearsInPro >= 3) {
          trajectoryHtml = `<span class="text-slate-400">前兩年穩定</span> ➔ <span class="text-amber-300 font-black">+${currentSeasonWar} WAR 👑</span> <span class="text-amber-200 font-bold">(聯盟頂級全明星！)</span>`;
        }
      } else if (p.tier === "regular") {
        const isReturnee = p.is_returnee;
        const y1 = p.y1_war || (isReturnee ? 3 : 1);
        const y2 = p.y2_war || (isReturnee ? 4 : 3);
        const y3 = p.y3_war || (isReturnee ? 4 : 4);
        const y4 = p.y4_war || (isReturnee ? 3 : 4);
        const y5 = p.y5_war || (isReturnee ? 3 : 4);
        currentSeasonWar = p[`y${Math.min(5, yearsInPro)}_war`] || (yearsInPro === 1 ? y1 : yearsInPro === 2 ? y2 : yearsInPro === 3 ? y3 : yearsInPro === 4 ? y4 : y5);

        if (yearsInPro === 1) {
          trajectoryHtml = `<span class="text-emerald-400 font-bold">+${currentSeasonWar} WAR ⚡</span> <span class="text-slate-400">(${isReturnee ? '海歸即戰力貢獻' : '新人球季磨練打底'})</span>`;
        } else if (yearsInPro === 2) {
          trajectoryHtml = `<span class="text-slate-400">第1年 +${y1}</span> ➔ <span class="text-emerald-400 font-bold">+${currentSeasonWar} WAR</span> <span class="text-slate-300">(骨幹主力)</span>`;
        } else if (yearsInPro >= 3) {
          trajectoryHtml = `<span class="text-slate-400">前兩年穩定</span> ➔ <span class="text-emerald-300 font-bold">+${currentSeasonWar} WAR</span> <span class="text-slate-300">(成熟先發主力)</span>`;
        }
      } else if (p.tier === "ordinary") {
        currentSeasonWar = p[`y${Math.min(5, yearsInPro)}_war`] || 1;
        trajectoryHtml = `<span class="text-slate-200 font-bold">+${currentSeasonWar} WAR 🌾</span> <span class="text-slate-400">(綠葉工兵・板凳深度)</span>`;
      } else {
        currentSeasonWar = 0;
        trajectoryHtml = `<span class="text-rose-400 font-bold">0 WAR ⚠️</span> <span class="text-slate-500">(未能立足一軍)</span>`;
      }

      return {
        rec,
        player: p,
        draftedYear,
        yearsInPro,
        rawWar: currentSeasonWar,
        trajectoryHtml
      };
    });

    // 2. 依單季原始 WAR 由高至低排序 (以反映空間擠壓席次)
    evaluatedRecords.sort((a, b) => b.rawWar - a.rawWar);

    let effectiveTotalWar = 0;

    evaluatedRecords.forEach((item, index) => {
      const isTop4 = (index < 4);
      const effectiveWar = isTop4 ? item.rawWar : (item.rawWar * 0.5);
      effectiveTotalWar += effectiveWar;

      const roleBadge = isTop4
        ? `<span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-bold">🔥 核心先發 (${item.rawWar} 全額)</span>`
        : `<span class="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded font-bold">🛡️ 空間擠壓 (${item.rawWar * 0.5} 減半)</span>`;

      const p = item.player;
      const el = document.createElement("div");
      el.className = "bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs";
      el.innerHTML = `
        <div class="flex items-center space-x-2 flex-wrap gap-y-1">
          <span class="text-slate-500 font-num">第${item.draftedYear}年第${item.rec.round}輪</span>
          <span class="font-bold text-white">${p.title}</span>
          <span class="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold">${p.tier === "legend" ? '👑 SS級 ' : ''}${p.real_nickname || p.real_name_hint}</span>
          <span class="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">職棒第 ${item.yearsInPro} 年</span>
          ${roleBadge}
        </div>
        <div class="font-num flex items-center space-x-1.5">
          ${item.trajectoryHtml}
        </div>
      `;
      list.appendChild(el);
    });

    // 四捨五入取一位小數
    const finalWarDisplay = Math.round(effectiveTotalWar * 10) / 10;
    badge.innerText = `本季新秀實質貢獻：+${finalWarDisplay} 勝 (前4大主力全額 + 空間擠壓替補減半)`;
    if (window.lucide) lucide.createIcons();
  },

  // 截圖下載功能 (調用 html2canvas 渲染高解析 PNG 圖檔)
  captureAndSaveCard: function(elementId, filename) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (typeof html2canvas === "undefined") {
      alert("截圖模組載入中，請稍候重試！");
      return;
    }

    const isShareCard = (elementId === "finale-share-card");
    const prevPosition = el.style.position;
    const prevLeft = el.style.left;
    const prevTop = el.style.top;
    const prevZIndex = el.style.zIndex;
    const prevOpacity = el.style.opacity;

    if (isShareCard) {
      el.style.position = "fixed";
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.zIndex = "99999";
      el.style.opacity = "1";
    }

    const targetWidth = el.offsetWidth || 760;
    const targetHeight = el.scrollHeight;

    html2canvas(el, {
      backgroundColor: "#020617",
      scale: 2, // 2x Retina 高解析
      useCORS: true,
      logging: false,
      width: targetWidth,
      height: targetHeight,
      windowWidth: targetWidth,
      windowHeight: targetHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0
    }).then(canvas => {
      if (isShareCard) {
        el.style.position = prevPosition;
        el.style.left = prevLeft;
        el.style.top = prevTop;
        el.style.zIndex = prevZIndex;
        el.style.opacity = prevOpacity;
      }
      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }).catch(err => {
      if (isShareCard) {
        el.style.position = prevPosition;
        el.style.left = prevLeft;
        el.style.top = prevTop;
        el.style.zIndex = prevZIndex;
        el.style.opacity = prevOpacity;
      }
      console.error("Screenshot error:", err);
      alert("截圖生成失敗，請使用系統截圖快捷鍵（Win + Shift + S 或手機截圖）！");
    });
  },

  // 截圖複製至剪貼簿功能 (支援電腦端直接 Ctrl+V 貼上分享)
  captureAndCopyCard: function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (typeof html2canvas === "undefined") {
      alert("截圖模組載入中，請稍候重試！");
      return;
    }

    const isShareCard = (elementId === "finale-share-card");
    const prevPosition = el.style.position;
    const prevLeft = el.style.left;
    const prevTop = el.style.top;
    const prevZIndex = el.style.zIndex;
    const prevOpacity = el.style.opacity;

    if (isShareCard) {
      el.style.position = "fixed";
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.zIndex = "99999";
      el.style.opacity = "1";
    }

    const targetWidth = el.offsetWidth || 760;
    const targetHeight = el.scrollHeight;

    html2canvas(el, {
      backgroundColor: "#020617",
      scale: 2,
      useCORS: true,
      logging: false,
      width: targetWidth,
      height: targetHeight,
      windowWidth: targetWidth,
      windowHeight: targetHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0
    }).then(canvas => {
      if (isShareCard) {
        el.style.position = prevPosition;
        el.style.left = prevLeft;
        el.style.top = prevTop;
        el.style.zIndex = prevZIndex;
        el.style.opacity = prevOpacity;
      }
      canvas.toBlob(blob => {
        if (navigator.clipboard && navigator.clipboard.write) {
          navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
          ]).then(() => {
            alert("✅ 戰報截圖已成功複製到剪貼簿！\n可直接至 LINE、PTT、Discord、FB 等社群聊天室按 Ctrl + V 貼上分享！");
          }).catch(() => {
            const link = document.createElement("a");
            link.download = "CPBL五年球探戰報.png";
            link.href = canvas.toDataURL("image/png");
            link.click();
            alert("因瀏覽器安全限制，已為您自動下載為戰報圖檔！");
          });
        } else {
          const link = document.createElement("a");
          link.download = "CPBL五年球探戰報.png";
          link.href = canvas.toDataURL("image/png");
          link.click();
          alert("已為您下載戰報圖檔！");
        }
      });
    }).catch(err => {
      if (isShareCard) {
        el.style.position = prevPosition;
        el.style.left = prevLeft;
        el.style.top = prevTop;
        el.style.zIndex = prevZIndex;
        el.style.opacity = prevOpacity;
      }
      console.error("Screenshot copy error:", err);
      alert("截圖生成失敗！");
    });
  }
};

// 網頁載入完成後啟動遊戲
window.addEventListener("DOMContentLoaded", () => {
  window.App.init();
});
