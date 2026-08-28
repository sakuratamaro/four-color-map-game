import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Four Color Map Game' }} />
      <Stack.Screen name="battle" options={{ title: 'Local Battle' }} />
      <Stack.Screen name="quiz" options={{ title: 'Math Quiz' }} />
      <Stack.Screen name="gacha" options={{ title: 'Gacha' }} />
      <Stack.Screen name="cards" options={{ title: 'Skill Cards' }} />
    </Stack>
  );
}
