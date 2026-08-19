import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AbstractHero, FateDropBackground } from '@/components/fatedrop-ui';
import { FateDropColors } from '@/constants/theme';

export default function ModalScreen(){return <SafeAreaView style={styles.safe}><FateDropBackground/><View style={styles.content}><AbstractHero eyebrow="FateDrop" title="The signal stays with you." subtitle="Return to the live dashboard and keep watching the market." icon="radio"/><Pressable onPress={()=>router.dismissTo('/')} style={({pressed})=>[styles.button,pressed&&styles.pressed]}><Ionicons name="home" size={18} color={FateDropColors.text}/><Text style={styles.buttonText}>Return home</Text></Pressable></View></SafeAreaView>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:FateDropColors.background},content:{flex:1,justifyContent:'center',padding:20},button:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,backgroundColor:FateDropColors.violet,borderWidth:1,borderColor:FateDropColors.violetLight,borderRadius:16,paddingVertical:15},buttonText:{color:FateDropColors.text,fontSize:14,fontWeight:'800'},pressed:{opacity:.8,transform:[{scale:.98}]}});
