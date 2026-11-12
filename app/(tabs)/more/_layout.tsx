import { Stack } from 'expo-router';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="history" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="downloads" />
      <Stack.Screen name="reading-settings" />
      <Stack.Screen name="audio-settings" />
      <Stack.Screen name="voice-selection" />
      <Stack.Screen name="help" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
