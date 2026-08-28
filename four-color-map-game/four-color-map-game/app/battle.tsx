import { StyleSheet, Text, View } from 'react-native';
import { BoardCanvas } from '@/board/BoardCanvas';
import { GAME_CONFIG } from '@/config/gameConfig';

export default function BattleScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Local battle scaffold</Text>
      <Text>Board: {GAME_CONFIG.boardWidth} × {GAME_CONFIG.boardHeight}</Text>
      <View style={styles.boardWrap}>
        <BoardCanvas rows={GAME_CONFIG.boardHeight} columns={GAME_CONFIG.boardWidth} size={320} />
      </View>
      <Text style={styles.note}>
        Touch interaction and full turn state are intentionally not wired yet. Core rule functions live under src/game.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700' },
  boardWrap: { alignItems: 'center', marginVertical: 12 },
  note: { opacity: 0.65, lineHeight: 20 },
});
