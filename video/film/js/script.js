// The film's script: timing, camera, captions, labels and routes.
// All times are seconds on a 60 s timeline; 80 BPM score → one bar = 3 s.

export const DURATION = 60;
export const FPS = 60;

// ── Year counter: [t, year] (negative = BCE) ─────────────────────────────
export const YEAR_KEYS = [
  [0.0, -3500], [6.0, -3500], [9.0, -3200], [12.0, -2000], [15.0, -800], [18.0, -250],
  [20.6, 100], [24.0, 220], [26.6, 800], [29.2, 900], [30.6, 1206], [33.0, 1279],
  [35.2, 1405], [37.3, 1492], [37.9, 1498], [39.2, 1519], [41.2, 1522], [42.4, 1760],
  [45.0, 1830], [48.0, 1900], [49.2, 1914], [50.4, 1945], [51.3, 1969], [52.6, 1991],
  [54.0, 2012], [55.5, 2026], [60.0, 2026],
];
export const TODAY_T = 55.5;

// ── World population estimates (millions), HYDE / UN mid-range, rounded ──
export const POPULATION = [
  [-3500, 30], [-3000, 45], [-2000, 72], [-1000, 115], [-500, 150], [1, 190], [500, 210],
  [1000, 295], [1200, 390], [1300, 395], [1400, 370], [1500, 460], [1600, 555], [1700, 605],
  [1800, 990], [1850, 1260], [1900, 1650], [1950, 2530], [1975, 4070], [2000, 6150],
  [2012, 7100], [2022, 8000], [2026, 8300],
];

// ── Camera: lon/lat of the point beneath the camera, P = distance in Earth
//    radii, Rd = limb radius as a multiple of the layout base, cy = vertical
//    centre (fraction of height) or `limb` = y of the limb's top edge. ─────
export const CAMERA_KEYS = [
  { t: 0.0, lon: 47.0, lat: 4, P: 1.45, Rd: 2.5, limb: 0.56 },
  { t: 3.0, lon: 46.5, lat: 9, P: 1.45, Rd: 2.45, limb: 0.52 },
  { t: 6.0, lon: 45.0, lat: 31, P: 1.5, Rd: 1.9, cy: 0.5 },
  { t: 9.0, lon: 41.0, lat: 30, P: 1.7, Rd: 1.5, cy: 0.5 },
  { t: 12.0, lon: 52.0, lat: 29, P: 2.1, Rd: 1.05, cy: 0.5 },
  { t: 15.0, lon: 66.0, lat: 31, P: 2.7, Rd: 0.82, cy: 0.5 },
  { t: 18.0, lon: 62.0, lat: 34, P: 3.2, Rd: 0.7, cy: 0.5 },
  { t: 24.0, lon: 55.0, lat: 31, P: 3.4, Rd: 0.68, cy: 0.5 },
  { t: 27.0, lon: 50.0, lat: 30, P: 3.4, Rd: 0.68, cy: 0.5 },
  { t: 30.0, lon: 72.0, lat: 40, P: 3.6, Rd: 0.64, cy: 0.5 },
  { t: 33.4, lon: 80.0, lat: 34, P: 3.8, Rd: 0.61, cy: 0.5 },
  { t: 36.0, lon: 60.0, lat: 10, P: 4.0, Rd: 0.58, cy: 0.5 },
  { t: 37.4, lon: 12.0, lat: 2, P: 4.0, Rd: 0.58, cy: 0.5 },
  { t: 38.7, lon: -42.0, lat: 18, P: 4.0, Rd: 0.58, cy: 0.5 },
  { t: 40.5, lon: -136.0, lat: -8, P: 4.0, Rd: 0.58, cy: 0.5 },
  { t: 41.3, lon: -131.0, lat: -2, P: 3.9, Rd: 0.59, cy: 0.5 },
  { t: 42.8, lon: -60.0, lat: 38, P: 3.6, Rd: 0.64, cy: 0.5 },
  { t: 44.2, lon: -40.0, lat: 44, P: 3.6, Rd: 0.64, cy: 0.5 },
  { t: 46.2, lon: -35.0, lat: 45, P: 3.6, Rd: 0.64, cy: 0.5 },
  { t: 48.2, lon: -30.0, lat: 44, P: 3.8, Rd: 0.62, cy: 0.5 },
  { t: 50.9, lon: -34.0, lat: 33, P: 5.6, Rd: 0.42, cy: 0.5 },
  { t: 54.0, lon: 58.0, lat: 24, P: 7.0, Rd: 0.375, cy: 0.45 },
  { t: 60.0, lon: 84.0, lat: 20, P: 8.0, Rd: 0.36, cy: 0.44 },
];

// ── Captions ─────────────────────────────────────────────────────────────
// kind: 'hook' | 'title' | 'lower' (lower third) | 'final' (centred, low)
// *asterisks* mark italic emphasis.
export const CAPTIONS = [
  { kind: 'hook', t0: 0.55, t1: 3.25, lines: ['For 300,000 years,', '*the night was dark.*'] },
  { kind: 'title', t0: 3.55, t1: 5.95, kicker: 'THE STORY OF CIVILIZATION', title: '5,000 YEARS', sub: 'IN 60 SECONDS' },

  { kind: 'lower', t0: 6.2, t1: 8.9, kicker: 'MESOPOTAMIA · c. 3500 BCE',
    lines: ['The first cities rise', '*between two rivers.*'] },
  { kind: 'lower', t0: 9.1, t1: 11.9, kicker: 'SUMER & EGYPT · c. 3200 BCE',
    lines: ['Writing is invented.', '*History begins.*'] },
  { kind: 'lower', t0: 12.1, t1: 14.9, kicker: 'THE BRONZE AGE · 3000–1200 BCE',
    lines: ['Kingdoms rise along', '*the great rivers.*'] },
  { kind: 'lower', t0: 15.1, t1: 17.9, kicker: 'THE AXIAL AGE · 800–200 BCE',
    lines: ['Confucius. The Buddha. Socrates.', '*Ideas that still shape us.*'],
    linesP: ['Confucius. The Buddha.', 'Socrates.', '*Ideas that still shape us.*'] },
  { kind: 'lower', t0: 18.2, t1: 23.8, kicker: 'ROME & HAN CHINA · c. 100 CE',
    lines: ['Two empires at the ends of a continent,', '*joined by the Silk Road.*'],
    linesP: ['Two empires at the ends', 'of a continent,', '*joined by the Silk Road.*'] },
  { kind: 'lower', t0: 24.1, t1: 29.7, kicker: 'A GOLDEN AGE OF LEARNING · c. 800 CE',
    lines: ['Paper, algebra, the number zero —', '*knowledge travels the world.*'],
    linesP: ['Paper, algebra,', 'the number zero —', '*knowledge travels the world.*'] },
  { kind: 'lower', t0: 30.1, t1: 35.6, kicker: 'THE MONGOL EMPIRE · 1206–1368',
    lines: ['From the Pacific to the Black Sea:', '*the largest land empire in history.*'],
    linesP: ['From the Pacific', 'to the Black Sea:', '*the largest land empire', '*in history.*'] },
  { kind: 'lower', t0: 36.1, t1: 41.7, kicker: 'THE AGE OF SAIL · 1405–1522',
    lines: ['Ships cross every ocean.', '*The world is joined — and upended.*'],
    linesP: ['Ships cross every ocean.', '*The world is joined —', '*and upended.*'] },
  { kind: 'lower', t0: 42.1, t1: 47.7, kicker: 'THE INDUSTRIAL REVOLUTION · 1760–1900',
    lines: ['Steam. Steel. Electricity.', '*The night begins to glow.*'] },
  { kind: 'lower', t0: 48.1, t1: 53.6, kicker: 'THE 20TH CENTURY',
    lines: ['In a single lifetime: flight, world wars,', '*the Moon, the web.*'],
    linesP: ['In a single lifetime:', 'flight, world wars,', '*the Moon, the web.*'] },

  { kind: 'lower', t0: 54.2, t1: 56.8, kicker: 'TODAY',
    lines: ['Five thousand years.', '*Eight billion lives.*'] },
  { kind: 'final', big: true, t0: 57.1, t1: 59.45,
    lines: ['The next chapter is *unwritten.*'],
    linesP: ['The next chapter', 'is *unwritten.*'] },
];

// ── Map labels ───────────────────────────────────────────────────────────
// city: name in cities.js (or `at: [lon, lat]`); dx/dy: label offset in px.
export const LABELS = [
  { city: 'Uruk', text: 'URUK', t0: 6.25, t1: 11.6, dx: 20, dy: -18 },
  { at: [43.9, 34.9], text: 'Tigris', river: true, t0: 6.9, t1: 10.6, dx: 12, dy: -6 },
  { at: [40.6, 35.0], text: 'Euphrates', river: true, t0: 7.1, t1: 10.6, dx: -14, dy: 10, align: 'right' },
  { city: 'Memphis', text: 'MEMPHIS', t0: 9.5, t1: 14.6, dx: -20, dy: -16, align: 'right' },
  { at: [31.2, 27.6], text: 'Nile', river: true, t0: 9.9, t1: 13.6, dx: 14, dy: 6 },
  { city: 'Babylon', text: 'BABYLON', t0: 12.5, t1: 14.9, dx: 18, dy: -16 },
  { city: 'Mohenjo-daro', text: 'MOHENJO-DARO', t0: 12.2, t1: 14.9, dx: 18, dy: 20 },
  { city: 'Anyang', text: 'ANYANG', sub: 'Shang China', t0: 13.2, t1: 15.4, dx: -18, dy: -18, align: 'right' },

  { city: 'Athens', text: 'SOCRATES', sub: 'Athens', t0: 15.25, t1: 17.9, dx: -18, dy: -18, align: 'right' },
  { city: 'Bodh Gaya', text: 'THE BUDDHA', sub: 'Bodh Gaya', t0: 15.55, t1: 17.9, dx: 18, dy: 22 },
  { city: 'Qufu', text: 'CONFUCIUS', sub: 'Qufu', t0: 15.85, t1: 17.9, dx: -18, dy: -18, align: 'right' },

  { city: 'Rome', text: 'ROME', t0: 18.4, t1: 23.8, dx: -18, dy: -18, align: 'right' },
  { city: "Chang'an", text: "CHANG'AN", t0: 18.6, t1: 23.8, dx: 18, dy: -18 },
  { at: [70.0, 40.6], text: 'SILK ROAD', route: true, t0: 20.6, t1: 23.8, dx: 0, dy: -22, align: 'center' },

  { city: 'Baghdad', text: 'BAGHDAD', t0: 24.3, t1: 29.6, dx: 18, dy: -18 },
  { city: "Chang'an", text: "CHANG'AN", t0: 24.6, t1: 29.6, dx: 18, dy: -18 },
  { city: 'Byzantium', text: 'CONSTANTINOPLE', t0: 25.0, t1: 29.6, dx: -16, dy: -20, align: 'right' },
  { city: 'Corduba', text: 'CÓRDOBA', t0: 25.6, t1: 29.6, dx: -16, dy: 22, align: 'right' },
  { city: 'Nalanda', text: 'NALANDA', t0: 25.3, t1: 29.6, dx: 18, dy: 22 },

  { city: 'Karakorum', text: 'KARAKORUM', t0: 30.3, t1: 35.2, dx: 18, dy: -18 },
  { city: 'Samarkand', text: 'SAMARKAND', t0: 31.1, t1: 35.2, dx: -18, dy: 22, align: 'right' },
  { city: 'Sarai', text: 'SARAI', t0: 31.7, t1: 35.2, dx: -18, dy: -18, align: 'right' },
  { city: 'Ji (Beijing)', text: 'KHANBALIQ', sub: 'Beijing', t0: 31.9, t1: 35.4, dx: 18, dy: 4 },
  { city: 'Delhi', text: 'DELHI', t0: 32.3, t1: 35.4, dx: 18, dy: 22 },

  { at: [88.0, 4.0], text: 'ZHENG HE · 1405', route: true, t0: 34.7, t1: 37.3, dx: 0, dy: 26, align: 'center' },
  { at: [-3.0, -9.0], text: 'DA GAMA · 1498', route: true, t0: 37.2, t1: 39.6, dx: 0, dy: 0, align: 'center' },
  { at: [-45.0, 31.0], text: 'COLUMBUS · 1492', route: true, t0: 37.7, t1: 40.4, dx: 0, dy: 0, align: 'center' },
  { at: [-125.0, -9.0], text: 'MAGELLAN – ELCANO · 1519–22', route: true, t0: 39.8, t1: 41.8, dx: 0, dy: 30, align: 'center' },
  { city: 'Tenochtitlan', text: 'TENOCHTITLAN', t0: 39.0, t1: 41.9, dx: -18, dy: -18, align: 'right' },
  { city: 'Cusco', text: 'CUSCO', t0: 39.4, t1: 41.9, dx: 18, dy: 20 },

  { at: [-2.24, 53.48], text: 'MANCHESTER', t0: 43.0, t1: 47.6, dx: -22, dy: -26, align: 'right' },
  { city: 'Londinium', text: 'LONDON', t0: 43.3, t1: 47.6, dx: 26, dy: 26 },
  { city: 'New York', text: 'NEW YORK', t0: 44.6, t1: 47.6, dx: -22, dy: 26, align: 'right' },
  { at: [-32.0, 51.5], text: 'TRANSATLANTIC CABLE · 1866', route: true, t0: 46.2, t1: 48.4, dx: 0, dy: -20, align: 'center' },
];

// ── Routes ───────────────────────────────────────────────────────────────
// kind 'surface' hugs the ground; 'arc' rises above it. Drawn t0→t1,
// then fades between `hold` and `out` to `rest` opacity.
const SILK_ROAD = [
  [108.95, 34.27], [103.8, 36.05], [100.45, 38.93], [94.66, 40.14], [89.18, 42.95], [82.96, 41.72],
  [75.99, 39.47], [71.0, 40.5], [66.96, 39.65], [64.42, 39.77], [62.19, 37.66], [58.8, 36.21],
  [51.43, 35.59], [48.52, 34.8], [44.58, 33.09], [40.73, 34.75], [38.27, 34.55], [36.16, 36.2],
  // …then by sea from Antioch to Rome.
  [35.6, 36.0], [34.0, 35.85], [32.3, 35.75], [30.0, 35.5], [27.6, 34.9], [24.0, 34.6], [18.0, 36.0],
  [15.6, 37.0], [15.65, 38.25], [15.3, 38.6], [13.5, 40.2], [12.25, 41.73],
];
const ZHENG_HE = [
  [118.8, 32.06], [121.3, 31.5], [122.4, 29.5], [119.9, 25.6], [113.5, 20.0], [109.6, 13.8], [106.8, 6.0],
  [104.6, 1.6], [104.1, 1.15], [103.4, 1.1], [102.2, 2.1], [97.6, 5.7], [90.0, 6.0], [80.3, 5.8],
  [77.3, 7.6], [75.9, 9.5], [75.7, 11.25], [66.0, 18.5], [58.5, 24.8], [56.45, 27.05],
];
const ZHENG_HE_AFRICA = [[75.7, 11.25], [62.0, 8.0], [52.0, 4.5], [46.2, 2.0], [40.3, -3.1]];
const DA_GAMA = [
  [-9.14, 38.72], [-17.0, 28.5], [-23.5, 15.0], [-21.0, 4.0], [-27.0, -10.0], [-25.0, -22.0], [-11.0, -31.0],
  [5.0, -33.5], [17.0, -33.5], [18.47, -34.9], [22.5, -35.3], [27.5, -34.4], [32.8, -29.0], [35.8, -24.0],
  [40.9, -15.0], [41.2, -10.5], [40.0, -4.0], [40.2, -3.22], [55.0, 4.0], [75.7, 11.25],
];
const COLUMBUS = [[-6.89, 37.23], [-17.1, 28.1], [-40.0, 26.6], [-60.0, 25.2], [-74.48, 24.06], [-75.9, 21.2],
  [-72.3, 19.9]];
const MAGELLAN = [
  [-6.35, 36.78], [-16.5, 28.0], [-22.0, 9.0], [-31.0, -8.0], [-37.5, -17.0], [-41.0, -23.3], [-43.1, -23.1],
  [-55.5, -35.8], [-66.8, -49.3], [-68.5, -52.5], [-70.9, -53.6], [-71.6, -53.85], [-73.6, -53.2],
  [-74.9, -52.7], [-80.0, -40.0], [-90.0, -25.0], [-110.0, -12.0], [-140.0, -1.0],
  [-170.0, 8.0], [165.0, 12.0], [144.79, 13.44], [125.8, 10.7], [123.9, 10.3], [121.5, 8.5], [121.8, 6.0],
  [124.5, 3.5], [126.5, 2.0], [127.4, 0.68], [127.0, -2.5], [126.5, -6.5], [127.6, -8.5], [126.5, -9.9],
  [105.0, -22.0], [80.0, -36.0], [50.0, -38.5], [25.0, -38.0], [18.0, -35.6], [5.0, -22.0], [-10.0, -5.0],
  [-20.0, 5.0], [-23.5, 15.0], [-25.0, 28.0], [-18.0, 34.0], [-6.35, 36.78],
];
const CABLE = [[-10.3, 51.9], [-20.0, 52.8], [-32.0, 52.0], [-44.0, 49.8], [-53.37, 47.87]];

const hop = (a, b) => [a, b];
const C = {
  changan: [108.95, 34.27], samarkand: [66.96, 39.65], baghdad: [44.36, 33.31], cairo: [31.24, 30.04],
  cordoba: [-4.78, 37.89], ujjain: [75.78, 23.18], karakorum: [102.84, 47.2], beijing: [116.4, 39.9],
  sarai: [47.43, 47.17], tabriz: [46.29, 38.08], kyiv: [30.52, 50.45], hangzhou: [120.15, 30.27],
  kaesong: [126.55, 37.97], constantinople: [28.98, 41.01],
};

export const ROUTES = [
  { kind: 'surface', color: 'gold', pts: SILK_ROAD, t0: 18.7, t1: 22.2, hold: 23.4, out: 25.0, rest: 0.16, width: 2.2 },

  // Paper's journey west (and India's numerals to Baghdad).
  { kind: 'arc', color: 'pale', pts: hop(C.changan, C.samarkand), t0: 25.0, t1: 25.9, hold: 28.6, out: 30.2, rest: 0, alt: 0.07 },
  { kind: 'arc', color: 'pale', pts: hop(C.samarkand, C.baghdad), t0: 25.8, t1: 26.6, hold: 28.6, out: 30.2, rest: 0, alt: 0.05 },
  { kind: 'arc', color: 'pale', pts: hop(C.ujjain, C.baghdad), t0: 26.2, t1: 27.1, hold: 28.6, out: 30.2, rest: 0, alt: 0.06 },
  { kind: 'arc', color: 'pale', pts: hop(C.baghdad, C.constantinople), t0: 26.7, t1: 27.4, hold: 28.6, out: 30.2, rest: 0, alt: 0.04 },
  { kind: 'arc', color: 'pale', pts: hop(C.baghdad, C.cairo), t0: 26.9, t1: 27.6, hold: 28.6, out: 30.2, rest: 0, alt: 0.04 },
  { kind: 'arc', color: 'pale', pts: hop(C.cairo, C.cordoba), t0: 27.6, t1: 28.6, hold: 28.9, out: 30.2, rest: 0, alt: 0.07 },

  // The Mongol conquests radiate from Karakorum.
  { kind: 'arc', color: 'ember', pts: hop(C.karakorum, C.beijing), t0: 30.7, t1: 31.5, hold: 34.4, out: 36.2, rest: 0, alt: 0.035 },
  { kind: 'arc', color: 'ember', pts: hop(C.karakorum, C.samarkand), t0: 30.9, t1: 31.9, hold: 34.4, out: 36.2, rest: 0, alt: 0.06 },
  { kind: 'arc', color: 'ember', pts: hop(C.karakorum, C.sarai), t0: 31.3, t1: 32.5, hold: 34.4, out: 36.2, rest: 0, alt: 0.09 },
  { kind: 'arc', color: 'ember', pts: hop(C.sarai, C.kyiv), t0: 32.4, t1: 33.0, hold: 34.4, out: 36.2, rest: 0, alt: 0.03 },
  { kind: 'arc', color: 'ember', pts: hop(C.samarkand, C.tabriz), t0: 31.9, t1: 32.7, hold: 34.4, out: 36.2, rest: 0, alt: 0.04 },
  { kind: 'arc', color: 'ember', pts: hop(C.tabriz, C.baghdad), t0: 32.7, t1: 33.2, hold: 34.4, out: 36.2, rest: 0, alt: 0.02 },
  { kind: 'arc', color: 'ember', pts: hop(C.beijing, C.hangzhou), t0: 32.2, t1: 33.0, hold: 34.4, out: 36.2, rest: 0, alt: 0.03 },
  { kind: 'arc', color: 'ember', pts: hop(C.beijing, C.kaesong), t0: 31.6, t1: 32.2, hold: 34.4, out: 36.2, rest: 0, alt: 0.025 },

  // The age of sail.
  { kind: 'surface', color: 'aqua', pts: ZHENG_HE, t0: 34.5, t1: 36.2, hold: 37.4, out: 39.0, rest: 0.0, width: 2.0 },
  { kind: 'surface', color: 'aqua', pts: ZHENG_HE_AFRICA, t0: 35.9, t1: 37.0, hold: 37.6, out: 39.0, rest: 0.0, width: 2.0 },
  { kind: 'surface', color: 'aqua', pts: DA_GAMA, t0: 36.7, t1: 38.3, hold: 39.6, out: 41.4, rest: 0.0, width: 2.0 },
  { kind: 'surface', color: 'aqua', pts: COLUMBUS, t0: 37.3, t1: 38.5, hold: 41.0, out: 42.6, rest: 0.0, width: 2.0 },
  { kind: 'surface', color: 'aqua', pts: MAGELLAN, t0: 38.9, t1: 41.5, hold: 41.9, out: 43.6, rest: 0.0, width: 2.0 },

  // First transatlantic telegraph cable, 1866.
  { kind: 'surface', color: 'pale', pts: CABLE, t0: 46.1, t1: 46.9, hold: 48.0, out: 49.4, rest: 0.0, width: 1.8 },
];

// ── The web: great-circle links between major cities, 1991 → ─────────────
export const HUBS = {
  NYC: [-74.0, 40.7], LAX: [-118.2, 34.05], SFO: [-122.4, 37.77], CHI: [-87.6, 41.9], MEX: [-99.1, 19.4],
  SAO: [-46.6, -23.5], BUE: [-58.4, -34.6], BOG: [-74.1, 4.7], LON: [-0.1, 51.5], PAR: [2.35, 48.86],
  FRA: [8.68, 50.11], MAD: [-3.7, 40.4], STO: [18.07, 59.33], MOW: [37.6, 55.75], IST: [28.98, 41.0],
  CAI: [31.24, 30.04], LOS: [3.4, 6.5], NBO: [36.8, -1.3], JNB: [28.0, -26.2], DXB: [55.3, 25.2],
  KHI: [67.0, 24.9], DEL: [77.2, 28.6], BOM: [72.9, 19.1], BLR: [77.6, 12.97], DAC: [90.4, 23.8],
  BKK: [100.5, 13.75], SIN: [103.8, 1.35], JKT: [106.85, -6.2], HKG: [114.2, 22.3], SHA: [121.5, 31.2],
  PEK: [116.4, 39.9], SEL: [127.0, 37.57], TYO: [139.7, 35.68], MNL: [121.0, 14.6], SYD: [151.2, -33.87],
  GVA: [6.1, 46.2], THR: [51.4, 35.7], ALA: [76.9, 43.2], TAS: [69.2, 41.3], ADD: [38.7, 9.0],
};
export const LINKS = [
  ['GVA', 'LON'], ['GVA', 'PAR'], ['GVA', 'FRA'], ['GVA', 'NYC'], ['LON', 'NYC'], ['PAR', 'NYC'], ['LON', 'FRA'],
  ['FRA', 'MOW'], ['FRA', 'IST'], ['LON', 'MAD'], ['FRA', 'STO'], ['MOW', 'IST'], ['IST', 'CAI'], ['IST', 'DXB'],
  ['CAI', 'DXB'], ['DXB', 'BOM'], ['DXB', 'KHI'], ['DXB', 'DEL'], ['BOM', 'DEL'], ['DEL', 'DAC'], ['BOM', 'BLR'],
  ['BLR', 'SIN'], ['DEL', 'PEK'], ['DAC', 'BKK'], ['BKK', 'SIN'], ['SIN', 'JKT'], ['SIN', 'HKG'], ['HKG', 'SHA'],
  ['SHA', 'PEK'], ['PEK', 'SEL'], ['SEL', 'TYO'], ['SHA', 'TYO'], ['HKG', 'MNL'], ['MNL', 'TYO'], ['SIN', 'SYD'],
  ['TYO', 'SYD'], ['TYO', 'SFO'], ['TYO', 'LAX'], ['SFO', 'NYC'], ['LAX', 'CHI'], ['CHI', 'NYC'], ['NYC', 'MEX'],
  ['NYC', 'SAO'], ['SAO', 'BUE'], ['BOG', 'MEX'], ['BOG', 'SAO'], ['MAD', 'SAO'], ['MAD', 'LOS'], ['LON', 'LOS'],
  ['LOS', 'JNB'], ['LOS', 'NBO'], ['NBO', 'JNB'], ['NBO', 'DXB'], ['NBO', 'ADD'], ['ADD', 'CAI'], ['JNB', 'BOM'],
  ['LON', 'DXB'], ['FRA', 'DEL'], ['MOW', 'PEK'], ['MOW', 'ALA'], ['ALA', 'PEK'], ['TAS', 'DEL'], ['THR', 'IST'],
  ['THR', 'DXB'], ['PAR', 'CAI'], ['LON', 'SIN'], ['FRA', 'SHA'], ['LON', 'TYO'], ['KHI', 'BOM'], ['JKT', 'SYD'],
  ['HKG', 'BKK'], ['LAX', 'SYD'], ['STO', 'MOW'], ['MAD', 'PAR'],
];
export const WEB_T0 = 52.3;

// ── Apollo 11 ────────────────────────────────────────────────────────────
export const APOLLO = { from: [-80.6, 28.57], t0: 50.75, t1: 51.75, moonIn: 49.4, moonOut: 53.3 };
