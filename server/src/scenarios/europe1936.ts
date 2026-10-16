/**
 * Preset scenario: "Europe, 1936".
 *
 * March 1936 — days before the Rhineland remilitarisation. Italy is mid-war in
 * Ethiopia, the Popular Front has just won in Spain, the Franco-Soviet pact is
 * awaiting ratification and Britain is pursuing appeasement.
 *
 * Provinces are modern admin-0 units (see scripts/build-geo.ts); this file maps
 * them onto 1936 owners. Any province not listed becomes its own minor nation.
 */
import type { NationId } from '../../../shared/types';
import type { ScenarioDefinition, NationSeed } from './types';

const nations: NationSeed[] = [
  {
    id: 'GER', name: 'Germany', leader: 'Adolf Hitler', government: 'National Socialist dictatorship',
    color: '#5b5f66', stability: 72, economy: 64, playable: true,
    goals: ['Remilitarise the Rhineland', 'Overturn Versailles', 'Unite all Germans in one Reich (Austria, Sudetenland, Danzig)', 'Secure Lebensraum in the East'],
    persona: 'Brash, revisionist, makes grand promises and veiled threats; respects strength and despises weakness.',
    blurb: 'A rearming revisionist power testing how far the Western democracies will bend.',
  },
  {
    id: 'ITA', name: 'Italy', leader: 'Benito Mussolini', government: 'Fascist dictatorship (Kingdom)',
    color: '#3f8f4f', stability: 62, economy: 48, playable: true,
    goals: ['Finish the conquest of Ethiopia', 'Make the Mediterranean an Italian lake', 'Keep Austria out of German hands', 'Gain prestige as a great power'],
    persona: 'Theatrical and opportunistic; flatters, boasts, and switches sides when it pays.',
    blurb: 'Under League sanctions over Ethiopia and courted by both Berlin and London.',
  },
  {
    id: 'ENG', name: 'United Kingdom', leader: 'Stanley Baldwin', government: 'Constitutional monarchy (parliamentary)',
    color: '#c0392b', stability: 78, economy: 72, playable: true,
    goals: ['Preserve the Empire', 'Avoid a continental war through negotiation', 'Maintain naval supremacy', 'Keep France as a partner without binding commitments'],
    persona: 'Polite, cautious and non-committal; prefers conferences, guarantees with conditions, and buying time.',
    blurb: 'The largest empire on Earth, war-weary and pursuing appeasement.',
  },
  {
    id: 'FRA', name: 'France', leader: 'Albert Sarraut', government: 'Third Republic (parliamentary)',
    color: '#2e5fa8', stability: 48, economy: 58, playable: true,
    goals: ['Contain Germany', 'Keep the alliance system with Poland and the Little Entente', 'Secure a firm British commitment', 'Defend the Maginot Line and the colonies'],
    persona: 'Anxious about Germany, legalistic, eager for British backing but politically divided at home.',
    blurb: 'Politically divided, behind the Maginot Line, seeking allies against Germany.',
  },
  {
    id: 'SOV', name: 'Soviet Union', leader: 'Joseph Stalin', government: 'Communist single-party state',
    color: '#8e1b1b', stability: 66, economy: 55, playable: true,
    goals: ['Industrialise at any cost', 'Collective security against fascism', 'Regain lost Tsarist territory (Baltics, Bessarabia, eastern Poland)', 'Spread communism where safe'],
    persona: 'Suspicious, patient and transactional; trusts no one and always asks what is offered in return.',
    blurb: 'Industrialising rapidly under Stalin and suspicious of every capitalist power.',
  },
  {
    id: 'SPR', name: 'Spain', leader: 'Manuel Azaña', government: 'Second Republic (Popular Front)',
    color: '#d4a017', stability: 28, economy: 35, playable: true,
    goals: ['Hold the Republic together', 'Prevent a military coup', 'Implement land and social reforms'],
    persona: 'Idealistic but harried; desperate for support and wary of foreign intervention.',
    blurb: 'A fractured Republic on the brink of civil war.',
  },
  {
    id: 'POL', name: 'Poland', leader: 'Ignacy Mościcki', government: 'Sanation authoritarian republic',
    color: '#c06c84', stability: 58, economy: 40, playable: true,
    goals: ['Balance between Germany and the USSR', 'Keep the Danzig corridor', 'Build an Intermarium bloc'],
    persona: 'Proud and prickly; refuses to be anyone\'s junior partner.',
    blurb: 'Squeezed between two giants, balancing non-aggression pacts with both.',
  },
  {
    id: 'CSK', name: 'Czechoslovakia', leader: 'Edvard Beneš', government: 'Parliamentary republic',
    color: '#5c9bd6', stability: 60, economy: 60, playable: true,
    goals: ['Defend the Sudeten border fortifications', 'Keep French and Soviet guarantees', 'Hold the Little Entente together'],
    persona: 'Principled democrat and skilled negotiator; deeply reliant on treaties.',
    blurb: 'An industrial democracy surrounded by revisionist neighbours.',
  },
  {
    id: 'AUT', name: 'Austria', leader: 'Kurt Schuschnigg', government: 'Federal State (authoritarian)',
    color: '#e8e2d0', stability: 40, economy: 38, playable: true,
    goals: ['Remain independent of Germany', 'Keep Italian protection'],
    persona: 'Earnest and nervous; clings to any guarantor of independence.',
    blurb: 'Clinging to independence under Italian protection as Berlin looms.',
  },
  {
    id: 'HUN', name: 'Hungary', leader: 'Miklós Horthy', government: 'Kingdom under a Regent',
    color: '#9a7b4f', stability: 58, economy: 42, playable: true,
    goals: ['Revise the Treaty of Trianon', 'Recover lost lands from Czechoslovakia, Romania and Yugoslavia'],
    persona: 'Conservative and revisionist; cautious about committing to Germany too far.',
    blurb: 'Revisionist kingdom without a king, hungry to undo Trianon.',
  },
  {
    id: 'ROM', name: 'Romania', leader: 'Carol II', government: 'Constitutional monarchy',
    color: '#d9c84a', stability: 50, economy: 44, playable: true,
    goals: ['Defend Greater Romania', 'Keep Bessarabia from the USSR', 'Profit from oil exports'],
    persona: 'Scheming and self-interested; wants guarantees and arms.',
    blurb: 'Oil-rich kingdom defending its post-war gains.',
  },
  {
    id: 'YUG', name: 'Yugoslavia', leader: 'Prince Paul', government: 'Kingdom under a Regent',
    color: '#4f7fbf', stability: 42, economy: 38, playable: true,
    goals: ['Hold the multi-ethnic kingdom together', 'Resist Italian ambitions on the Adriatic'],
    persona: 'Anglophile and careful; avoids provoking stronger neighbours.',
    blurb: 'A fragile multi-ethnic kingdom eyed by Italy and Hungary.',
  },
  {
    id: 'BUL', name: 'Bulgaria', leader: 'Boris III', government: 'Tsardom (royal dictatorship)',
    color: '#5f8a3a', stability: 52, economy: 34, playable: true,
    goals: ['Regain Dobruja and Aegean access', 'Avoid being dragged into a great-power war'],
    persona: 'Shrewd and cautious; quietly revisionist.',
    blurb: 'A revisionist Tsardom seeking lost Macedonia and Dobruja.',
  },
  {
    id: 'GRE', name: 'Greece', leader: 'George II', government: 'Restored monarchy',
    color: '#6fa8dc', stability: 38, economy: 36, playable: true,
    goals: ['Restore order at home', 'Keep British friendship', 'Guard against Italy in the Aegean'],
    persona: 'Pragmatic and pro-British.', blurb: 'A newly restored monarchy facing turmoil.',
  },
  {
    id: 'TUR', name: 'Turkey', leader: 'Mustafa Kemal Atatürk', government: 'Kemalist single-party republic',
    color: '#b5651d', stability: 74, economy: 44, playable: true,
    goals: ['Remilitarise the Straits (revise the Lausanne regime)', 'Modernise the state', 'Stay out of European wars'],
    persona: 'Confident moderniser; neutral, hard-nosed and allergic to foreign interference.',
    blurb: 'A modernising republic seeking control over the Straits.',
  },
  {
    id: 'POR', name: 'Portugal', leader: 'António de Oliveira Salazar', government: 'Estado Novo (corporatist)',
    color: '#2f6f4f', stability: 66, economy: 36, playable: true,
    goals: ['Preserve the empire', 'Keep the Anglo-Portuguese alliance', 'Prevent a communist Spain'],
    persona: 'Austere, careful and conservative.', blurb: 'An austere dictatorship with a vast African empire.',
  },
  {
    id: 'BEL', name: 'Belgium', leader: 'Leopold III', government: 'Constitutional monarchy',
    color: '#c9a227', stability: 58, economy: 58, playable: true,
    goals: ['Return to neutrality', 'Keep the Congo'], persona: 'Neutralist and cautious.',
    blurb: 'A small industrial kingdom drifting back to neutrality.',
  },
  {
    id: 'HOL', name: 'Netherlands', leader: 'Hendrikus Colijn', government: 'Constitutional monarchy',
    color: '#e67e22', stability: 66, economy: 58, playable: true,
    goals: ['Strict neutrality', 'Defend the East Indies from Japan'], persona: 'Thrifty, neutral and legalistic.',
    blurb: 'A neutral trading nation with a rich colonial empire.',
  },
  {
    id: 'SWE', name: 'Sweden', leader: 'Per Albin Hansson', government: 'Constitutional monarchy (social democratic)',
    color: '#3b7dd8', stability: 78, economy: 62, playable: true,
    goals: ['Neutrality', 'Profit from iron ore exports', 'Nordic cooperation'], persona: 'Consensual and neutral.',
    blurb: 'A neutral social democracy sitting on iron ore.',
  },
  {
    id: 'NOR', name: 'Norway', leader: 'Johan Nygaardsvold', government: 'Constitutional monarchy',
    color: '#7f1d2d', stability: 70, economy: 50, playable: true,
    goals: ['Neutrality', 'Protect the merchant fleet'], persona: 'Plain-spoken neutral.', blurb: 'A neutral seafaring kingdom.',
  },
  {
    id: 'DEN', name: 'Denmark', leader: 'Thorvald Stauning', government: 'Constitutional monarchy',
    color: '#d35454', stability: 72, economy: 54, playable: true,
    goals: ['Avoid provoking Germany', 'Keep Iceland and Greenland'], persona: 'Accommodating and careful.',
    blurb: 'A small kingdom on Germany\'s doorstep.',
  },
  {
    id: 'FIN', name: 'Finland', leader: 'Pehr Evind Svinhufvud', government: 'Parliamentary republic',
    color: '#e6eef7', stability: 66, economy: 44, playable: true,
    goals: ['Defend against the USSR', 'Nordic friendship'], persona: 'Stubborn and wary of Moscow.',
    blurb: 'A young republic watching the Soviet border.',
  },
  {
    id: 'EST', name: 'Estonia', leader: 'Konstantin Päts', government: 'Authoritarian republic',
    color: '#3d6fb6', stability: 56, economy: 40, playable: true, goals: ['Survive between Germany and the USSR'],
    persona: 'Cautious small-state diplomat.', blurb: 'A small Baltic state.',
  },
  {
    id: 'LAT', name: 'Latvia', leader: 'Kārlis Ulmanis', government: 'Authoritarian republic',
    color: '#8b3a3a', stability: 56, economy: 40, playable: true, goals: ['Survive between Germany and the USSR'],
    persona: 'Cautious small-state diplomat.', blurb: 'A small Baltic state.',
  },
  {
    id: 'LIT', name: 'Lithuania', leader: 'Antanas Smetona', government: 'Authoritarian republic',
    color: '#c7a93a', stability: 54, economy: 36, playable: true, goals: ['Recover Vilnius from Poland', 'Keep Memel from Germany'],
    persona: 'Aggrieved and cautious.', blurb: 'A Baltic state still claiming Vilnius.',
  },
  {
    id: 'SWI', name: 'Switzerland', leader: 'Albert Meyer', government: 'Federal republic',
    color: '#b03030', stability: 86, economy: 66, playable: true, goals: ['Armed neutrality', 'Banking and trade'],
    persona: 'Polite, precise and immovably neutral.', blurb: 'The armed neutral heart of Europe.',
  },
  {
    id: 'IRE', name: 'Ireland', leader: 'Éamon de Valera', government: 'Irish Free State',
    color: '#2e8b57', stability: 62, economy: 36, playable: true, goals: ['Loosen ties to Britain', 'Neutrality'],
    persona: 'Proud, legalistic and anti-British.', blurb: 'A Free State loosening its ties to London.',
  },
  {
    id: 'ALB', name: 'Albania', leader: 'Zog I', government: 'Kingdom',
    color: '#6b2f2f', stability: 40, economy: 20, playable: true, goals: ['Keep independence from Italy'],
    persona: 'Wily survivor.', blurb: 'A poor kingdom under heavy Italian influence.',
  },
  {
    id: 'ETH', name: 'Ethiopia', leader: 'Haile Selassie', government: 'Absolute monarchy (at war)',
    color: '#4caf50', stability: 30, economy: 15, playable: true, goals: ['Survive the Italian invasion', 'Win League of Nations support'],
    persona: 'Dignified and desperate; appeals to collective security.', blurb: 'Fighting for its life against Italy.',
  },
  {
    id: 'USA', name: 'United States', leader: 'Franklin D. Roosevelt', government: 'Federal presidential republic',
    color: '#4a6fa5', stability: 72, economy: 70, playable: true, goals: ['Recover from the Depression', 'Stay out of European wars', 'Contain Japan in the Pacific'],
    persona: 'Charming, idealistic in words, isolationist in deeds (Congress is watching).',
    blurb: 'An isolationist industrial giant recovering from the Depression.',
  },
  {
    id: 'JAP', name: 'Japan', leader: 'Hirohito', government: 'Imperial constitutional monarchy (militarist)',
    color: '#e8e0c8', stability: 56, economy: 56, playable: true, goals: ['Expand in China', 'Secure resources in Asia', 'Counter the USSR'],
    persona: 'Formal and indirect; the military sets the agenda.', blurb: 'A militarist empire expanding in Asia.',
  },
  {
    id: 'CHI', name: 'China', leader: 'Chiang Kai-shek', government: 'Nationalist one-party state (Kuomintang)',
    color: '#a5c26b', stability: 32, economy: 28, playable: true, goals: ['Unify China', 'Resist Japan', 'Defeat the Communists'],
    persona: 'Proud and embattled; seeks foreign aid.', blurb: 'A divided republic facing Japanese aggression.',
  },
  {
    id: 'BRA', name: 'Brazil', leader: 'Getúlio Vargas', government: 'Presidential republic (authoritarian)',
    color: '#2d9b5a', stability: 54, economy: 38, playable: true, goals: ['Industrialise', 'Play the great powers off for trade'],
    persona: 'Pragmatic populist.', blurb: 'South America\'s giant under Vargas.',
  },
];

/** Province id -> owning nation in March 1936. Unlisted provinces become minor nations. */
const owners: Record<string, NationId> = {
  DEU: 'GER', EPR: 'GER',
  ITA: 'ITA', LBY: 'ITA', ERI: 'ITA', SOM: 'ITA',
  ETH: 'ETH',
  GBR: 'ENG', CAN: 'ENG', AUS: 'ENG', NZL: 'ENG', ZAF: 'ENG', IND: 'ENG', PAK: 'ENG', BGD: 'ENG', MMR: 'ENG', LKA: 'ENG',
  EGY: 'ENG', SDN: 'ENG', SDS: 'ENG', KEN: 'ENG', UGA: 'ENG', TZA: 'ENG', NGA: 'ENG', GHA: 'ENG', SLE: 'ENG', GMB: 'ENG',
  ZMB: 'ENG', ZWE: 'ENG', MWI: 'ENG', BWA: 'ENG', LSO: 'ENG', SWZ: 'ENG', NAM: 'ENG', SOL: 'ENG', ISR: 'ENG', PSX: 'ENG',
  JOR: 'ENG', KWT: 'ENG', QAT: 'ENG', ARE: 'ENG', CYP: 'ENG', CYN: 'ENG', MYS: 'ENG', BRN: 'ENG', PNG: 'ENG', SLB: 'ENG',
  FJI: 'ENG', BLZ: 'ENG', GUY: 'ENG', JAM: 'ENG', TTO: 'ENG', BHS: 'ENG', FLK: 'ENG', VUT: 'ENG',
  FRA: 'FRA', DZA: 'FRA', TUN: 'FRA', MAR: 'FRA', MRT: 'FRA', SEN: 'FRA', MLI: 'FRA', GIN: 'FRA', CIV: 'FRA', BFA: 'FRA',
  NER: 'FRA', BEN: 'FRA', TGO: 'FRA', TCD: 'FRA', CAF: 'FRA', COG: 'FRA', GAB: 'FRA', CMR: 'FRA', MDG: 'FRA', DJI: 'FRA',
  VNM: 'FRA', LAO: 'FRA', KHM: 'FRA', SYR: 'FRA', LBN: 'FRA', NCL: 'FRA', ATF: 'FRA',
  RUS: 'SOV', UKR: 'SOV', BLR: 'SOV', GEO: 'SOV', ARM: 'SOV', AZE: 'SOV', KAZ: 'SOV', UZB: 'SOV', TKM: 'SOV', KGZ: 'SOV', TJK: 'SOV',
  ESP: 'SPR', SAH: 'SPR', GNQ: 'SPR',
  PRT: 'POR', AGO: 'POR', MOZ: 'POR', GNB: 'POR', TLS: 'POR',
  BEL: 'BEL', COD: 'BEL', RWA: 'BEL', BDI: 'BEL',
  NLD: 'HOL', IDN: 'HOL', SUR: 'HOL',
  DNK: 'DEN', ISL: 'DEN', GRL: 'DEN',
  CZE: 'CSK', SVK: 'CSK',
  SRB: 'YUG', SVN: 'YUG', HRV: 'YUG', BIH: 'YUG', MNE: 'YUG', MKD: 'YUG', KOS: 'YUG',
  ROU: 'ROM', MDA: 'ROM',
  USA: 'USA', PHL: 'USA', PRI: 'USA',
  JPN: 'JAP', KOR: 'JAP', PRK: 'JAP', TWN: 'JAP',
  CHN: 'CHI', TUR: 'TUR', POL: 'POL', AUT: 'AUT', HUN: 'HUN', BGR: 'BUL', GRC: 'GRE', ALB: 'ALB',
  SWE: 'SWE', NOR: 'NOR', FIN: 'FIN', EST: 'EST', LVA: 'LAT', LTU: 'LIT', CHE: 'SWI', IRL: 'IRE', BRA: 'BRA',
};

/** 1936 names for provinces whose modern name would be anachronistic. */
const provinceNames: Record<string, string> = {
  IND: 'British India', PAK: 'Punjab & Sindh', BGD: 'Bengal', MMR: 'Burma', LKA: 'Ceylon', COD: 'Belgian Congo',
  RWA: 'Ruanda', BDI: 'Urundi', IDN: 'Dutch East Indies', SUR: 'Dutch Guiana', TWN: 'Formosa', KOR: 'Korea (South)',
  PRK: 'Korea (North)', NAM: 'South West Africa', ZWE: 'Southern Rhodesia', ZMB: 'Northern Rhodesia', MWI: 'Nyasaland',
  GHA: 'Gold Coast', BWA: 'Bechuanaland', LSO: 'Basutoland', SWZ: 'Swaziland', TZA: 'Tanganyika', THA: 'Siam',
  ISR: 'Mandatory Palestine', PSX: 'Judea & Samaria', JOR: 'Transjordan', MLI: 'French Sudan', BFA: 'Upper Volta',
  BEN: 'Dahomey', VNM: 'Annam & Tonkin', PNG: 'Territory of New Guinea', GUY: 'British Guiana', BLZ: 'British Honduras',
  SOL: 'British Somaliland', SOM: 'Italian Somaliland', DJI: 'French Somaliland', TLS: 'Portuguese Timor',
  GNB: 'Portuguese Guinea', MDA: 'Bessarabia', MKD: 'Vardar Macedonia', ARE: 'Trucial States', SDN: 'Anglo-Egyptian Sudan',
  SDS: 'Southern Sudan', GNQ: 'Spanish Guinea', SAH: 'Spanish Sahara', MYS: 'British Malaya', BRN: 'Brunei',
  UKR: 'Ukrainian SSR', BLR: 'Byelorussian SSR', GEO: 'Georgian SSR', ARM: 'Armenian SSR', AZE: 'Azerbaijan SSR',
  KAZ: 'Kazakh SSR', UZB: 'Uzbek SSR', TKM: 'Turkmen SSR', KGZ: 'Kirghiz SSR', TJK: 'Tajik SSR', RUS: 'Russian SFSR',
  IRN: 'Iran', SAU: 'Saudi Arabia', CIV: 'Ivory Coast', NCL: 'New Caledonia', LBN: 'Greater Lebanon',
};

/** Symmetric starting relations (unlisted pairs start at 0). */
const relations: [NationId, NationId, number][] = [
  ['GER', 'ITA', 35], ['GER', 'FRA', -50], ['GER', 'ENG', -5], ['GER', 'SOV', -70], ['GER', 'POL', 10], ['GER', 'CSK', -45],
  ['GER', 'AUT', -25], ['GER', 'JAP', 30], ['GER', 'HUN', 25], ['GER', 'LIT', -30], ['GER', 'USA', -20],
  ['ITA', 'ETH', -100], ['ITA', 'ENG', -40], ['ITA', 'FRA', -20], ['ITA', 'AUT', 45], ['ITA', 'HUN', 40], ['ITA', 'YUG', -30],
  ['ITA', 'ALB', 25], ['ITA', 'GRE', -20], ['ITA', 'SOV', -30],
  ['ENG', 'FRA', 60], ['ENG', 'USA', 40], ['ENG', 'POR', 60], ['ENG', 'IRE', -25], ['ENG', 'SOV', -20], ['ENG', 'JAP', -15],
  ['ENG', 'GRE', 30], ['ENG', 'ETH', 20], ['ENG', 'TUR', 15], ['ENG', 'HOL', 30], ['ENG', 'BEL', 30],
  ['FRA', 'SOV', 30], ['FRA', 'CSK', 65], ['FRA', 'POL', 40], ['FRA', 'BEL', 50], ['FRA', 'YUG', 35], ['FRA', 'ROM', 35],
  ['FRA', 'SPR', 30],
  ['SOV', 'JAP', -50], ['SOV', 'POL', -35], ['SOV', 'CSK', 30], ['SOV', 'FIN', -25], ['SOV', 'ROM', -35], ['SOV', 'SPR', 20],
  ['SOV', 'EST', -15], ['SOV', 'LAT', -15], ['SOV', 'CHI', 0], ['SOV', 'TUR', 20],
  ['CSK', 'HUN', -40], ['CSK', 'YUG', 45], ['CSK', 'ROM', 45], ['YUG', 'ROM', 45], ['CSK', 'POL', -20],
  ['HUN', 'ROM', -55], ['HUN', 'YUG', -30], ['BUL', 'YUG', -10], ['BUL', 'GRE', -25], ['BUL', 'ROM', -25], ['GRE', 'TUR', 40],
  ['USA', 'JAP', -25], ['USA', 'CHI', 25], ['JAP', 'CHI', -85], ['POL', 'LIT', -55], ['POL', 'ROM', 40], ['POL', 'HUN', 35],
  ['EST', 'LAT', 50], ['LAT', 'LIT', 30], ['FIN', 'SWE', 50], ['SWE', 'NOR', 60], ['NOR', 'DEN', 60], ['SWE', 'DEN', 60],
  ['POR', 'SPR', -20], ['BRA', 'USA', 35], ['ITA', 'JAP', 5],
];

export const europe1936: ScenarioDefinition = {
  id: 'europe-1936',
  name: 'Europe, 1936',
  description:
    'March 1936. Germany prepares to march into the Rhineland, Italy is at war in Ethiopia, Spain teeters on the brink of civil war, and the democracies hope appeasement will keep the peace.',
  startDate: '1936-03-01',
  startRange: ['1936-01', '1936-12'],
  nations,
  owners,
  provinceNames,
  relations,
  openingEvents: [
    'Italian forces advance deep into Ethiopia; the League of Nations debates oil sanctions.',
    'The Popular Front has won the Spanish general election; tension grows between the Republic and the army.',
    'The French Chamber of Deputies has ratified the Franco-Soviet Treaty of Mutual Assistance. Berlin calls it a violation of Locarno.',
  ],
};
