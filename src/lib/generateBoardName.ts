const ADJECTIVES = [
  'Bold', 'Bright', 'Calm', 'Clever', 'Cool', 'Cosmic', 'Cozy',
  'Crisp', 'Crystal', 'Daring', 'Deep', 'Eager', 'Electric',
  'Emerald', 'Epic', 'Fierce', 'Fresh', 'Gentle', 'Golden',
  'Grand', 'Happy', 'Icy', 'Keen', 'Kind', 'Light', 'Lively',
  'Lucky', 'Lunar', 'Magic', 'Mighty', 'Misty', 'Noble', 'Neon',
  'Nimble', 'Odd', 'Pale', 'Plucky', 'Polite', 'Quick', 'Quiet',
  'Rapid', 'Rosy', 'Royal', 'Rusty', 'Sandy', 'Sharp', 'Silent',
  'Silver', 'Sleek', 'Solar', 'Spicy', 'Steady', 'Stormy',
  'Sunny', 'Swift', 'Tidy', 'Tiny', 'Vivid', 'Warm', 'Wild',
  'Wise', 'Witty', 'Zen',
];

const NOUNS = [
  'Anchor', 'Arrow', 'Atlas', 'Beacon', 'Birch', 'Bloom',
  'Breeze', 'Brook', 'Canvas', 'Cedar', 'Cliff', 'Cloud',
  'Comet', 'Coral', 'Crane', 'Creek', 'Crest', 'Dawn', 'Drift',
  'Dune', 'Echo', 'Ember', 'Falcon', 'Fern', 'Flame', 'Flash',
  'Flint', 'Forge', 'Fox', 'Frost', 'Glade', 'Grove', 'Harbor',
  'Hawk', 'Haze', 'Heron', 'Ivy', 'Jade', 'Lake', 'Lark',
  'Leaf', 'Maple', 'Marsh', 'Meadow', 'Moon', 'Moss', 'Oak',
  'Orbit', 'Otter', 'Owl', 'Path', 'Peak', 'Pearl', 'Pebble',
  'Pine', 'Pond', 'Quill', 'Rain', 'Reef', 'Ridge', 'River',
  'Robin', 'Sage', 'Sky', 'Spark', 'Star', 'Stone', 'Storm',
  'Tide', 'Trail', 'Vale', 'Wave', 'Willow', 'Wolf', 'Wren',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateBoardName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}
