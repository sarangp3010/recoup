import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { runHrv } from '@recoup/algorithms';

// Smoke-test the shared @recoup/algorithms package from the app.
const hrv = runHrv({
  start_time: '2026-01-01T00:00:00Z',
  end_time: '2026-01-01T00:01:00Z',
  rr_intervals_ms: [800, 810, 790, 800],
});

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recoup</Text>
      <Text style={styles.subtitle}>Sample HRV ({hrv.algorithm_id})</Text>
      <Text style={styles.metric}>RMSSD {hrv.rmssd_ms.toFixed(1)} ms</Text>
      <Text style={styles.metric}>SDNN {hrv.sdnn_ms.toFixed(1)} ms</Text>
      <Text style={styles.metric}>Mean NN {hrv.mean_nn_ms.toFixed(0)} ms</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  metric: {
    fontSize: 18,
  },
});
