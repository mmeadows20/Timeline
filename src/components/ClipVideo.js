import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

function loadPlayer() {
  try {
    const av = require('expo-av');
    if (!av || !av.Video) return null;
    return av;
  } catch (_) {
    return null;
  }
}

export default function ClipVideo({ uri, style }) {
  const [failed, setFailed] = useState(false);
  const av = loadPlayer();
  if (!uri) return null;
  if (!av || failed) {
    return (
      <Text style={styles.fail}>
        This video is saved on this device. This copy of Expo Go cannot play it yet.
      </Text>
    );
  }
  const { Video, ResizeMode } = av;
  return (
    <View style={styles.wrap}>
      <Video
        source={{ uri }}
        style={[styles.player, style]}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        isLooping={false}
        onError={() => setFailed(true)}
      />
      <Text style={styles.hint}>First frame shows here. Use the play control to watch it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 8 },
  player: {
    width: '100%',
    height: 220,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  hint: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
  fail: { color: '#fbbf24', fontSize: 13, marginVertical: 8 },
});
