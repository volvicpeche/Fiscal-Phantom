// --- UI FUNCTIONS ---

function initGameUI() {
    document.getElementById('research-tab-btn').style.display = 'none';
    document.getElementById('research-list').innerHTML = "";
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
    strikeEl.style.color = gameState.strikes >= 4 ? '#f44336' : (gameState.strikes >= 2 ? '#ff9800' : 'inherit');

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
    let prestigeBtn = document.getElementById('prestige-upgrade');
    if (gameState.lifetimeEarnings >= 1000000000) {
        prestigeBtn.style.display = 'flex';
        let potentialPoints = Math.floor(gameState.lifetimeEarnings / 1000000000);
        let gain = potentialPoints - gameState.prestige.currency;
        if (gain > 0) {
            document.getElementById('prestige-gain').innerText = `Gain: ${gain} Influence (+${gain * 10}%)`;
            prestigeBtn.classList.remove('disabled');
        } else {
            document.getElementById('prestige-gain').innerText = `Pas assez de gains pour plus d'Influence`;
            prestigeBtn.classList.add('disabled');
        }
    } else {
        prestigeBtn.style.display = 'none';
    }

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

function formatTime(seconds) {
    if (!seconds || seconds === Infinity) return "∞";
    if (seconds < 60) return Math.ceil(seconds) + "s";
    if (seconds < 3600) return Math.ceil(seconds / 60) + "m";
    return Math.ceil(seconds / 3600) + "h";
}
