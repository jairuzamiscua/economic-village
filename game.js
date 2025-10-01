/* ============================================
   ECONOVILLE PHASE 1 - GAME LOGIC.
   A+ Production-Ready Version (JS-only)
   ============================================ */

// ============================================
// CORE STATE & CONSTANT
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
  
  switch(type) {
    case 'click':
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
      break;
      
    case 'build':
      oscillator.frequency.value = 400;
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
      break;
      
    case 'harvest':
      oscillator.frequency.value = 600;
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.15);
      break;
      
    case 'complete':
      oscillator.frequency.value = 523.25; // C5
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      oscillator.start(audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
      oscillator.stop(audioCtx.currentTime + 0.4);
      break;
      
    case 'tech':
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
      break;
      
    case 'bad':
      oscillator.frequency.value = 200;
      oscillator.type = 'sawtooth';
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.3);
      break;
  }
}

let autoStarted = false;
let tickInterval = null;
let draggedType = null;
let isPaused = false;
let eventTimeout = null;

const S = {
  // Time
  day: 1,
  year: 1,
  season: 0,
  seasons: ['Spring', 'Summer', 'Autumn', 'Winter'],

  // Population
  pop: 80,
  cap: 150,
  totalDeaths: 0,

  // Labor allocation
  farmers: 0.5,
  builders: 0.3,
  herders: 0.1,
  gatherers: 0.1,
  workIntensity: 1.0,

  // Resources
  materials: 20,
  foodStock: 5,
  livestock: 0,

  // Economic indicators
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

  // Progress tracking
  tech: {},
  builds: [],
  nodes: [],

  // Win condition tracking
  wageAbove13Years: 0,

  tutorialStep: 0,
  tutorialCompleted: false,

  // Data export
  history: [],

  // Seasonality
  lastSeasonWarning: -1,
  harvestBonusShown: false,
  seasonTransitionShown: false,

  milestones: {
    firstWinter: { complete: false, reward: 'materials', amount: 15 },
    population100: { complete: false, reward: 'tfp', amount: 1.1 },
    firstMill: { complete: false, reward: 'morale', amount: 0.2 },
    marketBuilt: { complete: false, reward: 'materials_income', amount: 2 },
    sustained_wage: { complete: false, reward: 'victory_progress', amount: 25 }
  },
  victoryProgress: 0,

  // Add to State object
  seasonalPressure: {
    spring: { farmers: 0.6, builders: 0.2, gatherers: 0.1, herders: 0.1 },
    summer: { farmers: 0.5, builders: 0.3, gatherers: 0.1, herders: 0.1 },
    autumn: { farmers: 0.7, builders: 0.1, gatherers: 0.1, herders: 0.1 },
    winter: { farmers: 0.3, builders: 0.4, gatherers: 0.2, herders: 0.1 }
  },

  age: 1,
  ageGoals: {
    1: { name: 'Survival', pop: 100, year: 3, complete: false },
    2: { name: 'Expansion', pop: 125, mills: 2, complete: false },
    3: { name: 'Prosperity', pop: 150, mills: 3, wage: true, complete: false }
  },
  gatherers: 0, // For gatherer system if you implement it
  lastFoodProduction: 0, // Track food production for display

  lastLaborWarning: -1, // Prevent spam

  // Material Generation System
  nodeRegenQueue: []
};


// Tutorial Overlay
const TUTORIAL_STEPS = [
  {
    target: 'buildPalette',
    title: 'Build Your Economy',
    text: 'Drag farms and houses onto the green area. Farms produce food, houses increase population cap.',
    highlight: true
  },
  {
    target: 'farmerSlider',
    title: 'Allocate Labor',
    text: '50% farmers grow food. 30% builders construct faster. Balance these carefully.',
    highlight: true
  },
  {
    target: 'realWage',
    title: 'Watch Real Wages',
    text: 'This is your survival meter. Below 1.0 = crisis. Population grows when wages are high.',
    highlight: true
  },
  {
    target: 'ground',
    title: 'Gather Resources',
    text: 'Click trees and rocks to gather materials for buildings and technology.',
    highlight: true
  },
  {
    target: 'btnTech',
    title: 'Unlock Technologies',
    text: 'Spend materials here to improve farming, reduce disease, and grow faster.',
    highlight: true
  }
];

function showTutorial() {
  console.log('showTutorial called, step:', S.tutorialStep); // DEBUG
  
  if (S.tutorialCompleted) {
    console.log('Tutorial already completed');
    return;
  }
  
  const step = TUTORIAL_STEPS[S.tutorialStep];
  if (!step) {
    S.tutorialCompleted = true;
    toast('Tutorial complete! Now survive and grow.', 5000);
    return;
  }
  
  console.log('Showing step:', step.title); // DEBUG
  
  // Remove any existing overlay
  const existingOverlay = document.getElementById('tutorialOverlay');
  if (existingOverlay) {
    console.log('Removing existing overlay');
    existingOverlay.remove();
  }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'tutorialOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.9)';
  overlay.style.zIndex = '99999'; // SUPER HIGH
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  
  const box = document.createElement('div');
  box.style.background = 'linear-gradient(180deg, #111827, #0b1224)';
  box.style.border = '2px solid #22d3ee';
  box.style.borderRadius = '16px';
  box.style.padding = '32px';
  box.style.maxWidth = '500px';
  box.style.width = '90%';
  box.style.boxShadow = '0 20px 60px rgba(0,0,0,0.7)';
  
  box.innerHTML = `
    <h3 style="color: #22d3ee; margin-bottom: 16px; font-size: 20px;">${step.title}</h3>
    <p style="margin-bottom: 24px; line-height: 1.6; font-size: 15px; color: #e5e7eb;">${step.text}</p>
    <button id="tutorialNext" style="width: 100%; padding: 12px; font-size: 14px; background: linear-gradient(135deg, #22d3ee, #a78bfa); border: none; border-radius: 8px; color: #000; font-weight: 600; cursor: pointer;">
      Got it (${S.tutorialStep + 1}/${TUTORIAL_STEPS.length})
    </button>
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  console.log('Overlay appended to body'); // DEBUG
  
  // Attach click handler
  const btn = document.getElementById('tutorialNext');
  if (btn) {
    console.log('Button found, attaching handler');
    btn.onclick = () => {
      console.log('Button clicked');
      overlay.remove();
      S.tutorialStep++;
      
      if (S.tutorialStep < TUTORIAL_STEPS.length) {
        setTimeout(() => showTutorial(), 400);
      } else {
        S.tutorialCompleted = true;
        toast('Tutorial complete! Good luck, Chief.', 4000);
      }
    };
  } else {
    console.error('Tutorial button not found!');
  }
}

// Tech Tree
const TECH_TREE = {
  basicFarming: {
    name: 'Basic Farming',
    cost: 0,
    req: [],
    effect: 'Enables farms',
    desc: 'Cultivate crops for food production'
  },
  livestock: {
    name: 'Livestock Domestication',
    cost: 15,
    req: ['basicFarming'],
    effect: 'Animals for food & draft power',
    desc: 'Domesticate animals for steady food supply'
  },
  threeField: {
    name: 'Three-Field Rotation',
    cost: 20,
    req: ['basicFarming'],
    effect: '+15% yield, prevent soil loss',
    desc: 'Rotate crops to maintain soil fertility'
  },
  heavyPlough: {
    name: 'Heavy Plough',
    cost: 25,
    req: ['livestock'],
    effect: '+20% farm TFP',
    desc: 'Animal-powered deep tilling'
  },
  manure: {
    name: 'Manure Fertilization',
    cost: 15,
    req: ['livestock'],
    effect: '+10% yield per livestock unit',
    desc: 'Enrich soil with animal waste'
  },
  irrigation: {
    name: 'Irrigation Canals',
    cost: 30,
    req: ['basicFarming'],
    effect: 'Drought penalty -30% → -10%',
    desc: 'Water distribution systems'
  },
  granary: {
    name: 'Granary Storage',
    cost: 25,
    req: ['basicFarming'],
    effect: 'Spoilage 25% → 10%',
    desc: 'Preserve surplus grain safely'
  },
  well: {
    name: 'Well & Sanitation',
    cost: 20,
    req: [],
    effect: '+20% health, lower disease',
    desc: 'Clean water source'
  },
  marketAccess: {
    name: 'Market Road',
    cost: 20,
    req: ['basicFarming'],
    effect: 'Enable surplus trade',
    desc: 'Roads connecting to regional markets'
  },
  seedSelection: {
    name: 'Seed Selection',
    cost: 18,
    req: ['threeField'],
    effect: '+8% crop yields',
    desc: 'Choose best seeds for planting'
  },
  animalBreeding: {
    name: 'Selective Breeding',
    cost: 22,
    req: ['livestock'],
    effect: 'Livestock growth +50%',
    desc: 'Breed stronger, more productive animals'
  },
  mill: {
    name: 'Windmill Technology',
    cost: 35,
    req: ['basicFarming'],
    effect: '+12% TFP (capital good)',
    desc: 'Mechanical grain milling'
  },
  market: {
    name: 'Market Charter',
    cost: 25,
    req: ['marketAccess'],
    effect: 'Allows Market build',
    desc: 'Institutional framework for trade'
  }
};

const BUILDS = {
  farm: { name: 'Farm', mat: 8, dur: 5, icon: 'farm' },
  house: { name: 'House', mat: 12, dur: 4, icon: 'house' },
  well: { name: 'Well', mat: 15, dur: 6, icon: 'well', reqTech: 'well' },
  granary: { name: 'Granary', mat: 20, dur: 7, icon: 'granary', reqTech: 'granary' },
  livestock: { name: 'Livestock Pen', mat: 12, dur: 5, icon: 'livestock', reqTech: 'livestock' },
  market: { name: 'Market', mat: 25, dur: 6, icon: 'market', reqTech: 'market' },
  mill: { name: 'Windmill', mat: 35, dur: 8, icon: 'mill', reqTech: 'mill' }
};

const CROP_DATA = {
  wheat: { yield: 1.0, droughtMult: 0.6, soilDrain: 0.02 },
  rye: { yield: 0.85, droughtMult: 0.9, soilDrain: 0.015 },
  legumes: { yield: 0.7, droughtMult: 0.85, soilDrain: -0.01 }
};

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
        toast('Purchased iron tools! +15% farm productivity');
        return true;
      }
      toast('Not enough materials!');
      return false;
    }
  },
  {
    id: 'harsh_winter',
    title: 'Harsh Winter Forecast',
    desc: 'Scouts report a brutal winter approaching. Slaughter livestock now for guaranteed food, or risk keeping them?',
    effect: 'Accept: +15 food now, -3 livestock | Decline: Keep livestock, risk losses',
    action: () => {
      if (S.livestock >= 3) {
        S.foodStock += 15;
        S.livestock -= 3;
        toast('Livestock slaughtered. +15 food, -3 animals');
        return true;
      }
      toast('Not enough livestock!');
      return false;
    }
  },
  {
    id: 'neighbor_aid',
    title: 'Neighboring Village Requests Aid',
    desc: 'A nearby village suffered crop failure. They request food aid and promise future alliance.',
    effect: 'Accept: -15 food, +20% morale | Decline: Keep food',
    action: () => {
      if (S.foodStock >= 15) {
        S.foodStock -= 15;
        S.morale = Math.min(1, S.morale + 0.2);
        toast('Aid sent! +20% morale from goodwill');
        return true;
      }
      toast('Not enough food to share!');
      return false;
    }
  },
  {
    id: 'scholar',
    title: 'Wandering Scholar',
    desc: 'A scholar offers to teach advanced farming techniques for a modest payment.',
    effect: 'Cost: 15 materials | Gain: +10% TFP',
    cost: 15,
    action: () => {
      if (S.materials >= 15) {
        S.materials -= 15;
        S.tfp *= 1.1;
        toast('Knowledge acquired! +10% TFP');
        return true;
      }
      toast("Cannot afford the scholar's fee!");
      return false;
    }
  },
  {
    id: 'bandits',
    title: 'Bandit Threat',
    desc: 'Bandits demand tribute. Pay them off or risk a raid that damages morale.',
    effect: 'Accept: -10 materials | Decline: -20% morale',
    action: () => {
      if (S.materials >= 10) {
        S.materials -= 10;
        toast('Tribute paid. Bandits leave peacefully.');
        return true;
      }
      toast('Cannot pay! Bandits raid nearby.');
      return false;
    },
    decline: () => {
      S.morale = Math.max(0, S.morale - 0.2);
      toast('Bandits raid outskirts! -20% morale');
    }
  },
  {
    id: 'rain_blessing',
    title: 'Rain Blessing Predicted',
    desc: 'Elders predict abundant rain. Plant extra fields now to maximize harvest?',
    effect: 'Accept: -5 materials (seeds) | Next week: +30% farm output',
    action: () => {
      if (S.materials >= 5) {
        S.materials -= 5;
        S.tfp *= 1.3;
        setTimeout(() => {
          S.tfp /= 1.3;
        }, 14000); // about one sim-week depending on tick speed
        toast('Extra planting! +30% output for one week');
        return true;
      }
      toast('Not enough materials for extra seeds!');
      return false;
    }
  },
  {
    id: 'festival',
    title: 'Harvest Festival Request',
    desc: 'Villagers want a harvest festival. Costs food but greatly boosts morale.',
    effect: 'Cost: 10 food | Gain: +25% morale',
    action: () => {
      if (S.foodStock >= 10) {
        S.foodStock -= 10;
        S.morale = Math.min(1, S.morale + 0.25);
        toast('Festival celebrated! +25% morale');
        return true;
      }
      toast('Not enough food for a festival!');
      return false;
    }
  },
  {
    id: 'tool_repair',
    title: 'Tool Maintenance',
    desc: 'Farm tools need repair. Invest now or risk productivity decline?',
    effect: 'Accept: -8 materials | Prevent -10% TFP loss',
    action: () => {
      if (S.materials >= 8) {
        S.materials -= 8;
        toast('Tools repaired and maintained.');
        return true;
      }
      toast('Cannot afford repairs!');
      return false;
    },
    decline: () => {
      S.tfp *= 0.9;
      toast('Tools degrade! -10% TFP');
    }
  },
  {
   id: 'bad_harvest',
    title: 'Bad Harvest',
    desc: 'Blight hits the fields. Yields fall unexpectedly.',
    effect: '−30% farm output for 20 days',
    action: () => {
      S.tfp *= 0.7;
      setTimeout(() => (S.tfp /= 0.7), 20000);
      toast('Bad harvest! Output down temporarily.');
      return true;
    }
  },
  {
    id: 'rats_granary',
    title: 'Rats in the Granary',
    desc: 'Pests spoil your stores overnight.',
    effect: 'Lose 25% of stored food',
    action: () => {
      const loss = Math.max(0, Math.floor(S.foodStock * 0.25));
      S.foodStock = Math.max(0, S.foodStock - loss);
      toast(`Rats! Lost ${loss} food from stores.`);
      return true;
    }
  }
];

// Current (too subtle)
const seasonalYield = [1.0, 1.2, 0.8, 0.3];

// Better (creates real crisis)
const SEASON_DATA = {
  0: { 
    name: 'Spring',
    mult: 0.7,
    color: '#86efac',
    icon: '🌱',
    desc: 'Planting season - reduced yields',
    warning: null // ADD THIS
  },
  1: { 
    name: 'Summer', 
    mult: 1.0,
    color: '#fcd34d',
    icon: '☀️',
    desc: 'Growing season - good yields',
    warning: null // ADD THIS
  },
  2: { 
    name: 'Autumn',
    mult: 1.5,
    color: '#fb923c',
    icon: '🌾',
    desc: 'HARVEST! Store food for winter',
    warning: 'Winter approaches - store 90+ days of food!' // ADD THIS
  },
  3: { 
    name: 'Winter',
    mult: 0.1,
    color: '#93c5fd',
    icon: '❄️',
    desc: 'SURVIVAL MODE - live on stores',
    warning: 'Ration carefully - spring comes soon' // ADD THIS
  }
};

function checkCriticalAlerts() {
  const needPerDay = S.pop * 0.10;
  const daysOfFood = S.foodStock / needPerDay;
  
  // Food crisis warning
  if (daysOfFood < 10 && daysOfFood > 0) {
    const warning = el('gameLog');
    if (warning) {
      warning.innerHTML = `<span style="color:var(--warn);">⚠ LOW FOOD: ${Math.floor(daysOfFood)} days remaining!</span>`;
    }
  } else if (S.foodStock < 0) {
    const warning = el('gameLog');
    if (warning) {
      warning.innerHTML = `<span style="color:var(--bad);">🚨 STARVATION: Build more farms NOW!</span>`;
    }
  }
  
  // Material shortage
  if (S.materials < 10 && S.nodes.length === 0) {
    const warning = el('gameLog');
    if (warning) {
      warning.innerHTML = `<span style="color:var(--warn);">⚠ Material shortage: Wait for resources to respawn</span>`;
    }
  }
  
  // Wage crisis
  if (S.realWage < 0.8) {
    const warning = el('gameLog');
    if (warning) {
      warning.innerHTML = `<span style="color:var(--bad);">🚨 WAGE CRISIS: Famine imminent!</span>`;
    }
  }
}


// ============================================
// INITIALIZATION & LANDING SCREEN
// ============================================

function init() {
  // Buttons present on landing
  const btnStart = el('btnStart');
  const btnHowTo = el('btnHowTo');
  const howToClose = el('howToClose');

  if (btnStart) btnStart.addEventListener('click', startGame);
  if (btnHowTo) btnHowTo.addEventListener('click', () => showModal('howToModal'));
  if (howToClose) howToClose.addEventListener('click', () => hideModal('howToModal'));

  // Start with basic farming unlocked
  S.tech.basicFarming = true;

  // Initialize weather
  rollWeather();
}

function autoStart() {
  if (!autoStarted) {
    autoStarted = true;
    startTick();
    toast('Time flows! Make decisions to grow your village.');
  }
}

function startGame() {
  const landing = el('landing');
  const gameContainer = el('gameContainer');
  
  if (landing && gameContainer) {
    // Fade out landing
    landing.style.transition = 'opacity 0.3s';
    landing.style.opacity = '0';
    
    setTimeout(() => {
      landing.style.display = 'none';
      gameContainer.style.display = 'grid';
      gameContainer.style.opacity = '0'; // ADD: Start invisible
      
      // Initialize game state
      initializeGameState();
      
      // Show tutorial FIRST, before revealing game
      showTutorial();
      
      // THEN fade in game behind the overlay
      setTimeout(() => {
        gameContainer.style.transition = 'opacity 0.3s';
        gameContainer.style.opacity = '1';
      }, 100);
    }, 300);
  }
}

function initializeGameState() {
  // Pre-build starting infrastructure
  for (let i = 0; i < 3; i++) {
    S.builds.push({
      id: 'start_farm_' + i,
      type: 'farm',
      x: 150 + i * 120,
      y: 100,
      done: true,
      progress: BUILDS.farm.dur,
      dur: BUILDS.farm.dur
    });
  }
  
  for (let i = 0; i < 2; i++) {
    S.builds.push({
      id: 'start_house_' + i,
      type: 'house',
      x: 200 + i * 120,
      y: 30,
      done: true,
      progress: BUILDS.house.dur,
      dur: BUILDS.house.dur
    });
  }

  // Leaner start: 1 finished farm, 1 half-built farm, 1 house
  S.builds.push({
    id: 'start_farm_1',
    type: 'farm',
    x: 150,
    y: 100,
    done: true,
    progress: BUILDS.farm.dur,
    dur: BUILDS.farm.dur
  });
  S.builds.push({
    id: 'start_farm_2',
    type: 'farm',
    x: 270,
   y: 100,
    done: false,
    progress: BUILDS.farm.dur / 2,
    dur: BUILDS.farm.dur
  });
  S.builds.push({
    id: 'start_house_1',
    type: 'house',
    x: 200,
    y: 30,
    done: true,
   progress: BUILDS.house.dur,
   dur: BUILDS.house.dur
  });

  // Tighter early buffer & worried village
  S.foodStock = 15;
  S.morale = 0.45;




  spawnNodes();
  setupEventListeners();
  renderPalette();
  updateUI();

  document.addEventListener('click', autoStart, { once: true });
  document.addEventListener('input', autoStart, { once: true });

  toast('Welcome, Chief! Time will begin when you interact.');
}

// ============================================
// GAME LOOP
// ============================================

function startTick() {
  const speedSel = el('speedSelect');
  const speed = speedSel ? parseInt(speedSel.value) : 250;
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(tick, speed);
}

function tick() {
  if (isPaused) return;

  // Construction progress
  const builderPop = Math.floor(S.pop * S.builders);
  S.builds.forEach(b => {
    if (!b.done) {
      const oldProgress = b.progress;
      b.progress += builderPop * 0.02 * S.workIntensity;
      
      // Audio feedback at milestones
      if (Math.floor(oldProgress / (b.dur / 4)) < Math.floor(b.progress / (b.dur / 4))) {
        playSound('click'); // Quarter completion sound
      }
      
      if (b.progress >= b.dur) {
        b.done = true;
        onBuildComplete(b);
      }
    }
  });

  // Resource regeneration check
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
        toast(`A ${regen.type} has regrown!`);
      }
    }
  }

  function checkMilestones() {
  // First winter survival
    if (!S.milestones.firstWinter.complete && S.year === 2 && S.season === 0) {
      S.milestones.firstWinter.complete = true;
      S.materials += 15;
      showMilestone('Survived First Winter!', 'Gained 15 materials bonus', '+15 Materials');
      playSound('complete');
    }
    
    // Population milestone
    if (!S.milestones.population100.complete && S.pop >= 100) {
      S.milestones.population100.complete = true;
      S.tfp *= 1.1;
      showMilestone('Village Expansion!', 'Population reached 100', '+10% Productivity');
      playSound('complete');
    }
    
    // First mill (capital accumulation)
    const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
    if (!S.milestones.firstMill.complete && mills >= 1) {
      S.milestones.firstMill.complete = true;
      S.morale = Math.min(1, S.morale + 0.2);
      showMilestone('Industrial Revolution Begins!', 'First windmill operational', '+20% Morale');
      playSound('complete');
    }
    
    // Market economy
    const hasMarket = S.builds.some(b => b.type === 'market' && b.done);
    if (!S.milestones.marketBuilt.complete && hasMarket) {
      S.milestones.marketBuilt.complete = true;
      S.materialsPerYear = 2; // Passive income
      showMilestone('Market Economy Unlocked!', 'Trade generates passive materials', '+2 Materials/Year');
      playSound('complete');
    }
    
    // Sustained prosperity
    if (!S.milestones.sustained_wage.complete && S.wageAbove13Years >= 1) {
      S.milestones.sustained_wage.complete = true;
      S.victoryProgress += 25;
      showMilestone('Prosperity Sustained!', 'High wages for 1 full year', 'Victory: 25%');
      playSound('complete');
    }
  }

  function showMilestone(title, desc, reward) {
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, var(--accent)22, var(--panel));
      border: 3px solid var(--accent);
      border-radius: 16px;
      padding: 30px 40px;
      z-index: 10000;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
      text-align: center;
      min-width: 350px;
      animation: scaleIn 0.5s;
    `;
    
    popup.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">🏆</div>
      <div style="font-size: 22px; font-weight: 800; margin-bottom: 8px; color: var(--accent);">
        ${title}
      </div>
      <div style="font-size: 14px; margin-bottom: 16px; color: var(--muted);">
        ${desc}
      </div>
      <div style="font-size: 18px; font-weight: 700; color: var(--good); background: #0b1224aa; padding: 12px; border-radius: 8px;">
        ${reward}
      </div>
    `;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
      popup.style.animation = 'fadeOut 0.5s';
      setTimeout(() => popup.remove(), 500);
    }, 3500);
  }

  // Food production
  const farms = S.builds.filter(b => b.type === 'farm' && b.done).length;
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
  const farmerPop = Math.floor(S.pop * S.farmers);
  const herderPop = Math.floor(S.pop * S.herders);
  const gathererPop = Math.floor(S.pop * S.gatherers);
  
  if (S.day % 30 === 0 && autoStarted) {
    const gameLog = el('gameLog');
    if (gameLog && farms > 0) {
      const foodPerFarm = S.lastFoodProduction / Math.max(1, farms);
      gameLog.innerHTML = `
        <span style="color:var(--accent)">
          📊 ${farms} farms producing ${foodPerFarm.toFixed(1)} food/farm/day
          ${mills > 0 ? `| ${mills} mills = +${Math.round(mills * 12)}% TFP` : ''}
        </span>
      `;
    }
  }

  if (S.gatherJobs && S.gatherJobs.length > 0) {
    const job = S.gatherJobs[0]; // Work first in queue
    job.progress += gathererPop * 0.05 * S.workIntensity;
    
    if (job.progress >= job.required) {
      // Job complete
      const gain = job.type === 'tree' ? 4 : 5;
      S.materials += gain;
      playSound('harvest');
      toast(`Gathered +${gain} materials from ${job.type}`);
      
      // Remove node
      const node = S.nodes.find(n => n.id === job.nodeId);
      if (node) {
        S.nodeRegenQueue.push({
          ...node,
          regenTime: S.year + 5
        });
        S.nodes = S.nodes.filter(n => n.id !== job.nodeId);
      }
      
      // Remove job
      S.gatherJobs.shift();
    }
  }

  // ===== CONTINUOUS SEASONAL LABOR FEEDBACK =====
  // Check every 10 days if allocation is suboptimal
  if (S.day % 10 === 0 && autoStarted) {
    const seasonName = S.seasons[S.season].toLowerCase();
    const recommended = S.seasonalPressure[seasonName];
    
    // Calculate how far off they are
    const farmerGap = recommended.farmers - S.farmers;
    const builderGap = recommended.builders - S.builders;
    
    // Autumn: Penalize low farmers during harvest
    if (S.season === 2 && S.farmers < 0.55) {
      const penalty = Math.abs(farmerGap) * 0.15; // Up to 15% production loss
      farmFood *= (1 - penalty);
      
      if (S.day % 30 === 0 && S.lastLaborWarning !== S.day) {
        S.lastLaborWarning = S.day;
        toast(`⚠️ Harvest suffers! Only ${Math.round(S.farmers * 100)}% farmers = ${Math.round(penalty * 100)}% food loss`, 5000);
        highlightSlider('farmer', 8000);
      }
    }
    
    // Winter: Reward high builders (they have nothing else to do)
    if (S.season === 3 && S.builders > 0.35) {
      const bonus = (S.builders - 0.3) * 0.5; // Up to 10% construction bonus
      S.builds.forEach(b => {
        if (!b.done) {
          b.progress += builderPop * 0.01 * bonus; // Extra construction
        }
      });
      
      if (S.day === 30 && S.lastLaborWarning !== S.day) {
        S.lastLaborWarning = S.day;
        toast(`❄️ Winter efficiency! High builders = +${Math.round(bonus * 100)}% construction`, 4000);
      }
    }
    
    // Spring: Penalize low farmers (crops need planting)
    if (S.season === 0 && S.farmers < 0.5) {
      const penalty = Math.abs(farmerGap) * 0.12;
      farmFood *= (1 - penalty);
      
      if (S.day === 40 && S.lastLaborWarning !== S.day) {
        S.lastLaborWarning = S.day;
        toast(`🌱 Planting delayed! Low farmers = ${Math.round(penalty * 100)}% yield loss`, 5000);
        highlightSlider('farmer', 8000);
      }
    }
    
    // Summer: Balanced - warn if too extreme either way
    if (S.season === 1 && (S.farmers < 0.4 || S.farmers > 0.7)) {
      if (S.day === 45 && S.lastLaborWarning !== S.day) {
        S.lastLaborWarning = S.day;
        if (S.farmers < 0.4) {
          toast(`☀️ Summer shortage! Crops need more attention`, 4000);
          highlightSlider('farmer', 6000);
        } else {
          toast(`☀️ Overfarming! You could expand infrastructure`, 4000);
          highlightSlider('builder', 6000);
        }
      }
    }
  }

  // ===== SEASONAL FOOD PRODUCTION =====
  const seasonData = SEASON_DATA[S.season];
  const seasonMult = seasonData.mult;

  // Diminishing returns to land (Ricardian)
  const landPerFarm = S.totalLand / Math.max(1, farms);
  const diminishingReturns = Math.pow(landPerFarm / 10, 0.6);

  // Crop-specific multipliers
  const crop = CROP_DATA[S.cropType];
  const baseFoodPerFarm = 2.5 * crop.yield;

  // Farm production with SEASONAL multiplier
  let farmFood =
    farms *
    baseFoodPerFarm *
    S.tfp *
    S.landQuality *
    diminishingReturns *
    (farmerPop / Math.max(1, S.pop)) *
    S.workIntensity *
    seasonMult; // SEASONAL MULTIPLIER APPLIED

  // Weather effects
  const w = weatherEffect(S.weatherNow);
  farmFood *= w.mult;

  // Morale bonus
  const moraleBonus = 1 + (S.morale - 0.5) * 0.2;
  farmFood *= moraleBonus;

  // Enclosure bonus
  if (S.landPolicy === 'enclosed') {
    farmFood *= 1.15;
  }

  // ===== AUTUMN HARVEST RUSH BONUS =====
  if (S.season === 2 && S.farmers > 0.6) {
    farmFood *= 1.3; // 30% bonus for dedicating workers
    
    if (S.day === 1 && !S.harvestBonusShown) {
      S.harvestBonusShown = true;
      toast('HARVEST RUSH ACTIVE: 60%+ farmers = +30% bonus!', 5000);
    }
  }

  // Reset harvest flag each spring
  if (S.day === 1 && S.season === 0) {
    S.harvestBonusShown = false;
  }

  // Livestock production
  let livestockFood = S.livestock * 0.5 * (herderPop / Math.max(1, S.pop));

  // Tech bonuses
  if (S.tech.manure) {
    farmFood *= 1 + Math.min(S.livestock * 0.1, 0.5);
  }
  if (S.tech.seedSelection) {
    farmFood *= 1.08;
  }
  if (mills > 0) {
    farmFood *= 1 + mills * 0.12;
  }

  // Total food
  const totalFood = farmFood + livestockFood;
  const spoilage = totalFood * w.spoil;
  
  // Year 1 villages have poor storage unless Granary tech is unlocked
  const extraYearOneSpoil = (!S.tech.granary && S.year === 1) ? totalFood * 0.10 : 0;
  const netFood = totalFood - spoilage - extraYearOneSpoil;

  // Store for UI display
  S.lastFoodProduction = netFood;

  S.foodStock += netFood;

  // Consumption
  const needPerDay = S.pop * 0.10;
  S.foodStock -= needPerDay;

  // Early survival warning in first Spring
  if (S.year === 1 && S.season === 0 && S.day === 20) {
   const daysOfFoodNow = S.foodStock / needPerDay;
    if (daysOfFoodNow < 30) {
     toast('⚠️ Your stores won’t last winter. Shift labor to farming and build another farm.', 6000);
     const log = el('gameLog');
     if (log) log.innerHTML = `<span style="color:var(--warn)">Early warning: You need ~90 days stored by end of Autumn.</span>`;
    }
  }

  // Real wage calculation (Malthusian indicator)
  S.realWage = (S.foodStock / Math.max(1, S.pop)) / 0.2;

  // ===== WINTER SURVIVAL MECHANICS =====
  if (S.season === 3) { // Winter
    const daysOfFood = S.foodStock / needPerDay;
    
    // Health deteriorates faster without wells
    if (!S.tech.well) {
      S.health = Math.max(0.2, S.health - 0.005);
    }
    
    // Morale crisis if food insecure
    if (daysOfFood < 30) {
      S.morale = Math.max(0.1, S.morale - 0.015);
    }
    
    // Increased disease risk in winter starvation
    if (S.foodStock < 0) {
      if (Math.random() < w.disease * 2) {
        const deaths = Math.max(2, Math.floor(S.pop * 0.04));
        S.pop = Math.max(10, S.pop - deaths);
        S.totalDeaths += deaths;
        const gameLog = el('gameLog');
        if (gameLog) gameLog.innerHTML = `<span style="color:var(--bad)">Winter disease! Lost ${deaths} villagers.</span>`;
        toast(`Winter takes its toll: -${deaths} population`, 4000);
        playSound('bad');
      }
    }

    // FIRST WINTER CHECK: if you didn't stockpile, people die
    if (S.year === 1 && daysOfFood < 60) {
      const deaths = Math.max(4, Math.floor(S.pop * 0.10));
      S.pop = Math.max(10, S.pop - deaths);
      S.totalDeaths += deaths;
      const gameLog = el('gameLog');
      if (gameLog) gameLog.innerHTML = `<span style="color:var(--bad)">First winter bites! ${deaths} villagers perished.</span>`;
      toast(`First winter was harsh: -${deaths} population`, 4500);
      playSound('bad');
    }
  }

  if (S.day === 1 && autoStarted) {
    const seasonIdx = S.season;
    const seasonName = S.seasons[seasonIdx].toLowerCase();
    const recommended = S.seasonalPressure[seasonName];
    
    // Check if player's allocation is way off
    const farmerDiff = Math.abs(S.farmers - recommended.farmers);
    const builderDiff = Math.abs(S.builders - recommended.builders);
    
    if (farmerDiff > 0.2) {
      toast(`⚠️ ${S.seasons[seasonIdx]}: Consider ${recommended.farmers * 100}% farmers (currently ${Math.round(S.farmers * 100)}%)`, 6000);
    }
    
    if (seasonIdx === 2 && S.farmers < 0.6) {
      showSeasonalGuide('autumn');
    }
  }

  // In tick(), after season change:
  if (S.day === 1 && autoStarted) {
  const seasonIdx = S.season;
  
  // Critical autumn warning
  if (seasonIdx === 2 && S.farmers < 0.6) {
    showSeasonalGuide('autumn');
    highlightSlider('farmer', 8000);
  }
  
  // Winter construction opportunity
  if (seasonIdx === 3 && S.builders < 0.3) {
    showSeasonalGuide('winter');
    highlightSlider('builder', 8000);
  }
  
  // Spring planting
  if (seasonIdx === 0 && S.farmers < 0.5) {
    showSeasonalGuide('spring');
    highlightSlider('farmer', 8000);
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
    const gameLog = el('gameLog');
    if (gameLog) gameLog.innerHTML = `<span style="color:var(--bad)">Disease outbreak! Lost ${deaths} villagers.</span>`;
    toast(`Disease! -${deaths} population`, 4000);
  }

  // Famine (Malthusian crisis)
  if (S.year >= 3 && S.foodStock < -needPerDay * 3 && Math.random() < 0.1) {
    const famineDeaths = Math.floor(S.pop * 0.15);
    S.pop = Math.max(20, S.pop - famineDeaths);
    S.totalDeaths += famineDeaths;
    S.foodStock = needPerDay * 5;
    const gameLog = el('gameLog');
    if (gameLog) gameLog.innerHTML = `<span style="color:var(--bad)">FAMINE! ${famineDeaths} perished. Malthusian reset.</span>`;
    toast(`<strong>FAMINE!</strong> Population crash. Wages will rise for survivors.`, 5000);
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
    toast('👶 Population +1! Village growing.', 2000);
  }

  // Livestock breeding
  const breedRate = S.tech.animalBreeding ? 0.075 : 0.05;
  if (herderPop > 0 && S.livestock < herderPop * 3 && Math.random() < breedRate) {
    S.livestock++;
  }

  // Soil quality dynamics
  if (!S.tech.threeField && farms > 0) {
    S.landQuality = Math.max(0.5, S.landQuality - crop.soilDrain);
  } else if (S.tech.threeField) {
    S.landQuality = Math.min(1.0, S.landQuality + 0.005);
  }

  // ===== SEASON WARNINGS =====
  const daysOfFood = S.foodStock / needPerDay;

  // Winter warning at day 75 of Autumn
  if (S.season === 2 && S.day === 75 && S.lastSeasonWarning !== 2) {
    S.lastSeasonWarning = 2;
    if (daysOfFood < 90) {
      showWinterWarning(15, daysOfFood);
    }
  }

  // Critical warning at day 85 of Autumn
  if (S.season === 2 && S.day === 85 && daysOfFood < 60) {
    showWinterWarning(5, daysOfFood);
  }

  // Time progression
  S.day++;
  if (S.day > 90) {
    S.day = 1;
    S.year++;
    const oldSeason = S.season;
    S.season = (S.season + 1) % 4;
    
    // Announce season change
    if (autoStarted) {
      announceSeasonChange(oldSeason, S.season);
    }
    
    // Track sustained high wages
    if (S.realWage > 1.3) {
      S.wageAbove13Years++;
    } else {
      S.wageAbove13Years = 0;
    }
    
    // Reset season warning flag
    S.lastSeasonWarning = -1;
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

  // Age progression
  if (S.age === 1 && S.year >= 3 && S.pop >= 100 && !S.ageGoals[1].complete) {
    S.ageGoals[1].complete = true;
    S.age = 2;
    S.tfp *= 1.1;
    toast('🎉 BRONZE AGE UNLOCKED! +10% TFP. New technologies available.', 6000);
    playSound('complete');
  }
  if (S.age === 2 && S.pop >= 125 && mills >= 2 && !S.ageGoals[2].complete) {
    S.ageGoals[2].complete = true;
    S.age = 3;
    toast('🎉 IRON AGE UNLOCKED! Markets now generate trade income.', 6000);
    playSound('complete');
  }

  // Check win condition
  checkVictory();

  // Check Milestones
  checkMilestones();

  if (S.milestones.marketBuilt.complete && S.day === 1) {
    S.materials += S.materialsPerYear || 0;
  }

  // Check critical alerts
  checkCriticalAlerts();

  // Check for contextual events
  checkContextualEvents()

  // Update UI
  updateUI();
  updateTheoryStatus();
}

// ===== SEASON ANNOUNCEMENT =====
function announceSeasonChange(oldSeason, newSeason) {
  const seasonData = SEASON_DATA[newSeason];
  
  // Full-screen overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, ${seasonData.color}22, #00000088);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.5s;
  `;
  
  const box = document.createElement('div');
  box.style.cssText = `
    background: var(--panel);
    border: 3px solid ${seasonData.color};
    border-radius: 20px;
    padding: 40px 60px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    animation: scaleIn 0.5s;
  `;
  
  box.innerHTML = `
    <div style="font-size: 72px; margin-bottom: 20px;">${seasonData.icon}</div>
    <div style="font-size: 32px; font-weight: 800; margin-bottom: 12px; color: ${seasonData.color};">
      ${seasonData.name.toUpperCase()}
    </div>
    <div style="font-size: 16px; margin-bottom: 16px; color: var(--muted);">
      ${seasonData.desc}
    </div>
    <div style="font-size: 20px; font-weight: 600; color: ${seasonData.mult > 1 ? 'var(--good)' : seasonData.mult < 0.5 ? 'var(--bad)' : 'var(--warn)'}">
      Food Production: ${Math.round(seasonData.mult * 100)}%
    </div>
    ${seasonData.warning ? `
      <div style="font-size: 14px; margin-top: 16px; padding: 12px; background: #7f1d1d44; border: 1px solid var(--bad); border-radius: 8px; color: var(--bad);">
        ${seasonData.warning}
      </div>
    ` : ''}
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  // Sound effects
  if (newSeason === 3) { // Winter
    playSound('bad');
    setTimeout(() => playSound('bad'), 200);
  } else if (newSeason === 2) { // Autumn harvest
    playSound('complete');
  } else {
    playSound('click');
  }
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    overlay.style.animation = 'fadeOut 0.5s';
    setTimeout(() => overlay.remove(), 500);
  }, 2500);
}

// ===== WINTER WARNING =====
function showWinterWarning(daysLeft, daysOfFood) {
  const warning = document.createElement('div');
  warning.style.cssText = `
    position: fixed;
    top: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #7f1d1dcc, #450a0acc);
    border: 2px solid var(--bad);
    border-radius: 12px;
    padding: 20px 30px;
    z-index: 8000;
    max-width: 500px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    animation: shake 0.5s, fadeIn 0.3s;
  `;
  
  const deficit = Math.max(0, 90 - daysOfFood);
  
  warning.innerHTML = `
    <div style="font-size: 32px; text-align: center; margin-bottom: 12px;">⚠️</div>
    <div style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: var(--bad); text-align: center;">
      WINTER APPROACHING
    </div>
    <div style="font-size: 14px; line-height: 1.6; text-align: center;">
      Winter starts in <strong>${daysLeft} days</strong>. Food production drops to <strong>20%</strong>.
      <br/><br/>
      Current stores: <strong>${Math.floor(daysOfFood)} days</strong>
      <br/>
      <span style="color: ${deficit > 30 ? 'var(--bad)' : 'var(--warn)'}; font-weight: 600;">
        ${deficit > 0 ? `You need ${Math.ceil(deficit)} more days of food!` : 'You are prepared for winter.'}
      </span>
      <br/><br/>
      <span style="font-size: 12px; opacity: 0.8;">
        ${deficit > 0 ? 'Build more farms and increase farmer allocation NOW!' : 'Well done! Maintain your stores.'}
      </span>
    </div>
  `;
  
  document.body.appendChild(warning);
  
  playSound('bad');
  
  setTimeout(() => {
    warning.style.animation = 'fadeOut 0.5s';
    setTimeout(() => warning.remove(), 500);
  }, 5500);
}

// In onBuildComplete() function, add:
function onBuildComplete(b) {
  playSound('complete');
  
  // Visual celebration effect
  const icon = document.querySelector(`[data-id="${b.id}"]`);
  if (icon) {
    // Flash effect
    icon.style.animation = 'scaleIn 0.5s, pulse 0.3s 3';
    setTimeout(() => icon.style.animation = '', 2000);
    
    // Particle burst
    for (let i = 0; i < 8; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: absolute;
        width: 6px;
        height: 6px;
        background: var(--accent);
        border-radius: 50%;
        left: ${icon.offsetLeft + 36}px;
        top: ${icon.offsetTop + 36}px;
        pointer-events: none;
        z-index: 1000;
      `;
      document.getElementById('ground').appendChild(particle);
      
      const angle = (i / 8) * Math.PI * 2;
      const distance = 40;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      
      particle.animate([
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: `translate(${tx}px, ${ty}px)`, opacity: 0 }
      ], {
        duration: 600,
        easing: 'ease-out'
      }).onfinish = () => particle.remove();
    }
  }
  
  // Immediate stat impact display
  const buildType = BUILDS[b.type];
  let impactMsg = '';
  let statChange = '';
  
  if (b.type === 'farm') {
    const oldProduction = S.lastFoodProduction;
    // Recalculate to show new production
    setTimeout(() => {
      const newProduction = S.lastFoodProduction;
      const gain = newProduction - oldProduction;
      if (gain > 0) {
        toast(`🌾 Farm complete! +${gain.toFixed(1)} food/day production`, 4000);
      }
    }, 100);
    
    if (S.farmers < 0.4) {
      setTimeout(() => {
        toast(`Tip: Increase farmers to ${Math.round(S.farmers * 100 + 10)}% to use this farm`, 3000);
        highlightSlider('farmer', 5000);
      }, 4500);
    }
    statChange = 'food production';
  }
  
  if (b.type === 'house') {
    const oldCap = S.cap;
    S.cap += 5; // Already happens but show it
    toast(`🏠 House complete! Population cap: ${oldCap} → ${S.cap}`, 4000);
    statChange = 'population capacity';
  }
  
  if (b.type === 'well') {
    const oldHealth = S.health;
    S.health = Math.min(1, S.health + 0.2);
    const healthGain = Math.round((S.health - oldHealth) * 100);
    toast(`💧 Well complete! Health: +${healthGain}%, disease risk halved`, 4000);
    statChange = 'health';
    
    // Show visible meter change
    setTimeout(() => updateUI(), 200);
  }
  
  if (b.type === 'granary') {
    toast(`🌾 Granary complete! Food spoilage: 25% → 10%`, 4000);
    toast(`Each harvest now wastes 60% less food`, 3000);
    statChange = 'food efficiency';
  }
  
  if (b.type === 'livestock') {
    S.livestock += 2;
    toast(`🐑 Livestock Pen complete! +2 animals (now ${S.livestock} total)`, 4000);
    if (S.herders < 0.1) {
      setTimeout(() => {
        toast(`Tip: Allocate 10%+ to herders to breed animals`, 3000);
        highlightSlider('herder', 5000);
      }, 4500);
    }
    statChange = 'livestock count';
  }
  
  if (b.type === 'market') {
    toast(`🏛️ Market complete! Unlocked: +2 materials/year passive income`, 4000);
    S.materialsPerYear = 2;
    statChange = 'trade income';
  }
  
  if (b.type === 'mill') {
    const oldTFP = S.tfp;
    S.tfp *= 1.12;
    const tfpGain = Math.round((S.tfp - oldTFP) * 100);
    toast(`⚙️ Windmill complete! Total Factor Productivity: +${tfpGain}%`, 4000);
    
    if (S.builders > 0.3) {
      setTimeout(() => {
        toast(`Consider reducing builders now that construction is done`, 3000);
        highlightSlider('builder', 5000);
      }, 4500);
    }
    statChange = 'productivity';
  }
  
  // Show before/after comparison popup
  showBuildingImpact(buildType.name, statChange);
}

function showBuildingImpact(buildingName, statType) {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, var(--panel), var(--panel2));
    border: 3px solid var(--accent);
    border-radius: 16px;
    padding: 24px 32px;
    z-index: 10000;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    min-width: 300px;
    text-align: center;
    animation: scaleIn 0.4s;
  `;
  
  const impacts = {
    'food production': '🌾',
    'population capacity': '🏠',
    'health': '💧',
    'food efficiency': '📦',
    'livestock count': '🐑',
    'trade income': '💰',
    'productivity': '⚙️'
  };
  
  popup.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 12px;">${impacts[statType] || '✨'}</div>
    <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: var(--accent);">
      ${buildingName} Complete!
    </div>
    <div style="font-size: 14px; color: var(--muted); margin-bottom: 16px;">
      Impact: ${statType}
    </div>
    <div style="font-size: 13px; padding: 12px; background: #0b1224aa; border-radius: 8px; color: var(--good);">
      Check your meters to see the improvement
    </div>
  `;
  
  document.body.appendChild(popup);
  
  setTimeout(() => {
    popup.style.animation = 'fadeOut 0.4s';
    setTimeout(() => popup.remove(), 400);
  }, 2500);
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

  return { mult, spoil, disease };
}

function rollWeather() {
  S.weatherNow = seasonWeighted(S.season);
  S.weatherNext = seasonWeighted(S.season);
}

// ============================================
// SEASON ANNOUNCEMENT
// ============================================
// ===== SEASON ANNOUNCEMENT =====
function announceSeasonChange(oldSeason, newSeason) {
  const seasonData = SEASON_DATA[newSeason];
  
  // Full-screen overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, ${seasonData.color}22, #00000088);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.5s;
  `;
  
  const box = document.createElement('div');
  box.style.cssText = `
    background: var(--panel);
    border: 3px solid ${seasonData.color};
    border-radius: 20px;
    padding: 40px 60px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    animation: scaleIn 0.5s;
  `;
  
  box.innerHTML = `
    <div style="font-size: 72px; margin-bottom: 20px;">${seasonData.icon}</div>
    <div style="font-size: 32px; font-weight: 800; margin-bottom: 12px; color: ${seasonData.color};">
      ${seasonData.name.toUpperCase()}
    </div>
    <div style="font-size: 16px; margin-bottom: 16px; color: var(--muted);">
      ${seasonData.desc}
    </div>
    <div style="font-size: 20px; font-weight: 600; color: ${seasonData.mult > 1 ? 'var(--good)' : seasonData.mult < 0.5 ? 'var(--bad)' : 'var(--warn)'}">
      Food Production: ${Math.round(seasonData.mult * 100)}%
    </div>
    ${seasonData.warning ? `
      <div style="font-size: 14px; margin-top: 16px; padding: 12px; background: #7f1d1d44; border: 1px solid var(--bad); border-radius: 8px; color: var(--bad);">
        ${seasonData.warning}
      </div>
    ` : ''}
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  // Sound effects
  if (newSeason === 3) { // Winter
    playSound('bad');
    setTimeout(() => playSound('bad'), 200);
  } else if (newSeason === 2) { // Autumn harvest
    playSound('complete');
  } else {
    playSound('click');
  }
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    overlay.style.animation = 'fadeOut 0.5s';
    setTimeout(() => overlay.remove(), 500);
  }, 2500);
}

// ===== WINTER WARNING =====
function showWinterWarning(daysLeft, daysOfFood) {
  const warning = document.createElement('div');
  warning.style.cssText = `
    position: fixed;
    top: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #7f1d1dcc, #450a0acc);
    border: 2px solid var(--bad);
    border-radius: 12px;
    padding: 20px 30px;
    z-index: 8000;
    max-width: 500px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
    animation: shake 0.5s, fadeIn 0.3s;
  `;
  
  const deficit = Math.max(0, 90 - daysOfFood);
  
  warning.innerHTML = `
    <div style="font-size: 32px; text-align: center; margin-bottom: 12px;">⚠️</div>
    <div style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: var(--bad); text-align: center;">
      WINTER APPROACHING
    </div>
    <div style="font-size: 14px; line-height: 1.6; text-align: center;">
      Winter starts in <strong>${daysLeft} days</strong>. Food production drops to <strong>20%</strong>.
      <br/><br/>
      Current stores: <strong>${Math.floor(daysOfFood)} days</strong>
      <br/>
      <span style="color: ${deficit > 30 ? 'var(--bad)' : 'var(--warn)'}; font-weight: 600;">
        ${deficit > 0 ? `You need ${Math.ceil(deficit)} more days of food!` : 'You are prepared for winter.'}
      </span>
      <br/><br/>
      <span style="font-size: 12px; opacity: 0.8;">
        ${deficit > 0 ? 'Build more farms and increase farmer allocation NOW!' : 'Well done! Maintain your stores.'}
      </span>
    </div>
  `;
  
  document.body.appendChild(warning);
  
  playSound('bad');
  
  setTimeout(() => {
    warning.style.animation = 'fadeOut 0.5s';
    setTimeout(() => warning.remove(), 500);
  }, 5500);
}

// ============================================
// EVENT SYSTEM
// ============================================

function checkContextualEvents() {
  // Only check every 7 days to avoid spam
  if (S.day % 7 !== 0) return;
  
  const possibleEvents = [];
  
  // Crisis events (only when struggling)
  if (S.realWage < 0.9 && S.foodStock < S.pop * 2) {
    const evt = EVENTS.find(e => e.id === 'neighbor_aid');
    if (evt) possibleEvents.push(evt);
  }
  
  if (S.foodStock < 0 && S.livestock >= 3) {
    const evt = EVENTS.find(e => e.id === 'harsh_winter');
    if (evt) possibleEvents.push(evt);
  }
  
  // Opportunity events (only when thriving)
  if (S.materials >= 20 && S.realWage > 1.2) {
    const evt = EVENTS.find(e => e.id === 'merchant_tools');
    if (evt) possibleEvents.push(evt);
  }
  
  if (S.morale < 0.4 && S.foodStock > S.pop * 10) {
    const evt = EVENTS.find(e => e.id === 'festival');
    if (evt) possibleEvents.push(evt);
  }
  
  // Tech opportunity (only if can actually afford and use it)
  if (S.materials >= 15 && !S.tech.heavyPlough && S.tech.livestock) {
    const evt = EVENTS.find(e => e.id === 'scholar');
    if (evt) possibleEvents.push(evt);
  }
  
  // Tool maintenance (only if you have TFP to lose)
  if (S.tfp > 1.2 && S.materials < 20) {
    const evt = EVENTS.find(e => e.id === 'tool_repair');
    if (evt) possibleEvents.push(evt);
  }
  
  // Bandit threat (only mid-game)
  if (S.year >= 2 && S.materials >= 10 && Math.random() < 0.3) {
    const evt = EVENTS.find(e => e.id === 'bandits');
    if (evt) possibleEvents.push(evt);
  }
  
  // Trigger one if conditions met (30% chance when eligible)
  if (possibleEvents.length > 0 && Math.random() < 0.3) {
    const event = possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
    showEventCard(event);
  }
}

function triggerRandomEvent() {
  const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  showEventCard(event);
}

function showEventCard(event) {
  isPaused = true;

  const title = el('eventTitle');
  const desc = el('eventDesc');
  const eff = el('eventEffect');
  const card = el('eventCard');
  const accept = el('eventAccept');
  const decline = el('eventDecline');

  if (!card || !accept || !decline) {
    const ok = confirm(`${event.title}\n\n${event.desc}\n\n${event.effect}\n\nAccept?`);
    if (ok) event.action();
    else if (event.decline) event.decline();
    isPaused = false;
    return;
  }

  title.textContent = event.title;
  desc.textContent = event.desc;
  eff.textContent = event.effect;
  card.classList.add('show');

  accept.onclick = () => {
    if (event.action()) {
      card.classList.remove('show');
      isPaused = false;
    }
  };

  decline.onclick = () => {
    if (event.decline) event.decline();
    card.classList.remove('show');
    isPaused = false;
    toast('Event declined.');
  };
}

// ============================================
// UI UPDATE
// ============================================

function updateUI() {
  // Time
  const day = el('day');
  const year = el('year');
  const season = el('season');
  if (day) day.textContent = S.day;
  if (year) year.textContent = S.year;
  if (season) season.textContent = S.seasons[S.season];

  // HUD
  const pop = el('pop');
  const cap = el('cap');
  const mat = el('mat');
  const foodStock = el('foodStock');
  const livestock = el('livestock');
  const realWage = el('realWage');
  if (pop) pop.textContent = S.pop;
  if (cap) cap.textContent = S.cap;
  if (mat) mat.textContent = Math.floor(S.materials);
  if (foodStock) foodStock.textContent = Math.floor(S.foodStock);
  if (livestock) livestock.textContent = S.livestock;
  if (realWage) realWage.textContent = S.realWage.toFixed(2);

  // Weather display
  const weatherIcon = el('weatherIcon');
  const weatherNowLbl = el('weatherNow');
  const weatherNextLbl = el('weatherNext');
  const weatherIcons = {
    sunny: '☀️',
    rain: '🌧️',
    storm: '⛈️',
    drought: '🌵'
  };
  if (weatherIcon) weatherIcon.textContent = weatherIcons[S.weatherNow] || '🌤️';
  if (weatherNowLbl) weatherNowLbl.textContent = S.weatherNow;
  if (weatherNextLbl) weatherNextLbl.textContent = S.weatherNext;

  // ===== SEASON BANNER UPDATE =====
  const seasonData = SEASON_DATA[S.season];
  const banner = el('seasonBanner');
  const seasonIcon = el('seasonIcon');
  const seasonName = el('seasonName');
  const seasonDesc = el('seasonDesc');
  const seasonDay = el('seasonDay');

  if (banner) {
    banner.style.setProperty('--season-color', seasonData.color);
    banner.className = 'season-banner';
    if (S.season === 3) banner.classList.add('winter');
    if (S.season === 2) banner.classList.add('autumn');
  }
  if (seasonIcon) seasonIcon.textContent = seasonData.icon;
  if (seasonName) seasonName.textContent = seasonData.name;
  if (seasonDesc) seasonDesc.textContent = seasonData.desc;
  if (seasonDay) seasonDay.textContent = S.day;

  // Labor & land UI
  const popTotal = el('popTotal');
  const landQual = el('landQual');
  const landPolicy = el('landPolicy');
  const intensityPct = el('intensityPct');
  if (popTotal) popTotal.textContent = S.pop;
  if (landQual) landQual.textContent = Math.round(S.landQuality * 100) + '%';
  if (landPolicy) landPolicy.textContent = S.landPolicy === 'commons' ? 'Commons' : 'Enclosed';
  if (intensityPct) intensityPct.textContent = Math.round(S.workIntensity * 100) + '%';

  const laborHeader = document.querySelector('.labor').previousElementSibling; // The <h2>
  if (laborHeader && autoStarted) {
    let badge = laborHeader.querySelector('.labor-hint');
    
    const needsAdjustment = 
      (S.season === 2 && S.farmers < 0.6) ||
      (S.season === 3 && S.builders < 0.3) ||
      (S.season === 0 && S.farmers < 0.5);
    
    if (needsAdjustment && !badge) {
      badge = document.createElement('span');
      badge.className = 'labor-hint';
      badge.style.cssText = `
        background: var(--warn);
        color: #000;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        margin-left: 8px;
        font-weight: 700;
        animation: pulse 2s infinite;
      `;
      badge.textContent = '! ADJUST';
      laborHeader.appendChild(badge);
    } else if (!needsAdjustment && badge) {
      badge.remove();
    }
  }

  // Real wage badge
  const wb = el('wagebadge');
  if (wb) {
    if (S.realWage < 0.95) wb.className = 'badge bad';
    else if (S.realWage < 1.1) wb.className = 'badge warn';
    else wb.className = 'badge';
  }

  // Tech Notification
  const affordableTechs = Object.keys(TECH_TREE).filter(key => {
    const t = TECH_TREE[key];
    return !S.tech[key] && 
           t.req.every(r => S.tech[r]) && 
           S.materials >= t.cost;
  }).length;
  
  const btnTech = el('btnTech');
  if (btnTech) {
    if (affordableTechs > 0) {
      btnTech.innerHTML = `Tech Tree <span style="background:var(--accent); color:#000; padding:2px 6px; border-radius:10px; font-size:10px; margin-left:4px;">${affordableTechs}</span>`;
      btnTech.style.animation = 'pulse 2s infinite';
    } else {
      btnTech.textContent = 'Tech Tree';
      btnTech.style.animation = '';
    }
  }

  // Meters
  updateMeter(
    'fillWage',
    'wageLbl',
    'wageStatus',
    S.realWage / 2,
    S.realWage < 0.95 ? 'Crisis!' : S.realWage < 1.1 ? 'Below normal' : 'Healthy',
    S.realWage < 0.95 ? 'bad' : S.realWage < 1.1 ? 'warn' : ''
  );

  const needPerDay = S.pop * 0.2;
  const foodPct = Math.max(0, Math.min(1, S.foodStock / (needPerDay * 14)));
  updateMeter('fillFood', 'foodLbl', null, foodPct);
  const foodNeed = el('foodNeed');
  if (foodNeed) foodNeed.textContent = Math.floor(needPerDay);

  // Food production display
  const foodProduction = el('foodProduction');
  if (foodProduction) {
    foodProduction.textContent = (S.lastFoodProduction || 0).toFixed(1);
    
    // Show if seasonal penalty active
    const seasonName = S.seasons[S.season].toLowerCase();
    const recommended = S.seasonalPressure[seasonName];
    const farmerGap = Math.abs(recommended.farmers - S.farmers);
    
    if (farmerGap > 0.15 && (S.season === 0 || S.season === 2)) {
      foodProduction.style.color = 'var(--warn)';
      foodProduction.parentElement.style.animation = 'pulse 2s infinite';
    } else {
      foodProduction.style.color = '';
      foodProduction.parentElement.style.animation = '';
    }
  }
  
  // ===== FOOD BUFFER DISPLAY =====
  const daysOfFood = S.foodStock / needPerDay;
  const foodDays = el('foodDays');
  const bufferFill = el('bufferFill');
  const bufferWarning = el('bufferWarning');

  if (foodDays) {
    foodDays.textContent = Math.floor(daysOfFood);
    if (daysOfFood < 30) {
      foodDays.style.color = 'var(--bad)';
    } else if (daysOfFood < 90) {
      foodDays.style.color = 'var(--warn)';
    } else {
      foodDays.style.color = 'var(--good)';
    }
  }

  if (bufferFill) {
    const maxDisplay = 180; // Show up to 6 months
    const pct = Math.min(100, (daysOfFood / maxDisplay) * 100);
    bufferFill.style.width = pct + '%';
  }

  if (bufferWarning) {
    if (S.season === 2 && daysOfFood < 90) {
      bufferWarning.innerHTML = `<span style="color:var(--bad)">⚠️ Store ${Math.ceil(90 - daysOfFood)} more days for winter!</span>`;
    } else if (S.season === 3 && daysOfFood < 30) {
      bufferWarning.innerHTML = `<span style="color:var(--bad)">🚨 CRITICAL: Only ${Math.floor(daysOfFood)} days left!</span>`;
    } else {
      bufferWarning.textContent = 'Winter requires 90 days of stored food';
    }
  }

  updateMeter('fillHealth', 'healthLbl', null, S.health);
  const w = weatherEffect(S.weatherNow);
  const diseaseRisk = el('diseaseRisk');
  if (diseaseRisk) diseaseRisk.textContent = (w.disease * 100).toFixed(1) + '%';

  updateMeter('fillMorale', 'moraleLbl', null, S.morale);

  // Labor percentages
  const idle = Math.max(0, 1 - S.farmers - S.builders - S.herders - S.gatherers);
  const farmerPct = el('farmerPct');
  const builderPct = el('builderPct');
  const herderPct = el('herderPct');
  const gathererPct = el('gathererPct');
  const idlePct = el('idlePct');
  if (farmerPct) farmerPct.textContent = Math.round(S.farmers * 100) + '%';
  if (builderPct) builderPct.textContent = Math.round(S.builders * 100) + '%';
  if (herderPct) herderPct.textContent = Math.round(S.herders * 100) + '%';
  if (gathererPct) gathererPct.textContent = Math.round(S.gatherers * 100) + '%';
  if (idlePct) idlePct.textContent = Math.round(idle * 100) + '%';

  const victoryBar = el('victoryProgressBar');
  if (victoryBar) {
    victoryBar.style.width = S.victoryProgress + '%';
    victoryBar.textContent = S.victoryProgress + '%';
  }

  // Show building count and impact
  const farms = S.builds.filter(b => b.type === 'farm' && b.done).length;
  const houses = S.builds.filter(b => b.type === 'house' && b.done).length;
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
  
  // Update game log with building stats every 30 days
  if (S.day % 30 === 0 && autoStarted) {
    const gameLog = el('gameLog');
    if (gameLog && farms > 0) {
      const foodPerFarm = S.lastFoodProduction / Math.max(1, farms);
      gameLog.innerHTML = `
        <span style="color:var(--accent)">
          📊 ${farms} farms producing ${foodPerFarm.toFixed(1)} food/farm/day
          ${mills > 0 ? `| ${mills} mills = +${Math.round(mills * 12)}% TFP` : ''}
        </span>
      `;
    }
  }

  // Show construction queue
  const inProgress = S.builds.filter(b => !b.done);
  const queueBox = el('constructionQueue');
  const queueList = el('queueList');
  
  if (queueBox && queueList) {
    if (inProgress.length > 0) {
      queueBox.style.display = 'block';
      queueList.innerHTML = inProgress.map(b => {
        const pct = Math.round((b.progress / b.dur) * 100);
        const eta = Math.ceil((b.dur - b.progress) / (builderPop * 0.02 * S.workIntensity));
        return `
          <div style="margin-bottom: 8px; padding: 6px; background: #0b1224; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>${BUILDS[b.type].name}</span>
              <span style="color: var(--accent);">${pct}%</span>
            </div>
            <div style="height: 4px; background: #1f2937; border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; width: ${pct}%; background: var(--accent); transition: width 0.3s;"></div>
            </div>
            <div style="font-size: 9px; color: var(--muted); margin-top: 2px;">
              ETA: ~${eta} days
            </div>
          </div>
        `;
      }).join('');
    } else {
      queueBox.style.display = 'none';
    }
  }

  // Render
  renderPalette();
  renderGrid();
}

function updateMeter(fillId, lblId, statusId, pct, statusText = '', fillClass = '') {
  const fill = el(fillId);
  if (fill) {
    fill.style.width = Math.round(pct * 100) + '%';
    fill.className = 'fill ' + fillClass;
  }
  const lbl = el(lblId);
  if (lbl) lbl.textContent = Math.round(pct * 100) + '%';
  if (statusId) {
    const s = el(statusId);
    if (s) s.innerHTML = statusText;
  }
}

function updateMeter(fillId, lblId, statusId, pct, statusText = '', fillClass = '') {
  const fill = el(fillId);
  if (fill) {
    fill.style.width = Math.round(pct * 100) + '%';
    fill.className = 'fill ' + fillClass;
  }
  const lbl = el(lblId);
  if (lbl) lbl.textContent = Math.round(pct * 100) + '%';
  if (statusId) {
    const s = el(statusId);
    if (s) s.innerHTML = statusText;
  }
}

function updateTheoryStatus() {
  let theory = '';
  if (S.realWage < 0.95) {
    theory = "<span style='color:var(--bad)'>Malthusian Crisis</span> - Wages below subsistence, population will collapse";
  } else if (S.realWage > 1.3) {
    theory = "<span style='color:var(--good)'>Post-Crisis Boom</span> - Labor scarcity, high wages (temporary golden age)";
  } else if (S.landPolicy === 'enclosed' && S.realWage < 1.1) {
    theory = "<span style='color:var(--warn)'>Enclosure Effects</span> - Efficiency vs equity trade-off";
  } else if (S.tech.threeField && S.tech.heavyPlough) {
    theory = "<span style='color:var(--accent)'>Smithian Growth</span> - TFP rising from specialization";
  } else {
    theory = "<span style='color:var(--muted)'>Malthusian Trap</span> - Steady state equilibrium";
  }
  const theoryStatus = el('theoryStatus');
  if (theoryStatus) theoryStatus.innerHTML = theory;
}

// ============================================
// BUILDINGS & RESOURCES
// ============================================

function renderPalette() {
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
      <div class="tile-icon icon ${b.icon}" style="position:static"></div>
      <div class="tile-name">${b.name}</div>
      <div class="tile-cost">${b.mat}m • ${b.dur}d</div>
    `;

    tile.addEventListener('dragstart', e => {
      draggedType = key;
      e.dataTransfer.effectAllowed = 'copy';
    });

    tile.addEventListener('dragend', () => (draggedType = null));

    pal.appendChild(tile);
  });
}

function renderGrid() {
  const grid = el('grid');
  const ground = el('ground');
  if (!grid || !ground) return;
  
  // Check both grid and ground for existing icons
  const existing = [
    ...grid.querySelectorAll('.icon'),
    ...ground.querySelectorAll('.icon')
  ];

  S.builds.forEach(b => {
    let icon = existing.find(e => e.dataset.id == b.id);
    if (!icon) {
      icon = document.createElement('div');
      icon.className = 'icon ' + BUILDS[b.type].icon + (b.done ? '' : ' site');
      icon.dataset.id = b.id;
      icon.style.left = b.x + 'px';
      icon.style.top = b.y + 'px';
      ground.appendChild(icon); // CHANGED: append to ground instead of grid
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

  // Helper function to check if position overlaps with buildings
  function overlapsBuilding(x, y) {
    const nodeSize = 48;
    for (let b of S.builds) {
      const buildSize = 72;
      // Check if rectangles overlap
      if (x < b.x + buildSize && x + nodeSize > b.x &&
          y < b.y + buildSize && y + nodeSize > b.y) {
        return true;
      }
    }
    return false;
  }

  // Helper to get valid position
  function getValidPosition() {
    let attempts = 0;
    while (attempts < 50) {
      const x = 30 + Math.random() * (rect.width - 100);
      const y = 10 + Math.random() * (rect.height - 60);
      
      if (!overlapsBuilding(x, y)) {
        return { x, y };
      }
      attempts++;
    }
    // Fallback to random position if can't find valid spot
    return {
      x: 30 + Math.random() * (rect.width - 100),
      y: 10 + Math.random() * (rect.height - 60)
    };
  }

  // Spawn trees
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

  // Spawn rocks
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
    
    // Check if this node has an active gathering job
    const activeJob = S.gatherJobs && S.gatherJobs.find(j => j.nodeId === n.id);
    
    if (activeJob) {
      // Show progress ring for active jobs
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
      // Remove ring if not active
      node.style.opacity = '1';
      const ring = node.querySelector('.ring');
      if (ring) ring.remove();
    }
  });
  
  // Remove nodes that no longer exist
  [...ground.querySelectorAll('.node')].forEach(node => {
    if (!S.nodes.find(n => n.id === node.dataset.nodeid)) {
      node.remove();
    }
  });
}

function harvestNode(n) {
  // Check if gatherers allocated
  if (S.gatherers < 0.05) {
    playSound('bad');
    toast('Need at least 5% gatherers to harvest!');
    return;
  }
  
  // Check if already gathering this node
  if (S.gatherJobs && S.gatherJobs.find(j => j.nodeId === n.id)) {
    toast('Already gathering this resource...');
    return;
  }
  
  // Start gathering job
  if (!S.gatherJobs) S.gatherJobs = [];
  
  S.gatherJobs.push({
    id: Date.now() + Math.random(),
    nodeId: n.id,
    progress: 0,
    required: n.type === 'tree' ? 8 : 6, // days of work
    type: n.type
  });
  
  playSound('click');
  toast(`Started gathering ${n.type}...`);
  updateUI();
}

// ============================================
// DRAG & DROP
// ============================================

function attachGridDnD() {
  const ground = el('ground'); // CHANGED from grid
  if (!ground) return;

  ground.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  ground.addEventListener('drop', e => {
    e.preventDefault();
    if (!draggedType) return;

    const b = BUILDS[draggedType];
    if (S.materials < b.mat) {
      playSound('bad');
      toast('Not enough materials!');
      return;
    }

    playSound('build');
    const rect = ground.getBoundingClientRect(); // CHANGED from grid
    const x = e.clientX - rect.left - 36;
    const y = e.clientY - rect.top - 36;

    S.materials -= b.mat;
    S.builds.push({
      id: Date.now() + Math.random(),
      type: draggedType,
      x: Math.max(0, Math.min(rect.width - 72, x)),
      y: Math.max(0, Math.min(rect.height - 72, y)),
      done: false,
      progress: 0,
      dur: b.dur
    });

    toast(`Started building ${b.name}`);
    updateUI();
  });
}

// ============================================
// TECH TREE
// ============================================

function renderTechTree() {
  const grid = el('techGrid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.keys(TECH_TREE).forEach(key => {
    const t = TECH_TREE[key];
    const unlocked = S.tech[key];
    const reqsMet = t.req.every(r => S.tech[r]);
    const canAfford = S.materials >= t.cost;
    const canUnlock = !unlocked && reqsMet && canAfford;

    const card = document.createElement('div');
    card.className = 'tech-card' + 
      (unlocked ? ' unlocked' : '') + 
      (!canUnlock && !unlocked ? ' locked' : '') +
      (canAfford && reqsMet && !unlocked ? ' affordable' : ''); // NEW

    let reqText = '';
    if (t.req.length && !unlocked) {
      const missing = t.req.filter(r => !S.tech[r]);
      if (missing.length) {
        reqText = `<div class="tech-req">Requires: ${missing.map(m => TECH_TREE[m].name).join(', ')}</div>`;
      }
    }

    card.innerHTML = `
      <div class="tech-status"></div>
      <div class="tech-name">${t.name}</div>
      <div class="tech-desc">${t.desc}</div>
      ${reqText}
      <div class="tech-effect">${t.effect}</div>
      <div class="tech-cost">${unlocked ? '✓ Unlocked' : t.cost + ' materials'}</div>
    `;

    if (canUnlock) {
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.textContent = 'Unlock';
      btn.onclick = () => unlockTech(key);
      card.appendChild(btn);
    }

    grid.appendChild(card);
  });
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
  if (key === 'heavyPlough') S.tfp *= 1.2;
  if (key === 'seedSelection') S.tfp *= 1.08;
  if (key === 'well') S.health = Math.min(1, S.health + 0.2);

  // ADD CELEBRATION FOR FIRST TECH UNLOCK
  const techCount = Object.keys(S.tech).filter(k => S.tech[k]).length;
  if (techCount === 2) { // 2 because basicFarming starts unlocked
    // Flash effect
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      inset: 0;
      background: radial-gradient(circle, rgba(34,211,238,0.3), transparent);
      z-index: 8000;
      pointer-events: none;
      animation: flashFade 1s ease-out;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1000);
    
    toast('First technology unlocked! Your civilization advances.', 4000);
  } else {
    toast(`Unlocked: ${t.name}!`);
  }

  renderTechTree();
  updateUI();
}

// ============================================
// PROGRESS & VICTORY
// ============================================

function checkVictory() {
  const pop150 = S.pop >= 150;
  const wage13 = S.wageAbove13Years >= 1;
  const hasMarket = S.builds.some(b => b.type === 'market' && b.done);
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
  const capitalGoods = mills >= 3;
  
  // Progressive victory counter
  S.victoryProgress = 0;
  if (pop150) S.victoryProgress += 25;
  if (wage13) S.victoryProgress += 25;
  if (hasMarket) S.victoryProgress += 25;
  if (capitalGoods) S.victoryProgress += 25;
  
  // Show victory when all complete
  if (S.victoryProgress >= 100) {
    showVictory();
  }
}

function updateProgress() {
  const pop150 = S.pop >= 150;
  const wage13 = S.wageAbove13Years >= 1;
  const hasMarket = S.builds.some(b => b.type === 'market' && b.done);
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
  const capitalGoods = mills >= 3;

  const completed = [pop150, wage13, hasMarket, capitalGoods].filter(Boolean).length;
  const progress = (completed / 4) * 100;

  const fill = el('progressFill');
  const pct = el('progressPercent');
  if (fill) fill.style.width = progress + '%';
  if (pct) pct.textContent = Math.round(progress) + '%';

  // Requirements
  updateReq('req1', pop150, `Population > 150 (Current: ${S.pop})`);
  updateReq('req2', wage13, `Real Wage > 1.3 for 1 year (Current: ${S.wageAbove13Years} years)`);
  updateReq('req3', hasMarket, 'Market infrastructure built');
  updateReq('req4', capitalGoods, `3+ capital goods (Current: ${mills})`);

  // Stats
  const statPop = el('statPop');
  const statWage = el('statWage');
  const statWageYears = el('statWageYears');
  const statMarket = el('statMarket');
  const statCapital = el('statCapital');
  if (statPop) statPop.textContent = S.pop;
  if (statWage) statWage.textContent = S.realWage.toFixed(2);
  if (statWageYears) statWageYears.textContent = S.wageAbove13Years;
  if (statMarket) statMarket.textContent = hasMarket ? 'Built' : 'Not built';
  if (statCapital) statCapital.textContent = mills;
}

function updateReq(id, complete, text) {
  const req = el(id);
  if (!req) return;
  req.innerHTML = `<span class="req-icon">${complete ? '✓' : '○'}</span> ${text}`;
  if (complete) req.classList.add('complete');
  else req.classList.remove('complete');
}

function showVictory() {
  isPaused = true;

  const years = el('vicYears');
  const days = el('vicDays');
  const pop = el('vicPop');
  const deaths = el('vicDeaths');

  if (years) years.textContent = S.year;
  if (days) days.textContent = S.day;
  if (pop) pop.textContent = S.pop;
  if (deaths) deaths.textContent = S.totalDeaths;

  // Calculate grade
  const efficiency = S.pop / (S.year * 90 + S.day);
  const gradeTxt = el('vicGrade');
  const grade = efficiency > 1.5 ? 'A+' : efficiency > 1.2 ? 'A' : efficiency > 1.0 ? 'B+' : efficiency > 0.8 ? 'B' : 'C';
  if (gradeTxt) gradeTxt.textContent = grade;

  showModal('victoryModal');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Pause/Resume
  const btnPause = el('btnPause');
  if (btnPause)
    btnPause.addEventListener('click', () => {
      isPaused = !isPaused;
      btnPause.textContent = isPaused ? '▶' : '⏸';
      toast(isPaused ? 'Paused' : 'Resumed');
    });

  // Speed control
  const speedSelect = el('speedSelect');
  if (speedSelect) speedSelect.addEventListener('change', startTick);

  // Labor sliders
  const farmerSlider = el('farmerSlider');
  const builderSlider = el('builderSlider');
  const herderSlider = el('herderSlider');
  const gathererSlider = el('gathererSlider');
  const intensitySlider = el('intensitySlider');

  if (gathererSlider)
    gathererSlider.addEventListener('input', e => {
      S.gatherers = e.target.value / 100;
      normalizeLabor();
      updateUI();
    });

  if (farmerSlider)
    farmerSlider.addEventListener('input', e => {
      S.farmers = e.target.value / 100;
      normalizeLabor();
      updateUI();
    });

  if (builderSlider)
    builderSlider.addEventListener('input', e => {
      S.builders = e.target.value / 100;
      normalizeLabor();
      updateUI();
    });

  if (herderSlider)
    herderSlider.addEventListener('input', e => {
      S.herders = e.target.value / 100;
      normalizeLabor();
      updateUI();
    });

  if (intensitySlider)
    intensitySlider.addEventListener('input', e => {
      S.workIntensity = e.target.value / 100;
      updateUI();
    });

  // Crop selection
  document.querySelectorAll('.crop-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.crop-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.cropType = btn.dataset.crop;
      toast(`Now planting ${S.cropType}`);
    });
  });

  // Enclosure toggle
  const btnEnclosure = el('btnEnclosure');
  if (btnEnclosure)
    btnEnclosure.addEventListener('click', () => {
      if (S.landPolicy === 'commons') {
        if (!confirm('Enclose land? +15% efficiency but -15% morale and inequality rises.')) return;
        S.landPolicy = 'enclosed';
        S.morale = Math.max(0, S.morale - 0.15);
        toast('Land enclosed! Efficiency up, morale down.');
      } else {
        if (!confirm('Return to commons? -15% efficiency but equality restored.')) return;
        S.landPolicy = 'commons';
        S.morale = Math.min(1, S.morale + 0.1);
        toast('Commons restored! Equality improved.');
      }
      updateUI();
    });

  // Modals
  const btnTech = el('btnTech');
  const techClose = el('techClose');
  if (btnTech)
    btnTech.addEventListener('click', () => {
      playSound('click');  
      renderTechTree();
      showModal('techModal');
    });
  if (techClose) techClose.addEventListener('click', () => hideModal('techModal'));

  const btnTheory = el('btnTheory');
  const theoryClose = el('theoryClose');
  if (btnTheory) btnTheory.addEventListener('click', () => showModal('theoryModal'));
  if (theoryClose) theoryClose.addEventListener('click', () => hideModal('theoryModal'));

  const btnProgress = el('btnProgress');
  const progressClose = el('progressClose');
  if (btnProgress)
    btnProgress.addEventListener('click', () => {
      updateProgress();
      showModal('progressModal');
    });
  if (progressClose) progressClose.addEventListener('click', () => hideModal('progressModal'));

  // Export data
  const btnExport = el('btnExport');
  const btnExportVictory = el('btnExportVictory');
  if (btnExport) btnExport.addEventListener('click', exportData);
  if (btnExportVictory) btnExportVictory.addEventListener('click', exportData);

  // Save/Reset
  const btnSave = el('btnSave');
  const btnReset = el('btnReset');
  if (btnSave) btnSave.addEventListener('click', saveGame);
  if (btnReset) btnReset.addEventListener('click', resetGame);

  // Victory
  const btnPlayAgain = el('btnPlayAgain');
  if (btnPlayAgain)
    btnPlayAgain.addEventListener('click', () => {
      hideModal('victoryModal');
      resetGame();
    });

  // Grid DnD (after DOM exists)
  attachGridDnD();
}

function normalizeLabor() {
  const total = S.farmers + S.builders + S.herders + S.gatherers; // ADD S.gatherers
  if (total > 1) {
    const scale = 1 / total;
    S.farmers *= scale;
    S.builders *= scale;
    S.herders *= scale;
    S.gatherers *= scale; // ADD THIS LINE
  }
  const fs = el('farmerSlider');
  const bs = el('builderSlider');
  const hs = el('herderSlider');
  const gs = el('gathererSlider'); // ADD THIS LINE
  if (fs) fs.value = S.farmers * 100;
  if (bs) bs.value = S.builders * 100;
  if (hs) hs.value = S.herders * 100;
  if (gs) gs.value = S.gatherers * 100; // ADD THIS LINE
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showModal(id) {
  el(id).classList.add('show');
  isPaused = true;
}

function hideModal(id) {
  el(id).classList.remove('show');
  if (!el('eventCard').classList.contains('show')) {
    isPaused = false;
  }
}

function saveGame() {
  try {
    localStorage.setItem('econoville_save', JSON.stringify(S));
    toast('Game saved!');
  } catch (e) {
    toast('Save failed: ' + e.message);
  }
}

function resetGame() {
  if (!confirm('Reset game? All progress will be lost.')) return;

  Object.assign(S, {
    day: 1,
    year: 1,
    season: 0,
    pop: 80,
    cap: 100,
    totalDeaths: 0,
    farmers: 0.5,
    builders: 0.3,
    herders: 0.1,
    gatherers: 0.1,
    workIntensity: 1.0,
    materials: 30,
    foodStock: 15,
    livestock: 0,
    health: 0.55,
    morale: 0.45,
    tfp: 1.0,
    landQuality: 1.0,
    realWage: 1.0,
    landPolicy: 'commons',
    cropType: 'wheat',
    weatherNow: 'sunny',
    weatherNext: 'rain',
    tech: { basicFarming: true },
    builds: [],
    nodes: [],
    wageAbove13Years: 0,
    history: []
  });

  rollWeather();
  spawnNodes();
  renderPalette();
  updateUI();

  toast('Game reset!');
}

function exportData() {
  const csv = ['Year,Day,Population,RealWage,FoodStock,Livestock,TFP,SoilQuality'];
  S.history.forEach(h => {
    csv.push(
      `${h.year},${h.day},${h.pop},${h.realWage.toFixed(3)},${h.foodStock.toFixed(1)},${h.livestock},${h.tfp.toFixed(3)},${h.soilQuality.toFixed(3)}`
    );
  });

  const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `econoville_data_year${S.year}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  toast('Data exported!');
}


// ============================================
// Seasonal Guide Pop Up
// ============================================
// In showSeasonalGuide() function, REPLACE the popup with:
function showSeasonalGuide(season) {
  const guides = {
    autumn: {
      title: 'HARVEST SEASON',
      advice: 'Maximize food production NOW to survive winter',
      farmers: 70,
      builders: 10,
      gatherers: 10,
      herders: 10
    },
    winter: {
      title: 'WINTER STRATEGY',
      advice: 'Low food production - focus on construction',
      farmers: 30,
      builders: 40,
      gatherers: 20,
      herders: 10
    },
    spring: {
      title: 'PLANTING SEASON',
      advice: 'Establish crops for the growing season',
      farmers: 60,
      builders: 20,
      gatherers: 10,
      herders: 10
    },
    summer: {
      title: 'GROWTH SEASON',
      advice: 'Balance food and infrastructure',
      farmers: 50,
      builders: 30,
      gatherers: 10,
      herders: 10
    }
  };
  
  const guide = guides[season];
  if (!guide) return;
  
  // Highlight the labor panel
  const laborPanel = document.querySelector('.labor');
  if (laborPanel) {
    laborPanel.style.border = '3px solid var(--warn)';
    laborPanel.style.animation = 'pulse 1.5s ease-in-out 3';
    
    setTimeout(() => {
      laborPanel.style.border = '';
      laborPanel.style.animation = '';
    }, 5000);
  }
  
  // Show overlay directly over labor sliders
  const overlay = document.createElement('div');
  overlay.id = 'laborGuideOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9500;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s;
  `;
  
  const box = document.createElement('div');
  box.style.cssText = `
    background: linear-gradient(135deg, var(--panel), var(--panel2));
    border: 3px solid var(--warn);
    border-radius: 16px;
    padding: 30px;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7);
  `;
  
  box.innerHTML = `
    <div style="font-size: 24px; font-weight: 800; margin-bottom: 12px; color: var(--warn); text-align: center;">
      ${guide.title}
    </div>
    <div style="font-size: 15px; line-height: 1.6; margin-bottom: 20px; text-align: center;">
      ${guide.advice}
    </div>
    
    <div style="background: #0b1224aa; border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--accent);">Recommended Allocation:</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
        <div>👨‍🌾 Farmers:</div><div style="text-align: right; font-weight: 700;">${guide.farmers}%</div>
        <div>🔨 Builders:</div><div style="text-align: right; font-weight: 700;">${guide.builders}%</div>
        <div>🪓 Gatherers:</div><div style="text-align: right; font-weight: 700;">${guide.gatherers}%</div>
        <div>🐑 Herders:</div><div style="text-align: right; font-weight: 700;">${guide.herders}%</div>
      </div>
      
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted);">
        Current: Farmers ${Math.round(S.farmers * 100)}%, Builders ${Math.round(S.builders * 100)}%, Gatherers ${Math.round(S.gatherers * 100)}%, Herders ${Math.round(S.herders * 100)}%
      </div>
    </div>
    
    <div style="display: flex; gap: 12px;">
      <button id="btnApplyLabor" style="flex: 1; padding: 12px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border: none; border-radius: 8px; color: #000; font-weight: 700; cursor: pointer; font-size: 14px;">
        Apply Recommendation
      </button>
      <button id="btnIgnoreLabor" style="flex: 1; padding: 12px; background: transparent; border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-weight: 600; cursor: pointer; font-size: 14px;">
        I'll Adjust Myself
      </button>
    </div>
  `;
  
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  
  // Apply button
  document.getElementById('btnApplyLabor').onclick = () => {
    S.farmers = guide.farmers / 100;
    S.builders = guide.builders / 100;
    S.gatherers = guide.gatherers / 100;
    S.herders = guide.herders / 100;
    normalizeLabor();
    updateUI();
    overlay.remove();
    toast(`Labor adjusted for ${guide.title}`, 3000);
    playSound('click');
  };
  
  // Ignore button
  document.getElementById('btnIgnoreLabor').onclick = () => {
    overlay.remove();
    playSound('click');
  };
}

function highlightSlider(sliderType, duration = 5000) {
  const slider = el(sliderType + 'Slider');
  const label = slider?.parentElement;
  
  if (label) {
    label.style.background = 'rgba(251, 146, 60, 0.2)';
    label.style.border = '2px solid var(--warn)';
    label.style.borderRadius = '8px';
    label.style.padding = '8px';
    label.style.animation = 'pulse 1.5s ease-in-out infinite';
    
    setTimeout(() => {
      label.style.background = '';
      label.style.border = '';
      label.style.padding = '';
      label.style.animation = '';
    }, duration);
  }
}

// ============================================
// STARTUP HOOK
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}