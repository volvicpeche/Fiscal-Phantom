// --- CONFIGURATION & DATA ---
const GAME_CONFIG = {
    baseRiskMultiplier: 0.05,
    baseRiskReductionPerClick: 1.0,
    auditPenalty: 0.30,
    costGrowth: 1.15,
    eventChance: 0.005,
    diminishingReturnsFactor: 200,
    bribeRiskReduction: 15,
    maxStrikes: 5
};

// Skills Actifs (Définitions)
const SKILLS_DATA = {
    disinfo: { name: "Campagne de Désinformation", riskReduction: 10, cooldown: 60, icon: "📰", unlocked: false },
    fire: { name: "Incendie 'Accidentel'", riskReduction: 20, cooldown: 120, icon: "🔥", unlocked: false },
    scapegoat: { name: "Bouc Émissaire", riskReduction: 35, cooldown: 300, icon: "🐐", unlocked: false }
};

const RESEARCH_DATA = [
    { id: 'res_1', name: "Déchiqueteuse Industrielle", cost: 15000, multiplier: 2, icon: "🏭", desc: "Clics x2 plus efficaces." },
    // UNLOCK SKILL 1
    { id: 'res_skill_1', name: "Opération 'Écran de Fumée'", cost: 50000, multiplier: 1, icon: "⚡", desc: "Débloque: Campagne de Désinformation.", unlocksSkill: 'disinfo' },
    { id: 'res_2', name: "Réseau VPN Quantique", cost: 150000, multiplier: 5, icon: "🌐", desc: "Clics x5 plus efficaces." },
    // UNLOCK SKILL 2
    { id: 'res_skill_2', name: "Le 'Nettoyeur'", cost: 500000, multiplier: 1, icon: "⚡", desc: "Débloque: Incendie 'Accidentel'.", unlocksSkill: 'fire' },
    { id: 'res_3', name: "Algorithme de 'Lavage'", cost: 1500000, multiplier: 10, icon: "🧼", desc: "Clics x10 plus efficaces." },
    // UNLOCK SKILL 3
    { id: 'res_skill_3', name: "Plan 'Sacrifice'", cost: 10000000, multiplier: 1, icon: "⚡", desc: "Débloque: Bouc Émissaire.", unlocksSkill: 'scapegoat' },
    { id: 'res_4', name: "IA de Corruption", cost: 25000000, multiplier: 20, icon: "🤖", desc: "Clics x20 plus efficaces." }
];

const RANDOM_EVENTS = [
    { title: "Enquête Journalistique", desc: "Un journaliste fouine trop. Risque +10%", riskDelta: 10, type: "bad" },
    { title: "Fuite de Données", desc: "Un stagiaire a perdu une clé USB. Risque +15%", riskDelta: 15, type: "bad" },
    { title: "Panama Papers", desc: "Vos comptes sont exposés ! Risque +30%", riskDelta: 30, type: "bad" },
    { title: "Lanceur d'Alerte", desc: "Un employé parle trop... Risque +12%", riskDelta: 12, type: "bad" },
    { title: "Pot-de-vin réussi", desc: "Le maire regarde ailleurs. Risque -10%", riskDelta: -10, type: "good" },
    { title: "Faille Juridique", desc: "Votre avocat a trouvé un vide juridique. Risque -5%", riskDelta: -5, type: "good" },
    { title: "Dossier Perdu", desc: "L'administration a perdu votre dossier. Risque -8%", riskDelta: -8, type: "good" },
    { title: "Krach Crypto", desc: "Le marché s'effondre. Vous perdez 10% de cash.", riskDelta: 5, type: "bad", moneyFactor: -0.10 },
    { title: "Année Électorale", desc: "Les politiciens ont besoin de fonds. Risque accru.", riskDelta: 20, type: "bad" },
    { title: "Fuite Paradis Fiscal", desc: "Une liste de comptes a fuité.", riskDelta: 15, type: "bad" }
];

const ACHIEVEMENTS_DATA = [
    { id: 'first_fraud', name: "Première Fraude", desc: "Gagner 1,000 $ (Cumulé)", condition: (state) => state.lifetimeEarnings >= 1000, icon: "💸" },
    { id: 'risk_taker', name: "Tête Brûlée", desc: "Atteindre 95% de risque", condition: (state) => state.risk >= 95, icon: "🔥" },
    { id: 'safe_haven', name: "Paradis Fiscal", desc: "Acheter une Banque Offshore", condition: (state) => state.buildings[5].count > 0, icon: "🏝️" },
    { id: 'untouchable', name: "Intouchable", desc: "Avoir 5 Avocats", condition: (state) => state.lawyerLevel >= 5, icon: "⚖️" },
    { id: 'prestige_1', name: "Nouvelle Identité", desc: "Faire un Exil Fiscal", condition: (state) => state.prestige.currency > 0, icon: "✈️" },
    { id: 'crypto_king', name: "Roi de la Crypto", desc: "Posséder 10 Mines de Crypto", condition: (state) => state.buildings[4].count >= 10, icon: "₿" }
];
