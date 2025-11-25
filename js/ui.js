// --- UI FUNCTIONS ---

function initGameUI() {
    document.getElementById('research-tab-btn').style.display = 'none';
    document.getElementById('syndicate-tab-btn').style.display = 'none';
    document.getElementById('research-list').innerHTML = "";
    document.getElementById('syndicate-list').innerHTML = "";
    document.getElementById('activeSkillsContainer').innerHTML = "";

    let container = document.getElementById('buildings-tab');
    container.innerHTML = "";
    gameState.buildings.forEach((b, index) => {
        let item = document.createElement('div');
        item.className = 'shop-item disabled';
        item.id = `building-${index}`;
        item.onclick = () => buyBuilding(index);

        // Add specific info for Shell Company
        let extraInfo = "";
        if (b.id === 3) {
            extraInfo = `<div style="font-size: 0.7rem; color: var(--tech-color); margin-top: 2px;">🔓 Débloque R&D</div>`;
        }

        item.innerHTML = `
        <div class="item-info">
            <h4>${b.icon} ${b.name}</h4>
            <div class="item-cost"><span class="cost-val">${b.baseCost}</span> $</div>
            <div class="item-stats">+${b.income} $/sec</div>
            ${extraInfo}
        </div>
        <div class="item-count count-val">0</div>
    `;
        container.appendChild(item);
    });

    initSyndicateList();

    // Country Header
    let header = document.querySelector('header h1');
    if (header) {
        let country = COUNTRIES_DATA[gameState.currentCountryIndex];
        header.innerHTML = `Fiscal Phantom <span style="font-size: 0.6em; color: #aaa;">| ${country.flag} ${country.name}</span>`;
    }

    updateUI();
}

function showEventToast(event) {
    let toast = document.getElementById('eventToast');
    let title = document.getElementById('eventTitle');
    let desc = document.getElementById('eventDesc');

    title.innerText = event.title;
    desc.innerText = event.desc;

    toast.className = `event-toast ${event.type}`;
    toast.style.display = 'flex';

    if (event.type !== 'tech' && event.type !== 'bribe') {
        document.getElementById('newsTickerText').innerText = `FLASH INFO: ${event.title} - ${event.desc}`;
    }

    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}

function updateUI() {
    document.getElementById('totalMoney').innerText = formatMoney(gameState.money) + " $";
    document.getElementById('incomePerSec').innerText = formatMoney(calculateTotalIncome());
    document.getElementById('defenseLevel').innerText = gameState.defense.toFixed(1);
    document.getElementById('clickPowerDisplay').innerText = formatMoney(gameState.clickPower);

    let strikeEl = document.getElementById('strikeCount');
    strikeEl.innerText = gameState.strikes;
    strikeEl.style.color = gameState.strikes >= GAME_CONFIG.maxStrikes - 1 ? '#f44336' : (gameState.strikes >= 1 ? '#ff9800' : 'inherit');
    document.querySelector('.strikes-display').innerHTML = `Casier Judiciaire: <span id="strikeCount">${gameState.strikes}</span>/${GAME_CONFIG.maxStrikes}`;

    let r = gameState.risk;
    let bar = document.getElementById('riskBar');
    bar.style.width = Math.min(r, 100) + "%";
    document.getElementById('riskValue').innerText = r.toFixed(1);

    if (r < 50) bar.style.backgroundColor = "var(--risk-low)";
    else if (r < 80) bar.style.backgroundColor = "var(--risk-med)";
    else bar.style.backgroundColor = "var(--risk-high)";

    document.getElementById('auditAlert').style.display = (r > 85) ? 'block' : 'none';

    // Update Skill Buttons (Cooldown visuals)
    updateSkillButtonsUI();

    // Business List
    gameState.buildings.forEach((b, index) => {
        let el = document.getElementById(`building-${index}`);
        if (el) {
            let currentCost = getBuildingCost(b);
            el.querySelector('.cost-val').innerText = formatMoney(currentCost);
            el.querySelector('.count-val').innerText = b.count;

            let roi = b.income > 0 ? currentCost / b.income : 0;
            let roiText = roi > 0 ? ` | ROI: ${formatTime(roi)}` : "";
            el.querySelector('.item-stats').innerText = `+${b.income} $/sec${roiText}`;

            if (gameState.money >= currentCost) el.classList.remove('disabled');
            else el.classList.add('disabled');
        }
    });

    // Lawyer & Bribe
    document.getElementById('lawyer-cost').innerText = formatMoney(gameState.lawyerCost) + " $";
    document.getElementById('lawyer-stat').innerText = gameState.defense.toFixed(1);
    let lawyerBtn = document.getElementById('lawyer-upgrade');
    if (gameState.money >= gameState.lawyerCost) lawyerBtn.classList.remove('disabled');
    else lawyerBtn.classList.add('disabled');

    let bribeCost = calculateBribeCost();
    document.getElementById('bribe-cost').innerText = formatMoney(bribeCost) + " $";
    let bribeBtn = document.getElementById('bribe-action');
    if (gameState.money >= bribeCost) bribeBtn.classList.remove('disabled');
    else bribeBtn.classList.add('disabled');

    // Prestige
    // Travel / Prestige
    let prestigeBtn = document.getElementById('prestige-upgrade');
    let currentCountry = COUNTRIES_DATA[gameState.currentCountryIndex];
    let nextCountry = COUNTRIES_DATA[gameState.currentCountryIndex + 1];

    if (nextCountry) {
        // Show button if we are close or if we unlocked it?
        // Let's show it always but disabled if not met, so player sees the goal.
        prestigeBtn.style.display = 'flex';

        let reqMet = gameState.lifetimeEarnings >= nextCountry.req;

        // Calculate Influence Gain
        let threshold = 1000000000;
        let potentialPoints = Math.floor(gameState.lifetimeEarnings / threshold);
        let gain = potentialPoints; // Simplified for display
        if (gain < 1) gain = 1; // Min 1

        // Effect: Marketing
        let marketingLevel = gameState.blackMarketUpgrades['marketing'] || 0;
        if (marketingLevel > 0) {
            gain = Math.floor(gain * (1 + (marketingLevel * 0.10)));
        }

        let btnText = `Fuite vers ${nextCountry.name}`;
        let btnDesc = `Requis: ${formatMoney(nextCountry.req)} $`;

        if (reqMet) {
            prestigeBtn.classList.remove('disabled');
            prestigeBtn.onclick = travelToNextCountry; // Update handler
            document.getElementById('prestige-gain').innerHTML = `${btnText} <br> <span style="font-size:0.8em; color:var(--good-color)">Gain: ${gain} Influence</span>`;
        } else {
            prestigeBtn.classList.add('disabled');
            document.getElementById('prestige-gain').innerHTML = `${btnText} <br> <span style="font-size:0.8em; color:var(--risk-high)">${btnDesc}</span>`;
        }
    } else {
        // Max Level Reached
        prestigeBtn.style.display = 'none';
    }

    // Black Market Button Visibility - REMOVED (Now in Menu)
    let bmBtn = document.getElementById('blackMarketBtn');
    if (bmBtn) bmBtn.style.display = 'none';

    // Research List
    if (gameState.researchUnlocked) {
        RESEARCH_DATA.forEach((res, index) => {
            let el = document.getElementById(`research-${index}`);
            if (el && !gameState.researchesOwned.includes(res.id)) {
                if (gameState.money >= res.cost) el.classList.remove('disabled');
                else el.classList.add('disabled');
            }
        });
    }

    // Syndicate List
    if (gameState.lifetimeEarnings >= 100000) { // Unlock at 100k lifetime
        document.getElementById('syndicate-tab-btn').style.display = 'block';
        updateSyndicateUI();
    }
}

function initSkillButtons() {
    let container = document.getElementById('activeSkillsContainer');
    container.innerHTML = "";

    for (let key in SKILLS_DATA) {
        let skill = SKILLS_DATA[key];
        if (skill.unlocked) {
            let btn = document.createElement('div');
            btn.className = 'skill-btn';
            btn.id = `skill-${key}`;
            btn.onclick = () => useSkill(key);
            btn.title = `${skill.name} (-${skill.riskReduction}% Risque)`;

            btn.innerHTML = `
            <div class="skill-icon">${skill.icon}</div>
            <div class="skill-label">${skill.name}</div>
            <div class="skill-cooldown-overlay" id="skill-cd-${key}"></div>
        `;
            container.appendChild(btn);
        }
    }
}

function updateSkillButtonsUI() {
    for (let key in gameState.skillCooldowns) {
        let skill = SKILLS_DATA[key];
        if (skill.unlocked) {
            let btn = document.getElementById(`skill-${key}`);
            let overlay = document.getElementById(`skill-cd-${key}`);
            let currentCD = gameState.skillCooldowns[key];

            if (currentCD > 0) {
                btn.classList.add('on-cooldown');
                overlay.style.display = 'flex';
                // Hauteur proportionnelle
                let pct = (currentCD / skill.cooldown) * 100;
                overlay.style.height = pct + "%";
                overlay.innerText = Math.ceil(currentCD);
            } else {
                btn.classList.remove('on-cooldown');
                overlay.style.display = 'none';
            }
        }
    }
}

function createFloatingText(x, y, text) {
    let el = document.createElement('div');
    el.classList.add('floating-text');
    el.innerText = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.shop-content').forEach(c => c.style.display = 'none');

    let btn = document.querySelector(`button[onclick="switchTab('${tabName}')"]`);
    if (btn) btn.classList.add('active');

    document.getElementById(tabName + '-tab').style.display = 'block';
}

function formatMoney(num) {
    if (num < 1000) return Math.floor(num);
    if (num < 1000000) return (num / 1000).toFixed(2) + "k";
    if (num < 1000000000) return (num / 1000000).toFixed(2) + "M";
    return (num / 1000000000).toFixed(2) + "B";
}

function initResearchList() {
    let container = document.getElementById('research-list');
    container.innerHTML = ""; // Clear existing
    RESEARCH_DATA.forEach((res, index) => {
        let isOwned = gameState.researchesOwned.includes(res.id);
        let item = document.createElement('div');
        item.className = 'shop-item disabled';
        if (isOwned) item.classList.add('purchased');
        item.id = `research-${index}`;
        item.onclick = () => buyResearch(index);

        let costDisplay = isOwned ? "ACQUIS" : `${formatMoney(res.cost)} $`;
        let nameColor = res.unlocksSkill ? "var(--tech-color)" : "inherit";
        let iconDisplay = res.unlocksSkill ? "⚡" : res.icon;

        item.innerHTML = `
        <div class="item-info">
            <h4 style="color: ${nameColor}">${iconDisplay} ${res.name}</h4>
            <div class="item-cost">${costDisplay}</div>
            <div class="item-stats">${res.desc}</div>
        </div>
    `;
        container.appendChild(item);
    });
}

function initSyndicateList() {
    let container = document.getElementById('syndicate-list');
    container.innerHTML = "";

    SYNDICATE_DATA.forEach(manager => {
        let item = document.createElement('div');
        item.className = 'syndicate-item';
        item.id = `manager-${manager.id}`;
        item.onclick = () => hireManager(manager.id);

        item.innerHTML = `
            <div class="item-info">
                <h4>${manager.icon} ${manager.name} <span class="syndicate-level" id="lvl-${manager.id}">(Niv. 0)</span></h4>
                <div class="item-cost" id="cost-${manager.id}">${formatMoney(manager.baseCost)} $</div>
                <div class="item-stats">${manager.desc}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

function updateSyndicateUI() {
    SYNDICATE_DATA.forEach(manager => {
        let el = document.getElementById(`manager-${manager.id}`);
        if (el) {
            let currentLevel = gameState.syndicateManagers[manager.id] || 0;
            let isMaxed = currentLevel >= manager.maxLevel;
            let nextCost = Math.floor(manager.baseCost * Math.pow(1.5, currentLevel));

            el.querySelector(`#lvl-${manager.id}`).innerText = `(Niv. ${currentLevel}/${manager.maxLevel})`;

            if (isMaxed) {
                el.classList.add('hired');
                el.querySelector(`#cost-${manager.id}`).innerText = "MAX";
            } else {
                el.querySelector(`#cost-${manager.id}`).innerText = formatMoney(nextCost) + " $";
                if (gameState.money >= nextCost) el.classList.remove('disabled');
                else el.classList.add('disabled');
            }
        }
    });
}

function closeAudit() {
    document.getElementById('auditModal').style.display = 'none';
    gameState.risk = 0;
}

function openAchievements() {
    let list = document.getElementById('achievementsList');
    list.innerHTML = "";

    ACHIEVEMENTS_DATA.forEach(ach => {
        let unlocked = gameState.achievements.includes(ach.id);
        let item = document.createElement('div');
        item.style.padding = "10px";
        item.style.marginBottom = "10px";
        item.style.backgroundColor = unlocked ? "#2e3b2e" : "#3a3a3d";
        item.style.border = unlocked ? "1px solid var(--money-color)" : "1px solid #555";
        item.style.borderRadius = "5px";
        item.style.opacity = unlocked ? "1" : "0.7";

        let icon = unlocked ? ach.icon : "🔒";
        let title = ach.name;
        let desc = ach.desc;

        item.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div style="font-size: 2rem; margin-right: 15px;">${icon}</div>
                <div>
                    <h4 style="margin: 0; color: ${unlocked ? 'var(--money-color)' : '#aaa'}">${title}</h4>
                    <div style="font-size: 0.8rem; color: #ccc;">${desc}</div>
                </div>
            </div>
        `;
        list.appendChild(item);
    });

    document.getElementById('achievementsModal').style.display = 'flex';
}

function closeAchievements() {
    document.getElementById('achievementsModal').style.display = 'none';
}

// --- MAIN MENU FUNCTIONS ---

function showMainMenu() {
    // Hide Game View
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('main-menu-view').style.display = 'flex';

    renderWorldMap();
    renderBlackMarketInMenu();
    updateMenuStats();
}

function updateMenuStats() {
    document.getElementById('menu-influence').innerText = gameState.prestige.currency;
    document.getElementById('menu-lifetime').innerText = formatMoney(gameState.lifetimeEarnings) + " $";
}

function renderWorldMap() {
    let container = document.getElementById('world-map-container');
    container.innerHTML = "";

    COUNTRIES_DATA.forEach((country, index) => {
        let isUnlocked = (index === 0) || (gameState.lifetimeEarnings >= country.req); // Simplified unlock logic
        // Or better: check if previous country was completed? 
        // For now, let's say you can travel to any unlocked country.
        // But wait, `gameState.currentCountryIndex` tracks where we are.
        // Maybe we only unlock the NEXT one?
        // Let's stick to: You can replay previous levels, and unlock next if requirements met.

        // Actually, the requirement `req` is usually "Money needed to travel TO this country".
        // So if you have enough lifetime earnings, you can go there?
        // Let's assume sequential unlocking for now.
        // If index <= gameState.highestCountryIndex? We don't track highest.
        // Let's use the `req` check against `lifetimeEarnings` of the *current* run? No, that's for "Travel".
        // In the menu, we are "between runs".
        // Let's assume all countries up to `currentCountryIndex + 1` are visible/unlocked?
        // But `currentCountryIndex` is reset on travel? No, it's persistent.

        // Let's simplify: You can start a run in any country you have reached.
        // But we need to track "Max Country Reached".
        // Let's add `maxCountryReached` to gameState in game.js later if needed.
        // For now, let's assume you can only play the current country or previous ones?
        // Or just the current one?
        // The prompt said "Choose their next country".
        // Let's assume you can select any country up to `currentCountryIndex`.

        let isLocked = index > gameState.currentCountryIndex;
        let isCurrent = index === gameState.currentCountryIndex;

        let card = document.createElement('div');
        card.className = `country-card ${isLocked ? 'locked' : ''}`;
        if (!isLocked) {
            card.onclick = () => startGame(index);
        }

        let badge = isCurrent ? `<div class="current-badge">ACTUEL</div>` : "";

        card.innerHTML = `
            ${badge}
            <div class="country-flag">${country.flag}</div>
            <div class="country-name">${country.name}</div>
            <div class="country-stats">
                Revenus x${country.incomeMult} | Risque x${country.riskMult}
            </div>
            <div class="country-desc">
                Coût Bâtiments x${country.costMult}
            </div>
            ${isLocked ? `<div class="country-req">Verrouillé</div>` : ""}
        `;
        container.appendChild(card);
    });
}

function renderBlackMarketInMenu() {
    let list = document.getElementById('menu-black-market-list');
    list.innerHTML = "";

    // Categorize
    let categories = {
        'defense': '🛡️ Défense',
        'income': '💸 Revenus',
        'utility': '⚙️ Utilitaires'
    };

    for (let catKey in categories) {
        let col = document.createElement('div');
        col.className = 'bm-column'; // Reuse style
        col.style.marginBottom = "15px";

        let catHeader = document.createElement('h3');
        catHeader.className = 'bm-col-header';
        catHeader.innerText = categories[catKey];
        col.appendChild(catHeader);

        let grid = document.createElement('div');
        grid.className = 'bm-col-grid';

        BLACK_MARKET_DATA.filter(u => u.category === catKey).forEach(upg => {
            let currentLevel = gameState.blackMarketUpgrades[upg.id] || 0;
            let isMaxed = upg.max && currentLevel >= upg.max;
            let canAfford = gameState.prestige.currency >= upg.cost;

            let item = document.createElement('div');
            item.className = 'bm-item compact';
            if (!canAfford && !isMaxed) item.classList.add('disabled');
            if (isMaxed) item.classList.add('maxed');

            item.onclick = () => {
                if (!isMaxed && canAfford) buyBlackMarketUpgrade(upg.id);
            };

            let costText = isMaxed ? "MAX" : `${upg.cost} Infl.`;
            let maxDisplay = upg.max > 10 ? upg.max : upg.max;
            let progressPct = (currentLevel / maxDisplay) * 100;

            item.innerHTML = `
                <div class="bm-row-top">
                    <div class="bm-icon-small">${upg.icon}</div>
                    <div class="bm-info-small">
                        <div class="bm-name-small">${upg.name}</div>
                        <div class="bm-cost-small">${costText}</div>
                    </div>
                </div>
                <div class="bm-progress-bg small">
                    <div class="bm-progress-fill" style="width: ${progressPct}%"></div>
                </div>
                <div class="bm-lvl-small">${currentLevel}/${upg.max}</div>
                <div class="bm-tooltip">
                    <strong>${upg.name}</strong><br>
                    ${upg.desc}<br>
                    <span style="color: #ce93d8">Coût: ${costText}</span>
                </div>
            `;
            grid.appendChild(item);
        });
        col.appendChild(grid);
        list.appendChild(col);
    }

    // Sovereignty Button in Menu?
    // Maybe add it at the bottom of the list or separate panel.
    // For now, let's keep it simple.
}

function formatTime(seconds) {
    if (!seconds || seconds === Infinity) return "∞";
    if (seconds < 60) return Math.ceil(seconds) + "s";
    if (seconds < 3600) return Math.ceil(seconds / 60) + "m";
    return Math.ceil(seconds / 3600) + "h";
}
