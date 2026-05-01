import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator,TouchableOpacity } from 'react-native';
import { Button, Checkbox, List, Searchbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buddyApi } from '../../api/client';
import { COLORS, SHADOWS } from '../../config/theme';
import { restoreSession } from '../../store/slices/authSlice';
import { RootState } from '../../store';

export default function ServiceSelectionScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<any>();

  const { profile } = useSelector((state: RootState) => state.buddy);

  const [services, setServices] = useState<any[]>([]); // Data from Backend
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch available services & Pre-select existing ones
  useEffect(() => {
    const init = async () => {
      try {
        // Fetch all services from backend
        const res = await buddyApi.getAllServices();
        const allServices = res.data.data;
        setServices(allServices);

        // Pre-select if profile has services
        if (profile && profile.services) {
          const existingIds = profile.services.map((s: any) => s.id);
          setSelectedIds(existingIds);
        }
      } catch (error) {
        console.error("Failed to load services", error);
        // Alert.alert("Error", "Could not load services."); 
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [profile]);

  const toggleService = (serviceId: string) => {
    if (selectedIds.includes(serviceId)) {
      setSelectedIds(selectedIds.filter(id => id !== serviceId));
    } else {
      setSelectedIds([...selectedIds, serviceId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === services.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(services.map(s => s.id));
    }
  };

  const filteredServices = services.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFinish = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one service.');
      return;
    }

    try {
      setSubmitting(true);
      // Send IDs to backend 
      await buddyApi.updateSkills(selectedIds);

      await dispatch(restoreSession());

      if (navigation.canGoBack()) {
        Alert.alert("Success", "Services Updated");
        navigation.goBack();
      } else {
        // Onboarding flow fallback
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save services.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Select Services</Text>
      <Text style={styles.subtitle}>Choose the services you are expert in.</Text>

      <Searchbar
        placeholder="Search..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
        elevation={0}
      />

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={handleSelectAll} style={{ paddingVertical: 8, paddingRight: 8 }}>
          <Text style={{ color: COLORS.primary, fontWeight: '500', fontSize: 14 }}>
            {selectedIds.length === services.length ? "Deselect All" : "Select All"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.countText}>{selectedIds.length} Selected</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {filteredServices.map((service) => (
          <List.Item
            key={service.id}
            title={service.title}
            description={`Category: ${service.category?.name || 'General'}`}
            onPress={() => toggleService(service.id)}
            right={() => (
              <Checkbox
                status={selectedIds.includes(service.id) ? 'checked' : 'unchecked'}
                color={COLORS.primary}
                onPress={() => toggleService(service.id)}
              />
            )}
            style={[
              styles.item,
              selectedIds.includes(service.id) && styles.selectedItem
            ]}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleFinish}
          loading={submitting}
          style={[styles.button, SHADOWS.green]}
          contentStyle={{ height: 50 }}
        >
          Save & Continue
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.charcoal, paddingHorizontal: 20, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.mediumGray, paddingHorizontal: 20, marginBottom: 10 },
  searchBar: { marginHorizontal: 20, marginBottom: 10, backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#eee' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  countText: { color: COLORS.mediumGray, fontWeight: 'bold' },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  item: { backgroundColor: COLORS.white, marginBottom: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  selectedItem: { borderColor: COLORS.primary, backgroundColor: '#E8F8F5' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, padding: 20,
    ...SHADOWS.heavy, borderTopLeftRadius: 20, borderTopRightRadius: 20
  },
  button: { borderRadius: 12, backgroundColor: COLORS.primary },
});