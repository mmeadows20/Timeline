const HELLOFRESH_RECIPE = /^https?:\/\/(?:[a-z0-9-]+\.)?hellofresh\.[a-z.]+\/recipes\/[^/?#]+/i;

export function isHelloFreshRecipeUrl(value) {
  return HELLOFRESH_RECIPE.test(String(value || '').trim());
}

function minutesFromIso(value) {
  const text = String(value || '');
  const hours = text.match(/([\d.]+)H/);
  const mins = text.match(/([\d.]+)M/);
  const total = (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
  return total ? String(Math.round(total)) : '';
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value['@graph'])) return value['@graph'];
  return value ? [value] : [];
}

/** Read the public recipe card on a HelloFresh page. The method is not kept. */
export function parseHelloFreshHtml(html) {
  const blocks = String(html || '').match(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    for (const obj of asList(data)) {
      if (!obj || typeof obj !== 'object') continue;
      const kind = obj['@type'];
      const isRecipe = kind === 'Recipe' || (Array.isArray(kind) && kind.includes('Recipe'));
      if (!isRecipe) continue;
      const ingredients = (Array.isArray(obj.recipeIngredient) ? obj.recipeIngredient : [])
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return {
        name: String(obj.name || '').trim(),
        minutes: minutesFromIso(obj.totalTime || obj.cookTime || obj.prepTime),
        tags: [obj.recipeCuisine, obj.recipeCategory].filter(Boolean).join(', '),
        ingredients,
      };
    }
  }
  return null;
}

export async function readHelloFreshLink(url) {
  const clean = String(url || '').trim();
  if (!isHelloFreshRecipeUrl(clean)) {
    throw new Error('Paste a HelloFresh recipe link. It looks like hellofresh.co.uk/recipes/…');
  }
  let response;
  try {
    response = await fetch(clean, { headers: { Accept: 'text/html' } });
  } catch {
    throw new Error('This browser blocked HelloFresh. Open Shopping list in Expo Go on your phone and try the same link.');
  }
  if (!response.ok) {
    throw new Error('HelloFresh did not return that page.');
  }
  const recipe = parseHelloFreshHtml(await response.text());
  if (!recipe || !recipe.ingredients.length) {
    throw new Error('That page has no ingredient list. Open one recipe, not the menu.');
  }
  return { ...recipe, url: clean };
}
