import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  LogBox,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { colors, type, space } from './src/theme';
import { match, lookup, brandFamilies, getPart, getEvidence, conflictFor, categories, adapters, sources, grades } from './src/fitment';
import { computeDue, formatRemaining, statusLabel, todayStr } from './src/due';
import * as db from './src/db';
import * as notify from './src/notify';
import { exportCsv, exportJson } from './src/export';
import { seedDemo } from './src/demo';

const Stack = createNativeStackNavigator();
const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';
// Screenshot tour: only when a build explicitly sets EXPO_PUBLIC_SHOTS=1 (CI screenshot job).
const SHOTS = process.env.EXPO_PUBLIC_SHOTS === '1';
const navRef = createNavigationContainerRef();
// Screenshot builds hide the dev-only log overlay so the captured frames are clean.
if (SHOTS) LogBox.ignoreAllLogs(true);

// Deep links: partfit://result/<query>, partfit://detail/<id>, partfit://lookup, ...
const linking = {
  prefixes: ['partfit://'],
  config: {
    screens: {
      Home: '',
      Scan: 'scan/:mode',
      Result: 'result/:query',
      AddAppliance: 'add',
      Detail: 'detail/:id',
      Lookup: 'lookup',
      Settings: 'settings',
      Sources: 'sources',
    },
  },
};

/* ------------------------------------------------------------------ atoms */

function Badge({ tone = 'neutral', children }) {
  const map = {
    confirmed: [colors.accentSoft, colors.accent],
    likely: [colors.warnSoft, colors.warn],
    check: [colors.warnSoft, colors.warn],
    candidate: ['#EEF1F0', colors.sub],
    overduetone: [colors.dangerSoft, colors.danger],
    neutral: ['#EEF1F0', colors.sub],
  };
  const [bg, fg] = map[tone] || map.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

function ConfidenceBadge({ confidence }) {
  const label = {
    confirmed: 'Confirmed fit',
    likely: 'Likely fit',
    check: 'Verify on label',
    candidate: 'Possible match',
    ambiguous: 'Check the label',
    unknown: 'Unknown',
  }[confidence] || 'Unknown';
  const tone = { confirmed: 'confirmed', likely: 'likely', check: 'check', candidate: 'candidate' }[confidence] || 'neutral';
  return <Badge tone={tone}>{label}</Badge>;
}

/** Human wording for a stored match confidence (badges must never show raw enums). */
function confidenceLabel(confidence) {
  return {
    confirmed: 'Confirmed match',
    likely: 'Likely match',
    check: 'Verify on label',
    candidate: 'Possible match',
    ambiguous: 'Check the label',
  }[confidence] || 'Unverified';
}

/** Titles in the dataset often start with the brand; don't print "Samsung · Samsung …". */
function withoutBrand(title, brand) {
  if (!title || !brand) return title || '';
  const t = String(title).trim();
  return t.toLowerCase().startsWith(String(brand).toLowerCase()) ? t.slice(String(brand).length).trim() : t;
}

function PrimaryButton({ label, onPress, disabled, tone = 'accent' }) {  const bg = tone === 'accent' ? colors.accent : tone === 'ghost' ? 'transparent' : colors.danger;
  const fg = tone === 'accent' ? '#FFFFFF' : tone === 'ghost' ? colors.accent : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        tone === 'ghost' && { borderWidth: 1, borderColor: colors.accent },
      ]}
    >
      <Text style={[styles.primaryText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Row({ label, value }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ home */

function HomeScreen({ navigation, refreshKey }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState({ appliances: 0, logs: 0 });

  const load = useCallback(async () => {
    await db.getDb();
    if (DEMO) await seedDemo();
    const rows = await db.listAppliances();
    setItems(rows);
    setCounts(await db.countAll());
    setReady(true);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const today = todayStr();
  const rows = useMemo(
    () => items.map((a) => ({ ...a, due: computeDue(a, today) })),
    [items, today]
  );
  const dueSoon = rows.filter((r) => ['overdue', 'urgent', 'due'].includes(r.due.status)).length;

  if (!ready) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space(5), paddingTop: insets.top + space(5), paddingBottom: space(10) }}>
      <Text style={styles.eyebrow}>PARTFIT</Text>
      <Text style={type.h1}>Know the exact filter.</Text>
      <Text style={[type.sub, { marginTop: space(2), marginBottom: space(5) }]}>
        {counts.appliances === 0
          ? 'Scan a model plate or the label on your old filter. Works offline.'
          : `${counts.appliances} appliance${counts.appliances > 1 ? 's' : ''} tracked · ${dueSoon} need attention`}
      </Text>

      <View style={styles.actionRow}>
        <Pressable style={[styles.actionTile, { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('Scan', { mode: 'model' })}>
          <Text style={styles.actionTileTitle}>Scan model plate</Text>
          <Text style={styles.actionTileSub}>Point at the sticker inside the door</Text>
        </Pressable>
        <Pressable style={[styles.actionTile, { backgroundColor: colors.ink }]} onPress={() => navigation.navigate('Scan', { mode: 'part' })}>
          <Text style={styles.actionTileTitle}>Scan old filter</Text>
          <Text style={styles.actionTileSub}>Fastest when you have the cartridge</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHead}>
        <Text style={type.h2}>My appliances</Text>
        <Pressable onPress={() => navigation.navigate('Lookup')}>
          <Text style={styles.link}>Type a number</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <Card>
          <Text style={type.body}>Nothing tracked yet.</Text>
          <Text style={[type.sub, { marginTop: space(2) }]}>
            Add one appliance and PartFit will tell you the exact cartridge, how often to change it, and where the answer came from.
          </Text>
        </Card>
      ) : (
        rows.map((a) => {
          const tone = a.due.status === 'overdue' ? 'overduetone' : a.due.status === 'ok' ? 'confirmed' : 'likely';
          return (
            <Pressable key={a.id} onPress={() => navigation.navigate('Detail', { id: a.id })} style={{ marginBottom: space(3) }}>
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{a.nickname}</Text>
                  <Badge tone={tone}>{statusLabel(a.due.status)}</Badge>
                </View>
                <Text style={[type.sub, { marginTop: 2 }]}>
                  {a.brand} {a.model} · {a.part_no || 'no filter set'}
                </Text>
                <Text style={[type.mono, { marginTop: space(2), color: colors.sub }]}>
                  {formatRemaining(a.due.daysLeft)} · next {a.due.nextDueDate || '—'}
                </Text>
              </Card>
            </Pressable>
          );
        })
      )}

      <View style={{ height: space(6) }} />
      <Card style={{ backgroundColor: colors.accentSoft }}>
        <Text style={[type.body, { fontWeight: '600' }]}>Why you can trust this</Text>
        <Text style={[type.sub, { marginTop: space(2) }]}>
          Every fitment shows the manufacturer page it came from and the date we checked it. When two manufacturer pages
          disagree, we show both instead of picking one.
        </Text>
        <Pressable onPress={() => navigation.navigate('Sources')} style={{ marginTop: space(3) }}>
          <Text style={styles.link}>Open the source list</Text>
        </Pressable>
      </Card>

      <View style={styles.footerLinks}>
        <Pressable onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.link}>Reminders & export</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ scan */

function ScanScreen({ navigation, route }) {
  const mode = route.params?.mode || 'model';
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const cameraRef = useRef(null);

  const onCapture = async (uri) => {
    setBusy(true);
    try {
      const text = await readLabel(uri);
      if (text) {
        navigation.navigate('Result', { query: text, mode });
      } else {
        Alert.alert(
          'Nothing readable yet',
          'The on-device reader could not find a model number in this photo. Type it below — it is usually 8–12 characters on the plate.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      {permission && permission.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onMountError={() => Alert.alert('Camera unavailable', 'Type the model number instead.')}
        >
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraHint}>
              {mode === 'part' ? 'Frame the label on the old filter' : 'Frame the model plate inside the door'}
            </Text>
          </View>
        </CameraView>
      ) : (
        <View style={[styles.center, { padding: space(6), paddingTop: space(16) }]}>
          <Text style={type.h2}>Camera access</Text>
          <Text style={[type.sub, { marginTop: space(2), textAlign: 'center' }]}>
            Photos are read on this device and never uploaded.
          </Text>
          <View style={{ height: space(4) }} />
          <PrimaryButton label="Allow camera" onPress={requestPermission} />
        </View>
      )}

      {busy && (
        <View style={[styles.center, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <ActivityIndicator color="#FFF" />
        </View>
      )}

      <View style={styles.scanBottom}>
        {permission && permission.granted ? (
          <PrimaryButton
            label={busy ? 'Reading…' : 'Capture and read'}
            disabled={busy}
            onPress={async () => {
              try {
                const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7, skipProcessing: true });
                if (photo?.uri) await onCapture(photo.uri);
              } catch (e) {
                Alert.alert('Capture failed', 'Try again, or type the number below.');
              }
            }}
          />
        ) : null}
        <TextInput
          style={styles.input}
          placeholder={mode === 'part' ? 'Or type the number on the cartridge' : 'Or type the model number'}
          placeholderTextColor={colors.sub}
          autoCapitalize="characters"
          autoCorrect={false}
          value={manual}
          onChangeText={setManual}
          returnKeyType="search"
          onSubmitEditing={() => manual.trim() && navigation.navigate('Result', { query: manual.trim(), mode })}
        />
        <PrimaryButton
          label="Look it up"
          disabled={!manual.trim()}
          onPress={() => navigation.navigate('Result', { query: manual.trim(), mode })}
        />
      </View>
    </View>
  );
}

/** 端侧识别：原生模块存在就用，否则返回 null，UI 退回手输（绝不假装识别成功） */
async function readLabel(uri) {
  try {
    const { requireNativeModule } = require('expo-modules-core');
    const ocr = requireNativeModule('PartFitOcr');
    const lines = await ocr.recognize(uri);
    const models = (lines || []).filter((l) => /^[A-Z0-9][A-Z0-9\-\/]{5,}$/i.test(String(l).trim()));
    return models[0] ? String(models[0]).trim() : (lines && lines[0]) || null;
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------------ result */

function ResultScreen({ navigation, route }) {
  const { query, mode } = route.params;
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => (mode === 'part' ? { kind: 'part', parts: lookup(query) } : { kind: 'model', ...match(query) }), [query, mode]);

  if (result.kind === 'part') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: space(5) }}>
        <Text style={type.h1}>Cartridge {query}</Text>
        <Text style={[type.sub, { marginTop: space(2), marginBottom: space(4) }]}>
          {result.parts.length ? 'We know this cartridge. Add the appliance it belongs to.' : 'No match on that number yet.'}
        </Text>
        {result.parts.map((p) => {
          const fits = adapters(p.partId);
          return (
            <Card key={p.partId} style={{ marginBottom: space(3) }}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{p.partNo}</Text>
                <Badge tone="confirmed">Known part</Badge>
              </View>
              <Text style={[type.sub, { marginTop: 2 }]}>{p.brand} · {withoutBrand(p.title, p.brand)}</Text>
              <Text style={[type.sub, { marginTop: space(2) }]}>{p.spec}</Text>
              <Text style={[type.mono, { marginTop: space(2), color: colors.sub }]}>
                Replace every {p.intervalMonths} months
              </Text>

              {fits.length > 0 && (
                <View style={{ marginTop: space(3) }}>
                  <Text style={type.body}>Fits {fits.length} appliance model{fits.length > 1 ? 's' : ''} we verified</Text>
                  {fits.slice(0, 6).map((f, i) => (
                    <Text key={i} style={[type.mono, { marginTop: 2, color: colors.sub }]}>
                      {f.model} · {f.grade === 'explicit' ? 'listed by maker' : 'series rule'}
                    </Text>
                  ))}
                  {fits.length > 6 ? (
                    <Text style={[type.sub, { marginTop: 2 }]}>+{fits.length - 6} more in the source list</Text>
                  ) : null}
                </View>
              )}

              <View style={{ height: space(3) }} />
              <PrimaryButton
                label="Add this appliance"
                onPress={() => navigation.navigate('AddAppliance', { partId: p.partId, partNo: p.partNo, category: p.category, brand: p.brand })}
              />
            </Card>
          );
        })}
        {!result.parts.length && (
          <Card>
            <Text style={type.body}>Try the number exactly as printed, or scan the cartridge label.</Text>
            <Text style={[type.sub, { marginTop: space(2) }]}>
              We only claim a fitment when a manufacturer source backs it, so an unknown number stays unknown.
            </Text>
          </Card>
        )}
      </ScrollView>
    );
  }

  const hits = result.hits || [];
  const top = hits[0];
  // If the typed value is actually a cartridge number (the old filter in hand), reverse it:
  // that is the highest-leverage lookup in this dataset (few part numbers, many appliance models).
  const cartridge = hits.length ? [] : lookup(query);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space(5) }}>
      <Text style={styles.eyebrow}>MODEL {String(query).toUpperCase()}</Text>
      <Text style={type.h1}>{top ? top.partNo : 'No match yet'}</Text>
      {top && top.evidenceGrade === 'rule' ? (
        <View style={styles.badgeRow}>
          <Badge tone="neutral">Matched by series rule</Badge>
        </View>
      ) : null}

      {result.hint ? <Text style={[type.sub, { marginTop: space(3) }]}>{result.hint}</Text> : null}

      {hits.map((h) => (
        <Card key={`${h.partId}-${h.valueRaw}`} style={{ marginTop: space(4) }}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{h.partNo}</Text>
            <ConfidenceBadge confidence={h.confidence} />
          </View>
          <Text style={[type.sub, { marginTop: 2 }]}>{h.brand} · {withoutBrand(h.title, h.brand)}</Text>
          {h.spec ? <Text style={[type.sub, { marginTop: space(2) }]}>{h.spec}</Text> : null}
          <Text style={[type.mono, { marginTop: space(2), color: colors.sub }]}>
            Every {h.intervalMonths} months · matched on “{h.valueRaw}”
          </Text>

          {h.conflict ? (
            <View style={styles.conflictBox}>
              <Text style={styles.conflictTitle}>Manufacturer pages disagree</Text>
              <Text style={[type.sub, { marginTop: 2 }]}>{h.conflict}</Text>
            </View>
          ) : null}

          <EvidenceList partId={h.partId} />

          <View style={{ height: space(3) }} />
          <TextInput
            style={styles.input}
            placeholder="Name it (e.g. Kitchen fridge)"
            placeholderTextColor={colors.sub}
            value={nickname}
            onChangeText={setNickname}
          />
          <View style={{ height: space(2) }} />
          <PrimaryButton
            label={saving ? 'Saving…' : 'Add to my appliances'}
            disabled={saving}
            onPress={async () => {
              setSaving(true);
              const id = await db.addAppliance({
                nickname: nickname.trim() || `${h.brand} filter`,
                category: h.category || 'fridge_water',
                brand: h.brand,
                model: query,
                partId: h.partId,
                partNo: h.partNo,
                intervalMonths: h.intervalMonths || 6,
                matchConfidence: h.confidence,
              });
              await notify.rescheduleAll(await db.listAppliances(), { requestPermission: false }).catch(() => 0);
              setSaving(false);
              navigation.navigate('Detail', { id });
            }}
          />
        </Card>
      ))}

      {cartridge.map((p) => {
        const fits = adapters(p.partId);
        return (
          <Card key={p.partId} style={{ marginTop: space(4), borderColor: colors.accent }}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{p.partNo}</Text>
              <Badge tone="confirmed">Cartridge number</Badge>
            </View>
            <Text style={[type.sub, { marginTop: 2 }]}>{p.brand} · {withoutBrand(p.title, p.brand)}</Text>
            <Text style={[type.sub, { marginTop: space(2) }]}>{p.spec}</Text>
            <Text style={[type.mono, { marginTop: space(2), color: colors.sub }]}>
              Replace every {p.intervalMonths} months
            </Text>

            {fits.length > 0 && (
              <View style={{ marginTop: space(3) }}>
                <Text style={type.body}>Fits {fits.length} appliance model{fits.length > 1 ? 's' : ''} we verified</Text>
                {fits.slice(0, 6).map((f, i) => (
                  <Text key={i} style={[type.mono, { marginTop: 2, color: colors.sub }]}>
                    {f.model} · {f.grade === 'explicit' ? 'listed by maker' : 'series rule'}
                  </Text>
                ))}
                {fits.length > 6 ? (
                  <Text style={[type.sub, { marginTop: 2 }]}>+{fits.length - 6} more in the source list</Text>
                ) : null}
              </View>
            )}

            <View style={{ height: space(3) }} />
            <PrimaryButton
              label="Add the appliance this fits"
              onPress={() => navigation.navigate('AddAppliance', { partId: p.partId, partNo: p.partNo, category: p.category, brand: p.brand })}
            />
          </Card>
        );
      })}

      {cartridge.length ? (
        <Text style={[type.sub, { marginTop: space(4) }]}>
          This number is the cartridge itself, so we reversed it instead of guessing an appliance.
        </Text>
      ) : null}

      {!hits.length && (
        <Card style={{ marginTop: space(4) }}>
          <Text style={type.body}>What you can do next</Text>
          <Text style={[type.sub, { marginTop: space(2) }]}>• Scan the label on your old filter — cartridge numbers are far fewer than model numbers.</Text>
          <Text style={[type.sub, { marginTop: 1 }]}>• Pick your brand and series, then confirm on the label.</Text>
          <Text style={[type.sub, { marginTop: 1 }]}>• Open the manufacturer’s own checker from the source list.</Text>
          <View style={{ height: space(3) }} />
          <PrimaryButton label="Scan old filter" onPress={() => navigation.navigate('Scan', { mode: 'part' })} />
        </Card>
      )}
    </ScrollView>
  );
}

function EvidenceList({ partId }) {
  const [open, setOpen] = useState(false);
  const evidence = getEvidence(partId) || [];
  const conflict = conflictFor(partId);
  if (!evidence.length) return null;
  return (
    <View style={{ marginTop: space(3) }}>
      <Pressable onPress={() => setOpen(!open)}>
        <Text style={styles.link}>{open ? 'Hide sources' : `Sources (${evidence.length})`}</Text>
      </Pressable>
      {open &&
        evidence.map((e, i) => (
          <View key={i} style={styles.sourceRow}>
            <Text style={[type.sub, { fontWeight: '600' }]}>{e.publisher}</Text>
            <Text style={[type.sub, { marginTop: 1 }]}>Checked {e.retrieved_at} · {e.grade === 'explicit' ? 'lists this model' : e.grade === 'rule' ? 'series rule' : 'part-level only'}</Text>
            {e.quote ? <Text style={[type.sub, { marginTop: 2, color: colors.ink }]}>{e.quote}</Text> : null}
            <Pressable onPress={() => Linking.openURL(e.url)}>
              <Text style={[styles.link, { marginTop: 2 }]}>{e.url}</Text>
            </Pressable>
          </View>
        ))}
      {conflict && (
        <View style={styles.conflictBox}>
          <Text style={styles.conflictTitle}>Conflict on file</Text>
          <Text style={[type.sub, { marginTop: 2 }]}>{conflict.description}</Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ add */

function AddApplianceScreen({ navigation, route }) {
  const p = route.params || {};
  const [nickname, setNickname] = useState('');
  const [date, setDate] = useState('');
  const part = p.partId ? getPart(p.partId) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space(5) }}>
      <Text style={type.h1}>Add appliance</Text>
      <Text style={[type.sub, { marginTop: space(2), marginBottom: space(4) }]}>
        {part ? `${part.brand} ${part.part_no} · every ${part.interval_months} months` : 'Set up a filter schedule.'}
      </Text>

      <Text style={styles.fieldLabel}>Nickname</Text>
      <TextInput style={styles.input} placeholder="Kitchen fridge" placeholderTextColor={colors.sub} value={nickname} onChangeText={setNickname} />

      <Text style={[styles.fieldLabel, { marginTop: space(4) }]}>Last replaced (YYYY-MM-DD, optional)</Text>
      <TextInput style={styles.input} placeholder="2026-06-01" placeholderTextColor={colors.sub} value={date} onChangeText={setDate} autoCapitalize="none" />

      <View style={{ height: space(5) }} />
      <PrimaryButton
        label="Save"
        onPress={async () => {
          const ok = /^\d{4}-\d{2}-\d{2}$/.test(date) || date === '';
          if (!ok) return Alert.alert('Check the date', 'Use YYYY-MM-DD.');
          const id = await db.addAppliance({
            nickname: nickname.trim() || (part ? `${part.brand} ${part.category}` : 'Appliance'),
            category: p.category || 'fridge_water',
            brand: p.brand,
            model: null,
            partId: p.partId,
            partNo: p.partNo,
            intervalMonths: part ? part.interval_months : 6,
            lastReplacedAt: date || null,
          });
          await notify.rescheduleAll(await db.listAppliances(), { requestPermission: false }).catch(() => 0);
          navigation.navigate('Detail', { id });
        }}
      />
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ detail */

function DetailScreen({ navigation, route }) {
  const { id } = route.params;
  const [appliance, setAppliance] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const a = await db.getAppliance(id);
    setAppliance(a);
    setLogs(await db.listLogs(id));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!appliance) return <View style={[styles.screen, styles.center]}><ActivityIndicator color={colors.accent} /></View>;

  const due = computeDue(appliance, todayStr());
  const evidence = appliance.part_id ? getEvidence(appliance.part_id) : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space(5) }}>
      <Text style={styles.eyebrow}>{appliance.brand || 'APPLIANCE'}</Text>
      <Text style={type.h1}>{appliance.nickname}</Text>
      <View style={styles.badgeRow}>
        <Badge tone={due.status === 'overdue' ? 'overduetone' : 'confirmed'}>{statusLabel(due.status)}</Badge>
        {appliance.match_confidence ? <Badge tone="neutral">{confidenceLabel(appliance.match_confidence)}</Badge> : null}
      </View>

      <Card style={{ marginTop: space(4) }}>
        <Row label="Filter" value={appliance.part_no || 'Not set'} />
        <Row label="Every" value={`${appliance.interval_months} months`} />
        <Row label="Last replaced" value={appliance.last_replaced_at || 'Not recorded'} />
        <Row label="Next due" value={due.nextDueDate || '—'} />
        <Row label="Remaining" value={formatRemaining(due.daysLeft)} />
      </Card>

      <View style={{ height: space(4) }} />
      <PrimaryButton
        label={busy ? 'Saving…' : 'I changed it today'}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          await db.addLog(appliance.id, { partNo: appliance.part_no, date: todayStr(), cost: null, note: 'Replaced' });
          await notify.rescheduleAll(await db.listAppliances(), { requestPermission: false }).catch(() => 0);
          await load();
          setBusy(false);
        }}
      />

      <View style={styles.sectionHead}>
        <Text style={type.h2}>History</Text>
        <Text style={type.sub}>{logs.length} record{logs.length === 1 ? '' : 's'}</Text>
      </View>
      {logs.length === 0 ? (
        <Text style={type.sub}>No replacements logged yet.</Text>
      ) : (
        logs.map((l) => (
          <Card key={l.id} style={{ marginBottom: space(2), paddingVertical: space(3) }}>
            <View style={styles.rowBetween}>
              <Text style={type.body}>{l.date}</Text>
              <Text style={type.sub}>{l.part_no || ''}</Text>
            </View>
          </Card>
        ))
      )}

      {evidence.length > 0 && (
        <>
          <View style={styles.sectionHead}><Text style={type.h2}>Where this came from</Text></View>
          <EvidenceList partId={appliance.part_id} />
        </>
      )}

      <View style={{ height: space(6) }} />
      <PrimaryButton
        tone="ghost"
        label="Remove appliance"
        onPress={() =>
          Alert.alert('Remove this appliance?', 'Its history will be deleted too. This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                await db.deleteAppliance(id);
                navigation.popToTop();
              },
            },
          ])
        }
      />
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ lookup */

function LookupScreen({ navigation }) {
  const [text, setText] = useState('');
  const [brand, setBrand] = useState('');
  const fams = useMemo(() => (brand ? brandFamilies(brand) : []), [brand]);
  const brands = ['Samsung', 'LG', 'GE Appliances', 'Whirlpool', 'AprilAire', 'Levoit'];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space(5) }}>
      <Text style={type.h1}>Find by number</Text>
      <Text style={[type.sub, { marginTop: space(2), marginBottom: space(4) }]}>
        Type the cartridge number printed on your old filter, or a model number from the plate.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="DA29-00020B or RF28K9070SR"
        placeholderTextColor={colors.sub}
        autoCapitalize="characters"
        autoCorrect={false}
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => text.trim() && navigation.navigate('Result', { query: text.trim(), mode: /[\d]/.test(text) ? 'part' : 'model' })}
      />
      <View style={{ height: space(3) }} />
      <PrimaryButton
        label="Search"
        disabled={!text.trim()}
        onPress={() =>
          navigation.navigate('Result', { query: text.trim(), mode: lookup(text).length ? 'part' : 'model' })
        }
      />

      <View style={styles.sectionHead}><Text style={type.h2}>Or start from the brand</Text></View>
      <View style={styles.chipRow}>
        {brands.map((b) => (
          <Pressable key={b} onPress={() => setBrand(b)} style={[styles.chip, brand === b && styles.chipOn]}>
            <Text style={[styles.chipText, brand === b && { color: '#FFF' }]}>{b}</Text>
          </Pressable>
        ))}
      </View>

      {fams.map((f) => (
        <Card key={f.family} style={{ marginBottom: space(2) }}>
          <Text style={styles.cardTitle}>{f.family}…</Text>
          <Text style={[type.sub, { marginTop: 2 }]}>{f.examples.join(' · ')}</Text>
          <Text style={[type.mono, { marginTop: space(1), color: colors.sub }]}>{f.parts.join(', ')}</Text>
        </Card>
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ settings */

function SettingsScreen({ navigation }) {
  const [perm, setPerm] = useState(null);
  const [scheduled, setScheduled] = useState(0);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    setPerm(await notify.permissionInfo());
    setScheduled(await notify.countScheduled());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space(5) }}>
      <Text style={type.h1}>Reminders & data</Text>

      <Card style={{ marginTop: space(4) }}>
        <Row label="Notifications" value={perm && perm.granted ? 'Allowed' : 'Not allowed'} />
        <Row label="Scheduled" value={String(scheduled)} />
        <Text style={[type.sub, { marginTop: space(2) }]}>
          Each filter gets a reminder 14 days ahead, 3 days ahead, and on the day.
        </Text>
        <View style={{ height: space(3) }} />
        <PrimaryButton
          label="Rebuild reminders"
          onPress={async () => {
            const n = await notify.rescheduleAll(await db.listAppliances());
            setMsg(`${n} reminders scheduled`);
            refresh();
          }}
        />
        {msg ? <Text style={[type.sub, { marginTop: space(2) }]}>{msg}</Text> : null}
      </Card>

      <View style={styles.sectionHead}><Text style={type.h2}>Export</Text></View>
      <PrimaryButton label="Export CSV" onPress={async () => exportCsv(await db.listAppliances())} />
      <View style={{ height: space(2) }} />
      <PrimaryButton
        tone="ghost"
        label="Export JSON (with full history)"
        onPress={async () => {
          const items = await db.listAppliances();
          const all = [];
          for (const a of items) all.push(...(await db.listLogs(a.id)).map((l) => ({ ...l, appliance: a.nickname })));
          exportJson(items, all);
        }}
      />

      <View style={styles.sectionHead}><Text style={type.h2}>About</Text></View>
      <Card>
        <Text style={type.body}>PartFit 1.0</Text>
          <Text style={[type.sub, { marginTop: space(2) }]}>
          Offline by design: no account, no cloud, no analytics. Photos are read on this device.
        </Text>
        <Pressable style={{ marginTop: space(3) }} onPress={() => navigation.navigate('Sources')}>
          <Text style={styles.link}>Source list & conflict log</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

function SourcesScreen() {
  const rows = sources();
  const gradeCopy = grades();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: space(5) }}>
      <Text style={type.h1}>Sources</Text>
      <Text style={[type.sub, { marginTop: space(2), marginBottom: space(4) }]}>
        Every fitment in PartFit points at the manufacturer page it came from, the date we checked it, and what the page
        actually says. Nothing here is inferred from another retailer’s chart.
      </Text>

      {Object.entries(gradeCopy).slice(0, 3).map(([k, v]) => (
        <Card key={k} style={{ marginBottom: space(2) }}>
          <Text style={styles.cardTitle}>{gradeLabel(k)}</Text>
          <Text style={[type.sub, { marginTop: 2 }]}>{v}</Text>
        </Card>
      ))}

      <View style={styles.sectionHead}>
        <Text style={type.h2}>Pages we checked</Text>
        <Text style={type.sub}>{rows.length} entries</Text>
      </View>

      {rows.map((r, i) => (
        <Card key={`${r.partId}-${i}`} style={{ marginBottom: space(3) }}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{r.partNo}</Text>
            <Badge tone={r.grade === 'explicit' ? 'confirmed' : 'neutral'}>{r.grade === 'explicit' ? 'Model list' : r.grade === 'rule' ? 'Series rule' : 'Part facts'}</Badge>
          </View>
          <Text style={[type.sub, { marginTop: 2 }]}>{r.brand} · {r.publisher} · checked {r.retrievedAt}</Text>
          <Text style={[type.sub, { marginTop: space(2), fontStyle: 'italic' }]}>{r.quote}</Text>
          <Pressable onPress={() => r.url && Linking.openURL(r.url)} style={{ marginTop: space(2) }}>
            <Text style={[type.mono, styles.link]} numberOfLines={1}>{r.url}</Text>
          </Pressable>
        </Card>
      ))}

      {conflictNote() ? (
        <Card style={{ backgroundColor: colors.warnSoft, borderColor: colors.warn }}>
          <Text style={styles.conflictTitle}>Conflict policy</Text>
          <Text style={[type.sub, { marginTop: space(2) }]}>{conflictNote()}</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

/** One line per known conflict, phrased for the store listing's promise: we never merge. */
function gradeLabel(k) {
  return { explicit: "Model list", rule: "Series rule", part_only: "Part facts", third_party: "Third-party chart" }[k] || k;
}

function conflictNote() {
  return 'When two manufacturer pages disagree, both are shown with the page each came from and never merged into one claim.';
}

/* ------------------------------------------------------------------ app */

const navTheme = {
  dark: false,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.ink,
    border: colors.line,
    notification: colors.accent,
  },
  fonts: { regular: { fontFamily: 'System', fontWeight: '400' }, medium: { fontFamily: 'System', fontWeight: '500' }, bold: { fontFamily: 'System', fontWeight: '700' }, heavy: { fontFamily: 'System', fontWeight: '800' } },
};

export default function App() {
  // Looping screenshot tour: five product screens, 6s each, so a CI capture pass
  // always lands on every screen no matter how slow the screenshot command is.
  useEffect(() => {
    if (!SHOTS) return undefined;
    const steps = [
      { screen: 'Home' },
      { screen: 'Result', params: { query: 'RF28K9070SR/AA', mode: 'model' } },
      { screen: 'Result', params: { query: 'XWFE', mode: 'part' } },
      { screen: 'Detail', params: { id: 1 } },
      { screen: 'Sources' },
    ];
    let i = 0;
    let timer;
    const tick = () => {
      const s = steps[i % steps.length];
      i += 1;
      if (navRef.isReady()) {
        if (s.screen === 'Home') navRef.navigate('Home');
        else navRef.navigate(s.screen, s.params);
      }
      timer = setTimeout(tick, 6000);
    };
    timer = setTimeout(tick, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer theme={navTheme} linking={linking} ref={navRef}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: '600' },
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Scan', headerShown: false }} />
          <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Result' }} />
          <Stack.Screen name="AddAppliance" component={AddApplianceScreen} options={{ title: 'New appliance' }} />
          <Stack.Screen name="Detail" component={DetailScreen} options={{ title: 'Appliance' }} />
          <Stack.Screen name="Lookup" component={LookupScreen} options={{ title: 'Find by number' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          <Stack.Screen name="Sources" component={SourcesScreen} options={{ title: 'Sources' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...type.sub, letterSpacing: 1.5, fontWeight: '700', color: colors.accent, marginBottom: space(2) },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: space(4), borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: space(2), paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  primary: { borderRadius: 14, paddingVertical: space(3.5), alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 16, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: space(3) },
  actionTile: { flex: 1, borderRadius: 18, padding: space(4), minHeight: 108, justifyContent: 'space-between' },
  actionTileTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  actionTileSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17, marginTop: space(2) },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space(6), marginBottom: space(3) },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  kvLabel: { ...type.sub },
  kvValue: { ...type.body, fontWeight: '600' },
  fieldLabel: { ...type.sub, marginBottom: space(2) },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: space(4), paddingVertical: space(3), fontSize: 16, color: colors.ink },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', padding: space(6) },
  cameraHint: { color: '#FFF', fontSize: 15, fontWeight: '600', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: space(3), borderRadius: 12 },
  scanBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space(5), gap: space(3), backgroundColor: 'rgba(247,248,247,0.96)' },
  sourceRow: { marginTop: space(3), paddingTop: space(2), borderTopWidth: 1, borderTopColor: colors.line },
  conflictBox: { marginTop: space(3), backgroundColor: colors.warnSoft, borderRadius: 12, padding: space(3) },
  conflictTitle: { fontSize: 13, fontWeight: '700', color: colors.warn },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  footerLinks: { marginTop: space(6), alignItems: 'center' },
});





