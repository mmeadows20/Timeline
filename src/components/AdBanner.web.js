import React from 'react';
import { Text, View } from 'react-native';

/** Browser preview. The real banner is only in the Android build. */
export default function AdBanner() {
  return (
    <View style={styles.slot}>
      <Text style={styles.label}>Advert · shows in the Android test build</Text>
    </View>
  );
}

const styles = {
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 36,
  },
  label: { color: '#94a3b8', fontSize: 12 },
};
