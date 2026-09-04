import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomePersonalBriefing } from '@/components/home-personal-briefing';
import HomeScreenV3 from '@/screens/home-screen-v3';

export default function HomeScreenV4() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.briefing, { paddingTop: insets.top }]}> 
        <HomePersonalBriefing />
      </View>
      <View style={styles.existingHome}>
        <HomeScreenV3 />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  briefing: {
    zIndex: 2,
    backgroundColor: '#05070B',
  },
  existingHome: {
    flex: 1,
    minHeight: 0,
  },
});
