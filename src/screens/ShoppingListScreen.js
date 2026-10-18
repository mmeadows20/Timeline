import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getEvents } from '../services/eventService';
import { copyTextToClipboard } from '../services/shareService';
import { useTheme } from '../themeContext';
import {
  REMAKE_PERK_CREDITS,
  SHOPS,
  buildLines,
  displayName,
  formatPence,
  lineCost,
  listText,
  loadRemakeState,
  paidFor,
  poundsToPence,
  recipeFromItems,
  saveRemakeState,
  shopSearchUrl,
  visibleRecipes,
} from '../services/remakeList';

export default function ShoppingListScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => screenStyles(colors), [colors]);
  const [events, setEvents] = useState([]);
  const [state, setState] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPaid, setDraftPaid] = useState('');
  const [draftItems, setDraftItems] = useState('');
  const [swapFor, setSwapFor] = useState(null);
  const [swapDraft, setSwapDraft] = useState('');
  const [group, setGroup] = useState('meal');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [saved, list] = await Promise.all([
          loadRemakeState(),
          getEvents().catch(() => []),
        ]);
        if (cancelled) return;
        setState(saved);
        setEvents(Array.isArray(list) ? list : []);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const persist = (next) => {
    setState(next);
    saveRemakeState(next).catch(() => {});
  };

  const recipes = useMemo(() => (state ? visibleRecipes(events, state) : []), [events, state]);
  const lines = useMemo(() => (state ? buildLines(recipes, state) : []), [recipes, state]);
  const shop = state?.shop && SHOPS.some((s) => s.id === state.shop) ? state.shop : 'tesco';
  const shopLabel = SHOPS.find((s) => s.id === shop)?.label || 'Shop';

  const totals = useMemo(() => {
    if (!state) return { box: 0, shopPence: 0, saved: 0, missingBox: false, meals: 0 };
    const chosen = recipes.filter((r) => !state.selected || state.selected.includes(r.id));
    const box = chosen.reduce((sum, r) => sum + paidFor(r, state), 0);
    const shopPence = lines.reduce((sum, line) => sum + lineCost(line), 0);
    return {
      box,
      shopPence,
      saved: box - shopPence,
      missingBox: chosen.some((r) => !paidFor(r, state)),
      meals: chosen.length,
    };
  }, [recipes, lines, state]);

  if (!state) {
    return (
      <View style={styles.container}>
        <Text style={styles.intro}>Loading shopping list…</Text>
      </View>
    );
  }

  const selectedOn = (id) => !state.selected || state.selected.includes(id);

  function toggleMeal(id) {
    const current = recipes.filter((r) => selectedOn(r.id)).map((r) => r.id);
    const nextIds = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    persist({ ...state, selected: nextIds });
  }

  function patch(partial) {
    persist({ ...state, ...partial });
  }

  function setPaid(id, raw) {
    persist({ ...state, paid: { ...state.paid, [id]: poundsToPence(raw) } });
  }

  function setPrice(line, raw) {
    persist({ ...state, prices: { ...state.prices, [line.id]: poundsToPence(raw) } });
  }

  function setGot(line) {
    persist({ ...state, got: { ...state.got, [line.id]: !line.got } });
  }

  function setDropped(line) {
    persist({
      ...state,
      dropped: { ...state.dropped, [line.id]: !line.dropped },
      got: { ...state.got, [line.id]: false },
    });
  }

  function applySwap(line) {
    persist({ ...state, swaps: { ...state.swaps, [line.id]: swapDraft.trim() }, dropped: { ...state.dropped, [line.id]: false } });
    setSwapFor(null);
    setSwapDraft('');
  }

  function removeRecipe(recipe) {
    const hidden = [...(state.hidden || []), recipe.id];
    const extras = (state.extras || []).filter((r) => r.id !== recipe.id);
    const selected = state.selected ? state.selected.filter((id) => id !== recipe.id) : null;
    persist({ ...state, hidden, extras, selected });
  }

  function addCard() {
    const name = draftName.trim();
    const items = draftItems.trim();
    if (!name || !items) {
      Alert.alert('Add a meal', 'Add a meal name and at least one ingredient.');
      return;
    }
    const id = `card-${Date.now()}`;
    const card = recipeFromItems(name, items, id, 'Your card');
    const paid = { ...state.paid, [id]: poundsToPence(draftPaid) };
    const current = recipes.filter((r) => selectedOn(r.id)).map((r) => r.id);
    persist({
      ...state,
      extras: [card, ...(state.extras || [])],
      paid,
      selected: [...current, id],
    });
    setDraftName('');
    setDraftPaid('');
    setDraftItems('');
    setAdding(false);
  }

  async function copyList() {
    const text = listText(recipes, lines, shop, state);
    const ok = await copyTextToClipboard(text);
    const message = ok
      ? 'List copied. Paste it into a note or Timeline Bot. Do not paste a card number.'
      : 'Could not copy from this device.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(message);
    else Alert.alert(ok ? 'Copied' : 'Copy', message);
  }

  function openNext() {
    const next = lines.find((line) => !line.got && !line.dropped);
    const query = next ? `${shop === 'uber' ? `${shopLabel} ` : ''}${displayName(next)}` : shopLabel;
    Linking.openURL(shopSearchUrl(shop, query)).catch(() => {
      Alert.alert('Could not open the shop', 'Copy the list and open the shop yourself.');
    });
  }

  const basket = [];
  const seen = new Map();
  lines.forEach((line) => {
    const key = displayName(line).toLowerCase();
    if (!seen.has(key)) {
      const groupLines = [];
      seen.set(key, groupLines);
      basket.push(groupLines);
    }
    seen.get(key).push(line);
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Shopping list</Text>
      <Text style={styles.intro}>
        Remake a past meal without the box. Every line stays on its own meal, so a swap in the aisle still belongs to that plate.
      </Text>

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Box versus the shop</Text>
        <Text style={styles.summaryValue}>
          {totals.missingBox
            ? 'Add the box price'
            : totals.saved > 0
              ? `${formatPence(totals.saved)} less than the box`
              : 'Shop guide is not under the box'}
        </Text>
        <Text style={styles.intro}>
          {totals.meals} meal{totals.meals === 1 ? '' : 's'} · box {formatPence(totals.box)} · shop guide {formatPence(totals.shopPence)}
        </Text>
        <Text style={styles.intro}>
          {totals.saved > 0
            ? `Meal extras are ${REMAKE_PERK_CREDITS} credits once that perk is on. You are ahead if those ${REMAKE_PERK_CREDITS} credits cost less than ${formatPence(totals.saved)}. `
            : 'Type what you paid for each box to compare it with the shop guide. '}
          Guide prices are typical supermarket figures, not a live till.
        </Text>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.section}>Meals</Text>
        <TouchableOpacity style={styles.smallBtn} onPress={() => setAdding((v) => !v)}>
          <Text style={styles.smallBtnText}>{adding ? 'Close' : 'Add a card'}</Text>
        </TouchableOpacity>
      </View>

      {adding ? (
        <View style={styles.card}>
          <Text style={styles.label}>Meal name</Text>
          <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} placeholder="Lemon chicken tray" placeholderTextColor={colors.faint} />
          <Text style={styles.label}>What you paid for the box (£)</Text>
          <TextInput style={styles.input} value={draftPaid} onChangeText={setDraftPaid} placeholder="13.99" placeholderTextColor={colors.faint} keyboardType="decimal-pad" />
          <Text style={styles.label}>Ingredients, commas or new lines</Text>
          <TextInput style={[styles.input, styles.items]} value={draftItems} onChangeText={setDraftItems} placeholder="Chicken breast, lemon, rice" placeholderTextColor={colors.faint} multiline />
          <TouchableOpacity style={styles.primary} onPress={addCard}>
            <Text style={styles.primaryText}>Add to the list</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {recipes.map((recipe) => {
        const on = selectedOn(recipe.id);
        const paid = paidFor(recipe, state);
        return (
          <View key={recipe.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <TouchableOpacity style={[styles.toggle, on && styles.toggleOn]} onPress={() => toggleMeal(recipe.id)}>
                <Text style={[styles.toggleText, on && styles.toggleOnText]}>{on ? 'On' : 'Off'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealName}>{recipe.name}</Text>
                <Text style={styles.meta}>{recipe.kit}{recipe.example ? ' · example' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => removeRecipe(recipe)}>
                <Text style={styles.meta}>Remove</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Paid for the box (£)</Text>
            <TextInput
              style={styles.input}
              defaultValue={(paid / 100).toFixed(2)}
              key={`${recipe.id}-${paid}`}
              onEndEditing={(e) => setPaid(recipe.id, e.nativeEvent.text)}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.faint}
            />
          </View>
        );
      })}

      <View style={styles.rowBetween}>
        <Text style={styles.section}>This shop</Text>
        <View style={styles.row}>
          {[['meal', 'By meal'], ['basket', 'One basket']].map(([id, label]) => (
            <TouchableOpacity key={id} style={[styles.chip, group === id && styles.chipOn]} onPress={() => setGroup(id)}>
              <Text style={[styles.chipText, group === id && styles.chipOnText]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <Text style={styles.intro}>Preferred shop. You still pay in their app or at the till.</Text>
      <View style={styles.row}>
        {SHOPS.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.chip, shop === item.id && styles.chipOn]} onPress={() => patch({ shop: item.id })}>
            <Text style={[styles.chipText, shop === item.id && styles.chipOnText]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {lines.length === 0 ? <Text style={styles.intro}>Turn a meal on to build the list.</Text> : null}

      {group === 'meal'
        ? recipes.filter((r) => selectedOn(r.id)).map((recipe) => (
            <View key={recipe.id}>
              <Text style={styles.mealHead}>{recipe.name}</Text>
              {lines.filter((line) => line.mealId === recipe.id).map((line) => (
                <LineCard
                  key={line.id}
                  line={line}
                  styles={styles}
                  colors={colors}
                  swapOpen={swapFor === line.id}
                  swapDraft={swapDraft}
                  onSwapDraft={setSwapDraft}
                  onOpenSwap={() => {
                    setSwapFor(swapFor === line.id ? null : line.id);
                    setSwapDraft(line.swap || '');
                  }}
                  onUse={() => applySwap(line)}
                  onGot={() => setGot(line)}
                  onDrop={() => setDropped(line)}
                  onPrice={(raw) => setPrice(line, raw)}
                />
              ))}
            </View>
          ))
        : basket.map((groupLines) => (
            <View key={groupLines[0].id} style={styles.card}>
              <Text style={styles.mealName}>{displayName(groupLines[0])}</Text>
              <Text style={styles.meta}>{groupLines.map((line) => line.mealName).join(' · ')}</Text>
              <Text style={styles.meta}>{formatPence(groupLines.reduce((sum, line) => sum + lineCost(line), 0))} guide</Text>
            </View>
          ))}

      <TouchableOpacity style={styles.primary} onPress={openNext}>
        <Ionicons name="storefront-outline" size={18} color="#fff" />
        <Text style={styles.primaryText}>Open next item in {shopLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={copyList}>
        <Text style={styles.secondaryText}>Copy for a note or Timeline Bot</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondary}
        onPress={() => Linking.openURL(SHOPS.find((s) => s.id === shop)?.home || SHOPS[0].home)}
      >
        <Text style={styles.secondaryText}>Open {shopLabel} home</Text>
      </TouchableOpacity>
      <Text style={styles.intro}>
        Take the list into a supermarket if you would rather walk the aisles. Online, Timeline only opens the shop and copies the lines. It does not hold a card, and neither should a chat bot. You sign in there and you pay there.
      </Text>
    </ScrollView>
  );
}

function LineCard({
  line,
  styles,
  colors,
  swapOpen,
  swapDraft,
  onSwapDraft,
  onOpenSwap,
  onUse,
  onGot,
  onDrop,
  onPrice,
}) {
  return (
    <View style={[styles.card, line.dropped && { opacity: 0.6 }]}>
      <View style={styles.rowBetween}>
        <TouchableOpacity style={[styles.toggle, line.got && styles.toggleOn]} disabled={line.dropped} onPress={onGot}>
          <Text style={[styles.toggleText, line.got && styles.toggleOnText]}>{line.got ? 'In' : 'Add'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mealName, line.dropped && styles.struck]}>
            {displayName(line)}
            {line.swap.trim() ? <Text style={styles.meta}> · instead of {line.name}</Text> : null}
          </Text>
          <Text style={styles.meta}>
            {line.qty} · for {line.mealName}
            {line.guessed ? ' · price is a guess' : ''}
          </Text>
        </View>
      </View>
      <Text style={styles.label}>Guide £</Text>
      <TextInput
        style={[styles.input, { maxWidth: 140 }]}
        defaultValue={(line.guidePence / 100).toFixed(2)}
        key={`${line.id}-${line.guidePence}`}
        onEndEditing={(e) => onPrice(e.nativeEvent.text)}
        keyboardType="decimal-pad"
        placeholderTextColor={colors.faint}
      />
      <View style={styles.row}>
        <TouchableOpacity style={styles.chip} onPress={onOpenSwap}>
          <Text style={styles.chipText}>Swap</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.chip} onPress={onDrop}>
          <Text style={styles.chipText}>{line.dropped ? 'Put back' : 'Skip this meal'}</Text>
        </TouchableOpacity>
      </View>
      {swapOpen ? (
        <View style={styles.rowBetween}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={swapDraft}
            onChangeText={onSwapDraft}
            placeholder="Yoghurt instead of soured cream"
            placeholderTextColor={colors.faint}
          />
          <TouchableOpacity style={styles.smallBtn} onPress={onUse}>
            <Text style={styles.smallBtnText}>Use</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function screenStyles(c) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 48 },
    heading: { color: c.text, fontSize: 26, fontWeight: '800', marginBottom: 6 },
    intro: { color: c.faint, fontSize: 13, lineHeight: 18, marginTop: 6 },
    section: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: 18 },
    summary: {
      marginTop: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      padding: 14,
    },
    summaryLabel: { color: c.text, fontWeight: '700' },
    summaryValue: { color: c.blue, fontSize: 22, fontWeight: '800', marginTop: 6 },
    card: {
      marginTop: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      padding: 12,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    mealName: { color: c.text, fontWeight: '700', fontSize: 16 },
    mealHead: { color: c.text, fontWeight: '700', marginTop: 16 },
    meta: { color: c.faint, fontSize: 12, marginTop: 2 },
    struck: { textDecorationLine: 'line-through' },
    label: { color: c.faint, fontSize: 12, marginTop: 8, marginBottom: 4 },
    input: {
      backgroundColor: c.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    items: { minHeight: 80, textAlignVertical: 'top' },
    toggle: {
      minWidth: 52,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
    },
    toggleOn: { backgroundColor: c.blue, borderColor: c.blue },
    toggleText: { color: c.faint, fontWeight: '700' },
    toggleOnText: { color: '#fff' },
    chip: {
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
    },
    chipOn: { backgroundColor: c.blue, borderColor: c.blue },
    chipText: { color: c.faint, fontWeight: '600' },
    chipOnText: { color: '#fff' },
    smallBtn: {
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    smallBtnText: { color: c.text, fontWeight: '700' },
    primary: {
      marginTop: 16,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: c.blue,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    secondary: {
      marginTop: 8,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { color: c.text, fontWeight: '700' },
  });
}
