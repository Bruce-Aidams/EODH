import { Stack } from 'expo-router';

export default function BookLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="[id]/reader" />
      <Stack.Screen name="[id]/audio" />
      <Stack.Screen name="[id]/sync" />
    </Stack>
  );
}
