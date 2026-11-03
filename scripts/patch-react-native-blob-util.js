/**
 * Patches react-native-blob-util build.gradle to fix ProGuard deprecation on Gradle 10+.
 *
 * The package uses getDefaultProguardFile('proguard-android.txt') which was removed
 * in newer Android Gradle Plugin versions. This script replaces it with the optimized
 * version before the Gradle build runs.
 *
 * Run via: node scripts/patch-react-native-blob-util.js
 */

const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-blob-util',
  'android',
  'build.gradle'
);

if (!fs.existsSync(buildGradlePath)) {
  console.log('react-native-blob-util build.gradle not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

if (content.includes("getDefaultProguardFile('proguard-android.txt')")) {
  content = content.replace(
    "getDefaultProguardFile('proguard-android.txt')",
    "getDefaultProguardFile('proguard-android-optimize.txt')"
  );
  fs.writeFileSync(buildGradlePath, content, 'utf8');
  console.log('Patched react-native-blob-util build.gradle: fixed ProGuard deprecation.');
} else {
  console.log('react-native-blob-util build.gradle already patched or not needed.');
}
