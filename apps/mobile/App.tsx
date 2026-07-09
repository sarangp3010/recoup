import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { runHrv } from '@recoup/algorithms';

const hrv = runHrv({
  start_time: '2026-01-01T00:00:00Z',
  end_time: '2026-01-01T00:01:00Z',
  rr_intervals_ms: [800, 810, 790, 800],
});

const recoveryScore = 78;
const strainScore = 12.4;
const sleepPerformance = 91;

const overviewMetrics = [
  { label: 'HRV', value: `${hrv.rmssd_ms.toFixed(1)} ms`, tone: 'good' },
  { label: 'Resting HR', value: '54 bpm', tone: 'steady' },
  { label: 'Respiratory', value: '14.8 rpm', tone: 'steady' },
];

const timeline = [
  { time: '6:10 AM', title: 'Recovery calculated', detail: 'Strong balance across HRV, strain, and sleep.' },
  { time: '7:30 AM', title: 'Suggested strain', detail: 'Target a moderate effort day and protect sleep debt.' },
  { time: 'Now', title: 'Daily focus', detail: 'Hydrate early and keep workouts below all-out intensity.' },
];

function ScoreRing({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <View style={styles.ringWrap}>
      <View style={[styles.ringOuter, { borderColor: `${accent}33` }]}>
        <View style={[styles.ringInner, { borderColor: accent }]}>
          <Text style={styles.ringValue}>{value}</Text>
          <Text style={styles.ringLabel}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View>
            <Text style={styles.eyebrow}>RECOVERY</Text>
            <Text style={styles.title}>Recoup</Text>
            <Text style={styles.subtitle}>
              A calmer, Whoop-inspired read on how ready your body feels today.
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.recoveryCard}>
          <View style={styles.recoveryHeader}>
            <View>
              <Text style={styles.sectionLabel}>Today</Text>
              <Text style={styles.recoveryTitle}>Ready for a solid day</Text>
            </View>
            <Text style={styles.recoveryTrend}>+6 vs yesterday</Text>
          </View>

          <View style={styles.recoveryBody}>
            <ScoreRing value={recoveryScore} label="Recovery" accent="#7CFFB2" />

            <View style={styles.recoveryFacts}>
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Sleep performance</Text>
                <Text style={styles.factValue}>{sleepPerformance}%</Text>
              </View>
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Day strain target</Text>
                <Text style={styles.factValue}>{strainScore}</Text>
              </View>
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Algorithm</Text>
                <Text style={styles.factValue}>{hrv.algorithm_id}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={[styles.card, styles.gridCard]}>
            <Text style={styles.cardLabel}>Sleep coach</Text>
            <Text style={styles.cardValue}>8h 12m</Text>
            <Text style={styles.cardHint}>Recommended tonight to stay in the green.</Text>
          </View>

          <View style={[styles.card, styles.gridCard]}>
            <Text style={styles.cardLabel}>Strain coach</Text>
            <Text style={styles.cardValue}>12.4</Text>
            <Text style={styles.cardHint}>Push enough to adapt, not enough to flatten recovery.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Vitals</Text>
          <View style={styles.metricsRow}>
            {overviewMetrics.map((metric) => (
              <View key={metric.label} style={styles.metricTile}>
                <View
                  style={[
                    styles.metricDot,
                    metric.tone === 'good' ? styles.metricDotGood : styles.metricDotSteady,
                  ]}
                />
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Daily briefing</Text>
          {timeline.map((item) => (
            <View key={item.time} style={styles.timelineRow}>
              <View style={styles.timelineStamp}>
                <Text style={styles.timelineTime}>{item.time}</Text>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{item.title}</Text>
                <Text style={styles.timelineDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07111A',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 18,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 8,
  },
  eyebrow: {
    color: '#6E8194',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  title: {
    color: '#F4F8FB',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9FB0BE',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
  },
  badge: {
    backgroundColor: '#102433',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#7CFFB2',
    fontSize: 12,
    fontWeight: '700',
  },
  recoveryCard: {
    backgroundColor: '#0D1B27',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: '#163142',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  recoveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  sectionLabel: {
    color: '#7E93A5',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  recoveryTitle: {
    color: '#F4F8FB',
    fontSize: 22,
    fontWeight: '700',
  },
  recoveryTrend: {
    color: '#7CFFB2',
    fontSize: 13,
    fontWeight: '700',
    paddingTop: 4,
  },
  recoveryBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  ringWrap: {
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A1620',
  },
  ringInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#08121A',
  },
  ringValue: {
    color: '#F7FBFD',
    fontSize: 36,
    fontWeight: '800',
  },
  ringLabel: {
    color: '#8BA1B2',
    fontSize: 13,
    fontWeight: '600',
  },
  recoveryFacts: {
    flex: 1,
    gap: 14,
  },
  factRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#163142',
    paddingBottom: 10,
  },
  factLabel: {
    color: '#8BA1B2',
    fontSize: 13,
    marginBottom: 4,
  },
  factValue: {
    color: '#F4F8FB',
    fontSize: 18,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    gap: 14,
  },
  gridCard: {
    flex: 1,
    minHeight: 150,
  },
  card: {
    backgroundColor: '#0B1620',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#122635',
  },
  cardLabel: {
    color: '#8AA0B1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
  },
  cardValue: {
    color: '#F4F8FB',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
  },
  cardHint: {
    color: '#94A8B8',
    fontSize: 14,
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  metricTile: {
    flex: 1,
    backgroundColor: '#0F202D',
    borderRadius: 18,
    padding: 14,
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  metricDotGood: {
    backgroundColor: '#7CFFB2',
  },
  metricDotSteady: {
    backgroundColor: '#5EB7FF',
  },
  metricLabel: {
    color: '#8BA1B2',
    fontSize: 12,
    marginBottom: 6,
  },
  metricValue: {
    color: '#F6FBFD',
    fontSize: 18,
    fontWeight: '700',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 10,
  },
  timelineStamp: {
    width: 64,
    paddingTop: 2,
  },
  timelineTime: {
    color: '#7E93A5',
    fontSize: 12,
    fontWeight: '700',
  },
  timelineContent: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: '#1B384B',
    paddingLeft: 14,
  },
  timelineTitle: {
    color: '#F4F8FB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  timelineDetail: {
    color: '#94A8B8',
    fontSize: 14,
    lineHeight: 20,
  },
});
