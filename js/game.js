let gameState;
let gameLoopInterval;
let autoSaveInterval;

function initApp() {
    // Load Save just to get persistent data (Influence, Upgrades, etc.)
    loadGame();

    // Show Main Menu
    showMainMenu();
}

function startGame(countryIndex) {
    // Set Country
    gameState.currentCountryIndex = countryIndex;

    // Reset Run-Specific State
    gameState.money = 15;
    gameState.risk = 0;
    gameState.buildings.forEach(b => b.count = 0);
    gameState.researchesOwned = [];
    gameState.researchUnlocked = false;
    gameState.clickPower = 1;
    gameState.strikes = 0;
    gameState.isGameOver = false;

    // Apply Persistent Upgrades
    // Effect: Nepotism (Keep Lawyer Level)
    let keepLawyer = (gameState.blackMarketUpgrades['nepotism'] > 0);
    gameState.lawyerLevel = keepLawyer ? (gameState.lawyerLevel || 0) : 0;
    gameState.lawyerCost = keepLawyer ? (gameState.lawyerCost || 500) : 500;
    gameState.defense = keepLawyer ? (gameState.defense || 1.0) : 1.0;

    // Effect: Offshore Account (Keep % Money)
    let offshoreLevel = gameState.blackMarketUpgrades['offshore_account'] || 0;
    if (offshoreLevel > 0) {
        // We need to know previous run money? 
        // Actually, in this new flow, money is reset on "Travel".
        // So "Offshore Account" might need to be "Start with extra money" or "Keep % of previous run".
        // Since we don't track "previous run money" in menu easily, let's change it to:
        // "Start with +1000$ per level" or similar?
        // Or we keep it as "Keep %" but we must have saved it before returning to menu.
        // Let's assume we saved `gameState.bankedMoney` or similar?
        // For now, let's simplify: It gives starting cash bonus.
        gameState.money += 15 * (offshoreLevel * 10); // Simple bonus
    }

    gameState.skillCooldowns = { disinfo: 0, fire: 0, scapegoat: 0 };
    gameState.lifetimeEarnings = 0; // Reset for this run

    // Switch View
    document.getElementById('main-menu-view').style.display = 'none';
    document.getElementById('game-view').style.display = 'block';

    // Initialize UI
    initGameUI();

    // Start Loop
    startGameLoop();
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
        let country = COUNTRIES_DATA[gameState.currentCountryIndex];
        let baseRisk = GAME_CONFIG.baseRiskMultiplier * country.riskMult;

        // Effect: Lobbying (Reduce base risk)
        let lobbyingLevel = gameState.blackMarketUpgrades['lobbying'] || 0;
        if (lobbyingLevel > 0) {
            baseRisk *= (1 - (lobbyingLevel * 0.10));
        }

        let riskIncrease = (Math.log10(incomePerSec + 1) * baseRisk) / gameState.defense;
        gameState.risk += riskIncrease;
    }

    // Effect: Botnet (Auto-click)
    let botnetLevel = gameState.blackMarketUpgrades['botnet'] || 0;
    if (botnetLevel > 0) {
        if (!gameState.botnetTimer) gameState.botnetTimer = 0;
        gameState.botnetTimer++;
        // 5 ticks = 0.5s. We want 2 clicks/sec per level?
        // Let's say it clicks every second (10 ticks), and adds (level * 2) clicks worth of money?
        // Or simpler: It clicks once every X ticks.
        // Let's do: Every 10 ticks (1 sec), it triggers (botnetLevel * 2) clicks.
        if (gameState.botnetTimer >= 10) {
            let clicks = botnetLevel * 2;
            // We simulate one click event but multiply the gain
            clickShredder({ clientX: 0, clientY: 0 }, true, clicks);
            gameState.botnetTimer = 0;
        }
    }

    // 3. Update Cooldowns
    updateCooldowns(0.1);

    // 4. Random Events
    handleRandomEvents();

    // 5. Check Unlock Research
    if (!gameState.researchUnlocked && gameState.buildings[3].count > 0) {
        unlockResearchTab();
    }

    // 6. Syndicate Logic (Run every tick, check intervals)
    runSyndicateLogic();

    // 7. Check Achievements
    checkAchievements();

    // 8. Clamp & Audit Check
    if (gameState.risk < 0) gameState.risk = 0;
    if (gameState.risk >= 100) triggerAudit();

    // 9. Update UI
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
            if (saved.currentCountryIndex !== undefined) gameState.currentCountryIndex = saved.currentCountryIndex;

            // Restore Prestige
            if (saved.prestige) {
                gameState.prestige = saved.prestige;
            }

            // Restore Arrays/Objects
            if (saved.researchesOwned) gameState.researchesOwned = saved.researchesOwned;
            if (saved.skillCooldowns) gameState.skillCooldowns = saved.skillCooldowns;
            if (saved.achievements) gameState.achievements = saved.achievements;
            if (saved.blackMarketUpgrades) gameState.blackMarketUpgrades = saved.blackMarketUpgrades;

            // Restore Syndicate (Handle migration from Array to Object if needed)
            if (saved.syndicateManagers) {
                if (Array.isArray(saved.syndicateManagers)) {
                    // Migration: Convert Array to Object { id: 1 }
                    gameState.syndicateManagers = {};
                    saved.syndicateManagers.forEach(id => {
                        gameState.syndicateManagers[id] = 1;
                    });
                } else {
                    gameState.syndicateManagers = saved.syndicateManagers;
                }
            }

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
    let country = COUNTRIES_DATA[gameState.currentCountryIndex];
    let baseIncome = gameState.buildings.reduce((acc, b) => acc + (b.income * b.count), 0);
    let prestigeMult = 1 + (gameState.prestige.currency * gameState.prestige.multiplier);

    // Country Multiplier
    baseIncome *= country.incomeMult;

    // Effect: Tax Haven (Passive Income Bonus)
    let taxHavenLevel = gameState.blackMarketUpgrades['tax_haven'] || 0;
    if (taxHavenLevel > 0) {
        prestigeMult *= (1 + (taxHavenLevel * 0.10));
    }

    return baseIncome * prestigeMult;
}

function calculateBribeCost() {
    let incomeBased = calculateTotalIncome() * 30;
    return Math.max(500, Math.floor(incomeBased));
}

function getBuildingCost(building) {
    let country = COUNTRIES_DATA[gameState.currentCountryIndex];
    let cost = Math.floor(building.baseCost * Math.pow(GAME_CONFIG.costGrowth, building.count));

    // Country Multiplier
    cost *= country.costMult;

    // Effect: Shell Corp (Building Cost Reduction)
    let shellLevel = gameState.blackMarketUpgrades['shell_corp'] || 0;
    if (shellLevel > 0) {
        cost *= (1 - (shellLevel * 0.05));
    }

    return Math.floor(cost);
}

function getClickRiskReduction() {
    let income = calculateTotalIncome();
    let efficiency = GAME_CONFIG.baseRiskReductionPerClick / (1 + (income / GAME_CONFIG.diminishingReturnsFactor));
    return Math.max(efficiency, 0.01) * gameState.clickPower;
}

function clickShredder(e, silent = false, multiplier = 1) {
    if (gameState.isGameOver) return;

    let baseClickGain = 1 + (calculateTotalIncome() * 0.01);
    let finalClickGain = baseClickGain * gameState.clickPower * multiplier;

    gameState.money += finalClickGain;
    gameState.lifetimeEarnings += finalClickGain;

    let reduction = getClickRiskReduction();
    gameState.risk -= reduction;
    if (gameState.risk < 0) gameState.risk = 0;

    if (!silent) {
        createFloatingText(e.clientX, e.clientY, `+$${formatMoney(finalClickGain)}`);
        let btn = document.getElementById('shredderBtn');
        if (btn) {
            btn.style.transform = "scale(0.95)";
            setTimeout(() => btn.style.transform = "scale(1)", 100);
        }
    }

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

    // Effect: Lawyer Friend (Cheaper Lawyers)
    let discount = 0;
    let friendLevel = gameState.blackMarketUpgrades['lawyer_friend'] || 0;
    if (friendLevel > 0) discount = friendLevel * 0.10;

    let finalCost = gameState.lawyerCost * (1 - discount);

    if (gameState.money >= finalCost) {
        gameState.money -= finalCost;
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

function hireManager(managerId) {
    if (gameState.isGameOver) return;

    let manager = SYNDICATE_DATA.find(m => m.id === managerId);
    if (!manager) return;

    let currentLevel = gameState.syndicateManagers[managerId] || 0;
    if (!gameState.syndicateTickers[id]) gameState.syndicateTickers[id] = 0;

    gameState.syndicateTickers[id]++;

    let interval = manager.getInterval(level);

    if (gameState.syndicateTickers[id] >= interval) {
        // Trigger Action
        let actionSuccess = false;

        if (manager.type === 'auto_risk') {
            if (gameState.risk > 50) {
                clickShredder({ clientX: 0, clientY: 0 }, true);
                actionSuccess = true;
            }
        } else if (manager.type === 'auto_lawyer') {
            let discount = 0;
            let friendLevel = gameState.blackMarketUpgrades['lawyer_friend'] || 0;
            if (friendLevel > 0) discount = friendLevel * 0.10;
            let finalCost = gameState.lawyerCost * (1 - discount);

            if (gameState.money >= finalCost) {
                buyLawyer();
                actionSuccess = true;
            }
        } else if (manager.type === 'auto_skill') {
            if (gameState.risk > 80) {
                for (let key in SKILLS_DATA) {
                    if (SKILLS_DATA[key].unlocked && gameState.skillCooldowns[key] <= 0) {
                        useSkill(key);
                        actionSuccess = true;
                        break;
                    }
                }
            }
        } else if (manager.type === 'auto_bribe') {
            if (gameState.risk > 90) {
                let cost = calculateBribeCost();
                if (gameState.money >= cost) {
                    payBribe();
                    actionSuccess = true;
                }
            }
        }

        // Reset ticker only if action attempted (or always? Let's say always to keep rhythm)
        gameState.syndicateTickers[id] = 0;
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

function returnToMenu() {
    document.getElementById('gameOverModal').style.display = 'none';
    document.getElementById('victoryModal').style.display = 'none';

    // Stop Loop
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    if (autoSaveInterval) clearInterval(autoSaveInterval);

    // Show Menu
    document.getElementById('game-view').style.display = 'none';
    document.getElementById('main-menu-view').style.display = 'flex';

    showMainMenu();
}

function travelToNextCountry() {
    let currentCountry = COUNTRIES_DATA[gameState.currentCountryIndex];
    let nextCountry = COUNTRIES_DATA[gameState.currentCountryIndex + 1];

    if (!nextCountry) return; // Max level reached (or handle differently)

    // Check Requirement
    if (gameState.lifetimeEarnings < nextCountry.req) return;

    // Calculate Prestige Points to gain (based on earnings in THIS run)
    // Formula: Sqrt(LifetimeEarnings / 1M) ? Or keep linear?
    // Let's keep the old formula for now but adapted
    let threshold = 1000000000; // 1 Billion base
    let pointsToGain = Math.floor(gameState.lifetimeEarnings / threshold);

    // Minimum 1 point if you qualify for next country?
    if (pointsToGain < 1) pointsToGain = 1;

    // Effect: Marketing (More Influence)
    let marketingLevel = gameState.blackMarketUpgrades['marketing'] || 0;
    if (marketingLevel > 0) {
        pointsToGain = Math.floor(pointsToGain * (1 + (marketingLevel * 0.10)));
    }

    if (confirm(`Prêt à fuir vers ${nextCountry.name} ?\n\nNouveau Départ:\n- Revenus x${nextCountry.incomeMult}\n- Risque x${nextCountry.riskMult}\n\nVous gardez:\n- Améliorations Marché Noir\n- Managers\n- Influence (+${pointsToGain})`)) {

        // Save Persistent Data
        let savedUpgrades = { ...gameState.blackMarketUpgrades };
        let savedManagers = { ...gameState.syndicateManagers };
        let savedAchievements = [...gameState.achievements];
        let savedPrestige = { ...gameState.prestige };
        savedPrestige.currency += pointsToGain;

        // Effect: Nepotism (Keep Lawyer Level)
        let keepLawyer = (savedUpgrades['nepotism'] > 0);
        let savedLawyerLevel = keepLawyer ? gameState.lawyerLevel : 0;
        let savedLawyerCost = keepLawyer ? gameState.lawyerCost : 500;
        let savedDefense = keepLawyer ? gameState.defense : 1.0;

        // Effect: Offshore Account (Keep % Money)
        let offshoreLevel = savedUpgrades['offshore_account'] || 0;
        let moneyKept = 0;
        if (offshoreLevel > 0) {
            moneyKept = gameState.money * (offshoreLevel * 0.10);
        }

        // Increment Country
        let nextIndex = gameState.currentCountryIndex + 1;

        // Reset Game State
        gameState.money = 15 + moneyKept;
        gameState.risk = 0;
        gameState.buildings.forEach(b => b.count = 0);
        gameState.researchesOwned = [];
        gameState.researchUnlocked = false;
        gameState.clickPower = 1;
        gameState.strikes = 0;

        // Restore Persistent
        gameState.currentCountryIndex = nextIndex;
        gameState.syndicateManagers = savedManagers;
        gameState.blackMarketUpgrades = savedUpgrades;
        gameState.achievements = savedAchievements;
        gameState.prestige = savedPrestige;

        gameState.defense = savedDefense;
        gameState.lawyerLevel = savedLawyerLevel;
        gameState.lawyerCost = savedLawyerCost;
        gameState.skillCooldowns = { disinfo: 0, fire: 0, scapegoat: 0 };
        gameState.lifetimeEarnings = 0; // Reset for new country run

        saveGame();
        returnToMenu();
        alert(`Exil Réussi ! Vous avez gagné ${pointsToGain} Influence.`);
    }
}

function buyBlackMarketUpgrade(id) {
    let upgrade = BLACK_MARKET_DATA.find(u => u.id === id);
    if (!upgrade) return;

    let currentLevel = gameState.blackMarketUpgrades[id] || 0;
    // Check max level (if max is defined)
    if (upgrade.max && currentLevel >= upgrade.max) return;

    if (gameState.prestige.currency >= upgrade.cost) {
        gameState.prestige.currency -= upgrade.cost;
        gameState.blackMarketUpgrades[id] = currentLevel + 1;

        // Update Menu UI directly
        renderBlackMarketInMenu();
        updateMenuStats();
        saveGame();
    }
}

function buySovereignty() {
    if (gameState.money >= SOVEREIGNTY_CONFIG.costMoney && gameState.prestige.currency >= SOVEREIGNTY_CONFIG.costInfluence) {
        gameState.money -= SOVEREIGNTY_CONFIG.costMoney;
        gameState.prestige.currency -= SOVEREIGNTY_CONFIG.costInfluence;
        showVictoryModal();
    }
}

// INIT
window.onload = function () {
    initApp();
    // startGameLoop is called in startGame()
    document.getElementById('shredderBtn').addEventListener('mousedown', clickShredder);
};
