/**
 * Patches build.gradle files to fix ProGuard deprecation on Gradle 10+.
 *
 * Some packages use getDefaultProguardFile('proguard-android.txt') which was removed
 * in newer Android Gradle Plugin versions. This script replaces it with the optimized
 * version before the Gradle build runs.
 *
 * Run via: node scripts/patch-react-native-blob-util.js
 */

const fs = require('fs');
const path = require('path');

const packagesToPatch = [
  'react-native-blob-util',
  'react-native-pdf-jsi',
];

let patched = false;

for (const pkg of packagesToPatch) {
  const buildGradlePath = path.join(
    __dirname,
    '..',
    'node_modules',
    pkg,
    'android',
    'build.gradle'
  );

  if (!fs.existsSync(buildGradlePath)) {
    console.log(`${pkg} build.gradle not found, skipping.`);
    continue;
  }

  let content = fs.readFileSync(buildGradlePath, 'utf8');

  if (content.includes("getDefaultProguardFile('proguard-android.txt')")) {
    content = content.replace(
      "getDefaultProguardFile('proguard-android.txt')",
      "getDefaultProguardFile('proguard-android-optimize.txt')"
    );
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log(`Patched ${pkg} build.gradle: fixed ProGuard deprecation.`);
    patched = true;
  } else {
    console.log(`${pkg} build.gradle already patched or not needed.`);
  }
}

if (!patched) {
  console.log('No patches were needed.');
}
