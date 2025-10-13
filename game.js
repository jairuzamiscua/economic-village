/* ============================================
   ECONOVILLE - GRAND STRATEGY EDITION
   Enhanced gameplay with deeper tech tree
   ============================================ */

// ============================================
// UTILITY FUNCTIONS
// ============================================

const el = id => document.getElementById(id);

const toast = (msg, duration = 3000) => {
  const t = el('toast');
  if (!t) return;
  t.innerHTML = msg;
  t.style.display = 'block';
  setTimeout(() => (t.style.display = 'none'), duration);
};

// Sound System
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
  if (!audioCtx) return;
  
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const sounds = {
    click: { freq: 800, gain: 0.1, dur: 0.1 },
    build: { freq: 400, gain: 0.15, dur: 0.3 },
    harvest: { freq: 600, gain: 0.1, dur: 0.15, type: 'square' },
    complete: { freq: 523.25, gain: 0.2, dur: 0.4 },
    tech: { freq: 880, gain: 0.15, dur: 0.5 },
    bad: { freq: 200, gain: 0.2, dur: 0.3, type: 'sawtooth' }
  };
  
  const sound = sounds[type] || sounds.click;
  oscillator.frequency.value = sound.freq;
  oscillator.type = sound.type || 'sine';
  gainNode.gain.setValueAtTime(sound.gain, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + sound.dur);
  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + sound.dur);
}

// ============================================
// GAME STATE
// ============================================

let autoStarted = false;
let tickInterval = null;
let draggedType = null;
let isPaused = false;

const S = {
  // Time
  day: 1,
  year: 1,
  season: 0,
  seasons: ['Spring', 'Summer', 'Autumn', 'Winter'],

  // NEW: Enclosure system
  enclosedLandPct: 0.0, // Starts at 0%, gradually increases
  enclosureRate: 0.0, // Rate of enclosure per year
  landlessLaborers: 0, // Displaced peasants
  woolProduction: 0,
  
  // NEW: Trade system
  foodSurplus: 0,
  marketPrice: 1.0, // Base price multiplier
  grainSold: 0,
  tradeIncome: 0,
  
  // NEW: Urban system
  urbanPopPct: 0.05, // Starts at 5%
  urbanDemand: 1.0, // Multiplier for food prices
  
  // NEW: Labor friction
  laborSkills: {
    farmers: 0.5,
    builders: 0.3,
    herders: 0.1,
    gatherers: 0.1
  },
  laborReallocationCost: 0,

  // Feudal system
  lordTithePct: 0.40,
  churchTithePct: 0.10,
  laborDays: 0,
  freeholderPct: 0.2,
  villeinPct: 0.6,
  cottarPct: 0.2,

  // Population
  pop: 80,
  cap: 100,
  totalDeaths: 0,

  // Crop tracking
  farmCrops: {},
  lastPlantingWarning: -1,

  // Labor
  farmers: 0.5,
  builders: 0.3,
  herders: 0.1,
  gatherers: 0.1,
  workIntensity: 1.0,

  // Resources
  materials: 30,
  foodStock: 20,
  livestock: 0,

  // Economy
  health: 0.6,
  morale: 0.6,
  tfp: 1.0,
  landQuality: 1.0,
  totalLand: 100,
  realWage: 1.0,

  // Policies
  landPolicy: 'commons',
  cropType: 'wheat',

  // Weather
  weatherNow: 'sunny',
  weatherNext: 'rain',

  // Progress
  tech: {},
  builds: [],
  nodes: [],
  wageAbove13Years: 0,
  history: [],
  lastFoodProduction: 0,
  victoryProgress: 0,
  gatherJobs: [],
  nodeRegenQueue: [],
  matureFarmsCount: 0,

  milestones: {
    firstWinter: { complete: false, reward: 'materials', amount: 15 },
    population100: { complete: false, reward: 'tfp', amount: 1.1 },
    firstMill: { complete: false, reward: 'morale', amount: 0.2 },
    marketBuilt: { complete: false, reward: 'materials_income', amount: 2 },
    sustained_wage: { complete: false, reward: 'victory_progress', amount: 25 }
  }
  
};

// ============================================
// ENHANCED TECH TREE - 3 TIERS
// ============================================

const TECH_TREE = {
  // ===== TIER 1: EARLY AGRARIAN (Foundation) =====
  basicFarming: {
    name: 'Basic Farming',
    category: 'Agriculture',
    tier: 1,
    cost: 0,
    req: [],
    effect: 'Enables farm construction',
    desc: 'Cultivate crops for food production'
  },
  
  livestock: {
    name: 'Livestock Domestication',
    category: 'Agriculture',
    tier: 1,
    cost: 15,
    req: ['basicFarming'],
    effect: 'Enables livestock pens, +0.5 food/animal',
    desc: 'Domesticate animals for steady food supply'
  },
  
  threeField: {
    name: 'Three-Field Rotation',
    category: 'Agriculture',
    tier: 1,
    cost: 20,
    req: ['basicFarming'],
    effect: '+15% yield, prevent soil degradation',
    desc: 'Rotate crops to maintain soil fertility'
  },
  
  well: {
    name: 'Well & Sanitation',
    category: 'Infrastructure',
    tier: 1,
    cost: 20,
    req: [],
    effect: '+20% health, -50% disease risk',
    desc: 'Clean water reduces mortality'
  },
  
  granary: {
    name: 'Granary Storage',
    category: 'Infrastructure',
    tier: 1,
    cost: 25,
    req: ['basicFarming'],
    effect: 'Food spoilage: 25% → 10%',
    desc: 'Preserve surplus grain safely'
  },
  
  marketAccess: {
    name: 'Market Road',
    category: 'Economic',
    tier: 1,
    cost: 20,
    req: ['basicFarming'],
    effect: 'Enable surplus trade routes',
    desc: 'Connect to regional markets'
  },

  // ===== TIER 2: MIDDLE AGRARIAN (Optimization) =====
  
  heavyPlough: {
    name: 'Heavy Plough',
    category: 'Agriculture',
    tier: 2,
    cost: 30,
    req: ['livestock', 'threeField'],
    effect: '+25% farm TFP',
    desc: 'Animal-powered deep tilling increases yields'
  },
  
  manure: {
    name: 'Manure Fertilization',
    category: 'Agriculture',
    tier: 2,
    cost: 18,
    req: ['livestock'],
    effect: '+10% yield per livestock unit',
    desc: 'Enrich soil with animal waste'
  },
  
  seedSelection: {
    name: 'Seed Selection',
    category: 'Agriculture',
    tier: 2,
    cost: 22,
    req: ['threeField'],
    effect: '+10% crop yields',
    desc: 'Choose best seeds for planting'
  },
  
  irrigation: {
    name: 'Irrigation Canals',
    category: 'Infrastructure',
    tier: 2,
    cost: 35,
    req: ['well'],
    effect: 'Drought penalty: -40% → -10%',
    desc: 'Water distribution systems'
  },
  
  animalBreeding: {
    name: 'Selective Breeding',
    category: 'Agriculture',
    tier: 2,
    cost: 25,
    req: ['livestock', 'manure'],
    effect: '+50% livestock growth rate',
    desc: 'Breed stronger, more productive animals'
  },
  
  market: {
    name: 'Market Charter',
    category: 'Economic',
    tier: 2,
    cost: 30,
    req: ['marketAccess'],
    effect: 'Enables Market building, +2 materials/year',
    desc: 'Institutional framework for trade'
  },
  
  woodworking: {
    name: 'Advanced Woodworking',
    category: 'Infrastructure',
    tier: 2,
    cost: 25,
    req: ['granary'],
    effect: '-20% building material costs',
    desc: 'Efficient use of timber resources'
  },

  // ===== TIER 3: LATE AGRARIAN (Pre-Industrial) =====
  
  mill: {
    name: 'Windmill Technology',
    category: 'Infrastructure',
    tier: 3,
    cost: 40,
    req: ['heavyPlough', 'woodworking'],
    effect: '+15% TFP per mill (capital good)',
    desc: 'Mechanical grain milling'
  },
  
  charteredRights: {
    name: 'Town Charter',
    category: 'Social',
    tier: 3,
    cost: 50,
    req: ['market'],
    effect: 'Reduce lord tithe: 40% → 25%',
    desc: 'Negotiate reduced feudal obligations'
  },
  
  cropRotation: {
    name: 'Advanced Crop Rotation',
    category: 'Agriculture',
    tier: 3,
    cost: 35,
    req: ['seedSelection', 'manure'],
    effect: '+20% soil quality recovery rate',
    desc: 'Scientific approach to field management'
  },
  
  storage: {
    name: 'Bulk Storage',
    category: 'Infrastructure',
    tier: 3,
    cost: 30,
    req: ['granary', 'market'],
    effect: 'Spoilage: 10% → 5%, +20% food capacity',
    desc: 'Large-scale preservation techniques'
  },
  
  guildSystem: {
    name: 'Craft Guilds',
    category: 'Social',
    tier: 3,
    cost: 40,
    req: ['market', 'woodworking'],
    effect: '+10% TFP, +15% morale',
    desc: 'Organized skilled labor increases quality'
  },
  
  accounting: {
    name: 'Double-Entry Bookkeeping',
    category: 'Economic',
    tier: 3,
    cost: 35,
    req: ['market'],
    effect: '+1 material/year per 10 population',
    desc: 'Financial systems enable growth'
  },
  
  fertilizer: {
    name: 'Compost Science',
    category: 'Agriculture',
    tier: 3,
    cost: 30,
    req: ['manure', 'cropRotation'],
    effect: '+15% all crop yields',
    desc: 'Advanced soil enrichment techniques'
  }
};

// ============================================
// BUILDINGS
// ============================================

const BUILDS = {
  farm: { name: 'Farm', mat: 8, dur: 5, icon: 'farm' },
  house: { name: 'House', mat: 12, dur: 4, icon: 'house' },
  well: { name: 'Well', mat: 15, dur: 6, icon: 'well', reqTech: 'well' },
  granary: { name: 'Granary', mat: 20, dur: 7, icon: 'granary', reqTech: 'granary' },
  livestock: { name: 'Livestock Pen', mat: 12, dur: 5, icon: 'livestock', reqTech: 'livestock' },
  market: { name: 'Market', mat: 30, dur: 6, icon: 'market', reqTech: 'market' },
  mill: { name: 'Windmill', mat: 40, dur: 8, icon: 'mill', reqTech: 'mill' }
};

// ============================================
// CROP DATA
// ============================================

const CROP_DATA = {
  wheat: { 
    name: 'Winter Wheat',
    yield: 1.0, 
    droughtMult: 0.6, 
    soilDrain: 0.02,
    plantSeasons: [2],
    harvestSeasons: [1, 2],
    growthDays: 90,  // 1 season instead of 3
    winterHardy: true,
    baseFood: 3.0
  },
  rye: { 
    name: 'Rye',
    yield: 0.85, 
    droughtMult: 0.95,
    soilDrain: 0.015,
    plantSeasons: [2, 3],
    harvestSeasons: [1],
    growthDays: 80,  // Was 240
    winterHardy: true,
    baseFood: 2.5
  },
  legumes: { 
    name: 'Peas & Beans',
    yield: 0.75, 
    droughtMult: 0.85, 
    soilDrain: -0.015,
    plantSeasons: [0],
    harvestSeasons: [2],
    growthDays: 60,  // Was 180
    winterHardy: false,
    baseFood: 2.0
  },
  barley: {
    name: 'Spring Barley',
    yield: 0.9,
    droughtMult: 0.8,
    soilDrain: 0.018,
    plantSeasons: [0],
    harvestSeasons: [1],
    growthDays: 45,  // Was 120
    winterHardy: false,
    baseFood: 2.3
  }
};

// ============================================
// SEASON DATA
// ============================================

const SEASON_DATA = {
  0: {
    name: 'Spring',
    mult: 0.2,
    color: '#86efac',
    icon: '🌱',
    desc: 'Planting season - sow spring crops',
    skyGradient: 'radial-gradient(1400px 900px at 70% -10%, #7dd3fc 0%, #38bdf8 40%, #0284c7 100%)',
    groundGradient: 'linear-gradient(180deg, rgba(34, 197, 94, 0.4) 0%, rgba(21, 128, 61, 0.6) 100%)',
  },
  1: {
    name: 'Summer',
    mult: 0.6,
    color: '#fbbf24',
    icon: '☀️',
    desc: 'Growing season - early harvest',
    skyGradient: 'radial-gradient(1400px 900px at 70% -10%, #fef08a 0%, #fbbf24 40%, #f59e0b 100%)',
    groundGradient: 'linear-gradient(180deg, rgba(34, 197, 94, 0.5) 0%, rgba(74, 158, 37, 0.7) 100%)',
  },
  2: {
    name: 'Autumn',
    mult: 0.8,
    color: '#f97316',
    icon: '🌾',
    desc: 'HARVEST SEASON - reap crops',
    skyGradient: 'radial-gradient(1400px 900px at 70% -10%, #fb923c 0%, #ea580c 40%, #c2410c 100%)',
    groundGradient: 'linear-gradient(180deg, rgba(120, 53, 15, 0.6) 0%, rgba(69, 26, 3, 0.8) 100%)',
  },
  3: {
    name: 'Winter',
    mult: 0.05,
    color: '#93c5fd',
    icon: '❄️',
    desc: 'SURVIVAL - eat stored food',
    skyGradient: 'radial-gradient(1400px 900px at 70% -10%, #cbd5e1 0%, #94a3b8 40%, #64748b 100%)',
    groundGradient: 'linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, rgba(226, 232, 240, 0.98) 100%)',
  }
};

// ============================================
// EVENTS
// ============================================

const EVENTS = [
  {
    id: 'merchant_tools',
    title: 'Traveling Merchant',
    desc: 'A merchant offers iron tools that could improve farm productivity.',
    effect: 'Cost: 20 materials | Gain: +15% farm TFP',
    cost: 20,
    action: () => {
      if (S.materials >= 20) {
        S.materials -= 20;
        S.tfp *= 1.15;
        toast('Purchased iron tools! +15% productivity');
        return true;
      }
      toast('Not enough materials!');
      return false;
    }
  },
  {
    id: 'harsh_winter',
    title: 'Harsh Winter Forecast',
    desc: 'Scouts report a brutal winter. Slaughter livestock now or risk losses?',
    effect: 'Accept: +15 food, -3 livestock | Decline: Risk winter losses',
    action: () => {
      if (S.livestock >= 3) {
        S.foodStock += 15;
        S.livestock -= 3;
        toast('Livestock slaughtered for winter food');
        return true;
      }
      toast('Not enough livestock!');
      return false;
    }
  },
  {
    id: 'neighbor_aid',
    title: 'Neighboring Village Requests Aid',
    desc: 'A nearby village suffered crop failure. Send food aid?',
    effect: 'Accept: -15 food, +20% morale | Decline: Keep food',
    action: () => {
      if (S.foodStock >= 15) {
        S.foodStock -= 15;
        S.morale = Math.min(1, S.morale + 0.2);
        toast('Aid sent! Morale boosted by goodwill');
        return true;
      }
      toast('Not enough food to share!');
      return false;
    }
  },
  {
    id: 'festival',
    title: 'Harvest Festival',
    desc: 'Villagers want to celebrate the harvest with a festival.',
    effect: 'Cost: 10 food | Gain: +25% morale',
    action: () => {
      if (S.foodStock >= 10) {
        S.foodStock -= 10;
        S.morale = Math.min(1, S.morale + 0.25);
        toast('Festival celebrated! Community spirit restored');
        return true;
      }
      toast('Not enough food for festivities');
      return false;
    }
  }
];

// ============================================
// INITIALIZATION
// ============================================

function init() {
  console.log('EconoVille Grand Strategy Edition - Initializing...');
  
  // Start with basic farming unlocked
  S.tech.basicFarming = true;
  
  // Initialize weather
  rollWeather();
  
  // Pre-build starting infrastructure
  for (let i = 0; i < 3; i++) {
    S.builds.push({
      id: 'start_farm_' + i,
      type: 'farm',
      x: 150 + i * 80,
      y: 100,
      done: true,
      progress: BUILDS.farm.dur,
      dur: BUILDS.farm.dur
    });
  }

  // Start with crops almost ready to harvest!
  S.season = 2; // Start in Autumn (harvest season)
  for (let i = 0; i < 3; i++) {
    S.farmCrops['farm_start_farm_' + i] = {
      crop: 'wheat',
      plantedDay: 1,
      plantedSeason: 2,
      plantedYear: 1,
      mature: true,  // Already mature!
      daysGrowing: 90,
      harvested: false
    };
  }
  
  for (let i = 0; i < 2; i++) {
    S.builds.push({
      id: 'start_house_' + i,
      type: 'house',
      x: 200 + i * 80,
      y: 40,
      done: true,
      progress: BUILDS.house.dur,
      dur: BUILDS.house.dur
    });
  }
  
  // Spawn initial resources
  spawnNodes();
  
  // Setup UI
  setupEventListeners();
  setupCollapsibleSections();
  setupTabs();
  renderBuildPalette();
  renderTechTree();
  updateUI();
  
  // Auto-start on interaction
  document.addEventListener('click', autoStart, { once: true });
  document.addEventListener('input', autoStart, { once: true });
  
  toast('Grand strategy awaits. Make your decisions wisely.', 4000);
}

function autoStart() {
  if (!autoStarted) {
    autoStarted = true;
    startTick();
    toast('Time flows. The age begins.', 3000);
  }
}

// ============================================
// COLLAPSIBLE SECTIONS
// ============================================

function setupCollapsibleSections() {
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.getAttribute('data-section');
      const content = document.getElementById(section + '-content');
      const toggle = header.querySelector('.section-toggle');
      
      if (content) {
        const isExpanded = content.classList.contains('expanded');
        content.classList.toggle('expanded');
        toggle.textContent = isExpanded ? '▼' : '▶';
        header.setAttribute('data-expanded', !isExpanded);
      }
    });
  });
}

// ============================================
// TABS
// ============================================

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      
      // Remove active from all tabs
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      
      // Activate clicked tab
      tab.classList.add('active');
      document.getElementById(tabName + '-tab').classList.add('active');
      
      playSound('click');
    });
  });
}

// ============================================
// GAME LOOP
// ============================================

function startTick() {
  const speedSel = el('speedSelect');
  const speed = speedSel ? parseInt(speedSel.value) : 2000;
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(tick, speed);
}

function tick() {
  if (isPaused) return;

  // Construction progress
  const builderPop = Math.floor(S.pop * S.builders);
  S.builds.forEach(b => {
    if (!b.done) {
      b.progress += builderPop * 0.02 * S.workIntensity;
      if (b.progress >= b.dur) {
        b.done = true;
        onBuildComplete(b);
      }
    }
  });

  // Resource regeneration
  if (S.day === 1) {
    for (let i = S.nodeRegenQueue.length - 1; i >= 0; i--) {
      const regen = S.nodeRegenQueue[i];
      if (S.year >= regen.regenTime) {
        S.nodes.push({
          id: regen.id + '_regen_' + S.year,
          type: regen.type,
          x: regen.x,
          y: regen.y,
          hp: regen.type === 'tree' ? 3 : 2
        });
        S.nodeRegenQueue.splice(i, 1);
        toast(`A ${regen.type} has regrown`);
      }
    }
  }

  // Check milestones
  checkMilestones();

  // Get allocations
  const farmerPop = Math.floor(S.pop * S.farmers);
  const herderPop = Math.floor(S.pop * S.herders);
  const gathererPop = Math.floor(S.pop * S.gatherers);
  
  // Get buildings
  const farms = S.builds.filter(b => b.type === 'farm' && b.done);
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;

  // Auto-send farmers to crops every few ticks
  if (S.day % 5 === 0) {
    autoSendFarmersToCrops();
  }
  
  // Auto-send builders to construction
  if (S.day % 3 === 0 && Math.random() < 0.3) {
    sendBuilderToConstruction();
  }

  // Gathering jobs - now handled by villager system
  if (S.gatherJobs && S.gatherJobs.length > 0) {
    S.gatherJobs = S.gatherJobs.filter(j => !j.complete);
  }
  
  // Crop lifecycle & auto-replanting
  farms.forEach((farm) => {
    if (!farm.done) return;
    const farmId = 'farm_' + farm.id;
    
    if (!S.farmCrops[farmId]) {
      // Auto-replant empty farms in correct season
      const crop = CROP_DATA[S.cropType];
      if (crop && crop.plantSeasons.includes(S.season)) {
        S.farmCrops[farmId] = {
          crop: S.cropType,
          plantedDay: S.day,
          plantedSeason: S.season,
          plantedYear: S.year,
          mature: false,
          daysGrowing: 0
        };
        
        // Notify on first day of planting season
        if (S.day <= 2) {
          toast(`🌱 Auto-planting ${crop.name} on empty farms`, 2000);
        }
      }
    } else {
      const cropData = S.farmCrops[farmId];
      cropData.daysGrowing++;
      
      const cropType = CROP_DATA[cropData.crop];
      if (cropType && cropData.daysGrowing >= cropType.growthDays) {
        cropData.mature = true;
      }
    }
  });

  // Food production now comes from manual harvesting
  let farmFood = 0;
  
  // Check for mature farms and notify player
  let matureFarms = 0;
  farms.forEach(farm => {
    const farmId = 'farm_' + farm.id;
    const cropData = S.farmCrops[farmId];
    
    if (cropData && cropData.mature && !cropData.harvested) {
      const cropType = CROP_DATA[cropData.crop];
      if (cropType && cropType.harvestSeasons.includes(S.season)) {
        matureFarms++;
      }
    }
  });
  
  // Store mature farm count for notifications
  S.matureFarmsCount = matureFarms;

  // Weather & morale effects
  const w = weatherEffect(S.weatherNow);
  farmFood *= w.mult;
  const moraleBonus = 1 + (S.morale - 0.5) * 0.2;
  farmFood *= moraleBonus;

  // Policy effects
  if (S.landPolicy === 'enclosed') {
    farmFood *= 1.15;
  }

  // Livestock & foraging
  let livestockFood = S.livestock * 0.5 * (herderPop / Math.max(1, S.pop));
  let foragedFood = S.season !== 3 ? gathererPop * 0.3 * S.workIntensity : 0;

  // Tech bonuses
  if (S.tech.manure) farmFood *= 1 + Math.min(S.livestock * 0.1, 0.5);
  if (S.tech.seedSelection) farmFood *= 1.10;
  if (S.tech.fertilizer) farmFood *= 1.15;
  if (S.tech.cropRotation) S.landQuality = Math.min(1.0, S.landQuality + 0.008);
  if (mills > 0) farmFood *= 1 + mills * 0.15;

  // Total food
  const totalFood = farmFood + livestockFood + foragedFood;
  const spoilage = totalFood * w.spoil;
  const netFood = totalFood - spoilage;

  // Feudal extraction
  let foodAfterTithe = netFood;
  if (S.landPolicy === 'commons') {
    const lordTake = netFood * S.lordTithePct;
    const churchTake = netFood * S.churchTithePct;
    foodAfterTithe = netFood - lordTake - churchTake;
  } else {
    const rentTake = netFood * 0.50;
    foodAfterTithe = netFood - rentTake;
  }

  S.lastFoodProduction = foodAfterTithe;
  S.foodStock += foodAfterTithe;

  // Consumption
  const needPerDay = S.pop * 0.10;
  S.foodStock -= needPerDay;

  // Real wage
  S.realWage = (S.foodStock / Math.max(1, S.pop)) / 0.2;

  // Winter mechanics
  if (S.season === 3) {
    if (!S.tech.well) S.health = Math.max(0.2, S.health - 0.005);
    if (S.foodStock < needPerDay * 30) S.morale = Math.max(0.1, S.morale - 0.015);
    
    if (S.foodStock < 0 && Math.random() < w.disease * 2) {
      const deaths = Math.max(2, Math.floor(S.pop * 0.04));
      S.pop = Math.max(10, S.pop - deaths);
      S.totalDeaths += deaths;
      toast(`Winter disease! -${deaths} population`, 4000);
      playSound('bad');
    }
  }

  // Morale dynamics
  const intensityPenalty = (S.workIntensity - 1.0) * 0.3;
  if (S.foodStock > needPerDay * 7) {
    S.morale = Math.min(1, S.morale + 0.01 - intensityPenalty);
    } else if (S.foodStock < needPerDay * 3) {
    S.morale = Math.max(0, S.morale - 0.02 - intensityPenalty);
  } else {
    S.morale = Math.max(0, S.morale - intensityPenalty * 0.5);
  }

  // Disease events
  if (Math.random() < w.disease && S.foodStock < 0) {
    const deaths = Math.max(1, Math.floor(S.pop * 0.02));
    S.pop = Math.max(10, S.pop - deaths);
    S.totalDeaths += deaths;
    toast(`Disease outbreak! -${deaths} population`, 4000);
    playSound('bad');
  }

  // Famine (Malthusian crisis)
  if (S.year >= 3 && S.foodStock < -needPerDay * 3 && Math.random() < 0.1) {
    const famineDeaths = Math.floor(S.pop * 0.15);
    S.pop = Math.max(20, S.pop - famineDeaths);
    S.totalDeaths += famineDeaths;
    S.foodStock = needPerDay * 5;
    toast(`FAMINE! ${famineDeaths} perished. Malthusian reset.`, 5000);
    playSound('bad');
  }

  // Population growth
  const houses = S.builds.filter(b => b.type === 'house' && b.done).length;
  S.cap = 100 + houses * 5;

  const fertilityRate = S.year < 3 
    ? (S.realWage > 1.2 ? 0.08 : S.realWage > 0.9 ? 0.05 : 0.02)
    : (S.realWage > 1.2 ? 0.15 : S.realWage > 0.9 ? 0.1 : 0.05);
    
  if (S.foodStock > needPerDay * 10 && S.pop < S.cap && Math.random() < fertilityRate) {
    S.pop++;
    playSound('complete');
    toast('Population +1', 2000);
  }

  // Livestock breeding
  const breedRate = S.tech.animalBreeding ? 0.075 : 0.05;
  if (herderPop > 0 && S.livestock < herderPop * 3 && Math.random() < breedRate) {
    S.livestock++;
  }

  // Soil quality
  if (farms.length > 0) {
    if (!S.tech.threeField) {
      const farmsWithCrops = Object.values(S.farmCrops);
      let avgDrain = 0.02;
      if (farmsWithCrops.length > 0) {
        const sum = farmsWithCrops.reduce((acc, fc) => {
          const ct = CROP_DATA[fc.crop];
          return acc + (ct ? ct.soilDrain : 0.02);
        }, 0);
        avgDrain = sum / farmsWithCrops.length;
      }
      S.landQuality = Math.max(0.5, S.landQuality - avgDrain);
    }
  }

  // Time progression
  S.day++;
  if (S.day > 90) {
    S.day = 1;
    S.year++;
    S.season = (S.season + 1) % 4;

    // Season change notifications
    if (S.season === 0) {
      toast('🌱 SPRING! Plant barley and legumes', 4000);
    } else if (S.season === 1) {
      toast('☀️ SUMMER! Early harvest season', 4000);
    } else if (S.season === 2) {
      toast('🌾 AUTUMN! Main harvest season - reap your crops!', 4000);
      if (S.matureFarmsCount > 0) {
        setTimeout(() => toast(`⚠️ ${S.matureFarmsCount} farms ready to harvest!`, 5000), 1000);
      }
    } else if (S.season === 3) {
      toast('❄️ WINTER! Survival mode - non-hardy crops will die', 4000);
    }
    
    // Winter kills non-hardy crops
    if (S.season === 3) {
      let cropsDied = 0;
      Object.keys(S.farmCrops).forEach(farmId => {
        const cropData = S.farmCrops[farmId];
        if (cropData) {
          const cropType = CROP_DATA[cropData.crop];
          if (cropType && !cropType.winterHardy) {
            delete S.farmCrops[farmId];
            cropsDied++;
          }
        }
      });
      
      if (cropsDied > 0) {
        toast(`Winter killed ${cropsDied} non-hardy crops!`, 5000);
        playSound('bad');
      }
    }
    
    // Track sustained wages
    if (S.realWage > 1.3) {
      S.wageAbove13Years++;
    } else {
      S.wageAbove13Years = 0;
    }
  }

  // Weather update
  if (S.day % 7 === 0) {
    S.weatherNow = S.weatherNext;
    S.weatherNext = seasonWeighted(S.season);
  }

  // Data logging
  if (S.day % 10 === 0) {
    S.history.push({
      year: S.year,
      day: S.day,
      pop: S.pop,
      realWage: S.realWage,
      foodStock: S.foodStock,
      livestock: S.livestock,
      tfp: S.tfp,
      soilQuality: S.landQuality
    });
  }

  // Passive income from tech
  if (S.day === 1) {
    if (S.tech.accounting) {
      const bonus = Math.floor(S.pop / 10);
      S.materials += bonus;
    }
    if (S.milestones.marketBuilt.complete) {
      S.materials += 2;
    }
  }

  // Check for contextual events
  if (S.day % 15 === 0 && Math.random() < 0.2) {
    checkContextualEvents();
  }

  // Harvest reminders
  if (S.day % 20 === 0 && S.matureFarmsCount > 0) {
    toast(`🌾 ${S.matureFarmsCount} farm${S.matureFarmsCount > 1 ? 's' : ''} ready to harvest!`, 3000);
  }

  // Progress updates every 15 days
  if (S.day % 15 === 0) {
    const growingFarms = Object.values(S.farmCrops).filter(c => !c.mature && !c.harvested).length;
    if (growingFarms > 0) {
      toast(`📊 ${growingFarms} farm${growingFarms > 1 ? 's' : ''} still growing...`, 2000);
    }
    
    // Food security warning
    const daysOfFood = Math.floor(S.foodStock / (S.pop * 0.10));
    if (daysOfFood < 30 && daysOfFood > 0) {
      toast(`⚠️ Food reserves: ${daysOfFood} days remaining`, 3000);
      playSound('bad');
    }
  }

  const enclosureEffects = updateEnclosureSystem();

  const skillPenalty = updateLaborSkills();

  const urbanEffects = updateUrbanSystem();

  farmFood *= enclosureEffects.efficiency;

  farmFood *= skillPenalty;

  updateTradeSystem();

  // Victory check
  checkVictory();

  // UI update
  updateUI();
}

// ============================================
// BUILDING COMPLETION
// ============================================

function onBuildComplete(b) {
  playSound('complete');
  
  const buildType = BUILDS[b.type];
  toast(`${buildType.name} complete!`, 3000);
  
  if (b.type === 'farm') {
    setTimeout(() => openCropMenu(b.id), 300);
  }
  
  if (b.type === 'house') {
    S.cap += 5;
  }
  
  if (b.type === 'well') {
    S.health = Math.min(1, S.health + 0.2);
  }
  
  if (b.type === 'livestock') {
    S.livestock += 2;
  }
  
  if (b.type === 'market') {
    S.materialsPerYear = 2;
  }
  
  if (b.type === 'mill') {
    S.tfp *= 1.15;
  }
  
  updateUI();
}

// ============================================
// HARVEST SYSTEM
// ============================================

function harvestFarm(farmId) {
  const cropData = S.farmCrops[farmId];
  if (!cropData || !cropData.mature || cropData.harvested) {
    toast('Nothing to harvest!');
    return;
  }
  
  const cropType = CROP_DATA[cropData.crop];
  if (!cropType) return;
  
  // Calculate yield
  const farms = S.builds.filter(b => b.type === 'farm' && b.done);
  const farmerPop = Math.floor(S.pop * S.farmers);
  const landPerFarm = S.totalLand / Math.max(1, farms.length);
  const diminishingReturns = Math.pow(landPerFarm / 10, 0.6);
  
  // BASE YIELD - now affected by farmer allocation!
  const farmerEffect = 0.5 + (S.farmers * 1.0); // 50% at 0%, 150% at 100%
  let yield = 2.0 * cropType.yield * S.tfp * S.landQuality * diminishingReturns * farmerEffect;
  
  // Apply bonuses
  const moraleBonus = 1 + (S.morale - 0.5) * 0.2;
  yield *= moraleBonus;
  
  if (S.landPolicy === 'enclosed') yield *= 1.15;
  if (S.tech.manure) yield *= 1 + Math.min(S.livestock * 0.1, 0.5);
  if (S.tech.seedSelection) yield *= 1.10;
  if (S.tech.fertilizer) yield *= 1.15;
  
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
  if (mills > 0) yield *= 1 + mills * 0.15;
  
  // Weather effect
  const w = weatherEffect(S.weatherNow);
  yield *= w.mult;
  
  // Spoilage
  const spoilage = yield * w.spoil;
  const netYield = yield - spoilage;
  
  // Feudal extraction
  let finalYield = netYield;
  if (S.landPolicy === 'commons') {
    const lordTake = netYield * S.lordTithePct;
    const churchTake = netYield * S.churchTithePct;
    finalYield = netYield - lordTake - churchTake;
  } else {
    const rentTake = netYield * 0.50;
    finalYield = netYield - rentTake;
  }
  
  // Add to food stock
  S.foodStock += finalYield;
  cropData.harvested = true;
  
  // Clear the farm
  delete S.farmCrops[farmId];
  
  playSound('harvest');
  
  // Bonus feedback for good harvests
  if (finalYield > 15) {
    toast(`🌟 ABUNDANT HARVEST! +${Math.floor(finalYield)} food from ${cropType.name}!`, 4000);
    S.morale = Math.min(1, S.morale + 0.05);
  } else if (finalYield > 10) {
    toast(`✨ Good harvest! +${Math.floor(finalYield)} food from ${cropType.name}`, 3000);
  } else {
    toast(`Harvested ${cropType.name}: +${Math.floor(finalYield)} food`, 3000);
  }
  
  // Close modal and update UI
  hideModal('farmInfoModal');
  updateUI();
  
  return finalYield;
}

function openFarmInfo(buildId) {
  const farmId = 'farm_' + buildId;
  const cropData = S.farmCrops[farmId];
  
  const modal = el('farmInfoModal');
  const title = el('farmInfoTitle');
  const body = el('farmInfoBody');
  const harvestBtn = el('farmInfoHarvest');
  const plantBtn = el('farmInfoPlant');
  
  if (!modal || !title || !body) return;
  
  title.textContent = `Farm #${buildId}`;
  
  if (!cropData) {
    // Empty farm
    body.innerHTML = `
      <div class="farm-status-empty">
        <div class="status-icon">🟫</div>
        <div class="status-text">Empty / Fallow</div>
        <div class="status-detail">No crops planted</div>
      </div>
    `;
    harvestBtn.style.display = 'none';
    plantBtn.style.display = 'block';
    plantBtn.onclick = () => {
      hideModal('farmInfoModal');
      openCropMenu(buildId);
    };
  } else {
    const cropType = CROP_DATA[cropData.crop];
    const daysLeft = cropType.growthDays - cropData.daysGrowing;
    const canHarvest = cropData.mature && cropType.harvestSeasons.includes(S.season);
    
    let statusIcon = '🟢';
    let statusText = 'Growing';
    let statusDetail = `${daysLeft} days until mature`;
    
    if (cropData.mature) {
      if (canHarvest) {
        statusIcon = '🟡';
        statusText = 'Ready to Harvest!';
        statusDetail = 'Click harvest to collect your crops';
      } else {
        statusIcon = '⏳';
        statusText = 'Mature (Wrong Season)';
        const harvestSeasons = cropType.harvestSeasons.map(s => S.seasons[s]).join(', ');
        statusDetail = `Harvest in: ${harvestSeasons}`;
      }
    }
    
    body.innerHTML = `
      <div class="farm-status-info">
        <div class="status-icon">${statusIcon}</div>
        <div class="status-text">${statusText}</div>
      </div>
      <div class="farm-details">
        <div class="detail-row">
          <span class="detail-label">Crop:</span>
          <span class="detail-value">${cropType.name} ${cropType.yield >= 1 ? '🌾' : '🫘'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Planted:</span>
          <span class="detail-value">${S.seasons[cropData.plantedSeason]}, Year ${cropData.plantedYear}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Age:</span>
          <span class="detail-value">${cropData.daysGrowing} days</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status:</span>
          <span class="detail-value">${statusDetail}</span>
        </div>
      </div>
    `;
    
    if (canHarvest) {
      harvestBtn.style.display = 'block';
      harvestBtn.onclick = () => harvestFarm(farmId);
    } else {
      harvestBtn.style.display = 'none';
    }
    
    plantBtn.style.display = 'none';
  }
  
  showModal('farmInfoModal');
}

// ============================================
// WEATHER SYSTEM
// ============================================

function seasonWeighted(s) {
  const r = Math.random();
  if (s === 0) {
    if (r < 0.5) return 'rain';
    if (r < 0.85) return 'sunny';
    return 'storm';
  }
  if (s === 1) {
    if (r < 0.15) return 'rain';
    if (r < 0.7) return 'sunny';
    return 'drought';
  }
  if (s === 2) {
    if (r < 0.35) return 'rain';
    if (r < 0.85) return 'sunny';
    return 'storm';
  }
  if (s === 3) {
    if (r < 0.2) return 'rain';
    if (r < 0.65) return 'sunny';
    return 'drought';
  }
  return 'sunny';
}

function weatherEffect(w) {
  let mult = 1, spoil = 0.25, disease = 0.01;
  const crop = CROP_DATA[S.cropType];

  if (w === 'rain') mult = 1.2;
  if (w === 'storm') {
    mult = 1.3;
    spoil += 0.05;
  }
  if (w === 'drought') {
    mult = S.tech.irrigation ? 0.9 : crop.droughtMult;
  }

  if (S.tech.well) disease = 0.005;
  if (S.tech.granary) spoil = 0.1;
  if (S.tech.storage) spoil = 0.05;

  return { mult, spoil, disease };
}

function rollWeather() {
  S.weatherNow = seasonWeighted(S.season);
  S.weatherNext = seasonWeighted(S.season);
}

// ============================================
// MILESTONES
// ============================================

function checkMilestones() {
  if (!S.milestones.firstWinter.complete && S.year === 2 && S.season === 0) {
    S.milestones.firstWinter.complete = true;
    S.materials += 15;
    toast('Milestone: Survived First Winter! +15 materials', 4000);
    playSound('complete');
  }
  
  if (!S.milestones.population100.complete && S.pop >= 100) {
    S.milestones.population100.complete = true;
    S.tfp *= 1.1;
    toast('Milestone: Population 100! +10% TFP', 4000);
    playSound('complete');
  }
  
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
  if (!S.milestones.firstMill.complete && mills >= 1) {
    S.milestones.firstMill.complete = true;
    S.morale = Math.min(1, S.morale + 0.2);
    toast('Milestone: First Windmill! +20% morale', 4000);
    playSound('complete');
  }
  
  const hasMarket = S.builds.some(b => b.type === 'market' && b.done);
  if (!S.milestones.marketBuilt.complete && hasMarket) {
    S.milestones.marketBuilt.complete = true;
    toast('Milestone: Market Economy! +2 materials/year', 4000);
    playSound('complete');
  }
  
  if (!S.milestones.sustained_wage.complete && S.wageAbove13Years >= 1) {
    S.milestones.sustained_wage.complete = true;
    S.victoryProgress += 25;
    toast('Milestone: Prosperity Sustained! Victory +25%', 4000);
    playSound('complete');
  }
}

// ============================================
// ENHANCED VILLAGER SYSTEM WITH SMOOTH ANIMATION
// ============================================

const VILLAGER_TYPES = {
  farmer: { 
    icon: '🌾', 
    speed: 2.5,  // Increased from 1.2
    tasks: ['farm_tend', 'farm_plant', 'farm_harvest']
  },
  builder: { 
    icon: '🔨', 
    speed: 2.0,  // Increased from 1.0
    tasks: ['construct']
  },
  gatherer: { 
    icon: '🪵', 
    speed: 3.0,  // Increased from 1.5
    tasks: ['gather_tree', 'gather_rock']
  },
  herder: { 
    icon: '🐄', 
    speed: 2.2,  // Increased from 1.1
    tasks: ['tend_livestock']
  }
};

let villagerAnimationFrame = null;

function spawnVillager(type, startX, startY, targetX, targetY, task) {
  const ground = el('ground');
  if (!ground) return null;
  
  const villager = document.createElement('div');
  villager.className = `villager ${type} walking`;
  villager.style.left = startX + 'px';
  villager.style.top = startY + 'px';
  
  const typeData = VILLAGER_TYPES[type];
  
  villager.innerHTML = `
    <div class="villager-head"></div>
    <div class="villager-body"></div>
    <div class="villager-legs">
      <div class="villager-leg"></div>
      <div class="villager-leg"></div>
    </div>
    <div class="villager-carrying"></div>
    <div class="villager-progress">
      <div class="villager-progress-bar"></div>
    </div>
    <div class="villager-icon">${typeData.icon}</div>
  `;
  
  ground.appendChild(villager);
  
  const villagerId = 'villager_' + Date.now() + Math.random();
  const villagerData = {
    id: villagerId,
    type,
    element: villager,
    startX,
    startY,
    targetX,
    targetY,
    currentX: startX,
    currentY: startY,
    speed: typeData.speed,
    task,
    state: 'walking_to',
    workProgress: 0,
    workRequired: task.workRequired || 1.0
  };
  
  if (!S.villagers) S.villagers = [];
  S.villagers.push(villagerData);
  
  // Start animation loop if not already running
  if (!villagerAnimationFrame && S.villagers.length > 0) {
    startVillagerAnimation();
  }
  
  return villagerData;
}

function startVillagerAnimation() {
  function animate() {
    if (!isPaused) {
      updateVillagersAnimation();
    }
    villagerAnimationFrame = requestAnimationFrame(animate);
  }
  animate();
}

// ============================================
// VILLAGER HELPER FUNCTIONS
// ============================================

function findNearestHouse(targetX, targetY) {
  const houses = S.builds.filter(b => b.type === 'house' && b.done);
  if (houses.length === 0) return { x: 200, y: 40 };
  
  let nearest = houses[0];
  let minDist = Infinity;
  
  houses.forEach(h => {
    const dx = h.x + 32 - targetX;
    const dy = h.y + 32 - targetY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = h;
    }
  });
  
  return { x: nearest.x + 32, y: nearest.y + 32 };
}

function canSpawnVillager(type, count = 1) {
  const activeOfType = S.villagers ? S.villagers.filter(v => v.type === type).length : 0;
  const maxForType = {
    farmer: Math.floor(S.pop * S.farmers),
    builder: Math.floor(S.pop * S.builders),
    gatherer: Math.floor(S.pop * S.gatherers),
    herder: Math.floor(S.pop * S.herders)
  };
  
  return activeOfType + count <= maxForType[type];
}

function updateVillagersAnimation() {
  if (!S.villagers || S.villagers.length === 0) {
    if (villagerAnimationFrame) {
      cancelAnimationFrame(villagerAnimationFrame);
      villagerAnimationFrame = null;
    }
    return;
  }
  
  for (let i = S.villagers.length - 1; i >= 0; i--) {
    const v = S.villagers[i];
    
    if (v.state === 'walking_to') {
      const dx = v.targetX - v.currentX;
      const dy = v.targetY - v.currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < v.speed * 2) {
        v.currentX = v.targetX;
        v.currentY = v.targetY;
        v.state = 'working';
        v.element.classList.remove('walking');
        v.element.classList.add('working');
        
        if (v.task && v.task.onArrival) {
          v.task.onArrival();
        }
      } else {
        v.currentX += (dx / dist) * v.speed;
        v.currentY += (dy / dist) * v.speed;
      }
      
      v.element.style.left = v.currentX + 'px';
      v.element.style.top = v.currentY + 'px';
      
    } else if (v.state === 'working') {
      // Work progress - slower rate since this runs at 60fps
      v.workProgress += 0.008 * S.workIntensity;  // Reduced from 0.015
      
      const progressBar = v.element.querySelector('.villager-progress-bar');
      if (progressBar) {
        progressBar.style.width = Math.min(100, (v.workProgress / v.workRequired) * 100) + '%';
      }
      
      if (v.workProgress >= v.workRequired) {
        v.state = 'walking_back';
        v.element.classList.remove('working');
        v.element.classList.add('walking', 'carrying');
        
        if (v.task && v.task.onComplete) {
          v.task.onComplete(v);
        }
        
        playSound('harvest');
      }
      
    } else if (v.state === 'walking_back') {
      const dx = v.startX - v.currentX;
      const dy = v.startY - v.currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < v.speed * 2) {
        if (v.task && v.task.onReturn) {
          v.task.onReturn(v);
        }
        v.element.remove();
        S.villagers.splice(i, 1);
      } else {
        v.currentX += (dx / dist) * v.speed;
        v.currentY += (dy / dist) * v.speed;
        v.element.style.left = v.currentX + 'px';
        v.element.style.top = v.currentY + 'px';
      }
    }
  }
}

// Keep this simpler version for the tick() function
function updateVillagers() {
  // This function is now just for cleanup
  // Animation happens in updateVillagersAnimation()
}

// ============================================
// VICTORY
// ============================================

function checkVictory() {
  const pop150 = S.pop >= 150;
  const wage13 = S.wageAbove13Years >= 1;
  const hasMarket = S.builds.some(b => b.type === 'market' && b.done);
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
  const capitalGoods = mills >= 3;
  
  S.victoryProgress = 0;
  if (pop150) S.victoryProgress += 25;
  if (wage13) S.victoryProgress += 25;
  if (hasMarket) S.victoryProgress += 25;
  if (capitalGoods) S.victoryProgress += 25;
  
  if (S.victoryProgress >= 100 && autoStarted) {
    showVictory();
  }
}

function showVictory() {
  isPaused = true;
  alert(`VICTORY! Agrarian Phase Complete!\n\nTime: ${S.year} years\nPopulation: ${S.pop}\nDeaths: ${S.totalDeaths}\n\nYou have successfully transitioned from subsistence farming to a thriving agrarian economy!`);
}

// ============================================
// EVENTS
// ============================================

function checkContextualEvents() {
  const possibleEvents = [];
  
  if (S.realWage < 0.9 && S.foodStock < S.pop * 2) {
    const evt = EVENTS.find(e => e.id === 'neighbor_aid');
    if (evt) possibleEvents.push(evt);
  }
  
  if (S.materials >= 20 && S.realWage > 1.2) {
    const evt = EVENTS.find(e => e.id === 'merchant_tools');
    if (evt) possibleEvents.push(evt);
  }
  
  if (S.morale < 0.4 && S.foodStock > S.pop * 10) {
    const evt = EVENTS.find(e => e.id === 'festival');
    if (evt) possibleEvents.push(evt);
  }
  
  if (possibleEvents.length > 0 && Math.random() < 0.4) {
    const event = possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
    showEventCard(event);
  }
}

function showEventCard(event) {
  isPaused = true;
  
  el('eventTitle').textContent = event.title;
  el('eventDesc').textContent = event.desc;
  el('eventEffect').textContent = event.effect;
  
  const modal = el('eventModal');
  modal.classList.add('show');
  
  el('eventAccept').onclick = () => {
    if (event.action()) {
      modal.classList.remove('show');
      isPaused = false;
    }
  };
  
  el('eventDecline').onclick = () => {
    if (event.decline) event.decline();
    modal.classList.remove('show');
    isPaused = false;
    toast('Event declined');
  };
}

// ============================================
// UI UPDATE
// ============================================

function updateUI() {
  // Top bar
  if (el('topPop')) el('topPop').textContent = S.pop;
  if (el('topCap')) el('topCap').textContent = S.cap;
  if (el('topFood')) el('topFood').textContent = Math.floor(S.foodStock);
  if (el('topMat')) el('topMat').textContent = Math.floor(S.materials);
  if (el('topSeason')) el('topSeason').textContent = S.seasons[S.season];
  if (el('topYear')) el('topYear').textContent = S.year;
  
  // Labor sliders
  if (el('farmerPct')) el('farmerPct').textContent = Math.round(S.farmers * 100) + '%';
  if (el('builderPct')) el('builderPct').textContent = Math.round(S.builders * 100) + '%';
  if (el('gathererPct')) el('gathererPct').textContent = Math.round(S.gatherers * 100) + '%';
  if (el('herderPct')) el('herderPct').textContent = Math.round(S.herders * 100) + '%';
  if (el('intensityPct')) el('intensityPct').textContent = Math.round(S.workIntensity * 100) + '%';
  
  const idle = Math.max(0, 1 - S.farmers - S.builders - S.herders - S.gatherers);
  if (el('idlePct')) el('idlePct').textContent = Math.round(idle * 100) + '%';
  
  // Agriculture
  const farms = S.builds.filter(b => b.type === 'farm' && b.done).length;
  if (el('soilQuality')) el('soilQuality').textContent = Math.round(S.landQuality * 100) + '%';
  if (el('activeFarms')) el('activeFarms').textContent = farms;
  if (el('foodProduction')) el('foodProduction').textContent = S.lastFoodProduction.toFixed(1);
  
  // Map HUD
  if (el('weatherIcon')) {
    const icons = { sunny: '☀️', rain: '🌧️', storm: '⛈️', drought: '🌵' };
    el('weatherIcon').textContent = icons[S.weatherNow] || '🌤️';
  }
  if (el('weatherNow')) el('weatherNow').textContent = S.weatherNow;
  if (el('hudWage')) el('hudWage').textContent = S.realWage.toFixed(2);
  
  // Season banner
  const seasonData = SEASON_DATA[S.season];
  if (el('seasonIcon')) el('seasonIcon').textContent = seasonData.icon;
  if (el('seasonName')) el('seasonName').textContent = seasonData.name;
  if (el('seasonDesc')) el('seasonDesc').textContent = seasonData.desc;
  if (el('seasonDay')) el('seasonDay').textContent = S.day;
  
  // Meters
  const wagePct = Math.min(100, (S.realWage / 2) * 100);
  updateMeter('wageFill', 'wageValue', wagePct, S.realWage.toFixed(2));
  
  const needPerDay = S.pop * 0.10;
  const daysOfFood = S.foodStock / needPerDay;
  const foodPct = Math.min(100, (daysOfFood / 180) * 100);
  updateMeter('foodFill', 'foodDays', foodPct, Math.floor(daysOfFood) + 'd');
  
  updateMeter('healthFill', 'healthValue', S.health * 100, Math.round(S.health * 100) + '%');
  updateMeter('moraleFill', 'moraleValue', S.morale * 100, Math.round(S.morale * 100) + '%');
  
  const w = weatherEffect(S.weatherNow);
  if (el('diseaseRisk')) el('diseaseRisk').textContent = (w.disease * 100).toFixed(1) + '%';
  
  // Resources
  if (el('foodStock')) el('foodStock').textContent = Math.floor(S.foodStock);
  if (el('materials')) el('materials').textContent = Math.floor(S.materials);
  if (el('livestock')) el('livestock').textContent = S.livestock;
  
  // Population
  if (el('population')) el('population').textContent = S.pop;
  if (el('capacity')) el('capacity').textContent = S.cap;
  if (el('totalDeaths')) el('totalDeaths').textContent = S.totalDeaths;
  
  // Social
  if (el('lordTithe')) el('lordTithe').textContent = Math.round(S.lordTithePct * 100) + '%';
  
  // Theory
  let theory = 'Malthusian Trap';
  let theoryDesc = 'Population pressure at subsistence';
  if (S.realWage < 0.95) {
    theory = 'Malthusian Crisis';
    theoryDesc = 'Wages below subsistence, collapse imminent';
  } else if (S.realWage > 1.3) {
    theory = 'Post-Crisis Boom';
    theoryDesc = 'Labor scarcity drives high wages';
  }
  if (el('theoryStatus')) el('theoryStatus').textContent = theory;
  if (el('theoryDesc')) el('theoryDesc').textContent = theoryDesc;
  
  // Victory
  if (el('victoryFill')) {
    el('victoryFill').style.width = S.victoryProgress + '%';
    el('victoryFill').textContent = S.victoryProgress + '%';
  }
  
  // Tech count
  const techCount = Object.keys(S.tech).filter(k => S.tech[k]).length;
  if (el('techCount')) el('techCount').textContent = techCount;
  
  // Construction queue
  const inProgress = S.builds.filter(b => !b.done);
  const queueBox = el('constructionQueue');
  const queueList = el('queueList');

  const enclosureInfo = el('enclosureInfo'); // Add this element to HTML
  if (enclosureInfo) {
    enclosureInfo.innerHTML = `
      <div class="info-row">
        <span class="info-label">Enclosed Land:</span>
        <span class="info-value">${Math.round(S.enclosedLandPct * 100)}%</span>
      </div>
      <div class="info-row">
        <span class="info-label">Landless Workers:</span>
        <span class="info-value">${S.landlessLaborers}</span>
      </div>
      ${S.woolProduction > 0 ? `
      <div class="info-row">
        <span class="info-label">Wool Production:</span>
        <span class="info-value">${S.woolProduction.toFixed(1)}/day</span>
      </div>
      ` : ''}
    `;
  }

  // Add labor efficiency indicator
  if (el('laborEfficiency')) {
    const builderPop = Math.floor(S.pop * S.builders);
    const farmerPop = Math.floor(S.pop * S.farmers);
    const gathererPop = Math.floor(S.pop * S.gatherers);
    
    el('laborEfficiency').textContent = 
      `Builders: ${builderPop} | Farmers: ${farmerPop} | Gatherers: ${gathererPop}`;
  }
  
  // NEW: Display trade info
  const tradeInfo = el('tradeInfo'); // Add this element to HTML
  if (tradeInfo && S.grainSold > 0) {
    tradeInfo.innerHTML = `
      <div class="info-row">
        <span class="info-label">Market Price:</span>
        <span class="info-value">${S.marketPrice.toFixed(2)}x</span>
      </div>
      <div class="info-row">
        <span class="info-label">Grain Sold:</span>
        <span class="info-value">${S.grainSold.toFixed(1)}/day</span>
      </div>
      <div class="info-row">
        <span class="info-label">Trade Income:</span>
        <span class="info-value">+${S.tradeIncome.toFixed(1)} materials</span>
      </div>
    `;
  }
  
  // NEW: Display urban info
  const urbanInfo = el('urbanInfo'); // Add this to Society tab in HTML
  if (urbanInfo) {
    urbanInfo.innerHTML = `
      <div class="info-row">
        <span class="info-label">Urban Population:</span>
        <span class="info-value">${Math.round(S.urbanPopPct * 100)}%</span>
      </div>
      <div class="info-row">
        <span class="info-label">Urban Demand:</span>
        <span class="info-value">${S.urbanDemand.toFixed(2)}x</span>
      </div>
    `;
  }
  
  if (queueBox && queueList) {
    if (inProgress.length > 0) {
      queueBox.style.display = 'block';
      queueList.innerHTML = inProgress.map(b => {
        const pct = Math.round((b.progress / b.dur) * 100);
        return `
          <div class="queue-item">
            <div class="queue-header">
              <span>${BUILDS[b.type].name}</span>
              <span>${pct}%</span>
            </div>
            <div class="queue-progress">
              <div class="queue-progress-bar" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      queueBox.style.display = 'none';
    }
  }

  // Update map season visuals
  const mapContainer = document.querySelector('.map-container');
  if (mapContainer) {
    mapContainer.className = `map-container season-${S.season}`;
  }
  
  // Render
  renderGrid();

  updateFarmList();
}

// ============================================
// FARM LIST VIEW
// ============================================

function updateFarmList() {
  const farmList = el('farmListContent');
  if (!farmList) return;
  
  const farms = S.builds.filter(b => b.type === 'farm' && b.done);
  
  if (farms.length === 0) {
    farmList.innerHTML = '<div class="stat-detail">No farms built yet</div>';
    return;
  }
  
  farmList.innerHTML = farms.map(farm => {
    const farmId = 'farm_' + farm.id;
    const cropData = S.farmCrops[farmId];
    
    let statusClass = 'farm-list-empty';
    let statusIcon = '🟫';
    let statusText = 'Empty';
    let actionBtn = `<button class="btn-farm-action" onclick="openFarmInfo(${farm.id})">Plant</button>`;
    
    if (cropData) {
      const cropType = CROP_DATA[cropData.crop];
      const daysLeft = cropType.growthDays - cropData.daysGrowing;
      
      if (cropData.mature) {
        const canHarvest = cropType.harvestSeasons.includes(S.season);
        if (canHarvest) {
          statusClass = 'farm-list-ready';
          statusIcon = '🟡';
          statusText = `${cropType.name} - READY!`;
          actionBtn = `<button class="btn-farm-action harvest" onclick="openFarmInfo(${farm.id})">Harvest</button>`;
        } else {
          statusClass = 'farm-list-waiting';
          statusIcon = '⏳';
          statusText = `${cropType.name} - Waiting`;
          actionBtn = `<button class="btn-farm-action" onclick="openFarmInfo(${farm.id})">View</button>`;
        }
      } else {
        statusClass = 'farm-list-growing';
        statusIcon = '🟢';
        statusText = `${cropType.name} - ${daysLeft}d`;
        actionBtn = `<button class="btn-farm-action" onclick="openFarmInfo(${farm.id})">View</button>`;
      }
    }
    
    return `
      <div class="farm-list-item ${statusClass}">
        <div class="farm-list-icon">${statusIcon}</div>
        <div class="farm-list-info">
          <div class="farm-list-name">Farm #${farm.id}</div>
          <div class="farm-list-status">${statusText}</div>
        </div>
        ${actionBtn}
      </div>
    `;
  }).join('');
}

function updateMeter(fillId, valueId, pct, value) {
  const fill = el(fillId);
  if (fill) fill.style.width = pct + '%';
  const val = el(valueId);
  if (val) val.textContent = value;
}

// ============================================
// BUILDINGS & RESOURCES
// ============================================

function renderBuildPalette() {
  const pal = el('buildPalette');
  if (!pal) return;
  pal.innerHTML = '';

  Object.keys(BUILDS).forEach(key => {
    const b = BUILDS[key];
    if (b.reqTech && !S.tech[b.reqTech]) return;

    const tile = document.createElement('div');
    tile.className = 'build-tile';
    tile.draggable = true;

    tile.innerHTML = `
      <div class="tile-icon ${b.icon}"></div>
      <div class="tile-name">${b.name}</div>
      <div class="tile-cost">${b.mat}m · ${b.dur}d</div>
    `;

    tile.addEventListener('dragstart', e => {
      draggedType = key;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', key);
    });

    tile.addEventListener('dragend', () => (draggedType = null));

    pal.appendChild(tile);
  });
}

function renderGrid() {
  const ground = el('ground');
  if (!ground) return;

  const existing = [...ground.querySelectorAll('.icon')];

  S.builds.forEach(b => {
    let icon = existing.find(e => e.dataset.id == b.id);
    if (!icon) {
      icon = document.createElement('div');
      icon.className = 'icon ' + BUILDS[b.type].icon + (b.done ? '' : ' site');
      icon.dataset.id = b.id;
      icon.style.left = b.x + 'px';
      icon.style.top = b.y + 'px';
      ground.appendChild(icon);
    }

    if (!b.done) {
      icon.className = 'icon ' + BUILDS[b.type].icon + ' site';
      let ring = icon.querySelector('.ring');
      if (!ring) {
        ring = document.createElement('div');
        ring.className = 'ring';
        icon.appendChild(ring);
      }
      const pct = Math.min(100, (b.progress / b.dur) * 100);
      ring.style.setProperty('--pct', pct);
    } else {
      icon.className = 'icon ' + BUILDS[b.type].icon;
      const ring = icon.querySelector('.ring');
      if (ring) ring.remove();
    }

    // Farm crop states
    if (b.type === 'farm' && b.done) {
      const farmId = 'farm_' + b.id;
      const cropData = S.farmCrops[farmId];
      
      icon.classList.remove('farm-empty', 'farm-wheat-growing', 'farm-wheat-mature', 
        'farm-rye-growing', 'farm-rye-mature', 'farm-barley-growing', 'farm-barley-mature',
        'farm-legumes-growing', 'farm-legumes-mature', 'mature');

      if (!cropData) {
        icon.classList.add('farm-empty');
      } else {
        const stage = cropData.mature ? 'mature' : 'growing';
        icon.classList.add(`farm-${cropData.crop}-${stage}`);
        
        // Add pulsing effect for harvestable farms
        if (cropData.mature) {
          const cropType = CROP_DATA[cropData.crop];
          if (cropType && cropType.harvestSeasons.includes(S.season)) {
            icon.classList.add('mature');
          }
        }
      }
      
      icon.style.cursor = 'pointer';
      icon.onclick = (e) => {
        e.stopPropagation();
        openFarmInfo(b.id);
      };
    }
  });

  existing.forEach(e => {
    if (!S.builds.find(b => b.id == e.dataset.id)) e.remove();
  });

  drawNodes();
}

function spawnNodes() {
  const ground = el('ground');
  if (!ground) return;
  const rect = ground.getBoundingClientRect();

  function overlapsBuilding(x, y) {
    for (let b of S.builds) {
      if (x < b.x + 64 && x + 42 > b.x && y < b.y + 64 && y + 42 > b.y) {
        return true;
      }
    }
    return false;
  }

  function getValidPosition() {
    for (let i = 0; i < 50; i++) {
      const x = 30 + Math.random() * (rect.width - 100);
      const y = 10 + Math.random() * (rect.height - 60);
      if (!overlapsBuilding(x, y)) return { x, y };
    }
    return {
      x: 30 + Math.random() * (rect.width - 100),
      y: 10 + Math.random() * (rect.height - 60)
    };
  }

  for (let i = 0; i < 5; i++) {
    const pos = getValidPosition();
    S.nodes.push({
      id: 'tree' + i,
      type: 'tree',
      x: pos.x,
      y: pos.y,
      hp: 3
    });
  }

  for (let i = 0; i < 3; i++) {
    const pos = getValidPosition();
    S.nodes.push({
      id: 'rock' + i,
      type: 'rock',
      x: pos.x,
      y: pos.y,
      hp: 2
    });
  }
}

function drawNodes() {
  const ground = el('ground');
  if (!ground) return;
  
  S.nodes.forEach(n => {
    let node = ground.querySelector(`[data-nodeid="${n.id}"]`);
    if (!node) {
      node = document.createElement('div');
      node.className = 'node ' + n.type;
      node.dataset.nodeid = n.id;
      node.style.left = n.x + 'px';
      node.style.top = n.y + 'px';
      
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        harvestNode(n);
      });
      
      ground.appendChild(node);
    }
    
    const activeJob = S.gatherJobs && S.gatherJobs.find(j => j.nodeId === n.id);
    
    if (activeJob) {
      node.style.opacity = '0.7';
      let ring = node.querySelector('.ring');
      if (!ring) {
        ring = document.createElement('div');
        ring.className = 'ring';
        node.appendChild(ring);
      }
      const pct = Math.min(100, (activeJob.progress / activeJob.required) * 100);
      ring.style.setProperty('--pct', pct);
    } else {
      node.style.opacity = '1';
      const ring = node.querySelector('.ring');
      if (ring) ring.remove();
    }
  });
  
  [...ground.querySelectorAll('.node')].forEach(node => {
    if (!S.nodes.find(n => n.id === node.dataset.nodeid)) {
      node.remove();
    }
  });
}

function harvestNode(n) {
  if (S.gatherers < 0.05) {
    playSound('bad');
    toast('Need at least 5% gatherers to harvest!');
    return;
  }
  
  // Check if already being gathered
  if (S.gatherJobs && S.gatherJobs.find(j => j.nodeId === n.id)) {
    toast('Already gathering this resource');
    return;
  }
  
  // Check villager capacity
  if (!canSpawnVillager('gatherer')) {
    toast('All gatherers are busy!');
    return;
  }
  
  if (!S.gatherJobs) S.gatherJobs = [];
  
  const house = findNearestHouse(n.x, n.y);
  const taskType = n.type === 'tree' ? 'gather_tree' : 'gather_rock';
  
  const job = {
    id: Date.now() + Math.random(),
    nodeId: n.id,
    type: n.type,
    started: false,
    complete: false
  };
  
  S.gatherJobs.push(job);
  
  const villager = spawnVillager('gatherer', house.x, house.y, n.x + 21, n.y + 21, {
    jobId: job.id,
    taskType,
    // More gatherers = faster work
    workRequired: n.type === 'tree' ? (3.0 / (1 + S.gatherers)) : (2.5 / (1 + S.gatherers)),
    onArrival: () => {
      job.started = true;
    },
    onComplete: (v) => {
      job.complete = true;
      const gain = n.type === 'tree' ? 4 : 5;
      toast(`+${gain} materials from ${n.type}`);
    },
    onReturn: (v) => {
      const gain = n.type === 'tree' ? 4 : 5;
      S.materials += gain;
      
      const node = S.nodes.find(nd => nd.id === n.id);
      if (node) {
        S.nodeRegenQueue.push({
          ...node,
          regenTime: S.year + 5
        });
        S.nodes = S.nodes.filter(nd => nd.id !== n.id);
      }
      
      const jobIndex = S.gatherJobs.findIndex(j => j.nodeId === n.id);
      if (jobIndex !== -1) {
        S.gatherJobs.splice(jobIndex, 1);
      }
    }
  });
  
  if (villager) {
    job.villagerId = villager.id;
  }
  
  playSound('click');
  toast(`Gatherer heading to ${n.type}...`);
  updateUI();
}

// ============================================
// FARM TENDING SYSTEM
// ============================================

function sendFarmerToTendCrop(farmBuild) {
  if (!canSpawnVillager('farmer')) {
    return; // Silently fail - all farmers busy
  }
  
  const house = findNearestHouse(farmBuild.x, farmBuild.y);
  const farmId = 'farm_' + farmBuild.id;
  const cropData = S.farmCrops[farmId];
  
  if (!cropData || cropData.mature) return; // Only tend growing crops
  
  spawnVillager('farmer', house.x, house.y, farmBuild.x + 32, farmBuild.y + 32, {
    taskType: 'farm_tend',
    farmId: farmId,
    workRequired: 2.0,
    onComplete: (v) => {
      // Tending speeds up growth slightly
      if (S.farmCrops[farmId]) {
        S.farmCrops[farmId].daysGrowing += 2;
        toast('Crop tended! Growth accelerated', 2000);
      }
    }
  });
}

function autoSendFarmersToCrops() {
  if (S.farmers < 0.1) return; // Need at least 10% farmers
  
  const farms = S.builds.filter(b => b.type === 'farm' && b.done);
  const growingFarms = farms.filter(f => {
    const farmId = 'farm_' + f.id;
    const cropData = S.farmCrops[farmId];
    return cropData && !cropData.mature && !cropData.harvested;
  });
  
  // Send farmers to tend growing crops periodically
  if (growingFarms.length > 0 && Math.random() < 0.15) {
    const randomFarm = growingFarms[Math.floor(Math.random() * growingFarms.length)];
    sendFarmerToTendCrop(randomFarm);
  }
  
  // Auto-harvest mature crops in season
  const matureFarms = farms.filter(f => {
    const farmId = 'farm_' + f.id;
    const cropData = S.farmCrops[farmId];
    if (!cropData || !cropData.mature || cropData.harvested) return false;
    const cropType = CROP_DATA[cropData.crop];
    return cropType && cropType.harvestSeasons.includes(S.season);
  });
  
  if (matureFarms.length > 0 && Math.random() < 0.2) {
    const farm = matureFarms[Math.floor(Math.random() * matureFarms.length)];
    sendFarmerToHarvest(farm);
  }
}

function sendFarmerToHarvest(farmBuild) {
  if (!canSpawnVillager('farmer')) {
    return;
  }
  
  const house = findNearestHouse(farmBuild.x, farmBuild.y);
  const farmId = 'farm_' + farmBuild.id;
  
  spawnVillager('farmer', house.x, house.y, farmBuild.x + 32, farmBuild.y + 32, {
    taskType: 'farm_harvest',
    farmId: farmId,
    workRequired: 3.0,
    onComplete: (v) => {
      const yield = harvestFarm(farmId);
      if (yield && yield > 0) {
        toast(`Farmer harvested: +${Math.floor(yield)} food`, 2000);
      }
    }
  });
}


// ============================================
// BUILDER VILLAGER SYSTEM - ENHANCED
// ============================================

function sendBuilderToConstruction() {
  const builderPop = Math.floor(S.pop * S.builders);
  
  if (builderPop < 1) return; // Need at least some builders allocated
  if (!canSpawnVillager('builder', 1)) return;
  
  const inProgress = S.builds.filter(b => !b.done);
  if (inProgress.length === 0) return;
  
  // Pick the site with least progress (prioritize new buildings)
  const site = inProgress.sort((a, b) => a.progress - b.progress)[0];
  const house = findNearestHouse(site.x, site.y);
  
  spawnVillager('builder', house.x, house.y, site.x + 32, site.y + 32, {
    taskType: 'construct',
    buildId: site.id,
    workRequired: 1.5,  // Reduced from 2.5 - faster building!
    onComplete: (v) => {
      // Builders give HUGE progress boost
      const building = S.builds.find(b => b.id === site.id);
      if (building && !building.done) {
        // More builders = bigger bonus
        const builderBonus = 1.0 + (builderPop * 0.1);
        building.progress += builderBonus;
        toast(`Builder contributed +${builderBonus.toFixed(1)} progress!`, 1500);
        
        // Check if building is complete
        if (building.progress >= building.dur) {
          building.done = true;
          building.progress = building.dur;
          onBuildComplete(building);
        }
      }
    }
  });
}

// ============================================
// DRAG & DROP
// ============================================

function setupDragAndDrop() {
  const ground = el('ground');
  if (!ground) return;

  ground.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    ground.style.outline = '2px dashed rgba(124, 156, 191, 0.5)';
  });
  
  ground.addEventListener('dragleave', e => {
    ground.style.outline = 'none';
  });

  ground.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    ground.style.outline = 'none';
    
    if (!draggedType) {
      console.log('No dragged type');
      return;
    }

    const b = BUILDS[draggedType];
    if (!b) {
      console.log('Invalid building type:', draggedType);
      return;
    }
    
    if (S.materials < b.mat) {
      playSound('bad');
      toast('Not enough materials! Need ' + b.mat);
      return;
    }

    playSound('build');
    const rect = ground.getBoundingClientRect();
    const x = e.clientX - rect.left - 32;
    const y = e.clientY - rect.top - 32;

    S.materials -= b.mat;
    S.builds.push({
      id: Date.now() + Math.random(),
      type: draggedType,
      x: Math.max(0, Math.min(rect.width - 64, x)),
      y: Math.max(0, Math.min(rect.height - 64, y)),
      done: false,
      progress: 0,
      dur: b.dur
    });

    toast(`Building ${b.name}...`);
    updateUI();
  });
}

// ============================================
// CROP SELECTION
// ============================================

function openCropMenu(buildId) {
  const farmId = 'farm_' + buildId;
  S._activeFarmSelect = farmId;

  const grid = el('cropGrid');
  if (!grid) return;

  grid.innerHTML = Object.entries(CROP_DATA).map(([key, v]) => {
    const canPlantNow = v.plantSeasons.includes(S.season);
    const plantLbl = v.plantSeasons.map(s => S.seasons[s]).join(' / ');
    const harvestLbl = v.harvestSeasons.map(s => S.seasons[s]).join(' / ');
    const hardy = v.winterHardy ? 'Hardy' : 'Not hardy';

    return `
      <div class="crop-card">
        <div class="crop-card-header">${v.name}</div>
        <div class="crop-card-stats">
          Yield: ${Math.round(v.yield * 100)}%<br>
          ${hardy}<br>
          Plant: ${plantLbl}<br>
          Harvest: ${harvestLbl}
        </div>
        <button class="crop-card-btn" data-crop="${key}" ${canPlantNow ? '' : 'disabled'}>
          ${canPlantNow ? 'Plant' : 'Not in season'}
        </button>
        </div>
    `;
  }).join('');

  grid.querySelectorAll('.crop-card-btn').forEach(btn => {
    btn.onclick = () => {
      const choice = btn.dataset.crop;
      selectCropForFarm(farmId, choice, el('setDefaultCrop').checked);
    };
  });

  el('cropCancel').onclick = () => hideModal('cropModal');
  el('cropClose').onclick = () => hideModal('cropModal');

  showModal('cropModal');
}

function selectCropForFarm(farmId, cropKey, setDefaultAlso) {
  const cd = CROP_DATA[cropKey];
  if (!cd) return;

  if (!cd.plantSeasons.includes(S.season)) {
    const names = cd.plantSeasons.map(s => S.seasons[s]).join(' or ');
    toast(`${cd.name} can only be planted in ${names}`);
    playSound('bad');
    return;
  }

  S.farmCrops[farmId] = {
    crop: cropKey,
    plantedDay: S.day,
    plantedSeason: S.season,
    plantedYear: S.year,
    mature: false,
    daysGrowing: 0,
    harvested: false
  };

  if (setDefaultAlso) {
    S.cropType = cropKey;
    toast(`Default crop: ${cd.name}`);
  }

  toast(`Planted ${cd.name}. Harvest in ~${cd.growthDays} days`);
  playSound('click');
  hideModal('cropModal');
  renderGrid();
}

// ============================================
// TECH TREE
// ============================================

function renderTechTree() {
  const container = el('techTreeContainer');
  if (!container) return;

  // Group techs by tier
  const tiers = [
    { num: 1, name: 'Early Agrarian (Foundation)' },
    { num: 2, name: 'Middle Agrarian (Optimization)' },
    { num: 3, name: 'Late Agrarian (Pre-Industrial)' }
  ];

  container.innerHTML = tiers.map(tier => {
    const techs = Object.keys(TECH_TREE).filter(key => TECH_TREE[key].tier === tier.num);
    
    return `
      <div class="tech-tier">
        <div class="tier-title">${tier.name}</div>
        <div class="tech-tier-grid">
          ${techs.map(key => renderTechCard(key)).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  container.querySelectorAll('.tech-card').forEach(card => {
    const techKey = card.dataset.tech;
    const tech = TECH_TREE[techKey];
    
    if (!S.tech[techKey] && tech.req.every(r => S.tech[r]) && S.materials >= tech.cost) {
      card.querySelector('.tech-unlock-btn')?.addEventListener('click', () => unlockTech(techKey));
    }
  });
}

function renderTechCard(key) {
  const t = TECH_TREE[key];
  const unlocked = S.tech[key];
  const reqsMet = t.req.every(r => S.tech[r]);
  const canAfford = S.materials >= t.cost;
  const canUnlock = !unlocked && reqsMet && canAfford;

  let classes = 'tech-card';
  if (unlocked) classes += ' unlocked';
  else if (!reqsMet) classes += ' locked';
  else if (canAfford) classes += ' affordable';

  let reqText = '';
  if (t.req.length && !unlocked) {
    const missing = t.req.filter(r => !S.tech[r]);
    if (missing.length) {
      reqText = `<div class="tech-requirements">Requires: ${missing.map(m => TECH_TREE[m].name).join(', ')}</div>`;
    }
  }

  return `
    <div class="tech-card ${classes}" data-tech="${key}">
      <div class="tech-status"></div>
      <div class="tech-category">${t.category}</div>
      <div class="tech-name">${t.name}</div>
      <div class="tech-desc">${t.desc}</div>
      ${reqText}
      <div class="tech-effect">${t.effect}</div>
      <div class="tech-cost">${unlocked ? '✓ Unlocked' : t.cost + ' materials'}</div>
      ${canUnlock ? '<button class="tech-unlock-btn">Unlock</button>' : ''}
    </div>
  `;
}

function unlockTech(key) {
  const t = TECH_TREE[key];
  if (S.materials < t.cost) {
    playSound('bad');
    toast('Not enough materials!');
    return;
  }

  playSound('tech');
  S.materials -= t.cost;
  S.tech[key] = true;

  // Apply effects
  if (key === 'threeField') S.tfp *= 1.15;
  if (key === 'heavyPlough') S.tfp *= 1.25;
  if (key === 'seedSelection') S.tfp *= 1.10;
  if (key === 'fertilizer') S.tfp *= 1.15;
  if (key === 'well') S.health = Math.min(1, S.health + 0.2);
  if (key === 'charteredRights') S.lordTithePct = 0.25;
  if (key === 'guildSystem') {
    S.tfp *= 1.10;
    S.morale = Math.min(1, S.morale + 0.15);
  }
  if (key === 'woodworking') {
    Object.keys(BUILDS).forEach(bKey => {
      BUILDS[bKey].mat = Math.floor(BUILDS[bKey].mat * 0.8);
    });
  }

  toast(`Unlocked: ${t.name}!`, 3000);
  renderTechTree();
  renderBuildPalette();
  updateUI();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Pause/Resume
  const btnPause = el('btnPause');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      isPaused = !isPaused;
      btnPause.textContent = isPaused ? '▶' : '⏸';
      toast(isPaused ? 'Paused' : 'Resumed');
    });
  }

  // Speed control
  const speedSelect = el('speedSelect');
  if (speedSelect) speedSelect.addEventListener('change', startTick);

  // Labor sliders
  const farmerSlider = el('farmerSlider');
  const builderSlider = el('builderSlider');
  const herderSlider = el('herderSlider');
  const gathererSlider = el('gathererSlider');
  const intensitySlider = el('intensitySlider');

  if (farmerSlider) {
    farmerSlider.addEventListener('input', e => {
      S.farmers = e.target.value / 100;
      normalizeLabor();
      updateUI();
    });
  }

  if (builderSlider) {
    builderSlider.addEventListener('input', e => {
      S.builders = e.target.value / 100;
      normalizeLabor();
      updateUI();
    });
  }

  if (herderSlider) {
    herderSlider.addEventListener('input', e => {
      S.herders = e.target.value / 100;
      normalizeLabor();
      updateUI();
    });
  }

  if (gathererSlider) {
    gathererSlider.addEventListener('input', e => {
      S.gatherers = e.target.value / 100;
      normalizeLabor();
      updateUI();
    });
  }

  if (intensitySlider) {
    intensitySlider.addEventListener('input', e => {
      S.workIntensity = e.target.value / 100;
      updateUI();
    });
  }

  // Crop selection buttons
  document.querySelectorAll('.crop-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.crop-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.cropType = btn.dataset.crop;
      playSound('click');
      toast(`Default crop: ${CROP_DATA[btn.dataset.crop].name}`);
    });
  });

  // Land policy
  const btnPolicy = el('btnPolicy');
  if (btnPolicy) {
    btnPolicy.addEventListener('click', () => {
      if (S.landPolicy === 'commons') {
        S.landPolicy = 'enclosed';
        S.enclosureRate = 0.02; // 2% per year
        S.morale = Math.max(0, S.morale - 0.10);
        btnPolicy.innerHTML = `Enclosing Land (${Math.round(S.enclosedLandPct * 100)}%)`;
        toast('Land enclosure begins - displacing peasants gradually');
      } else if (S.enclosureRate > 0) {
        S.enclosureRate = 0; // Pause enclosure
        btnPolicy.innerHTML = `Enclosure Paused (${Math.round(S.enclosedLandPct * 100)}%)`;
        toast('Enclosure paused - can resume or reverse');
      } else {
        S.landPolicy = 'commons';
        S.enclosureRate = -0.01; // Reverse slowly
        S.morale = Math.min(1, S.morale + 0.05);
        btnPolicy.innerHTML = 'Commons (Equal Access)';
        toast('Returning land to commons - slow process');
      }
      playSound('click');
      updateUI();
    });
  }

  // Tech tree button
  const btnTechTree = el('btnTechTree');
  if (btnTechTree) {
    btnTechTree.addEventListener('click', () => {
      playSound('click');
      renderTechTree();
      showModal('techModal');
    });
  }

  // Modal closes
  el('techClose')?.addEventListener('click', () => hideModal('techModal'));
  el('cropClose')?.addEventListener('click', () => hideModal('cropModal'));
  el('cropCancel')?.addEventListener('click', () => hideModal('cropModal'));

  // Save/Menu
  el('btnSave')?.addEventListener('click', saveGame);
  el('btnMenu')?.addEventListener('click', () => {
    toast('Menu not yet implemented');
  });

  // Setup drag and drop
  setupDragAndDrop();
}

function normalizeLabor() {
  const total = S.farmers + S.builders + S.herders + S.gatherers;
  if (total > 1) {
    const scale = 1 / total;
    S.farmers *= scale;
    S.builders *= scale;
    S.herders *= scale;
    S.gatherers *= scale;
  }
  
  const fs = el('farmerSlider');
  const bs = el('builderSlider');
  const hs = el('herderSlider');
  const gs = el('gathererSlider');
  
  if (fs) fs.value = S.farmers * 100;
  if (bs) bs.value = S.builders * 100;
  if (hs) hs.value = S.herders * 100;
  if (gs) gs.value = S.gatherers * 100;
}

// Labor friction - skills decay when reallocating
function updateLaborSkills() {
  const friction = 0.85; // 15% productivity loss when switching roles
  const skillGrowth = 0.02; // 2% skill gain per season when working
  
  // Track actual labor allocation changes
  const laborChange = {
    farmers: Math.abs(S.farmers - S.laborSkills.farmers),
    builders: Math.abs(S.builders - S.laborSkills.builders),
    herders: Math.abs(S.herders - S.laborSkills.herders),
    gatherers: Math.abs(S.gatherers - S.laborSkills.gatherers)
  };
  
  // Calculate reallocation cost (lost productivity)
  S.laborReallocationCost = 
    (laborChange.farmers + laborChange.builders + 
     laborChange.herders + laborChange.gatherers) * 0.5;
  
  // Skills gradually adjust toward actual allocation
  Object.keys(S.laborSkills).forEach(role => {
    const target = S[role];
    const current = S.laborSkills[role];
    
    if (target > current) {
      // Growing this role - train new workers (slow)
      S.laborSkills[role] = Math.min(target, current + skillGrowth);
    } else if (target < current) {
      // Shrinking this role - skills decay (fast)
      S.laborSkills[role] = Math.max(target, current - skillGrowth * 2);
    }
  });
  
  // Apply productivity penalty for skill mismatch
  const skillMismatch = 
    Math.abs(S.farmers - S.laborSkills.farmers) +
    Math.abs(S.builders - S.laborSkills.builders) +
    Math.abs(S.herders - S.laborSkills.herders) +
    Math.abs(S.gatherers - S.laborSkills.gatherers);
  
  // TFP penalty: max 20% loss if everyone switches roles
  const skillPenalty = 1 - (skillMismatch * 0.1);
  return Math.max(0.8, skillPenalty);
}

// Enclosure happens gradually, player controls the rate
function updateEnclosureSystem() {
  // Enclosure rate set by player policy (see setupEventListeners update below)
  S.enclosedLandPct = Math.min(1.0, S.enclosedLandPct + S.enclosureRate / 365);
  
  // Enclosed land produces wool instead of grain
  const enclosedFarms = S.builds.filter(b => b.type === 'farm' && b.done).length;
  S.woolProduction = enclosedFarms * S.enclosedLandPct * 0.5 * S.tfp;
  
  // Enclosure displaces peasants → landless laborers
  const displacementRate = 0.15; // 15% become landless
  const newLandless = S.pop * S.enclosedLandPct * displacementRate;
  S.landlessLaborers = Math.floor(newLandless);
  
  // Landless laborers increase labor supply → wage pressure
  const laborSupplyEffect = 1 + (S.landlessLaborers / S.pop) * 0.3;
  
  // But also improve farm efficiency (larger consolidated fields)
  const enclosureEfficiency = 1 + S.enclosedLandPct * 0.25;
  
  // Social tension from inequality
  if (S.enclosedLandPct > 0.4 && Math.random() < 0.01) {
    triggerEnclosureUnrest();
  }
  
  return { efficiency: enclosureEfficiency, laborSupply: laborSupplyEffect };
}

function triggerEnclosureUnrest() {
  isPaused = true;
  
  const unrestEvent = {
    id: 'enclosure_unrest',
    title: 'Peasant Unrest',
    desc: `Displaced villagers protest land enclosure. ${S.landlessLaborers} people have lost access to common land. They demand you slow or reverse enclosure.`,
    effect: 'Accept: Pause enclosure for 2 years | Decline: -30% morale, risk of violence',
    action: () => {
      S.enclosureRate = 0;
      setTimeout(() => {
        if (S.landPolicy === 'enclosed') {
          S.enclosureRate = 0.02; // Resume after 2 years
        }
      }, 730000); // ~2 years at 1x speed
      toast('Enclosure paused to calm unrest');
      return true;
    },
    decline: () => {
      S.morale = Math.max(0.1, S.morale - 0.3);
      if (Math.random() < 0.3) {
        const deaths = Math.floor(S.pop * 0.05);
        S.pop -= deaths;
        S.totalDeaths += deaths;
        toast(`Violent suppression! ${deaths} killed in riots`, 5000);
        playSound('bad');
      } else {
        toast('Unrest suppressed, but morale devastated', 4000);
      }
    }
  };
  
  showEventCard(unrestEvent);
}

// Trade surplus food at market prices
function updateTradeSystem() {
  const needPerDay = S.pop * 0.10;
  const subsistenceBuffer = needPerDay * 30; // 30 days reserve
  
  // Only surplus above buffer can be sold
  S.foodSurplus = Math.max(0, S.foodStock - subsistenceBuffer);
  
  // Market price fluctuates based on:
  // 1. Urban demand (growing cities need more food)
  // 2. Harvest quality (bad harvests = high prices)
  // 3. Random merchant activity
  
  const harvestQuality = (S.lastFoodProduction / needPerDay) / 10; // 0-1 range
  const urbanDemandEffect = S.urbanPopPct * 10; // Cities drive prices up
  const randomFluctuation = 0.9 + Math.random() * 0.2; // ±10%
  
  S.marketPrice = (0.5 + urbanDemandEffect - harvestQuality * 0.3) * randomFluctuation;
  S.marketPrice = Math.max(0.3, Math.min(2.5, S.marketPrice));
  
  // Auto-sell surplus if market exists
  const hasMarket = S.builds.some(b => b.type === 'market' && b.done);
  if (hasMarket && S.foodSurplus > 0) {
    const sellAmount = Math.min(S.foodSurplus, needPerDay * 5); // Max 5 days/day
    S.grainSold = sellAmount;
    S.tradeIncome = sellAmount * S.marketPrice * 0.1; // Materials earned
    S.materials += S.tradeIncome;
    S.foodStock -= sellAmount;
    
    // Track commercialization
    const commercializationPct = S.grainSold / (S.lastFoodProduction + 0.1);
    if (commercializationPct > 0.3) {
      // High market integration
      S.tfp *= 1.02; // Specialization gains
    }
  } else {
    S.grainSold = 0;
    S.tradeIncome = 0;
  }
}

// Urban population grows from rural surplus & displaced laborers
function updateUrbanSystem() {
  // Urban growth drivers:
  // 1. Food surplus enables non-farm population
  // 2. Landless laborers migrate to towns
  // 3. Trade activity creates urban jobs
  
  const foodSurplusEffect = S.foodSurplus / (S.pop * 0.10 * 30);
  const migrationPressure = S.landlessLaborers / S.pop;
  const tradeEffect = S.grainSold > 0 ? 0.02 : 0;
  
  const urbanGrowthRate = (foodSurplusEffect * 0.01 + migrationPressure * 0.005 + tradeEffect) / 365;
  
  S.urbanPopPct = Math.min(0.20, S.urbanPopPct + urbanGrowthRate);
  
  // Urban demand for food
  S.urbanDemand = 1 + S.urbanPopPct * 5;
  
  // Urban growth slightly reduces rural labor supply
  const urbanAbsorption = S.urbanPopPct * 0.1;
  return { laborReduction: urbanAbsorption, demandMultiplier: S.urbanDemand };
}

// ============================================
// MODAL UTILITIES
// ============================================

function showModal(id) {
  const modal = el(id);
  if (modal) {
    modal.classList.add('show');
    isPaused = true;
  }
}

function hideModal(id) {
  const modal = el(id);
  if (modal) {
    modal.classList.remove('show');
    isPaused = false;
  }
}

// ============================================
// SAVE/LOAD
// ============================================

function saveGame() {
  try {
    localStorage.setItem('econoville_save', JSON.stringify(S));
    toast('Game saved!');
    playSound('complete');
  } catch (e) {
    toast('Save failed: ' + e.message);
    playSound('bad');
  }
}

function loadGame() {
  try {
    const saved = localStorage.getItem('econoville_save');
    if (saved) {
      Object.assign(S, JSON.parse(saved));
      toast('Game loaded!');
      return true;
    }
  } catch (e) {
    toast('Load failed: ' + e.message);
  }
  return false;
}

// ============================================
// STARTUP
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}