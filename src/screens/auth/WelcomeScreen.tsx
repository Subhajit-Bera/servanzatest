import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Platform } from 'react-native';
import { Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SHADOWS } from '../../config/theme';

import { StatusBar } from 'expo-status-bar';

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <StatusBar style="light" backgroundColor="transparent" translucent />

      {/* Remove 'top' from edges to let image go behind status bar */}
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.container} bounces={false} overScrollMode="never">
          <View style={styles.imageContainer}>
            {/* Replace with your actual image asset */}
            <Image
              source={require('../../assets/homeimage.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Be our partner and Let's grow together</Text>
            <Text style={styles.subtitle}>
              Join with us and get a monthly stable income. Transform your future as a Servanza Buddy.
            </Text>

            <Button
              mode="contained"
              onPress={() => navigation.navigate('Login')}
              style={[styles.button, SHADOWS.green]}
              labelStyle={styles.btnLabel}
            >
              Create Account
            </Button>

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>Why become a Servanza Buddy?</Text>
              <InfoItem title="Stable Monthly Income" desc="Earn consistently every month." />
              <InfoItem title="Growing Community" desc="Join a thriving network of partners." />
              <InfoItem title="Trusted Partnership" desc="Reliable and transparent ecosystem." />
            </View>

            <View style={styles.getStartedContainer}>
              <Text style={styles.readyText}>Ready to start earning?</Text>
              <Button
                mode="outlined"
                onPress={() => navigation.navigate('Login')}
                style={styles.outlineBtn}
                textColor={COLORS.primary}
              >
                Get Started Now →
              </Button>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const InfoItem = ({ title, desc }: { title: string, desc: string }) => (
  <View style={styles.infoItem}>
    <View style={styles.bullet} />
    <View>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.itemDesc}>{desc}</Text>
    </View>
  </View>
)

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  container: { flexGrow: 1, backgroundColor: COLORS.white },
  imageContainer: { height: 350, overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  heroImage: { width: '100%', height: '100%' },
  content: { padding: 24 },
  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.charcoal, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, color: COLORS.mediumGray, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  button: { borderRadius: 12, backgroundColor: COLORS.primary, paddingVertical: 6 },
  btnLabel: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  infoSection: { marginTop: 30 },
  infoTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  infoItem: { flexDirection: 'row', marginBottom: 15 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6, marginRight: 10 },
  itemTitle: { fontWeight: 'bold', fontSize: 16 },
  itemDesc: { color: COLORS.mediumGray, fontSize: 13 },
  getStartedContainer: { marginTop: 20, backgroundColor: '#E8F8F5', padding: 20, borderRadius: 16, alignItems: 'center' },
  readyText: { fontSize: 18, fontWeight: 'bold', color: COLORS.darkGreen, marginBottom: 10 },
  outlineBtn: { borderColor: COLORS.primary, borderWidth: 1, width: '100%' }
});