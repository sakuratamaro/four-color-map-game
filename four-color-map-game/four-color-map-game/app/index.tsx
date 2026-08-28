import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

const links = [
  ['/battle', 'Local Battle Prototype'],
  ['/quiz', 'Math Quiz Prototype'],
  ['/gacha', 'Gacha Prototype'],
  ['/cards', 'Skill Card Catalog'],
] as const;

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Four Color Map Game</Text>
      <Text style={styles.subtitle}>Create the region your opponent must color.</Text>
      <View style={styles.menu}>
        {links.map(([href, label]) => (
          <Link key={href} href={href} style={styles.link}>
            {label}
          </Link>
        ))}
      </View>
      <Text style={styles.note}>Prototype scaffold — rules first, online later.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16 },
  menu: { gap: 12, marginTop: 12 },
  link: { fontSize: 18, paddingVertical: 10 },
  note: { marginTop: 20, opacity: 0.6 },
});
