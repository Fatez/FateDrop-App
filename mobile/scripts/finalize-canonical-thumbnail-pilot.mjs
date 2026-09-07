import fs from 'node:fs';

for (const path of ['mobile/screens/fate-collection-browser-screen.tsx', 'mobile/screens/fate-graded-collection-screen.tsx']) {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes('<Image')) text = text.replace("import { Image } from 'expo-image';\n", '');
  fs.writeFileSync(path, text);
}

{
  const path = 'mobile/screens/fate-collection-browser-screen.tsx';
  let text = fs.readFileSync(path, 'utf8');
  const helper = 'function CardPlaceholder() { return <View style={styles.cardArtPlaceholder}><Ionicons name="sparkles-outline" size={18} color={FateDropColors.echo} /></View>; }\n\n';
  if (!text.includes('<CardPlaceholder')) text = text.replace(helper, '');
  fs.writeFileSync(path, text);
}

console.log('Canonical thumbnail cleanup complete.');
