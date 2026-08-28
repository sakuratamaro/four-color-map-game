import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { GACHA_CONFIG } from '@/config/gachaConfig';
import { drawRarity } from '@/gacha/draw';

export default function GachaScreen() {
  const [result, setResult] = useState<string>('');
  const draw = () => {
    const rarity = drawRarity(GACHA_CONFIG.rarityWeightsByQuizLevel[1], Math.random);
    setResult(`★${rarity}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Gacha prototype</Text>
      <Text>Uses provisional Level 1 rarity weights.</Text>
      <Button title="Draw once" onPress={draw} />
      <Text style={styles.result}>{result}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  heading: { fontSize: 22, fontWeight: '700' },
  result: { fontSize: 36, fontWeight: '700' },
});
