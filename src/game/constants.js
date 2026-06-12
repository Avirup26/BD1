/* ============================================================================
   DHAKA CITY UNDERWORLD — design assumptions
   ----------------------------------------------------------------------------
   1.  Per user request this is a React + Vite + Three.js project (not a single
       HTML file), and the web-research step was skipped; geography, colors and
       culture below come from internal knowledge of Dhaka:
       - Map orientation matches real Dhaka: Uttara north, Sadarghat/Buriganga
         south, Mirpur west, Gulshan/Baridhara east, Motijheel center-south.
       - CNG auto-rickshaws are bottle-green (CNG conversion livery) with
         yellow canopy trims; cycle rickshaws carry colorful floral art hoods.
       - Buriganga is a polluted grey-brown (#5C4A2A family).
       - Ahsan Manzil is the pink palace; Lalbagh Fort is a walled Mughal
         compound; the Jatiyo Sangsad Bhaban (Louis Kahn) is grey concrete with
         huge circular/triangular cutouts; Baitul Mukarram is a white cube.
   2.  Scale: 1 unit ≈ 1.2 m vertically (1 storey ≈ 3 units). Horizontal scale
       is compressed (~10 m/unit) so the whole city fits in a 2000×2000 world —
       same compression trick GTA uses.
   3.  Jamuna Future Park is really in Kuril (NE); the mission brief places the
       heist mall at (-300,-600) in Uttara, so it lives there for gameplay.
   4.  Hatirjheel is approximated by a curved link road + water patch.
   5.  The Uttara highway overpass is decorative (not driveable).
   6.  Fog densities are tuned below the spec values for playable draw
       distance (spec 0.008 clear would hide the city beyond ~120 units).
   7.  Streetlamps/neon use pooled PointLights (8 lamps + 6 neon near player) —
       hundreds of live lights would kill the frame rate; far lamps glow
       via emissive materials instead.
   8.  In-game time runs at 1 game-minute per real second (24 min full day).
   9.  Bengali strings are real Unicode (no placeholders). English fallbacks
       shown in HUD for readability.
   10. All meshes are generated from Three.js primitives + canvas textures —
       zero external assets.
   ============================================================================ */

export const WORLD = 1000; // half-extent of the world in units
export const TIME_SCALE = 1; // game minutes per real second

export const DISTRICTS = [
  { id: 'oldDhaka',  bn: 'পুরান ঢাকা',        en: 'Puran Dhaka',        x1: -100, x2: 200,  z1: 250,  z2: 480,  map: '#8a6b42' },
  { id: 'motijheel', bn: 'মতিঝিল',            en: 'Motijheel',          x1: 0,    x2: 350,  z1: 0,    z2: 250,  map: '#5a6472' },
  { id: 'gulshan',   bn: 'গুলশান-বারিধারা',   en: 'Gulshan-Baridhara',  x1: 200,  x2: 600,  z1: -400, z2: 0,    map: '#6d8060' },
  { id: 'sherEBangla', bn: 'শের-ই-বাংলা নগর', en: 'Sher-e-Bangla Nagar', x1: -600, x2: -300, z1: -150, z2: 100, map: '#7a6a52' },
  { id: 'mirpur',    bn: 'মিরপুর',            en: 'Mirpur',             x1: -800, x2: -300, z1: -200, z2: 250,  map: '#96704f' },
  { id: 'uttara',    bn: 'উত্তরা',            en: 'Uttara',             x1: -400, x2: 200,  z1: -800, z2: -400, map: '#71819b' },
  { id: 'dhanmondi', bn: 'ধানমন্ডি',          en: 'Dhanmondi',          x1: -300, x2: 0,    z1: -50,  z2: 250,  map: '#74795c' },
  { id: 'tejgaon',   bn: 'তেজগাঁও',           en: 'Tejgaon',            x1: -300, x2: 200,  z1: -400, z2: -50,  map: '#62626e' },
  { id: 'sadarghat', bn: 'সদরঘাট',            en: 'Sadarghat',          x1: -1000, x2: 1000, z1: 455, z2: 620,  map: '#54452e' }
];

export const FALLBACK_DISTRICT = { id: 'dhaka', bn: 'ঢাকা', en: 'Dhaka City', map: '#555a66' };

// Major road arteries as polylines [[x,z],...] — hardcoded from real Dhaka layout.
export const ROADS = [
  { name: 'Mirpur Road',               w: 30, pts: [[-600, -800], [-600, 480]] },
  { name: 'Airport Road',              w: 34, pts: [[-200, -800], [-200, 440]] },
  { name: 'Rokeya Sarani',             w: 20, pts: [[-500, -400], [-500, 250]] },
  { name: 'Gulshan Avenue',            w: 26, pts: [[400, -400], [400, -10]] },
  { name: 'DIT Avenue',                w: 22, pts: [[100, -50], [100, 468]] },
  { name: 'Nazimuddin Road',           w: 14, pts: [[0, 150], [0, 448]] },
  { name: 'Manik Mia Avenue',          w: 40, pts: [[-700, 50], [350, 50]] },
  { name: 'Kazi Nazrul Islam Avenue',  w: 24, pts: [[-600, 150], [350, 150]] },
  { name: 'Gulshan Road 27',           w: 26, pts: [[-250, -200], [600, -200]] },
  { name: 'Sonargaon Janapath',        w: 30, pts: [[-400, -600], [200, -600]] },
  { name: 'Buriganga Embankment',      w: 18, pts: [[-950, 450], [950, 450]] },
  { name: 'Mirpur 10 Road',            w: 18, pts: [[-800, -100], [-300, -100]] },
  { name: 'Islampur Road',             w: 10, pts: [[-100, 350], [200, 350]] },
  { name: 'Hatirjheel Link Road',      w: 18, pts: [[400, -150], [320, -100], [230, -60], [150, -10], [100, 40]] }
];

export const ROUNDABOUTS = [
  { name: 'Shapla Chattar',   x: 100,  z: 100,  r: 16 },
  { name: 'Shahbag Mor',      x: 0,    z: 155,  r: 13 },
  { name: 'Gulshan 1 Circle', x: 400,  z: -200, r: 14 },
  { name: 'Mirpur 10 Circle', x: -500, z: -100, r: 14 }
];

// Rectangles where procedural buildings must NOT spawn (landmarks, water, etc.)
export const EXCLUDES = [
  { x1: -100, x2: 0,    z1: 380,  z2: 460 },  // Lalbagh Fort compound
  { x1: 110,  x2: 190,  z1: 432,  z2: 480 },  // Ahsan Manzil
  { x1: 50,   x2: 150,  z1: 468,  z2: 520 },  // Sadarghat terminal + ghat
  { x1: -545, x2: -355, z1: -130, z2: 45 },   // Parliament + Crescent Lake lawn
  { x1: 145,  x2: 220,  z1: 158,  z2: 230 },  // Baitul Mukarram
  { x1: -30,  x2: 35,   z1: 210,  z2: 252 },  // National Museum, Shahbag
  { x1: 275,  x2: 425,  z1: -315, z2: -210 }, // Gulshan Lake
  { x1: 140,  x2: 425,  z1: -145, z2: -15 },  // Hatirjheel water band
  { x1: -360, x2: -240, z1: -700, z2: -605 }, // Jamuna Future Park mall
  { x1: -390, x2: 80,   z1: -785, z2: -640 }, // Airport grounds
  { x1: -430, x2: -370, z1: 25,   z2: 80 },   // Mirpur chop shop
  { x1: 0,    x2: 45,   z1: 285,  z2: 325 },  // Old Dhaka safehouse
  { x1: -60,  x2: 60,   z1: 130,  z2: 185 }   // Shahbag junction breathing room
];

// Per-district procedural building parameters
export const DISTRICT_BUILD = {
  oldDhaka:  { minH: 6,  maxH: 15, minW: 5,  maxW: 9,  grid: 13, fill: 0.92, tanks: 0.65,
               colors: ['#C4935A', '#D4A06A', '#8B6B4A', '#B8885A', '#E8C49A'] },
  motijheel: { minH: 24, maxH: 60, minW: 12, maxW: 22, grid: 34, fill: 0.80, tanks: 0.10,
               colors: ['#5A6472', '#7A8A96', '#4A5460', '#8A9AA6'] },
  gulshan:   { minH: 9,  maxH: 24, minW: 14, maxW: 24, grid: 36, fill: 0.62, tanks: 0.05,
               colors: ['#E8E8E8', '#F5F0E8', '#D8D0C8'] },
  sherEBangla: { minH: 6, maxH: 12, minW: 14, maxW: 24, grid: 42, fill: 0.30, tanks: 0.15,
               colors: ['#9b5a45', '#a86a52', '#8a5240'] },
  mirpur:    { minH: 9,  maxH: 21, minW: 8,  maxW: 16, grid: 24, fill: 0.70, tanks: 0.70,
               colors: ['#9B7355', '#8B6345', '#D4A882', '#6B4A32'] },
  uttara:    { minH: 15, maxH: 45, minW: 12, maxW: 26, grid: 40, fill: 0.55, tanks: 0.05,
               colors: ['#C8D8E8', '#A8B8C8', '#E8F0F8', '#B8C8D8'] },
  dhanmondi: { minH: 9,  maxH: 18, minW: 10, maxW: 18, grid: 28, fill: 0.60, tanks: 0.30,
               colors: ['#D8C8B8', '#C8B8A8', '#E0D0C0'] },
  tejgaon:   { minH: 8,  maxH: 20, minW: 12, maxW: 24, grid: 30, fill: 0.55, tanks: 0.40,
               colors: ['#8a8278', '#9a9288', '#7a7268'] }
};

export const SIGNS = [
  { bn: 'ঔষধ ঘর', en: 'Pharmacy' },
  { bn: 'চা স্টল', en: 'Tea Stall' },
  { bn: 'মোবাইল সার্ভিস', en: 'Mobile Repair' },
  { bn: 'কাপড়ের দোকান', en: 'Clothing Store' },
  { bn: 'রেস্তোরাঁ', en: 'Restaurant' },
  { bn: 'সুপারশপ', en: 'Supermarket' },
  { bn: 'ব্যাংক', en: 'Bank' },
  { bn: 'হাসপাতাল', en: 'Hospital' },
  { bn: 'বাজার', en: 'Market' },
  { bn: 'গ্যারেজ', en: 'Garage' },
  { bn: 'হাজীর বিরিয়ানি', en: 'Biryani House' },
  { bn: 'মিষ্টির দোকান', en: 'Sweet Shop' },
  { bn: 'সেলুন', en: 'Salon' },
  { bn: 'ইলেকট্রনিক্স', en: 'Electronics' },
  { bn: 'জুতার দোকান', en: 'Shoe Store' },
  { bn: 'লন্ড্রি', en: 'Laundry' }
];

export const BILLBOARD_ADS = [
  'গ্রামীণফোন — চলো বহুদূর',
  'বিকাশ — টাকা পাঠান নিমিষেই',
  'প্রাণ আপ — খাঁটি স্বাদ',
  'ওয়ালটন — আমাদের পণ্য',
  'রবি ৪.৫জি — দুরন্ত গতি',
  'ঢাকা মেট্রো রেল — স্বপ্নের যাত্রা'
];

export const BUMP_TEXTS = [
  'হ্যাঁ ভাই!', 'ছাড়েন!', 'আরে আরে!', 'কি করেন ভাই!',
  'ওই মিয়া!', 'মাফ করেন!', 'দেইখা চলেন!', 'আস্তে ভাই!'
];

export const PRAYER_TIMES = [
  { min: 300,  bn: 'ফজর' },
  { min: 795,  bn: 'যোহর' },
  { min: 1005, bn: 'আসর' },
  { min: 1110, bn: 'মাগরিব' },
  { min: 1200, bn: 'এশা' }
];

// type: { maxSpeed, accel, turn, radius, hp, seat:[x,y,z], engine, boat? }
export const VEHICLE_SPECS = {
  cng:        { maxSpeed: 22, accel: 14, turn: 2.2, radius: 1.8, hp: 60,  seat: [0, 1.0, 0.2],  engine: 180 },
  rickshaw:   { maxSpeed: 9,  accel: 9,  turn: 2.4, radius: 1.3, hp: 40,  seat: [0, 1.25, 0.5], engine: 0 },
  bus:        { maxSpeed: 26, accel: 8,  turn: 1.1, radius: 4.6, hp: 220, seat: [1.6, 2.0, -7], engine: 120 },
  moto:       { maxSpeed: 34, accel: 18, turn: 2.6, radius: 1.1, hp: 50,  seat: [0, 1.15, 0],   engine: 300 },
  prado:      { maxSpeed: 38, accel: 16, turn: 1.8, radius: 2.8, hp: 130, seat: [0.9, 1.4, -0.8], engine: 140 },
  truck:      { maxSpeed: 20, accel: 6,  turn: 1.0, radius: 4.4, hp: 260, seat: [1.2, 2.2, -3], engine: 100 },
  boat:       { maxSpeed: 30, accel: 12, turn: 1.7, radius: 2.6, hp: 90,  seat: [0, 1.1, 0.6],  engine: 90,  boat: true },
  policeBoat: { maxSpeed: 28, accel: 12, turn: 1.7, radius: 2.6, hp: 110, seat: [0, 1.1, 0.6],  engine: 90,  boat: true },
  police:     { maxSpeed: 36, accel: 15, turn: 2.0, radius: 2.6, hp: 130, seat: [0.8, 1.3, -0.5], engine: 140 },
  policeMoto: { maxSpeed: 36, accel: 18, turn: 2.6, radius: 1.1, hp: 60,  seat: [0, 1.15, 0],   engine: 300 },
  rab:        { maxSpeed: 40, accel: 17, turn: 1.9, radius: 2.8, hp: 160, seat: [0.9, 1.4, -0.8], engine: 140 }
};

export const MISSION_TEXT = {
  m1: { bn: 'সদরঘাটে আগমন', en: 'Sadarghat Landing' },
  m2: { bn: 'রিকশা রানার', en: 'Rickshaw Runner' },
  m3: { bn: 'গুলশান গ্র্যাব', en: 'Gulshan Grab' },
  m4: { bn: 'বুড়িগঙ্গা রান', en: 'Buriganga Run' },
  m5: { bn: 'যমুনা হাইস্ট', en: 'Jamuna Heist' }
};

// Points of interest drawn on the maps
export const POIS = [
  { x: -50,  z: 420,  icon: '🏰', label: 'লালবাগ কেল্লা' },
  { x: 150,  z: 458,  icon: '🏛️', label: 'আহসান মঞ্জিল' },
  { x: 100,  z: 487,  icon: '⛴️', label: 'সদরঘাট' },
  { x: -450, z: -40,  icon: '🏟️', label: 'জাতীয় সংসদ' },
  { x: 182,  z: 192,  icon: '🕌', label: 'বায়তুল মোকাররম' },
  { x: 100,  z: 100,  icon: '🌸', label: 'শাপলা চত্বর' },
  { x: -300, z: -652, icon: '🛍️', label: 'যমুনা ফিউচার পার্ক' },
  { x: -155, z: -712, icon: '✈️', label: 'বিমানবন্দর' },
  { x: -400, z: 52,   icon: '🔧', label: 'চপ শপ' },
  { x: 22,   z: 305,  icon: '🏠', label: 'আস্তানা' }
];

export const SAVE_KEY = 'dhaka_underworld_save_v1';
