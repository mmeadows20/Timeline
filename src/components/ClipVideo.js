import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function ClipVideo({ uri, style }) {
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(uri || null, (item) => {
    item.loop = false;
  });
  if (!uri) return null;
  if (failed) {
    return (
      <Text style={styles.fail}>
        This video is saved on this device. Open it from Gallery if it will not play here.
      </Text>
    );
  }
  return (
    <View style={styles.wrap}>
      <VideoView
        player={player}
        style={[styles.player, style]}
        nativeControls
        contentFit="contain"
        onFirstFrameRender={() => setFailed(false)}
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
