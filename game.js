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
  cap: 100,
  totalDeaths: 0,

  // Labor allocation
  farmers: 0.5,
  builders: 0.3,
  herders: 0.1,
  workIntensity: 1.0,

  // Resources
  materials: 20,
  foodStock: 100,
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

  // Data export
  history: [],

  // Material Generation System
  nodeRegenQueue: []
};

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
  }
];

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

function startGame() {
  const landing = el('landing');
  const gameContainer = el('gameContainer');
  if (landing) landing.style.display = 'none';
  if (gameContainer) gameContainer.style.display = 'grid';

  // Get grid dimensions for building placement
  const grid = el('grid');
  const gridRect = grid.getBoundingClientRect();
  
  // Pre-build starting infrastructure in the sky area (top half)
  // 3 farms in a row
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
  
  // 2 houses in a row
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

  // NOW spawn resources on ground, avoiding buildings
  spawnNodes();

  // Set up game
  setupEventListeners();
  renderPalette();
  updateUI();

  // Auto-start on first interaction
  document.addEventListener('click', autoStart, { once: true });
  document.addEventListener('input', autoStart, { once: true });

  toast('Welcome, Chief! Time will begin when you interact.');
}

function autoStart() {
  if (!autoStarted) {
    autoStarted = true;
    startTick();
    scheduleEvent();
    toast('Time flows! Make decisions to grow your village.');
  }
}

// ============================================
// GAME LOOP
// ============================================

function startTick() {
  const speedSel = el('speedSelect');
  const speed = speedSel ? parseInt(speedSel.value) : 500;
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

  // Resource regeneration check - FIXED
  if (S.day === 1) {
    // Loop backwards to safely remove items
    for (let i = S.nodeRegenQueue.length - 1; i >= 0; i--) {
      const regen = S.nodeRegenQueue[i];
      if (S.year >= regen.regenTime) {
        // Respawn the node
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


  // Food production
  const farms = S.builds.filter(b => b.type === 'farm' && b.done).length;
  const mills = S.builds.filter(b => b.type === 'mill' && b.done).length;
  const farmerPop = Math.floor(S.pop * S.farmers);
  const herderPop = Math.floor(S.pop * S.herders);

  // Diminishing returns to land (Ricardian)
  const landPerFarm = S.totalLand / Math.max(1, farms);
  const diminishingReturns = Math.pow(landPerFarm / 10, 0.6);

  // Crop-specific multipliers
  const crop = CROP_DATA[S.cropType];
  const baseFoodPerFarm = 3.5 * crop.yield;

  // Farm production
  let farmFood =
    farms *
    baseFoodPerFarm *
    S.tfp *
    S.landQuality *
    diminishingReturns *
    (farmerPop / Math.max(1, S.pop)) *
    S.workIntensity;

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
  const netFood = totalFood - spoilage;

  S.foodStock += netFood;

  // Consumption
  const needPerDay = S.pop * 0.10;
  S.foodStock -= needPerDay;

  // Real wage calculation (Malthusian indicator)
  S.realWage = (S.foodStock / Math.max(1, S.pop)) / 0.2;

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

  // Time progression
  S.day++;
  if (S.day > 90) {
    S.day = 1;
    S.year++;
    S.season = (S.season + 1) % 4;

    // Track sustained high wages
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

  // Weather labels (if present)
  const nowLbl = el('weatherNowLbl');
  const nextLbl = el('weatherNextLbl');
  if (nowLbl) nowLbl.textContent = S.weatherNow;
  if (nextLbl) nextLbl.textContent = S.weatherNext;

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

  // Check win condition
  checkVictory();

  // Update UI
  updateUI();
  updateTheoryStatus();


}

function onBuildComplete(b) {
  playSound('complete'); 
  if (b.type === 'well') S.health = Math.min(1, S.health + 0.2);
  if (b.type === 'livestock') S.livestock += 2;
  toast(`${BUILDS[b.type].name} construction complete!`);
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
// EVENT SYSTEM
// ============================================

function scheduleEvent() {
  const delay = 30000 + Math.random() * 20000; // 30-50 seconds
  eventTimeout = setTimeout(() => {
    if (!isPaused && autoStarted) {
      triggerRandomEvent();
    }
    scheduleEvent();
  }, delay);
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

  // Labor & land UI
  const popTotal = el('popTotal');
  const landQual = el('landQual');
  const landPolicy = el('landPolicy');
  const intensityPct = el('intensityPct');
  if (popTotal) popTotal.textContent = S.pop;
  if (landQual) landQual.textContent = Math.round(S.landQuality * 100) + '%';
  if (landPolicy) landPolicy.textContent = S.landPolicy === 'commons' ? 'Commons' : 'Enclosed';
  if (intensityPct) intensityPct.textContent = Math.round(S.workIntensity * 100) + '%';

  // Real wage badge
  const wb = el('wagebadge');
  if (wb) {
    if (S.realWage < 0.95) wb.className = 'badge bad';
    else if (S.realWage < 1.1) wb.className = 'badge warn';
    else wb.className = 'badge';
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

  updateMeter('fillHealth', 'healthLbl', null, S.health);
  const w = weatherEffect(S.weatherNow);
  const diseaseRisk = el('diseaseRisk');
  if (diseaseRisk) diseaseRisk.textContent = (w.disease * 100).toFixed(1) + '%';

  updateMeter('fillMorale', 'moraleLbl', null, S.morale);

  // Labor percentages
  const idle = Math.max(0, 1 - S.farmers - S.builders - S.herders);
  const farmerPct = el('farmerPct');
  const builderPct = el('builderPct');
  const herderPct = el('herderPct');
  const idlePct = el('idlePct');
  if (farmerPct) farmerPct.textContent = Math.round(S.farmers * 100) + '%';
  if (builderPct) builderPct.textContent = Math.round(S.builders * 100) + '%';
  if (herderPct) herderPct.textContent = Math.round(S.herders * 100) + '%';
  if (idlePct) idlePct.textContent = Math.round(idle * 100) + '%';

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
      node.style.top = n.y + 'px';  // CHANGED from bottom to top
      
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        harvestNode(n);
      });
      
      ground.appendChild(node);
    }
  });
  
  [...ground.querySelectorAll('.node')].forEach(node => {
    if (!S.nodes.find(n => n.id === node.dataset.nodeid)) {
      node.remove();
    }
  });
}

function harvestNode(n) {
  playSound('harvest'); 
  n.hp--;
  const gain = n.type === 'tree' ? 4 : 5;
  S.materials += gain;
  toast(`Gathered +${gain} materials`);
  if (n.hp <= 0) {
    S.nodeRegenQueue.push({
      ...n,
      regenTime: S.year + 5
    });
    S.nodes = S.nodes.filter(x => x.id !== n.id);
  }
  updateUI();
}

// ============================================
// DRAG & DROP
// ============================================

function attachGridDnD() {
  const grid = el('grid');
  if (!grid) return;

  grid.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  grid.addEventListener('drop', e => {
    e.preventDefault();
    if (!draggedType) return;

    const b = BUILDS[draggedType];
    if (S.materials < b.mat) {
      toast('Not enough materials!');
      return;
    }

    const rect = grid.getBoundingClientRect();
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

  toast(`Unlocked: ${t.name}!`);
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

  if (pop150 && wage13 && hasMarket && capitalGoods) {
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
  const intensitySlider = el('intensitySlider');

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
  const total = S.farmers + S.builders + S.herders;
  if (total > 1) {
    const scale = 1 / total;
    S.farmers *= scale;
    S.builders *= scale;
    S.herders *= scale;
  }
  const fs = el('farmerSlider');
  const bs = el('builderSlider');
  const hs = el('herderSlider');
  if (fs) fs.value = S.farmers * 100;
  if (bs) bs.value = S.builders * 100;
  if (hs) hs.value = S.herders * 100;
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
    workIntensity: 1.0,
    materials: 30,
    foodStock: 20,
    livestock: 0,
    health: 0.6,
    morale: 0.6,
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
// STARTUP HOOK
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}