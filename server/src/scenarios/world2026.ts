/**
 * Preset scenario: "World, 2026" — the present day, built for the military layer.
 *
 * Leaders, alignments and force sizes are a best-effort snapshot of 2026 and are
 * deliberately abstracted: a "division" is roughly 10–20k troops, factories are a
 * relative measure of defense-industrial capacity, and jet counts are combat aircraft.
 * The Russia–Ukraine war is already under way at game start.
 */
import type { NationId } from '../../../shared/types';
import type { MilitarySeed, NationSeed, ScenarioDefinition } from './types';

type N = Omit<NationSeed, 'playable'> & { playable?: boolean };
const n = (x: N): NationSeed => ({ playable: true, ...x });

const nations: NationSeed[] = [
  n({ id: 'USA', name: 'United States', leader: 'Donald Trump', government: 'Federal presidential republic', color: '#3c6fb4', stability: 58, economy: 88,
    goals: ['Remain the dominant military power', 'Deter China over Taiwan', 'Make allies pay more for defense', 'Avoid open-ended wars'],
    persona: 'Transactional dealmaker; loves leverage, tariffs and headline victories; distrusts multilateral commitments.',
    blurb: 'The world\'s strongest military, with global reach and stealth air power.' }),
  n({ id: 'CHN', name: 'China', leader: 'Xi Jinping', government: 'Communist single-party state', color: '#c8312f', stability: 70, economy: 80,
    goals: ['Unify Taiwan with the mainland', 'Dominate the South China Sea', 'Overtake the US technologically', 'Keep Russia as a partner'],
    persona: 'Patient, long-term, speaks of "win-win" but never concedes on core interests.',
    blurb: 'The largest industrial base on Earth and a rapidly modernising army.' }),
  n({ id: 'RUS', name: 'Russia', leader: 'Vladimir Putin', government: 'Authoritarian presidential federation', color: '#5b3a6e', stability: 55, economy: 50,
    goals: ['Win the war in Ukraine', 'Keep NATO out of its sphere', 'Divide the West', 'Hold Belarus close'],
    persona: 'Cold, grievance-driven, speaks in history lessons; tests red lines and respects only force.',
    blurb: 'A war economy grinding forward in Ukraine with masses of artillery and drones.' }),
  n({ id: 'UKR', name: 'Ukraine', leader: 'Volodymyr Zelenskyy', government: 'Presidential republic under martial law', color: '#e2c13b', stability: 52, economy: 30,
    goals: ['Liberate occupied territory', 'Secure Western weapons and guarantees', 'Join the EU and NATO', 'Outlast Russia'],
    persona: 'Defiant, media-savvy, relentless in asking for more help; refuses to trade land for peace.',
    blurb: 'Fighting for survival, with a world-class drone industry and Western aid.' }),
  n({ id: 'IND', name: 'India', leader: 'Narendra Modi', government: 'Federal parliamentary republic', color: '#e8893a', stability: 66, economy: 62,
    goals: ['Strategic autonomy between the blocs', 'Deter China and Pakistan', 'Build a domestic arms industry', 'Become a great power'],
    persona: 'Confident nationalist; multi-aligned, buys from everyone, commits to no one.',
    blurb: 'A rising giant facing China in the Himalayas and Pakistan in Kashmir.' }),
  n({ id: 'PAK', name: 'Pakistan', leader: 'Shehbaz Sharif', government: 'Parliamentary republic (army-dominated)', color: '#2f7a46', stability: 38, economy: 28,
    goals: ['Deter India', 'Keep Chinese backing', 'Contain militancy on the Afghan border'],
    persona: 'Defers to the army; proud, wary, quick to raise Kashmir.', blurb: 'A nuclear-armed state locked in rivalry with India.' }),
  n({ id: 'GBR', name: 'United Kingdom', leader: 'Keir Starmer', government: 'Constitutional monarchy (parliamentary)', color: '#b73a4a', stability: 60, economy: 64,
    goals: ['Back Ukraine', 'Keep the US engaged in Europe', 'Rebuild armed forces after decades of cuts'],
    persona: 'Measured, legalistic, loyal to allies; prefers coalitions.', blurb: 'A small but high-tech army and a key NATO pillar.' }),
  n({ id: 'FRA', name: 'France', leader: 'Emmanuel Macron', government: 'Semi-presidential republic', color: '#3d5dab', stability: 50, economy: 63,
    goals: ['European strategic autonomy', 'Back Ukraine', 'Keep influence in Africa and the Indo-Pacific'],
    persona: 'Grand visions, long speeches, wants Europe to stand on its own feet.', blurb: 'Europe\'s most independent military, with its own jets and tanks.' }),
  n({ id: 'DEU', name: 'Germany', leader: 'Friedrich Merz', government: 'Federal parliamentary republic', color: '#555b63', stability: 60, economy: 68,
    goals: ['Rebuild the Bundeswehr', 'Defend NATO\'s eastern flank', 'Support Ukraine'],
    persona: 'Businesslike and cautious, but newly willing to spend on defense.', blurb: 'An industrial powerhouse rearming at speed.' }),
  n({ id: 'ITA', name: 'Italy', leader: 'Giorgia Meloni', government: 'Parliamentary republic', color: '#3f8f5a', stability: 58, economy: 56,
    goals: ['Secure the Mediterranean', 'Control migration', 'Stay close to Washington'],
    persona: 'Sharp, pragmatic conservative; Atlanticist but defends national interest.', blurb: 'A Mediterranean power with modern jets and a capable navy.' }),
  n({ id: 'POL', name: 'Poland', leader: 'Donald Tusk', government: 'Parliamentary republic', color: '#d2546e', stability: 62, economy: 58,
    goals: ['Build Europe\'s strongest land army', 'Deter Russia and Belarus', 'Keep US troops on Polish soil'],
    persona: 'Blunt about the Russian threat; buying tanks and artillery by the thousand.', blurb: 'NATO\'s frontline state, spending more on defense than anyone in Europe.' }),
  n({ id: 'TUR', name: 'Turkey', leader: 'Recep Tayyip Erdoğan', government: 'Presidential republic', color: '#b5492e', stability: 50, economy: 44,
    goals: ['Be a regional power broker', 'Sell drones to the world', 'Contain Kurdish militias', 'Balance NATO and Russia'],
    persona: 'Mercurial, proud, plays all sides; drives hard bargains.', blurb: 'NATO\'s second-largest army and a drone superpower.' }),
  n({ id: 'ISR', name: 'Israel', leader: 'Benjamin Netanyahu', government: 'Parliamentary republic', color: '#4f8fd6', stability: 45, economy: 66,
    goals: ['Neutralise Iran\'s nuclear program', 'Destroy hostile militias', 'Keep US backing', 'Normalise ties with Gulf states'],
    persona: 'Combative, security-obsessed, distrusts guarantees not backed by force.', blurb: 'A small state with a superb air force and missile defenses.' }),
  n({ id: 'IRN', name: 'Iran', leader: 'Ali Khamenei', government: 'Islamic theocratic republic', color: '#2f6f5e', stability: 38, economy: 30,
    goals: ['Regime survival', 'Rebuild its proxy network', 'Deter Israel and the US', 'Expel the US from the region'],
    persona: 'Ideological, suspicious, speaks of resistance; never concedes publicly.', blurb: 'A sanctioned regional power with missiles, drones and a large army.' }),
  n({ id: 'SAU', name: 'Saudi Arabia', leader: 'Mohammed bin Salman', government: 'Absolute monarchy', color: '#1f7a3f', stability: 62, economy: 60,
    goals: ['Diversify the economy', 'Contain Iran', 'Lead the Arab world', 'Hedge between the US and China'],
    persona: 'Ambitious and impatient; buys influence and expects loyalty.', blurb: 'Oil wealth and a large, well-equipped but untested military.' }),
  n({ id: 'EGY', name: 'Egypt', leader: 'Abdel Fattah el-Sisi', government: 'Presidential republic (military-backed)', color: '#c9a64a', stability: 46, economy: 32,
    goals: ['Keep internal order', 'Secure the Nile', 'Stay on good terms with the Gulf and the US'],
    persona: 'Stern, status-quo minded, values stability above all.', blurb: 'The Arab world\'s largest army.' }),
  n({ id: 'JPN', name: 'Japan', leader: 'Sanae Takaichi', government: 'Constitutional monarchy (parliamentary)', color: '#e6e1d6', stability: 64, economy: 70,
    goals: ['Deter China and North Korea', 'Double defense spending', 'Strengthen the US alliance'],
    persona: 'Hawkish conservative; firm on China, warm to Washington.', blurb: 'A high-tech military casting off decades of restraint.' }),
  n({ id: 'KOR', name: 'South Korea', leader: 'Lee Jae-myung', government: 'Presidential republic', color: '#4a7fc1', stability: 56, economy: 68,
    goals: ['Deter North Korea', 'Grow arms exports', 'Manage relations with China'],
    persona: 'Pragmatic; prefers dialogue with the North but keeps the guard up.', blurb: 'A huge modern army and a booming arms industry.' }),
  n({ id: 'PRK', name: 'North Korea', leader: 'Kim Jong Un', government: 'Totalitarian hereditary dictatorship', color: '#7a2b2b', stability: 70, economy: 12,
    goals: ['Regime survival', 'Expand the nuclear arsenal', 'Profit from the Russian alliance'],
    persona: 'Bombastic, threatening, unpredictable.', blurb: 'A massive, ageing army with nuclear weapons.' }),
  n({ id: 'TWN', name: 'Taiwan', leader: 'Lai Ching-te', government: 'Semi-presidential republic', color: '#3f9b8f', stability: 62, economy: 70,
    goals: ['Deter a Chinese invasion', 'Keep US support', 'Build an asymmetric "porcupine" defense'],
    persona: 'Calm and careful; avoids provocation, never concedes sovereignty.', blurb: 'An island fortress facing the PLA across 160 km of sea.' }),
  n({ id: 'AUS', name: 'Australia', leader: 'Anthony Albanese', government: 'Constitutional monarchy (parliamentary)', color: '#d7a03a', stability: 68, economy: 66,
    goals: ['Secure the Indo-Pacific', 'Deliver nuclear submarines', 'Keep the US alliance strong'],
    persona: 'Plain-spoken and cautious.', blurb: 'A small, modern force on the edge of Asia.' }),
  n({ id: 'CAN', name: 'Canada', leader: 'Mark Carney', government: 'Constitutional monarchy (parliamentary)', color: '#c84040', stability: 66, economy: 64,
    goals: ['Defend Arctic sovereignty', 'Diversify away from the US', 'Meet NATO spending goals'],
    persona: 'Technocratic and polite; firmer with Washington than before.', blurb: 'A huge country with a small army.' }),
  n({ id: 'BRA', name: 'Brazil', leader: 'Luiz Inácio Lula da Silva', government: 'Federal presidential republic', color: '#2d9b5a', stability: 52, economy: 46,
    goals: ['Lead the Global South', 'Protect the Amazon', 'Stay neutral between the blocs'],
    persona: 'Warm, talkative, champions non-alignment.', blurb: 'South America\'s giant.' }),
  n({ id: 'IDN', name: 'Indonesia', leader: 'Prabowo Subianto', government: 'Presidential republic', color: '#b33b3b', stability: 58, economy: 45,
    goals: ['Defend the archipelago', 'Stay non-aligned', 'Modernise the armed forces'],
    persona: 'Former general; proud, nationalist, keeps options open.', blurb: 'The largest country in Southeast Asia.' }),
  n({ id: 'VNM', name: 'Vietnam', leader: 'Tô Lâm', government: 'Communist single-party state', color: '#c4502f', stability: 64, economy: 46,
    goals: ['Resist Chinese pressure in the South China Sea', 'Bamboo diplomacy: friends with all'],
    persona: 'Disciplined, cautious, never forgets past wars.', blurb: 'A battle-hardened army next to China.' }),
  n({ id: 'MEX', name: 'Mexico', leader: 'Claudia Sheinbaum', government: 'Federal presidential republic', color: '#3a8a5f', stability: 46, economy: 44,
    goals: ['Fight the cartels', 'Manage relations with Washington'], persona: 'Calm scientist-politician, firm on sovereignty.',
    blurb: 'A large army focused on internal security.' }),
  n({ id: 'ARG', name: 'Argentina', leader: 'Javier Milei', government: 'Federal presidential republic', color: '#6fa8dc', stability: 48, economy: 34,
    goals: ['Fix the economy', 'Align with the US', 'Revive the Falklands claim one day'], persona: 'Flamboyant libertarian, combative in rhetoric.',
    blurb: 'A hollowed-out military with big ambitions.' }),
  n({ id: 'ZAF', name: 'South Africa', leader: 'Cyril Ramaphosa', government: 'Parliamentary republic', color: '#d9a441', stability: 44, economy: 38,
    goals: ['Lead Africa', 'Stay non-aligned'], persona: 'Conciliatory negotiator.', blurb: 'Africa\'s most industrialised state.' }),
  n({ id: 'NGA', name: 'Nigeria', leader: 'Bola Tinubu', government: 'Federal presidential republic', color: '#3f9b4a', stability: 36, economy: 30,
    goals: ['Defeat insurgents', 'Lead West Africa'], persona: 'Wily political operator.', blurb: 'West Africa\'s largest military.' }),
  n({ id: 'BLR', name: 'Belarus', leader: 'Alexander Lukashenko', government: 'Authoritarian presidential republic', color: '#8a6f9e', stability: 55, economy: 30,
    goals: ['Regime survival', 'Stay out of direct fighting while backing Russia'], persona: 'Folksy strongman, Moscow\'s junior partner.',
    blurb: 'Russia\'s closest ally, bordering Ukraine, Poland and the Baltics.' }),
];

/** Province -> owner. Majors own their home province; extras here. Unlisted provinces become minor nations. */
const owners: Record<string, NationId> = Object.fromEntries(nations.map((x) => [x.id, x.id]));
Object.assign(owners, {
  PRI: 'USA', EPR: 'RUS', FLK: 'GBR', NCL: 'FRA', ATF: 'FRA',
  // Territories of minor nations
  GRL: 'DNK', SAH: 'MAR',
});

const provinceNames: Record<string, string> = {
  CZE: 'Czechia', EPR: 'Kaliningrad', CYN: 'Northern Cyprus', SOL: 'Somaliland', SAH: 'Western Sahara', COD: 'DR Congo', CAF: 'Central African Republic',
};

const relations: [NationId, NationId, number][] = [
  // NATO & Western partners
  ['USA', 'GBR', 75], ['USA', 'FRA', 50], ['USA', 'DEU', 55], ['USA', 'ITA', 60], ['USA', 'POL', 75], ['USA', 'CAN', 35], ['USA', 'TUR', 25],
  ['USA', 'JPN', 80], ['USA', 'KOR', 70], ['USA', 'AUS', 80], ['USA', 'TWN', 60], ['USA', 'ISR', 80], ['USA', 'SAU', 55], ['USA', 'UKR', 35],
  ['USA', 'EGY', 35], ['USA', 'IND', 30], ['USA', 'PAK', 10], ['USA', 'ARG', 55], ['USA', 'MEX', 10], ['USA', 'BRA', -10], ['USA', 'ZAF', -25],
  ['GBR', 'FRA', 65], ['GBR', 'DEU', 65], ['GBR', 'POL', 65], ['GBR', 'UKR', 75], ['GBR', 'CAN', 75], ['GBR', 'AUS', 80], ['GBR', 'ITA', 55],
  ['FRA', 'DEU', 70], ['FRA', 'ITA', 45], ['FRA', 'POL', 60], ['FRA', 'UKR', 70], ['FRA', 'IND', 55],
  ['DEU', 'POL', 55], ['DEU', 'UKR', 65], ['DEU', 'ITA', 55], ['ITA', 'UKR', 55], ['POL', 'UKR', 55], ['CAN', 'UKR', 70],
  ['JPN', 'KOR', 40], ['JPN', 'AUS', 65], ['JPN', 'TWN', 50], ['JPN', 'IND', 50], ['KOR', 'TWN', 20], ['AUS', 'IND', 45],
  // Russia / China bloc
  ['RUS', 'UKR', -100], ['RUS', 'BLR', 85], ['RUS', 'CHN', 60], ['RUS', 'PRK', 70], ['RUS', 'IRN', 55], ['RUS', 'IND', 45],
  ['RUS', 'USA', -45], ['RUS', 'GBR', -70], ['RUS', 'FRA', -60], ['RUS', 'DEU', -60], ['RUS', 'POL', -80], ['RUS', 'ITA', -40],
  ['RUS', 'TUR', 20], ['RUS', 'JPN', -50], ['RUS', 'CAN', -60], ['RUS', 'BRA', 20], ['RUS', 'ZAF', 30],
  ['BLR', 'UKR', -60], ['BLR', 'POL', -60],
  ['CHN', 'USA', -45], ['CHN', 'TWN', -80], ['CHN', 'JPN', -50], ['CHN', 'IND', -30], ['CHN', 'PAK', 80], ['CHN', 'PRK', 50], ['CHN', 'IRN', 40],
  ['CHN', 'VNM', -10], ['CHN', 'KOR', -10], ['CHN', 'AUS', -25], ['CHN', 'BRA', 40], ['CHN', 'ZAF', 40], ['CHN', 'SAU', 30], ['CHN', 'IDN', 20],
  ['CHN', 'UKR', -15],
  // Flashpoints
  ['IND', 'PAK', -80], ['KOR', 'PRK', -70], ['JPN', 'PRK', -70], ['USA', 'PRK', -70],
  ['ISR', 'IRN', -95], ['USA', 'IRN', -85], ['SAU', 'IRN', -20], ['TUR', 'ISR', -50], ['EGY', 'ISR', 10], ['ISR', 'SAU', 10], ['ISR', 'DEU', 55],
  ['IRN', 'GBR', -55], ['IRN', 'FRA', -45], ['IRN', 'PAK', 0],
  ['SAU', 'EGY', 60], ['TUR', 'UKR', 30], ['TUR', 'IRN', -10],
  ['VNM', 'USA', 25], ['IDN', 'AUS', 30], ['BRA', 'ARG', 0], ['MEX', 'BRA', 30], ['ZAF', 'NGA', 30],
];

// ---------------------------------------------------------------------------
// Military seeds (abstracted from public 2025–26 estimates)
// ---------------------------------------------------------------------------
// tier: tech level. factories: defense industry. manpower: thousands available.
// inf/mech/arm: starting divisions. jets: combat aircraft. drones: combat drones.
const m = (tier: 1 | 2 | 3, factories: number, manpower: number, inf: number, mech: number, arm: number, jets: number, slots: number, extra: Partial<MilitarySeed> = {}): MilitarySeed =>
  ({ tier, factories, manpower, inf, mech, arm, jets, slots, ...extra });

const military: Record<NationId, MilitarySeed> = {
  USA: m(1, 130, 2500, 8, 8, 6, 1400, 6, { stealthShare: 0.35, drones: 250, extraTechs: ['radar_gan', 'missile_hypersonic', 'ind_ai_research', 'inf_exo'] }),
  CHN: m(1, 180, 8000, 16, 10, 6, 1300, 6, { stealthShare: 0.15, drones: 300, tank: 'std_mbt_g3al', extraTechs: ['missile_hypersonic', 'drone_swarm', 'ind_automation'] }),
  RUS: m(2, 85, 3000, 18, 8, 6, 800, 5, { stealthShare: 0.03, drones: 400, tank: 'std_mbt_g3al', extraTechs: ['art_loiter', 'doc_attrition', 'doc_drone_war', 'missile_ramjet', 'jet_gen5'] }),
  UKR: m(2, 25, 1200, 18, 5, 2, 60, 4, { drones: 600, tank: 'std_mbt_g3al', extraTechs: ['art_loiter', 'doc_drone_war', 'inf_manpads', 'ucav'] }),
  IND: m(2, 60, 5000, 18, 5, 4, 550, 4, { drones: 50, tank: 'std_mbt_g3al' }),
  PAK: m(3, 18, 1000, 12, 3, 2, 350, 3, { tank: 'std_mbt_g3al', extraTechs: ['jet_gen45', 'radar_aesa'] }),
  GBR: m(1, 30, 400, 3, 2, 1, 150, 5, { stealthShare: 0.2 }),
  FRA: m(1, 35, 500, 4, 3, 1, 220, 5),
  DEU: m(1, 45, 450, 2, 3, 2, 130, 5),
  ITA: m(2, 28, 400, 3, 2, 1, 180, 4, { stealthShare: 0.15, extraTechs: ['jet_gen5', 'stealth_ram'] }),
  POL: m(2, 25, 600, 4, 4, 3, 70, 4, { extraTechs: ['art_loiter'] }),
  TUR: m(2, 35, 1500, 10, 4, 3, 280, 4, { drones: 300, extraTechs: ['art_loiter', 'drone_swarm'] }),
  ISR: m(1, 20, 600, 4, 3, 4, 300, 5, { stealthShare: 0.15, drones: 150, extraTechs: ['tank_aps2', 'art_laser'] }),
  IRN: m(3, 25, 2500, 14, 3, 2, 150, 3, { drones: 300, tank: 'std_mbt_legacy', extraTechs: ['ucav', 'art_loiter', 'art_guided'] }),
  SAU: m(2, 18, 400, 3, 3, 2, 300, 3),
  EGY: m(3, 18, 2000, 8, 4, 4, 220, 3),
  JPN: m(1, 50, 600, 4, 3, 1, 300, 5, { stealthShare: 0.2 }),
  KOR: m(1, 45, 1000, 10, 5, 3, 400, 5, { stealthShare: 0.08 }),
  PRK: m(3, 12, 3000, 20, 2, 3, 150, 2, { tank: 'std_mbt_legacy' }),
  TWN: m(2, 30, 600, 6, 3, 2, 280, 4, { drones: 60, extraTechs: ['inf_manpads', 'art_ad'] }),
  AUS: m(2, 12, 200, 1, 2, 1, 100, 4, { stealthShare: 0.4, extraTechs: ['jet_gen5', 'stealth_ram'] }),
  CAN: m(2, 15, 300, 1, 2, 1, 80, 4),
  BRA: m(3, 25, 1500, 8, 3, 1, 60, 3, { tank: 'std_mbt_legacy' }),
  IDN: m(3, 20, 2000, 10, 2, 1, 50, 3, { tank: 'std_light' }),
  VNM: m(3, 15, 2500, 12, 2, 2, 70, 3, { tank: 'std_mbt_legacy' }),
  MEX: m(3, 15, 1200, 8, 1, 0, 20, 2),
  ARG: m(3, 8, 400, 3, 1, 1, 20, 2, { tank: 'std_mbt_legacy' }),
  ZAF: m(3, 8, 300, 2, 1, 1, 25, 2, { tank: 'std_mbt_legacy' }),
  NGA: m(3, 8, 800, 5, 1, 0, 20, 2),
  BLR: m(3, 8, 300, 3, 2, 1, 40, 2, { tank: 'std_mbt_g3al' }),
};

export const world2026: ScenarioDefinition = {
  id: 'world-2026',
  name: 'World, 2026',
  description:
    'The present day. The Russia–Ukraine war grinds on, China eyes Taiwan, Iran and Israel trade blows, and every power is rearming. Research, design tanks and jets, plan divisions — then fight.',
  startDate: '2026-11-01',
  startRange: ['2026-01', '2027-12'],
  nations,
  owners,
  provinceNames,
  relations,
  openingEvents: [
    'The Russia–Ukraine war enters its fifth winter. Russian forces hold roughly a fifth of Ukraine; drones dominate the front.',
    'Chinese naval and air activity around Taiwan has reached record levels.',
    'European NATO members announce the largest rearmament programmes since the Cold War.',
    'Tensions between Israel and Iran remain high after last year\'s strikes on Iranian nuclear sites.',
  ],
  military: {
    seeds: military,
    wars: [['RUS', 'UKR', '2022-02-24']],
    // Russia occupies roughly a fifth of Ukraine.
    occupation: [['UKR', 'RUS', 19]],
    // [nation, province, share of its divisions]: forward deployments. The rest stay at home.
    deployments: [
      ['RUS', 'UKR', 0.65], ['USA', 'KOR', 0.06], ['USA', 'JPN', 0.06], ['USA', 'DEU', 0.06], ['USA', 'POL', 0.06],
      ['GBR', 'POL', 0.15], ['DEU', 'POL', 0.1],
    ],
  },
};
