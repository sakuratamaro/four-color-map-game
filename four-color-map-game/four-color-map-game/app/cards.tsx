import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SKILL_CARD_DEFINITIONS } from '@/cards/skillCardDefinitions';

export default function CardsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Skill cards — draft catalog</Text>
      {SKILL_CARD_DEFINITIONS.map((card) => (
        <View key={card.id} style={styles.card}>
          <Text style={styles.name}>{card.nameJa}</Text>
          <Text>{card.category} / {card.allowedPhase}</Text>
          <Text>{card.descriptionJa}</Text>
          <Text style={styles.provisional}>Rarity: provisional ★{card.prototypeRarity}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  heading: { fontSize: 22, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 6 },
  name: { fontSize: 18, fontWeight: '700' },
  provisional: { opacity: 0.6 },
});
