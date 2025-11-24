// --- CONFIGURATION & DATA ---
const GAME_CONFIG = {
    baseRiskMultiplier: 0.08, // Increased from 0.05
    baseRiskReductionPerClick: 1.0,
    auditPenalty: 0.50, // Increased from 0.30
    costGrowth: 1.25, // Increased from 1.15
    eventChance: 0.005,
    diminishingReturnsFactor: 200,
    bribeRiskReduction: 15,
    maxStrikes: 3 // Reduced from 5
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
    { id: 'res_skill_1', name: "Opération 'Écran de Fumée'", cost: 75000, multiplier: 1, icon: "⚡", desc: "Débloque: Campagne de Désinformation.", unlocksSkill: 'disinfo' },
    { id: 'res_2', name: "Réseau VPN Quantique", cost: 250000, multiplier: 5, icon: "🌐", desc: "Clics x5 plus efficaces." },
    // UNLOCK SKILL 2
    { id: 'res_skill_2', name: "Le 'Nettoyeur'", cost: 1000000, multiplier: 1, icon: "⚡", desc: "Débloque: Incendie 'Accidentel'.", unlocksSkill: 'fire' },
    { id: 'res_3', name: "Algorithme de 'Lavage'", cost: 5000000, multiplier: 10, icon: "🧼", desc: "Clics x10 plus efficaces." },
    // UNLOCK SKILL 3
    { id: 'res_skill_3', name: "Plan 'Sacrifice'", cost: 25000000, multiplier: 1, icon: "⚡", desc: "Débloque: Bouc Émissaire.", unlocksSkill: 'scapegoat' },
    { id: 'res_4', name: "IA de Corruption", cost: 100000000, multiplier: 20, icon: "🤖", desc: "Clics x20 plus efficaces." }
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

const BLACK_MARKET_DATA = [
    // DEFENSE
    { id: 'lobbying', category: 'defense', name: "Lobbying Intensif", desc: "Réduit le risque de base de 10%.", cost: 5, icon: "🤝", max: 5 },
    { id: 'nepotism', category: 'defense', name: "Népotisme", desc: "Conservez vos avocats après reset.", cost: 15, icon: "👨‍⚖️", max: 1 },
    { id: 'lawyer_friend', category: 'defense', name: "Ami du Juge", desc: "Les avocats sont 10% moins chers.", cost: 10, icon: "⚖️", max: 5 },

    // INCOME
    { id: 'offshore_account', category: 'income', name: "Compte Numéroté", desc: "Conservez 10% de votre cash après reset.", cost: 10, icon: "💼", max: 5 },
    { id: 'tax_haven', category: 'income', name: "Paradis Fiscal", desc: "+10% de revenus passifs.", cost: 8, icon: "🏝️", max: 10 },
    { id: 'shell_corp', category: 'income', name: "Sociétés Écrans", desc: "Les bâtiments coûtent 5% moins cher.", cost: 12, icon: "🏢", max: 5 },

    // UTILITY
    { id: 'botnet', category: 'utility', name: "Botnet Russe", desc: "Auto-clic 5 fois par seconde.", cost: 25, icon: "🤖", max: 1 },
    { id: 'marketing', category: 'utility', name: "Propagande", desc: "Influence gagnée +10% lors du Prestige.", cost: 20, icon: "📢", max: 5 }
];

const SYNDICATE_DATA = [
    {
        id: 'manager_risk',
        name: "Le Nettoyeur",
        desc: "Utilise 'Blanchir & Cacher' (Risque > 50%).",
        baseCost: 50000,
        icon: "🧹",
        type: "auto_risk",
        maxLevel: 10,
        // Interval in ticks (10 ticks = 1 sec). Level 1 = 5s, Level 10 = 0.5s
        getInterval: (level) => Math.max(5, 50 - (level * 4.5))
    },
    {
        id: 'manager_lawyer',
        name: "Le Conseiller",
        desc: "Engage des avocats.",
        baseCost: 250000,
        icon: "👔",
        type: "auto_lawyer",
        maxLevel: 5,
        getInterval: (level) => Math.max(10, 100 - (level * 15))
    },
    {
        id: 'manager_skills',
        name: "Le Stratège",
        desc: "Active les compétences (Risque > 80%).",
        baseCost: 1000000,
        icon: "🧠",
        type: "auto_skill",
        maxLevel: 5,
        getInterval: (level) => Math.max(10, 60 - (level * 10))
    },
    {
        id: 'manager_bribe',
        name: "Le Négociateur",
        desc: "Paye les pots-de-vin (Risque > 90%).",
        baseCost: 5000000,
        icon: "💼",
        type: "auto_bribe",
        maxLevel: 3,
        getInterval: (level) => Math.max(10, 100 - (level * 25))
    }
];
