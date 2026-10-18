import AsyncStorage from '@react-native-async-storage/async-storage';

export const REMAKE_PERK_CREDITS = 4;
const STORE = '@timeline_remake_v1';

const BOOK = [
  { keys: ['chicken breast', 'chicken'], pence: 450, qty: '2 breasts' },
  { keys: ['lemon'], pence: 35, qty: '1' },
  { keys: ['creme fraiche', 'crème fraîche'], pence: 110, qty: '200ml' },
  { keys: ['garlic'], pence: 40, qty: '1 bulb' },
  { keys: ['rice'], pence: 45, qty: '150g' },
  { keys: ['parsley'], pence: 70, qty: '1 bunch' },
  { keys: ['stock'], pence: 30, qty: '1 cube' },
  { keys: ['beef mince', 'mince'], pence: 280, qty: '300g' },
  { keys: ['mushroom'], pence: 120, qty: '200g' },
  { keys: ['onion'], pence: 30, qty: '1' },
  { keys: ['soured cream', 'sour cream'], pence: 90, qty: '150ml' },
  { keys: ['paprika'], pence: 40, qty: '1 spoon' },
  { keys: ['pasta'], pence: 55, qty: '150g' },
  { keys: ['halloumi'], pence: 250, qty: '225g' },
  { keys: ['couscous'], pence: 60, qty: '100g' },
  { keys: ['tomato'], pence: 80, qty: '2' },
  { keys: ['cucumber'], pence: 55, qty: '1' },
  { keys: ['mint'], pence: 70, qty: '1 bunch' },
  { keys: ['honey'], pence: 40, qty: '1 spoon' },
  { keys: ['yoghurt', 'yogurt'], pence: 80, qty: '150g' },
  { keys: ['salmon'], pence: 450, qty: '2 fillets' },
  { keys: ['broccoli'], pence: 90, qty: '1 head' },
  { keys: ['potato'], pence: 70, qty: '400g' },
  { keys: ['cheddar'], pence: 150, qty: '100g' },
  { keys: ['milk'], pence: 125, qty: '1 pint' },
  { keys: ['egg'], pence: 180, qty: '6' },
];

export const SHOPS = [
  { id: 'tesco', label: 'Tesco Express', home: 'https://www.tesco.com/groceries/en-GB/' },
  { id: 'coop', label: 'Co-op', home: 'https://shop.coop.co.uk/' },
  { id: 'uber', label: 'Uber Eats', home: 'https://www.ubereats.com/gb' },
];

function ing(name, qty, guidePence) {
  return { id: `i-${name}`, name, qty, guidePence, guessed: false };
}

export function exampleRecipes() {
  return [
    {
      id: 'ex-lemon-chicken',
      name: 'Lemon chicken tray',
      kit: 'Example card',
      isBox: true,
      paidPence: 1399,
      example: true,
      ingredients: [
        ing('Chicken breast', '2 breasts', 450),
        ing('Lemon', '1', 35),
        ing('Crème fraîche', '200ml', 110),
        ing('Garlic', '1 bulb', 40),
        ing('Rice', '150g', 45),
        ing('Parsley', '1 bunch', 70),
        ing('Chicken stock', '1 cube', 30),
      ],
    },
    {
      id: 'ex-beef-pasta',
      name: 'Beef mushroom pasta',
      kit: 'Example card',
      isBox: true,
      paidPence: 1449,
      example: true,
      ingredients: [
        ing('Beef mince', '300g', 280),
        ing('Mushrooms', '200g', 120),
        ing('Onion', '1', 30),
        ing('Soured cream', '150ml', 90),
        ing('Paprika', '1 spoon', 40),
        ing('Pasta', '150g', 55),
        ing('Beef stock', '1 cube', 30),
      ],
    },
    {
      id: 'ex-halloumi',
      name: 'Halloumi couscous',
      kit: 'Example card',
      isBox: true,
      paidPence: 1199,
      example: true,
      ingredients: [
        ing('Halloumi', '225g', 250),
        ing('Couscous', '100g', 60),
        ing('Tomatoes', '2', 80),
        ing('Cucumber', '1', 55),
        ing('Mint', '1 bunch', 70),
        ing('Lemon', '1', 35),
        ing('Honey', '1 spoon', 40),
      ],
    },
  ];
}

export function guessGuide(name) {
  const n = String(name || '').toLowerCase();
  const hit = BOOK.find((row) => row.keys.some((k) => n.includes(k)));
  if (!hit) return { qty: '1', guidePence: 100, guessed: true };
  return { qty: hit.qty, guidePence: hit.pence, guessed: false };
}

export function formatPence(pence) {
  const sign = pence < 0 ? '−' : '';
  const n = Math.abs(Math.round(pence || 0));
  return `${sign}£${(n / 100).toFixed(2)}`;
}

export function poundsToPence(raw) {
  const n = Number(String(raw || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function recipeFromItems(name, items, id, kit, isBox) {
  const parts = String(items || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const names = parts.length ? parts : [name || 'Ingredient'];
  return {
    id,
    name: name || 'Saved meal',
    kit: kit || 'Your card',
    isBox: !!isBox,
    paidPence: 0,
    ingredients: names.map((part, i) => {
      const g = guessGuide(part);
      return { id: `${id}-${i}`, name: part, qty: g.qty, guidePence: g.guidePence, guessed: g.guessed };
    }),
  };
}

export function recipesFromEvents(events) {
  return (events || [])
    .filter((event) => String(event?.source || '') === 'food')
    .filter((event) => event.foodItems || event.recipeName || event.description)
    .map((event) => {
      const name = event.recipeName || event.title || 'Saved meal';
      const items = event.foodItems || event.description || name;
      const kit = event.mealKit ? 'Meal-kit card' : 'Saved meal';
      const card = recipeFromItems(name, items, `food-${event.id}`, kit, !!event.mealKit);
      return card;
    });
}

export async function loadRemakeState() {
  try {
    const raw = await AsyncStorage.getItem(STORE);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed };
  } catch {
    return emptyState();
  }
}

export async function saveRemakeState(state) {
  await AsyncStorage.setItem(STORE, JSON.stringify(state));
}

function emptyState() {
  return {
    hidden: [],
    extras: [],
    selected: null,
    shop: 'tesco',
    paid: {},
    prices: {},
    swaps: {},
    got: {},
    dropped: {},
  };
}

export function visibleRecipes(events, state) {
  const hidden = new Set(state.hidden || []);
  const fromEvents = recipesFromEvents(events).filter((r) => !hidden.has(r.id));
  const extras = (state.extras || []).filter((r) => r && r.id && !hidden.has(r.id));
  const examples = fromEvents.length || extras.length ? [] : exampleRecipes().filter((r) => !hidden.has(r.id));
  return [...fromEvents, ...extras, ...examples];
}

export function lineId(recipeId, ingredientId) {
  return `${recipeId}::${ingredientId}`;
}

export function buildLines(recipes, state) {
  const selected = state.selected;
  const lines = [];
  recipes.forEach((recipe) => {
    const on = !selected || selected.includes(recipe.id);
    if (!on) return;
    recipe.ingredients.forEach((item) => {
      const id = lineId(recipe.id, item.id);
      lines.push({
        id,
        mealId: recipe.id,
        mealName: recipe.name,
        ingredientId: item.id,
        name: item.name,
        qty: item.qty,
        guidePence: state.prices && state.prices[id] != null ? state.prices[id] : item.guidePence,
        guessed: !(state.prices && state.prices[id] != null) && !!item.guessed,
        swap: (state.swaps && state.swaps[id]) || '',
        got: !!(state.got && state.got[id]),
        dropped: !!(state.dropped && state.dropped[id]),
      });
    });
  });
  return lines;
}

export function paidFor(recipe, state) {
  if (state.paid && state.paid[recipe.id] != null) return state.paid[recipe.id];
  return recipe.paidPence || 0;
}

export function displayName(line) {
  return (line.swap || '').trim() || line.name;
}

export function lineCost(line) {
  if (line.dropped) return 0;
  return line.guidePence || 0;
}

export function shopSearchUrl(shop, query) {
  const q = encodeURIComponent(query);
  if (shop === 'tesco') return `https://www.tesco.com/groceries/en-GB/search?query=${q}`;
  if (shop === 'coop') return `https://shop.coop.co.uk/search?query=${q}`;
  return `https://www.ubereats.com/gb/search?q=${q}`;
}

export function listText(recipes, lines, shop, state) {
  const shopLabel = (SHOPS.find((s) => s.id === shop) || SHOPS[0]).label;
  const chunks = [
    'Timeline shopping list',
    `Preferred shop: ${shopLabel}`,
    'Each line belongs to one meal. Swap or skip that meal’s line if the shelf is empty.',
    'Do not add a payment card here. Open the shop and pay there.',
    '',
  ];
  recipes.forEach((meal) => {
    const mealLines = lines.filter((line) => line.mealId === meal.id);
    if (!mealLines.length) return;
    const paid = meal.isBox ? paidFor(meal, state) : 0;
    const box = meal.isBox && paid > 0 ? ` (box ${formatPence(paid)})` : '';
    chunks.push(`${meal.name}${box}`);
    mealLines.forEach((line) => {
      const mark = line.dropped ? 'skip' : line.got ? 'got' : ' ';
      const what = displayName(line);
      const swapNote = line.swap.trim() ? ` (instead of ${line.name})` : '';
      chunks.push(`[${mark}] ${what} — ${line.qty} — guide ${formatPence(line.guidePence)}${swapNote} — for ${meal.name}`);
    });
    chunks.push('');
  });
  return chunks.join('\n').trim();
}
