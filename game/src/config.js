// Ember Coast — shared constants, districts, story jobs, prices, shop/garage data.
// Everything here is original content written for this game.
export const STEP = 1 / 60;
export const CITY = 170; // half-extent of the street grid
export const ROAD_STEP = 40;
export const SAVE_KEY = 'ember-coast-save-v1';

export const DISTRICTS = [
  { name: 'The Flamingo Mile', x: 80, z: -40, color: '#ff7ab8' },
  { name: 'North Pier', x: 0, z: -150, color: '#7ad9ff' },
  { name: 'Old Cannery Row', x: -120, z: -80, color: '#c9a06a' },
  { name: 'Palm Court', x: -40, z: 40, color: '#8dff9e' },
  { name: 'Copperton', x: 40, z: 80, color: '#ff9a5c' },
  { name: 'The Yards', x: 120, z: 120, color: '#b8b8b8' },
  { name: 'University Bluff', x: -120, z: 120, color: '#c79bff' },
  { name: 'Coral Dunes', x: 120, z: -120, color: '#ffd27a' },
  { name: 'Airport Mesa', x: -40, z: -120, color: '#9ecfff' },
  { name: 'Saltworks', x: 0, z: 160, color: '#e8e4d8' },
];

export const LANDMARKS = {
  garage: { x: -120, z: -140, name: "Milo's Garage" },
  marina: { x: -40, z: -150, name: 'Ember Marina' },
  pier: { x: 0, z: -185, name: 'North Pier' },
  lighthouse: { x: -150, z: -195, name: 'Point Ember Lighthouse' },
  casino: { x: 80, z: -40, name: 'The Flamingo Casino' },
  chopShop: { x: 120, z: 120, name: 'Chop Shop' },
  safehouse: { x: -40, z: 40, name: 'Cleo’s Safehouse' },
  cannery: { x: -120, z: -80, name: 'Old Cannery' },
  docks: { x: 140, z: -80, name: 'Container Docks' },
  rooftop: { x: 40, z: 0, name: 'Copperton Rooftops' },
  store: { x: 0, z: 0, name: 'Corner Store' },
  hospital: { x: -80, z: 80, name: 'Coast Clinic' },
  station: { x: 80, z: 80, name: 'Coast Police Station' },
};

// One step: {kind, x, z, text, radius, kills?, seconds?}
// kinds: talk, driveTo, goTo, steal, deliver, combat, survive, escape, boat
export const JOBS = [
  {
    id: 1, title: 'First Light', pay: 400, respect: 10,
    brief: 'Meet Milo at the garage, learn the ropes, drive the sedan down to the marina.',
    steps: [
      { kind: 'talk', x: -120, z: -140, text: 'Meet Milo at the garage' },
      { kind: 'driveTo', x: -40, z: -150, text: 'Drive the sedan to Ember Marina' },
    ],
  },
  {
    id: 2, title: 'Hotwire', pay: 700, respect: 12,
    brief: 'Steal a parked car on Palm Court, lose the 1-star tail, deliver it to the chop shop.',
    steps: [
      { kind: 'steal', x: -40, z: 20, text: 'Steal a parked car on Palm Court' },
      { kind: 'deliver', x: 120, z: 120, text: 'Deliver it to the chop shop — lose the tail first' },
    ],
  },
  {
    id: 3, title: 'The Drop', pay: 900, respect: 14,
    brief: 'Pick up the package under the pier, then run the foot chase through Palm Court and escape by car.',
    steps: [
      { kind: 'goTo', x: 0, z: -185, text: 'Pick up the package under the pier' },
      { kind: 'goTo', x: -40, z: 40, text: 'Foot chase — reach Palm Court on foot' },
      { kind: 'escape', x: -120, z: -140, text: 'Escape by car — reach the garage with no wanted stars' },
    ],
  },
  {
    id: 4, title: 'Clean Plates', pay: 1100, respect: 16,
    brief: 'Swap plates at the garage while police patrol. Stay out of sight — 2-star risk.',
    steps: [
      { kind: 'goTo', x: -120, z: -140, text: 'Sneak to the garage on foot — avoid police line of sight' },
      { kind: 'survive', seconds: 20, x: -120, z: -140, text: 'Swap the plates — hold out 20 seconds' },
    ],
  },
  {
    id: 5, title: 'Flamingo Run', pay: 1500, respect: 20,
    brief: 'Drive the getaway car down the Flamingo Mile in a 3-star chase. Dodge the roadblocks.',
    steps: [
      { kind: 'driveTo', x: 80, z: -40, text: 'Reach the Flamingo Casino in the getaway car' },
      { kind: 'driveTo', x: 40, z: 120, text: 'Break through to Copperton — roadblocks ahead' },
    ],
  },
  {
    id: 6, title: 'The Witness', pay: 2000, respect: 25,
    brief: 'Rooftop job in Copperton: protect the witness from the rival crew. Melee and ranged combat.',
    steps: [
      { kind: 'goTo', x: 40, z: 0, text: 'Reach the Copperton rooftops' },
      { kind: 'combat', x: 40, z: 0, kills: 4, text: 'Protect the witness — take out 4 rivals' },
    ],
  },
  {
    id: 7, title: 'Air Support', pay: 2600, respect: 30, respectNeed: 30,
    brief: 'A 4-star chase with a police helicopter overhead. Lose it in the cannery tunnels.',
    steps: [
      { kind: 'driveTo', x: -120, z: -80, text: 'Lose the helicopter — reach the cannery tunnels' },
      { kind: 'escape', x: -120, z: -80, text: 'Stay hidden until the heat dies down' },
    ],
  },
  {
    id: 8, title: 'Double Cross', pay: 3200, respect: 35, respectNeed: 60,
    brief: 'Ambush at the container docks. Fight through the crew, then escape with the score.',
    steps: [
      { kind: 'combat', x: 140, z: -80, kills: 5, text: 'Ambush at the docks — take out 5 rivals' },
      { kind: 'driveTo', x: -40, z: 40, text: 'Escape with the score — reach the safehouse' },
    ],
  },
  {
    id: 9, title: 'The Last Tide', pay: 8000, respect: 50, respectNeed: 90,
    brief: 'The finale: 5-star casino vault heist, helicopter and roadblocks, boat escape past the lighthouse.',
    steps: [
      { kind: 'goTo', x: 80, z: -40, text: 'Hit the Flamingo Casino vault' },
      { kind: 'combat', x: 80, z: -40, kills: 4, text: 'Hold the vault room — take out 4 guards' },
      { kind: 'boat', x: -150, z: -195, text: 'Boat escape — reach the lighthouse point' },
    ],
  },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', key: '1', damage: 25, range: 2.4, rate: 0.45, ammo: Infinity, auto: false },
  { id: 'bat', name: 'Bat', key: '2', damage: 40, range: 2.8, rate: 0.6, ammo: Infinity, auto: false },
  { id: 'pistol', name: 'Pistol', key: '3', damage: 34, range: 60, rate: 0.28, ammo: 24, auto: false },
  { id: 'smg', name: 'SMG', key: '4', damage: 18, range: 45, rate: 0.09, ammo: 90, auto: true },
];

export const CAR_MODELS = [
  { name: 'Sunset Sedan', top: 34, accel: 16, grip: 2.6, color: 0xd94f30 },
  { name: 'Pier Cruiser', top: 30, accel: 13, grip: 2.2, color: 0x2f7ad9 },
  { name: 'Copper Coupe', top: 40, accel: 19, grip: 3.0, color: 0xe8a13a },
  { name: 'Yard Pickup', top: 28, accel: 12, grip: 2.0, color: 0x5a7d4f },
  { name: 'Flamingo Sport', top: 46, accel: 22, grip: 3.4, color: 0xe83a8c },
];

export const UPGRADES = [
  { id: 'engine', name: 'Engine tune', cost: 600, desc: '+15% top speed' },
  { id: 'brakes', name: 'Sport brakes', cost: 350, desc: 'Shorter stopping, better grip' },
  { id: 'nitro', name: 'Nitro kit', cost: 900, desc: 'Shift for a nitro boost' },
  { id: 'paint', name: 'Repaint', cost: 200, desc: 'Fresh ember paint' },
  { id: 'repair', name: 'Full repair', cost: 250, desc: 'Fix all damage' },
];

export const SHOP_ITEMS = [
  { id: 'health', name: 'Med kit', cost: 80, desc: '+50 health' },
  { id: 'pistolAmmo', name: 'Pistol ammo', cost: 60, desc: '+24 pistol rounds' },
  { id: 'smgAmmo', name: 'SMG ammo', cost: 120, desc: '+90 SMG rounds' },
  { id: 'bat', name: 'Baseball bat', cost: 150, desc: 'Unlock the bat' },
  { id: 'smg', name: 'SMG', cost: 800, desc: 'Unlock the SMG' },
];

export const RADIO_STATIONS = ['Coast Pop 98.2', 'Latin Groove 101.5', 'Harbor Talk 88.4'];
export const TAXI_FARE = 120;
export const COIN_COUNT = 25;
export const MAX_WANTED = 5;
