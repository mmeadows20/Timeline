import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateField from '../components/DateField';
import PhotoView from '../components/PhotoView';
import { pickClipFromGallery } from '../services/imagePicker';
import { saveEvent } from '../services/eventService';
import { useTheme } from '../themeContext';

const STREAMS = [
  { id: 'tapo', label: 'Tapo camera' },
  { id: 'screen', label: 'Screen recording' },
  { id: 'other', label: 'Other' },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pad2(value) {
  const n = Math.max(0, parseInt(String(value || '0'), 10) || 0);
  return String(n).padStart(2, '0');
}

function streamLabel(stream, otherName) {
  if (stream === 'other') return String(otherName || '').trim() || 'Other';
  return STREAMS.find((row) => row.id === stream)?.label || 'Clip';
}

function clipTitle(file) {
  const name = streamLabel(file.stream, file.otherName);
  const fileName = String(file.filename || '').trim();
  return fileName ? `${name} · ${fileName}` : name;
}

export default function AddGalleryClipScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useMemo(() => screenStyles(colors), [colors]);
  const existing = route.params?.event || null;
  const [date, setDate] = useState(existing?.date ? String(existing.date).slice(0, 10) : todayIso());
  const [hour, setHour] = useState(() => {
    const d = existing?.date ? new Date(existing.date) : new Date();
    return Number.isNaN(d.getTime()) ? '12' : pad2(d.getHours());
  });
  const [minute, setMinute] = useState(() => {
    const d = existing?.date ? new Date(existing.date) : new Date();
    return Number.isNaN(d.getTime()) ? '00' : pad2(d.getMinutes());
  });
  const [note, setNote] = useState(existing?.description || '');
  const [files, setFiles] = useState(() => {
    if (!existing) return [];
    const video = !!existing.videoUri && !existing.imageUri;
    return [
      {
        id: existing.id,
        uri: existing.imageUri || existing.videoUri || '',
        filename: existing.clipFileName || '',
        kind: existing.clipKind || (video ? 'video' : 'image'),
        stream: existing.clipStream || 'tapo',
        otherName: existing.clipStream === 'other' ? existing.clipStreamLabel || '' : '',
      },
    ];
  });
  const [saving, setSaving] = useState(false);

  const addFromGallery = async () => {
    const picked = await pickClipFromGallery();
    if (!picked?.uri) return;
    setFiles((list) => [
      ...list,
      {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        uri: picked.uri,
        filename: picked.filename || '',
        kind: picked.kind === 'video' ? 'video' : 'image',
        stream: 'tapo',
        otherName: '',
      },
    ]);
  };

  const save = async () => {
    if (!files.length) {
      Alert.alert('Choose a file', 'Add at least one photo or video from the gallery.');
      return;
    }
    const hh = Math.min(23, parseInt(hour, 10) || 0);
    const mm = Math.min(59, parseInt(minute, 10) || 0);
    const [y, m, d] = String(date || todayIso()).split('-').map((n) => parseInt(n, 10));
    const when = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
    if (Number.isNaN(when.getTime())) {
      Alert.alert('Check the date', 'That date or time could not be read.');
      return;
    }
    setSaving(true);
    try {
      for (const file of files) {
        const label = streamLabel(file.stream, file.otherName);
        const payload = {
          title: clipTitle(file),
          description: note,
          date: when.toISOString(),
          category: 'personal',
          source: 'clip',
          clipStream: file.stream,
          clipStreamLabel: label,
          clipFileName: file.filename || '',
          clipKind: file.kind,
          imageUri: file.kind === 'image' ? file.uri : undefined,
          videoUri: file.kind === 'video' ? file.uri : undefined,
        };
        if (existing && file.id === existing.id) payload.id = existing.id;
        await saveEvent(payload);
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Put gallery files on the timeline at the time they belong to. Several files can share that time if they come from different streams.
      </Text>
      <Text style={styles.label}>When this happened</Text>
      <DateField value={date} onChange={setDate} />
      <View style={styles.timeRow}>
        <TextInput
          style={styles.time}
          value={hour}
          onChangeText={(t) => setHour(t.replace(/[^\d]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="HH"
          placeholderTextColor={colors.faint}
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          style={styles.time}
          value={minute}
          onChangeText={(t) => setMinute(t.replace(/[^\d]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="MM"
          placeholderTextColor={colors.faint}
        />
      </View>
      <TextInput
        style={styles.note}
        placeholder="Note, optional"
        placeholderTextColor={colors.faint}
        value={note}
        onChangeText={setNote}
        multiline
      />
      <TouchableOpacity style={styles.add} onPress={addFromGallery}>
        <Text style={styles.addText}>Add from gallery</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        {Platform.OS === 'web'
          ? 'On the laptop, photos are kept in the app. A video link from the browser may only last for this visit.'
          : 'On the phone, photos and videos are copied into Timeline. The gallery original is left as it is.'}
      </Text>
      {files.map((file) => (
        <View key={file.id} style={styles.card}>
          {file.kind === 'image' && file.uri ? (
            <PhotoView uri={file.uri} style={styles.thumb} resizeMode="cover" />
          ) : (
            <Text style={styles.video}>Video · {file.filename || 'gallery file'}</Text>
          )}
          <View style={styles.chips}>
            {STREAMS.map((stream) => {
              const on = file.stream === stream.id;
              return (
                <TouchableOpacity
                  key={stream.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() =>
                    setFiles((list) => list.map((row) => (row.id === file.id ? { ...row, stream: stream.id } : row)))
                  }
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{stream.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {file.stream === 'other' ? (
            <TextInput
              style={styles.other}
              placeholder="Name this stream"
              placeholderTextColor={colors.faint}
              value={file.otherName}
              onChangeText={(text) =>
                setFiles((list) => list.map((row) => (row.id === file.id ? { ...row, otherName: text } : row)))
              }
            />
          ) : null}
          <TouchableOpacity
            onPress={() => setFiles((list) => list.filter((row) => row.id !== file.id))}
          >
            <Text style={styles.remove}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save on timeline</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function screenStyles(c) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 16, paddingBottom: 48 },
    intro: { color: c.faint, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    label: { color: c.text, fontWeight: '700', marginBottom: 6 },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 10 },
    time: {
      width: 64,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      color: c.text,
      borderRadius: 10,
      textAlign: 'center',
      paddingVertical: 10,
      fontSize: 18,
    },
    colon: { color: c.text, fontSize: 20, marginHorizontal: 8 },
    note: {
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      color: c.text,
      borderRadius: 10,
      minHeight: 64,
      padding: 12,
      marginBottom: 12,
    },
    add: {
      borderWidth: 1,
      borderColor: c.blue,
      borderRadius: 10,
      alignItems: 'center',
      paddingVertical: 12,
    },
    addText: { color: c.blue, fontWeight: '700' },
    hint: { color: c.faint, fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 12 },
    card: {
      backgroundColor: c.card,
      borderColor: c.cardBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    thumb: { width: '100%', height: 160, borderRadius: 8, marginBottom: 8 },
    video: { color: c.text, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipOn: { backgroundColor: c.blue, borderColor: c.blue },
    chipText: { color: c.text, fontSize: 13 },
    chipTextOn: { color: '#fff', fontWeight: '700' },
    other: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.cardBorder,
      color: c.text,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    remove: { color: c.danger || '#dc2626', marginTop: 8 },
    save: {
      backgroundColor: c.blue,
      borderRadius: 10,
      alignItems: 'center',
      paddingVertical: 14,
      marginTop: 8,
    },
    saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
