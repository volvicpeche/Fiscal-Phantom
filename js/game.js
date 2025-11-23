let gameState;
let gameLoopInterval;
let autoSaveInterval;

function initGame() {
    gameState = {
        money: 15,
        risk: 0,
        defense: 1.0,
        clickPower: 1,
        strikes: 0,
        researchUnlocked: false,
        researchesOwned: [],
        achievements: [], // Array of IDs
        lifetimeEarnings: 0,
        prestige: {
            currency: 0, // Influence Points
            multiplier: 0.10 // 10% per point
        },
        // Cooldowns actuels des skills (0 = prêt)
        skillCooldowns: {
            disinfo: 0,
            fire: 0,
            scapegoat: 0
        },
        buildings: [
            { id: 0, name: "Stand de Limonade", baseCost: 4, income: 1, count: 0, icon: "🍋" },
            { id: 1, name: "Laverie Auto", baseCost: 60, income: 4, count: 0, icon: "🧺" },
            { id: 2, name: "Restaurant Cash-Only", baseCost: 720, income: 44, count: 0, icon: "🍕" },
            { id: 3, name: "Société Écran", baseCost: 8640, income: 480, count: 0, icon: "🏢" },
            { id: 4, name: "Mine de Crypto", baseCost: 103680, income: 5200, count: 0, icon: "💻" },
            { id: 5, name: "Banque Offshore", baseCost: 1200000, income: 58000, count: 0, icon: "🏦" },
            { id: 6, name: "Casino", baseCost: 15000000, income: 600000, count: 0, icon: "🎰" },
            { id: 7, name: "Parti Politique", baseCost: 200000000, income: 8000000, count: 0, icon: "🗳️" },
            { id: 8, name: "Agence Spatiale", baseCost: 5000000000, income: 150000000, count: 0, icon: "🚀" }
        ],
        lawyerCost: 500,
        lawyerLevel: 0,
        isGameOver: false
    };

    // Reset Skill Unlocks
    Object.keys(SKILLS_DATA).forEach(key => SKILLS_DATA[key].unlocked = false);

    // Load Save
    loadGame();

    // Initialize UI
    initGameUI();
}

// --- CORE LOOP ---
function startGameLoop() {
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(() => {
        if (!gameState.isGameOver) gameTick();
    }, 100);

    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
        if (!gameState.isGameOver) saveGame();
    }, 30000);
}

function gameTick() {
    let incomePerSec = calculateTotalIncome();
    let incomePerTick = incomePerSec / 10;

    // 1. Ajout Argent
    gameState.money += incomePerTick;
    gameState.lifetimeEarnings += incomePerTick;

    // Passive Income Feedback
    if (!gameState.passiveAccumulator) gameState.passiveAccumulator = 0;
    gameState.passiveAccumulator += incomePerTick;

    if (!gameState.passiveTimer) gameState.passiveTimer = 0;
    gameState.passiveTimer++;

    if (gameState.passiveTimer >= 10) {
        if (gameState.passiveAccumulator > 0) {
            let moneyDisplay = document.getElementById('totalMoney');
            if (moneyDisplay) {
                let rect = moneyDisplay.getBoundingClientRect();
                // Randomize slightly
                let x = rect.left + 20 + (Math.random() * 50);
                let y = rect.top + 20;
                createFloatingText(x, y, `+${formatMoney(gameState.passiveAccumulator)}$`);
            }
        }
        gameState.passiveAccumulator = 0;
        gameState.passiveTimer = 0;
    }

    // 2. Montée du Risque Passive
    if (incomePerSec > 0) {
        let riskIncrease = (Math.log10(incomePerSec + 1) * GAME_CONFIG.baseRiskMultiplier) / gameState.defense;
        gameState.risk += riskIncrease;
    }

    // 3. Update Cooldowns
    updateCooldowns(0.1);

    // 4. Random Events
    handleRandomEvents();

    // 5. Check Unlock Research
    if (!gameState.researchUnlocked && gameState.buildings[3].count > 0) {
        unlockResearchTab();
    }

    // 6. Check Achievements
    checkAchievements();

    // 7. Clamp & Audit Check
    if (gameState.risk < 0) gameState.risk = 0;
    if (gameState.risk >= 100) triggerAudit();

    // 8. Update UI
    updateUI();
}

// --- LOGIC ---

function saveGame() {
    gameState.lastSaveTime = Date.now();
    localStorage.setItem('fiscalPhantomSave', JSON.stringify(gameState));
}

function loadGame() {
    let save = localStorage.getItem('fiscalPhantomSave');
    if (save) {
        try {
            let saved = JSON.parse(save);

            // Restore primitive values
            if (saved.money !== undefined) gameState.money = saved.money;
            if (saved.risk !== undefined) gameState.risk = saved.risk;
            if (saved.defense !== undefined) gameState.defense = saved.defense;
            if (saved.clickPower !== undefined) gameState.clickPower = saved.clickPower;
            if (saved.strikes !== undefined) gameState.strikes = saved.strikes;
            if (saved.researchUnlocked !== undefined) gameState.researchUnlocked = saved.researchUnlocked;
            if (saved.lawyerCost !== undefined) gameState.lawyerCost = saved.lawyerCost;
            if (saved.lawyerLevel !== undefined) gameState.lawyerLevel = saved.lawyerLevel;
            if (saved.lifetimeEarnings !== undefined) gameState.lifetimeEarnings = saved.lifetimeEarnings;

            // Restore Prestige
            if (saved.prestige) {
                gameState.prestige = saved.prestige;
            }

            // Restore Arrays/Objects
            if (saved.researchesOwned) gameState.researchesOwned = saved.researchesOwned;
            if (saved.skillCooldowns) gameState.skillCooldowns = saved.skillCooldowns;
            if (saved.achievements) gameState.achievements = saved.achievements;

            // Restore Buildings
            if (saved.buildings) {
                saved.buildings.forEach(sb => {
                    let b = gameState.buildings.find(x => x.id === sb.id);
                    if (b) b.count = sb.count;
                });
            }

            // Re-apply Unlocks
            gameState.researchesOwned.forEach(id => {
                let res = RESEARCH_DATA.find(r => r.id === id);
                if (res && res.unlocksSkill) {
                    SKILLS_DATA[res.unlocksSkill].unlocked = true;
                }
            });

            // Offline Progress
            if (saved.lastSaveTime) {
                let now = Date.now();
                let secondsOffline = (now - saved.lastSaveTime) / 1000;
                if (secondsOffline > 60) {
                    let income = calculateTotalIncome();
                    let earned = income * secondsOffline * 0.5; // 50% efficiency
                    if (earned > 0) {
                        gameState.money += earned;
                        gameState.lifetimeEarnings += earned;
                        setTimeout(() => {
                            showEventToast({
                                title: "Revenus Occultes",
                                desc: `Pendant votre absence: +${formatMoney(earned)}$`,
                                type: "good"
                            });
                        }, 1000);
                    }
                }
            }

        } catch (e) {
            console.error("Save Error", e);
        }
    }
}

function checkAchievements() {
    ACHIEVEMENTS_DATA.forEach(ach => {
        if (!gameState.achievements.includes(ach.id)) {
            if (ach.condition(gameState)) {
                gameState.achievements.push(ach.id);
                showEventToast({
                    title: "Succès Débloqué !",
                    desc: `${ach.icon} ${ach.name}`,
                    type: "tech" // Use tech color for achievements
                });
                saveGame();
            }
        }
    });
}

function updateCooldowns(deltaTime) {
    for (let key in gameState.skillCooldowns) {
        if (gameState.skillCooldowns[key] > 0) {
            gameState.skillCooldowns[key] -= deltaTime;
            if (gameState.skillCooldowns[key] < 0) gameState.skillCooldowns[key] = 0;
        }
    }
}

function unlockResearchTab() {
    gameState.researchUnlocked = true;
    document.getElementById('research-tab-btn').style.display = 'block';
    showEventToast({ title: "Département R&D", desc: "Nouvelle technologie débloquée !", type: "tech" });
    initResearchList();
}

function calculateTotalIncome() {
    let baseIncome = gameState.buildings.reduce((acc, b) => acc + (b.income * b.count), 0);
    let prestigeMult = 1 + (gameState.prestige.currency * gameState.prestige.multiplier);
    return baseIncome * prestigeMult;
}

function calculateBribeCost() {
    let incomeBased = calculateTotalIncome() * 30;
    return Math.max(500, Math.floor(incomeBased));
}

function getBuildingCost(building) {
    return Math.floor(building.baseCost * Math.pow(GAME_CONFIG.costGrowth, building.count));
}

function getClickRiskReduction() {
    let income = calculateTotalIncome();
    let efficiency = GAME_CONFIG.baseRiskReductionPerClick / (1 + (income / GAME_CONFIG.diminishingReturnsFactor));
    return Math.max(efficiency, 0.01) * gameState.clickPower;
}

function clickShredder(e) {
    if (gameState.isGameOver) return;

    let baseClickGain = 1 + (calculateTotalIncome() * 0.01);
    let finalClickGain = baseClickGain * gameState.clickPower;

    gameState.money += finalClickGain;
    gameState.lifetimeEarnings += finalClickGain;

    let reduction = getClickRiskReduction();
    gameState.risk -= reduction;
    if (gameState.risk < 0) gameState.risk = 0;

    createFloatingText(e.clientX, e.clientY, `+$${formatMoney(finalClickGain)}`);

    let btn = document.getElementById('shredderBtn');
    btn.style.transform = "scale(0.95)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);

    updateUI();
}

function useSkill(skillKey) {
    if (gameState.isGameOver) return;

    let skill = SKILLS_DATA[skillKey];
    if (!skill.unlocked) return;
    if (gameState.skillCooldowns[skillKey] > 0) return; // On cooldown

    // Activate Effect
    gameState.risk -= skill.riskReduction;
    if (gameState.risk < 0) gameState.risk = 0;

    // Set Cooldown
    gameState.skillCooldowns[skillKey] = skill.cooldown;

    // Feedback
    showEventToast({
        title: skill.name,
        desc: `Risque réduit de ${skill.riskReduction}%`,
        type: "tech"
    });
    updateUI();
}

function buyBuilding(index) {
    if (gameState.isGameOver) return;
    let b = gameState.buildings[index];
    let cost = getBuildingCost(b);
    if (gameState.money >= cost) {
        gameState.money -= cost;
        b.count++;
        updateUI();
        saveGame();
    }
}

function buyResearch(index) {
    if (gameState.isGameOver) return;
    let res = RESEARCH_DATA[index];
    if (gameState.researchesOwned.includes(res.id)) return;

    if (gameState.money >= res.cost) {
        gameState.money -= res.cost;
        gameState.researchesOwned.push(res.id);
        gameState.clickPower *= res.multiplier;

        // Check Unlock Skill
        if (res.unlocksSkill) {
            SKILLS_DATA[res.unlocksSkill].unlocked = true;
            initSkillButtons();
            showEventToast({ title: "Compétence Débloquée", desc: SKILLS_DATA[res.unlocksSkill].name, type: "tech" });
        }

        initResearchList();
        updateUI();
        saveGame();
    }
}

function buyLawyer() {
    if (gameState.isGameOver) return;
    if (gameState.money >= gameState.lawyerCost) {
        gameState.money -= gameState.lawyerCost;
        gameState.lawyerLevel++;
        gameState.defense += 0.5;
        gameState.lawyerCost = Math.floor(gameState.lawyerCost * 2.5);
        updateUI();
        saveGame();
    }
}

function payBribe() {
    if (gameState.isGameOver) return;
    let cost = calculateBribeCost();
    if (gameState.money >= cost) {
        gameState.money -= cost;
        gameState.risk -= GAME_CONFIG.bribeRiskReduction;
        if (gameState.risk < 0) gameState.risk = 0;

        showEventToast({
            title: "Inspecteur Corrompu",
            desc: "Risque réduit de 15%. C'est beau la loyauté.",
            type: "bribe"
        });
        updateUI();
    }
}

function handleRandomEvents() {
    if (gameState.risk >= 100) return;
    if (calculateTotalIncome() < 10) return;

    if (Math.random() < GAME_CONFIG.eventChance) {
        let event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        gameState.risk += event.riskDelta;
        if (gameState.risk < 0) gameState.risk = 0;

        if (event.moneyFactor) {
            let amount = gameState.money * event.moneyFactor;
            gameState.money += amount;
        }

        showEventToast(event);
    }
}

function triggerAudit() {
    gameState.risk = 0;
    gameState.strikes++;
    updateUI();

    if (gameState.strikes >= GAME_CONFIG.maxStrikes) {
        gameOver();
    } else {
        let penalty = gameState.money * GAME_CONFIG.auditPenalty;
        gameState.money -= penalty;
        document.getElementById('auditModal').style.display = 'flex';
    }
}

function gameOver() {
    gameState.isGameOver = true;
    document.getElementById('gameOverModal').style.display = 'flex';
    localStorage.removeItem('fiscalPhantomSave');
}

function restartGame() {
    document.getElementById('gameOverModal').style.display = 'none';
    initGame();
}

function prestigeGame() {
    let threshold = 1000000000; // 1 Billion
    if (gameState.lifetimeEarnings < threshold) return;

    let earnedPoints = Math.floor(gameState.lifetimeEarnings / threshold);
    let currentPoints = gameState.prestige.currency;

    if (earnedPoints <= currentPoints) return;

    let newPoints = earnedPoints - currentPoints;
    let pointsToGain = Math.floor(gameState.lifetimeEarnings / threshold);

    if (confirm(`Voulez-vous fuir en "Exil Fiscal" ?\nVous perdrez tout votre argent, bâtiments et recherches.\nVous gagnerez ${pointsToGain} points d'Influence (+${pointsToGain * 10}% bonus de revenus).`)) {
        // Reset Game
        gameState.money = 15;
        gameState.risk = 0;
        gameState.buildings.forEach(b => b.count = 0);
        gameState.researchesOwned = [];
        gameState.researchUnlocked = false;
        gameState.clickPower = 1;
        gameState.strikes = 0;
        gameState.defense = 1.0;
        gameState.lawyerLevel = 0;
        gameState.lawyerCost = 500;
        gameState.skillCooldowns = { disinfo: 0, fire: 0, scapegoat: 0 };

        // Reset Run Earnings
        gameState.lifetimeEarnings = 0;

        // Add Prestige
        gameState.prestige.currency += pointsToGain;

        saveGame();
        initGameUI(); // Reset UI
        showEventToast({ title: "Exil Fiscal Réussi", desc: "Vous repartez de zéro, mais avec des amis haut placés.", type: "good" });
    }
}

// INIT
window.onload = function () {
    initGame();
    startGameLoop();
    document.getElementById('shredderBtn').addEventListener('mousedown', clickShredder);
};
