import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions, Alert, Animated, Easing } from 'react-native';

export const BUBBLE_SIZE = 78;
const VERT_GAP = 62;
const LABEL_COL = 86;
const OFFSETS = [36, 84, 52, 108, 64, 44, 96];
const MAX_REACH = LABEL_COL / 2 + 18 + Math.max(...OFFSETS) + BUBBLE_SIZE + 20;
export const SPINE_CANVAS_WIDTH = Math.ceil(MAX_REACH * 2);

/** Opens centred. Sideways drag stays available if a row is still wider than the phone. */
export function SpineStage({ children, canvasWidth }) {
  const { width: screenW } = useWindowDimensions();
  const canvas = Math.max(screenW, canvasWidth || 0);

  const scroller = useRef(null);
  const centered = useRef(false);
  const viewW = useRef(0);
  const contentW = useRef(0);

  const tryCenter = () => {
    if (centered.current || !contentW.current || !viewW.current) return;
    const x = Math.max(0, (contentW.current - viewW.current) / 2);
    centered.current = true;
    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ x, y: 0, animated: false });
    });
  };

  useEffect(() => {
    centered.current = false;
    tryCenter();
  }, [canvas]);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => {
        viewW.current = e.nativeEvent.layout.width;
        tryCenter();
      }}
      onContentSizeChange={(w) => {
        contentW.current = w;
        tryCenter();
      }}
      style={styles.stage}
    >
      <View style={[styles.stageCanvas, { width: canvas }]}>{children}</View>
    </ScrollView>
  );
}

function quadPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.abs(Math.trunc(seed));
  const s = String(seed || '');
  let n = 0;
  for (let i = 0; i < s.length; i += 1) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
}

function CurvedDashedSpoke({ side, distance, bubbleCenterY, spineY }) {
  const start = { x: 0, y: spineY };
  const endX = side === 'right' ? distance : -distance;
  const end = { x: endX, y: bubbleCenterY };
  const midX = endX * 0.45;
  const bow = side === 'right' ? Math.min(36, Math.abs(endX) * 0.28) : -Math.min(36, Math.abs(endX) * 0.28);
  const control = {
    x: midX + bow,
    y: spineY + (bubbleCenterY - spineY) * 0.35,
  };

  const steps = Math.max(8, Math.round(Math.abs(endX) / 7));
  const dots = [];
  for (let i = 1; i < steps; i += 1) {
    if (i % 2 === 0) continue;
    const t = i / steps;
    dots.push(quadPoint(start, control, end, t));
  }

  const minX = Math.min(0, endX, control.x) - 4;
  const maxX = Math.max(0, endX, control.x) + 4;
  const minY = Math.min(spineY, bubbleCenterY, control.y) - 4;
  const maxY = Math.max(spineY, bubbleCenterY, control.y) + 4;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        marginLeft: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
        zIndex: 1,
      }}
    >
      {dots.map((p, i) => (
        <View
          key={i}
          style={[
            styles.spokeDot,
            {
              position: 'absolute',
              left: p.x - minX - 1.5,
              top: p.y - minY - 1.5,
            },
          ]}
        />
      ))}
    </View>
  );
}

function KindBubble({ bubble, glow, onPress, style }) {
  const raw = bubble.count;
  const isDate = String(raw || '').includes('/');
  const n = typeof raw === 'number' ? raw : parseInt(String(raw || ''), 10);
  const countText = isDate
    ? String(raw)
    : Number.isFinite(n)
      ? n === 1
        ? '1 item'
        : `${n} items`
      : String(raw || '');
  return (
    <TouchableOpacity
      style={[
        styles.kindBubble,
        { backgroundColor: bubble.color, borderColor: bubble.color },
        glow && styles.kindBubbleGlow,
        style,
      ]}
      onPress={onPress}
      onLongPress={() => {
        const title = String(bubble.label || '').trim();
        if (title) Alert.alert(title, countText);
      }}
      delayLongPress={280}
      accessibilityLabel={`${bubble.label} ${countText}`}
      activeOpacity={0.85}
    >
      <Text style={styles.kindLabel} numberOfLines={isDate ? 2 : 1}>
        {bubble.label}
      </Text>
      <Text style={[styles.kindCount, styles.kindCountDate]} numberOfLines={1}>
        {countText}
      </Text>
    </TouchableOpacity>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function MonthLetterRow({ months, top, onOpenMonth }) {
  if (!Array.isArray(months) || months.length !== 12) return null;
  return (
    <View pointerEvents="box-none" style={[styles.monthRow, { top }]}>
      {months.map((mark) => {
        const on = (mark.count || 0) > 0;
        const name = MONTH_NAMES[mark.month] || mark.letter;
        if (!on) {
          return (
            <Text key={mark.month} style={styles.monthLetterOff}>
              {mark.letter}
            </Text>
          );
        }
        return (
          <TouchableOpacity
            key={mark.month}
            onPress={() => onOpenMonth && onOpenMonth(mark.month)}
            hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
            accessibilityLabel={`${name}, ${mark.count} ${mark.count === 1 ? 'event' : 'events'}`}
          >
            <Text style={styles.monthLetterOn}>{mark.letter}</Text>
            <View style={styles.monthDot} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MovingBubble({ node, progress, glow, onPress }) {
  const half = BUBBLE_SIZE / 2;
  const marginLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [node.from.x - half, node.to.x - half],
  });
  const top = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [node.from.y - half, node.to.y - half],
  });
  return (
    <Animated.View
      style={[styles.bubbleAbs, { left: '50%', marginLeft, top, opacity: node.split ? progress : 1, zIndex: 3 }]}
    >
      <KindBubble bubble={node.bubble} glow={glow} onPress={onPress} />
    </Animated.View>
  );
}

function MonthSpoke({ x1, y1, x2, y2, opacity }) {
  const start = { x: x1, y: y1 };
  const end = { x: x2, y: y2 };
  const control = { x: (x1 + x2) / 2, y: y1 + (y2 - y1) * 0.2 };
  const steps = 12;
  const dots = [];
  for (let i = 1; i < steps; i += 1) {
    if (i % 2 === 0) continue;
    dots.push(quadPoint(start, control, end, i / steps));
  }
  const minX = Math.min(x1, x2, control.x) - 4;
  const maxX = Math.max(x1, x2, control.x) + 4;
  const minY = Math.min(y1, y2, control.y) - 4;
  const maxY = Math.max(y1, y2, control.y) + 4;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        marginLeft: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
        opacity,
        zIndex: 1,
      }}
    >
      {dots.map((p, i) => (
        <View
          key={i}
          style={[styles.spokeDot, { position: 'absolute', left: p.x - minX - 1.5, top: p.y - minY - 1.5 }]}
        />
      ))}
    </Animated.View>
  );
}

function staggerOffset(seed, bubbleIndex) {
  const hash = (seedNumber(seed) + bubbleIndex * 3) % OFFSETS.length;
  return OFFSETS[hash];
}

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function collapsedLayout(list, blockIndex, seed, screenW, boxedLabel, sublabel) {
  const primaryLeft = blockIndex % 2 === 0;
  const n = list.length;
  const crowded = n >= 5;
  const vertGap = crowded ? BUBBLE_SIZE + 12 : VERT_GAP;
  const twoLine = boxedLabel && !!sublabel;
  const stackHeight =
    n === 0 ? (twoLine ? 112 : 96) : Math.max(twoLine ? 112 : 96, (n - 1) * vertGap + BUBBLE_SIZE + 28);
  const spineY = stackHeight / 2;
  const maxDistance = Math.max(LABEL_COL / 2 + 28 + BUBBLE_SIZE / 2, screenW / 2 - BUBBLE_SIZE / 2 - 10);
  const bubbles = list.map((b, i) => {
    let side = (i + (primaryLeft ? 0 : 1)) % 2 === 0 ? 'left' : 'right';
    if (n >= 5 && i === 2) side = primaryLeft ? 'right' : 'left';
    const rawOffset = staggerOffset(seed, i) * (crowded ? 0.5 : 0.8);
    const distance = Math.min(LABEL_COL / 2 + 18 + rawOffset + BUBBLE_SIZE / 2, maxDistance);
    const jitter = ((seedNumber(`${seed}:${i}`) % 5) - 2) * 4;
    const y = n === 1 ? spineY + jitter : spineY - ((n - 1) * vertGap) / 2 + i * vertGap + jitter;
    const x = side === 'right' ? distance : -distance;
    return { key: b.kind, bubble: b, x, y, side };
  });
  return {
    height: stackHeight,
    spineY,
    labelTop: twoLine ? spineY - 44 : boxedLabel ? spineY - 34 : spineY - 28,
    twoLine,
    bubbles,
  };
}

function monthTickX(month, half) {
  const inner = LABEL_COL / 2 + 28;
  const edge = 22;
  const span = Math.max(36, half - edge - inner);
  if (month <= 5) return -(inner + (span * (5 - month)) / 5);
  return inner + (span * (month - 6)) / 5;
}

function expandedLayout(monthBubbles, collapsed, width) {
  const half = width / 2;
  const ticks = Array.from({ length: 12 }, (_, month) => ({ month, x: monthTickX(month, half) }));
  const groups = {};
  (monthBubbles || []).forEach((b) => {
    if (b.month == null || b.month < 0) return;
    if (!groups[b.month]) groups[b.month] = [];
    groups[b.month].push(b);
  });
  const biggest = {};
  Object.values(groups).forEach((rows) => {
    rows.forEach((b) => {
      if (!biggest[b.kind] || b.count > biggest[b.kind].count) biggest[b.kind] = b;
    });
  });
  const bubbles = [];
  Object.keys(groups).forEach((key) => {
    const month = Number(key);
    groups[month].forEach((b, slot) => {
      const above = (month + slot) % 2 === 0;
      const y = collapsed.spineY + (above ? -1 : 1) * (92 + Math.floor(slot / 2) * (BUBBLE_SIZE + 14));
      const keep = biggest[b.kind] === b;
      bubbles.push({
        key: keep ? b.kind : `${b.kind}:${month}`,
        bubble: b,
        x: ticks[month].x,
        y,
        tickX: ticks[month].x,
        split: !keep,
      });
    });
  });
  const reach = bubbles.reduce((m, b) => Math.max(m, Math.abs(b.y - collapsed.spineY)), 0);
  const height = Math.max(collapsed.height, (reach + BUBBLE_SIZE / 2 + 24) * 2);
  const shift = height / 2 - collapsed.spineY;
  return {
    height,
    spineY: height / 2,
    labelTop: collapsed.labelTop + shift,
    ticks,
    bubbles: bubbles.map((b) => ({ ...b, y: b.y + shift })),
    shift,
  };
}

function startPos(node, other) {
  const exact = other.bubbles.find((b) => b.key === node.key);
  if (exact) return { x: exact.x, y: exact.y };
  const same = other.bubbles.find((b) => b.bubble.kind === node.bubble.kind);
  if (same) return { x: same.x, y: same.y };
  return { x: 0, y: other.spineY };
}

export default function SpineKindBlock({
  id,
  label,
  sublabel,
  current,
  muted,
  bubbles,
  blockIndex,
  glowKey,
  onOpenLabel,
  onOpenBubble,
  onOpenMonth,
  months,
  boxedLabel = false,
  expanded = false,
  monthBubbles,
  onLayout,
}) {
  const { width: screenW } = useWindowDimensions();
  const [blockW, setBlockW] = useState(0);
  const width = blockW > 40 ? blockW : Math.max(screenW, expanded ? 760 : screenW);
  const progress = useRef(new Animated.Value(1)).current;
  const firstPaint = useRef(true);
  const [settled, setSettled] = useState(true);

  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    setSettled(false);
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 560,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setSettled(true);
    });
    return () => anim.stop();
  }, [expanded, progress]);

  const list = bubbles || [];
  const primaryLeft = blockIndex % 2 === 0;
  const n = list.length;
  const crowded = n >= 5;
  const vertGap = crowded ? BUBBLE_SIZE + 12 : VERT_GAP;
  const twoLine = boxedLabel && !!sublabel;
  const showMonths = Array.isArray(months) && months.length === 12;
  const stackHeight =
    (n === 0 ? (twoLine ? 112 : 96) : Math.max(twoLine ? 112 : 96, (n - 1) * vertGap + BUBBLE_SIZE + 28)) +
    (showMonths ? 18 : 0);
  const spineY = stackHeight / 2;
  const seed = id ?? blockIndex;
  const maxDistance = Math.max(
    LABEL_COL / 2 + 28 + BUBBLE_SIZE / 2,
    screenW / 2 - BUBBLE_SIZE / 2 - 10
  );

  const placements = list.map((b, i) => {
    let side = (i + (primaryLeft ? 0 : 1)) % 2 === 0 ? 'left' : 'right';
    if (n >= 5 && i === 2) side = primaryLeft ? 'right' : 'left';
    const rawOffset = staggerOffset(seed, i) * (crowded ? 0.5 : 0.8);
    const distance = Math.min(LABEL_COL / 2 + 18 + rawOffset + BUBBLE_SIZE / 2, maxDistance);
    const jitter = ((seedNumber(`${seed}:${i}`) % 5) - 2) * 4;
    const bubbleCenterY =
      n === 1 ? spineY + jitter : spineY - ((n - 1) * vertGap) / 2 + i * vertGap + jitter;
    return { bubble: b, side, distance, bubbleCenterY };
  });

  const labelTop = twoLine ? spineY - 44 : boxedLabel ? spineY - 34 : spineY - 28;
  const moving = expanded || !settled;
  const seedKey = id ?? blockIndex;
  const folded = collapsedLayout(list, blockIndex, seedKey, width, boxedLabel, sublabel);
  const axisSource = monthBubbles && monthBubbles.length ? monthBubbles : list.filter((b) => b.month != null);
  const opened = expandedLayout(axisSource, folded, width);
  const toLayout = expanded ? opened : folded;
  const fromLayout = expanded ? folded : opened;
  const nodes = toLayout.bubbles.map((node) => ({
    ...node,
    from: startPos(node, fromLayout),
    to: { x: node.x, y: node.y },
  }));
  const axisOpacity = expanded
    ? progress
    : progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const blockHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [fromLayout.height + (showMonths ? 18 : 0), toLayout.height],
  });
  const labelTravel = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [fromLayout.labelTop, toLayout.labelTop],
  });

  if (moving) {
    return (
      <Animated.View
        onLayout={(e) => {
          setBlockW(e.nativeEvent.layout.width);
          if (onLayout) onLayout(e);
        }}
        style={[styles.block, { height: blockHeight, marginBottom: 28, zIndex: 4 }, muted && styles.blockMuted]}
      >
        <Animated.View pointerEvents="box-none" style={[styles.axisWrap, { opacity: axisOpacity }]}>
          <View
            style={[
              styles.axisLine,
              { top: opened.spineY, left: 10, width: Math.max(12, width / 2 - LABEL_COL / 2 - 18) },
            ]}
          />
          <View
            style={[
              styles.axisLine,
              {
                top: opened.spineY,
                left: width / 2 + LABEL_COL / 2 + 8,
                width: Math.max(12, width / 2 - LABEL_COL / 2 - 18),
              },
            ]}
          />
          {opened.ticks.map((tick) => {
            const mark = (months || []).find((m) => m.month === tick.month);
            const on = (mark?.count || 0) > 0;
            return (
              <TouchableOpacity
                key={tick.month}
                style={[styles.tickHit, { marginLeft: tick.x - 12, top: opened.spineY - 28 }]}
                onPress={() => onOpenMonth && onOpenMonth(tick.month)}
                accessibilityLabel={MONTH_NAMES[tick.month]}
              >
                <Text style={on ? styles.tickOn : styles.tickOff}>{MONTH_LETTERS[tick.month]}</Text>
                <View style={[styles.tickMark, on && styles.tickMarkOn]} />
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {nodes.map((node) => (
          <MonthSpoke
            key={`axis-spoke-${node.key}`}
            opacity={axisOpacity}
            x1={node.tickX != null ? node.tickX : node.to.x}
            y1={opened.spineY}
            x2={node.to.x}
            y2={node.to.y}
          />
        ))}

        <Animated.View style={[styles.labelCol, { top: labelTravel, zIndex: 6 }]}>
          <TouchableOpacity
            onPress={onOpenLabel}
            accessibilityLabel={`${expanded ? 'Fold' : 'Open'} ${label}`}
          >
            <View style={[boxedLabel && styles.labelChip, expanded && styles.labelChipOpen, boxedLabel && current && styles.labelChipCurrent]}>
              <View style={[styles.dot, current && styles.dotCurrent]} />
              <Text style={[styles.label, current && styles.labelCurrent]}>{label}</Text>
              {sublabel ? <Text style={[styles.sublabel, current && styles.labelCurrent]}>{sublabel}</Text> : null}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {nodes.map((node) => (
          <MovingBubble
            key={node.key}
            node={node}
            progress={progress}
            glow={glowKey === `${id}:${node.bubble.kind}`}
            onPress={() => onOpenBubble(node.bubble)}
          />
        ))}
      </Animated.View>
    );
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.block, { height: stackHeight, marginBottom: 40 }, muted && styles.blockMuted]}
    >
      {placements.map((p) => (
        <CurvedDashedSpoke
          key={`spoke-${p.bubble.kind}`}
          side={p.side}
          distance={p.distance}
          bubbleCenterY={p.bubbleCenterY}
          spineY={spineY}
        />
      ))}

      <TouchableOpacity
        style={[styles.labelCol, { top: labelTop }]}
        onPress={onOpenLabel}
        accessibilityLabel={`Open ${label}${sublabel ? ` ${sublabel}` : ''}`}
      >
        <View style={[boxedLabel && styles.labelChip, boxedLabel && current && styles.labelChipCurrent]}>
          <View style={[styles.dot, current && styles.dotCurrent]} />
          <Text style={[styles.label, current && styles.labelCurrent]}>{label}</Text>
          {sublabel ? (
            <Text style={[styles.sublabel, current && styles.labelCurrent]}>{sublabel}</Text>
          ) : null}
          {current ? <Text style={styles.nowMark}>★</Text> : null}
        </View>
      </TouchableOpacity>

      {showMonths ? (
        <MonthLetterRow months={months} top={labelTop + (twoLine ? 58 : 46)} onOpenMonth={onOpenMonth} />
      ) : null}

      {placements.map((p) => {
        const half = BUBBLE_SIZE / 2;
        const leftStyle =
          p.side === 'right'
            ? { left: '50%', marginLeft: p.distance - half }
            : { left: '50%', marginLeft: -(p.distance + half) };
        return (
          <KindBubble
            key={p.bubble.kind}
            bubble={p.bubble}
            glow={glowKey === `${id}:${p.bubble.kind}`}
            onPress={() => onOpenBubble(p.bubble)}
            style={[styles.bubbleAbs, leftStyle, { top: p.bubbleCenterY - half }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch' },
  stageCanvas: { position: 'relative' },
  block: {
    position: 'relative',
    width: '100%',
  },
  blockMuted: {
    opacity: 0.45,
  },
  labelCol: {
    position: 'absolute',
    left: '50%',
    marginLeft: -LABEL_COL / 2,
    width: LABEL_COL,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  labelChip: {
    backgroundColor: '#0f1024',
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  labelChipCurrent: {
    borderColor: '#facc15',
    backgroundColor: '#1a1630',
  },
  labelChipOpen: {
    borderColor: '#c4b5fd',
    backgroundColor: '#1e1b4b',
  },
  axisWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  axisLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#7c3aed',
  },
  tickHit: {
    position: 'absolute',
    left: '50%',
    width: 24,
    alignItems: 'center',
    zIndex: 5,
  },
  tickOn: {
    color: '#f5f3ff',
    fontSize: 13,
    fontWeight: '800',
  },
  tickOff: {
    color: '#6b6288',
    fontSize: 12,
    fontWeight: '700',
  },
  tickMark: {
    marginTop: 2,
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: '#6b6288',
  },
  tickMarkOn: {
    backgroundColor: '#ddd6fe',
    height: 16,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#c4b5fd',
    borderWidth: 2,
    borderColor: '#8b5cf6',
    marginBottom: 4,
  },
  dotCurrent: {
    backgroundColor: '#fde047',
    borderColor: '#facc15',
  },
  label: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  labelCurrent: {
    color: '#fde047',
  },
  sublabel: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  nowMark: {
    color: '#fde047',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  monthRow: {
    position: 'absolute',
    left: '50%',
    marginLeft: -96,
    width: 192,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 6,
  },
  monthLetterOn: {
    color: '#f5f3ff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    width: 14,
  },
  monthLetterOff: {
    color: '#4b4568',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: 14,
  },
  monthDot: {
    alignSelf: 'center',
    marginTop: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#c4b5fd',
  },
  bubbleAbs: {
    position: 'absolute',
    zIndex: 2,
  },
  spokeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#e2e8f0',
    opacity: 0.9,
  },
  kindBubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  kindBubbleGlow: {
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#93c5fd',
  },
  kindLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  kindCount: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  kindCountDate: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
