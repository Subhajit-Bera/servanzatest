import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootState } from '../../store';
import { buddyApi } from '../../api/client';
import { restoreSession } from '../../store/slices/authSlice';
import { COLORS, SHADOWS } from '../../config/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TrainingSelectionScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch<any>();
  const { user } = useSelector((state: RootState) => state.auth);

  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  useEffect(() => {
    // Calculate next 3 consecutive days from verification date OR today if not verified yet
    let baseDate: Date;

    if (user?.verifiedAt) {
      baseDate = new Date(user.verifiedAt);
    } else {
      // Fallback to today if verifiedAt is not available
      baseDate = new Date();
    }
    baseDate.setHours(0, 0, 0, 0);

    const dates: Date[] = [];
    for (let i = 1; i <= 3; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    setAvailableDates(dates);

    // Pre-select first available date
    if (dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[0]);
    }
  }, [user]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      Alert.alert('Required', 'Please select a training start date.');
      return;
    }

    try {
      setLoading(true);
      await buddyApi.selectTrainingStartDate(selectedDate.toISOString());

      // Refresh session
      await dispatch(restoreSession());
      // Your training has started.
      Alert.alert('Success', 'Training start date selected successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to select training date');
    } finally {
      setLoading(false);
    }
  };

  if (!user?.isVerified) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="alert-circle" size={60} color={COLORS.warning} />
        <Text style={styles.title}>Verification Required</Text>
        <Text style={styles.sub}>
          Please complete verification before selecting training date.
        </Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.offWhite }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Select Training Start Date</Text>
        <Text style={styles.subtitle}>
          Choose a date to start your 5-day training program. You can select from the next 3 consecutive days.
        </Text>

        <View style={[styles.card, SHADOWS.medium]}>
          <Text style={styles.label}>Training Start Date <Text style={{ color: 'red' }}>*</Text></Text>

          {/* Date Selection Buttons */}
          {availableDates.length > 0 ? (
            <View style={styles.dateButtonsContainer}>
              {availableDates.map((date, index) => {
                const isSelected = selectedDate &&
                  selectedDate.toISOString().split('T')[0] === date.toISOString().split('T')[0];
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateOptionButton,
                      isSelected && styles.dateOptionButtonSelected
                    ]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text style={[
                      styles.dateOptionDay,
                      isSelected && styles.dateOptionTextSelected
                    ]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={[
                      styles.dateOptionDate,
                      isSelected && styles.dateOptionTextSelected
                    ]}>
                      {date.getDate()}
                    </Text>
                    <Text style={[
                      styles.dateOptionMonth,
                      isSelected && styles.dateOptionTextSelected
                    ]}>
                      {date.toLocaleDateString('en-US', { month: 'short' })}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={COLORS.white}
                        style={styles.checkIcon}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noDateText}>Loading available dates...</Text>
          )}

          {selectedDate && (
            <View style={styles.selectedDateContainer}>
              <Text style={styles.selectedDateText}>
                Selected: {formatDate(selectedDate)}
              </Text>
            </View>
          )}

          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Training Information:</Text>
            <Text style={styles.infoText}>• Training duration: 5 days</Text>
            <Text style={styles.infoText}>• Servanza can extend training days if needed</Text>
            <Text style={styles.infoText}>• Job start date will be assigned by Servanza after training completion</Text>
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={!selectedDate}
            style={[styles.button, SHADOWS.green]}
            contentStyle={{ height: 50 }}
          >
            Confirm Training Date
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            textColor={COLORS.mediumGray}
            style={{ marginTop: 10 }}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.offWhite,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: COLORS.mediumGray,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.mediumGray,
    marginBottom: 24,
    lineHeight: 22,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    color: COLORS.charcoal,
  },
  dateButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateOptionButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateOptionButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateOptionDay: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumGray,
    marginBottom: 4,
  },
  dateOptionDate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
  dateOptionMonth: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 4,
  },
  dateOptionTextSelected: {
    color: COLORS.white,
  },
  checkIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  noDateText: {
    textAlign: 'center',
    color: COLORS.mediumGray,
    marginVertical: 20,
  },
  selectedDateContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
  },
  selectedDateText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.charcoal,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.mediumGray,
    marginBottom: 4,
    lineHeight: 20,
  },
  button: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
});
