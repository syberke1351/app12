import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Dimensions } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, CircleCheck as CheckCircle, Circle as XCircle, Clock, User, ChartBar as BarChart3 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'hadir' | 'tidak_hadir' | 'izin';
  noted_by?: string;
  created_at: string;
}

interface AttendanceStats {
  totalDays: number;
  hadirCount: number;
  izinCount: number;
  tidakHadirCount: number;
  percentage: number;
}

export default function AbsensiScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalDays: 0,
    hadirCount: 0,
    izinCount: 0,
    tidakHadirCount: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendanceData = async () => {
    if (!profile) return;

    try {
      let studentId = profile.id;
      
      // If parent, get first child's attendance
      if (profile.role === 'ortu') {
        const { data: childrenData } = await supabase
          .from('users')
          .select('id')
          .eq('organize_id', profile.organize_id)
          .eq('role', 'siswa')
          .limit(1);
        
        if (childrenData && childrenData.length > 0) {
          studentId = childrenData[0].id;
        } else {
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Error fetching attendance:', error);
        return;
      }

      const records = data || [];
      setAttendanceRecords(records);

      // Calculate stats
      const totalDays = records.length;
      const hadirCount = records.filter(r => r.status === 'hadir').length;
      const izinCount = records.filter(r => r.status === 'izin').length;
      const tidakHadirCount = records.filter(r => r.status === 'tidak_hadir').length;
      const percentage = totalDays > 0 ? Math.round((hadirCount / totalDays) * 100) : 0;

      setStats({
        totalDays,
        hadirCount,
        izinCount,
        tidakHadirCount,
        percentage,
      });
    } catch (error) {
      console.error('Error in fetchAttendanceData:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAttendanceData();
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [profile]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hadir': return '#10B981';
      case 'izin': return '#F59E0B';
      case 'tidak_hadir': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'hadir': return CheckCircle;
      case 'izin': return Clock;
      case 'tidak_hadir': return XCircle;
      default: return Calendar;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'hadir': return 'Hadir';
      case 'izin': return 'Izin';
      case 'tidak_hadir': return 'Tidak Hadir';
      default: return status;
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View 
        entering={FadeInUp.delay(100)}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerIcon}>
            <Calendar size={32} color="white" />
          </View>
          <Text style={styles.headerTitle}>Absensi</Text>
          <Text style={styles.headerSubtitle}>
            {profile?.role === 'ortu' ? 'Pantau kehadiran anak' : 'Riwayat kehadiran Anda'}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* Stats Cards */}
      <Animated.View entering={FadeInUp.delay(200)} style={styles.statsContainer}>
        <View style={styles.statCard}>
          <BarChart3 size={20} color="#8B5CF6" />
          <Text style={styles.statNumber}>{stats.percentage}%</Text>
          <Text style={styles.statLabel}>Persentase Hadir</Text>
        </View>
        <View style={styles.statCard}>
          <CheckCircle size={20} color="#10B981" />
          <Text style={styles.statNumber}>{stats.hadirCount}</Text>
          <Text style={styles.statLabel}>Hadir</Text>
        </View>
        <View style={styles.statCard}>
          <Clock size={20} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats.izinCount}</Text>
          <Text style={styles.statLabel}>Izin</Text>
        </View>
      </Animated.View>

      {/* Summary Card */}
      <Animated.View entering={FadeInUp.delay(300)} style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Ringkasan Kehadiran</Text>
        <View style={styles.summaryContent}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Hari</Text>
            <Text style={styles.summaryValue}>{stats.totalDays}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Tidak Hadir</Text>
            <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{stats.tidakHadirCount}</Text>
          </View>
        </View>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Tingkat Kehadiran</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${stats.percentage}%`,
                  backgroundColor: stats.percentage >= 80 ? '#10B981' : 
                                  stats.percentage >= 60 ? '#F59E0B' : '#EF4444'
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{stats.percentage}% dari {stats.totalDays} hari</Text>
        </View>
      </Animated.View>

      {/* Attendance Records */}
      <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
        <Text style={styles.sectionTitle}>Riwayat Absensi</Text>
        {attendanceRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Belum ada data absensi</Text>
            <Text style={styles.emptySubtext}>Data absensi akan muncul setelah ada setoran</Text>
          </View>
        ) : (
          <View style={styles.attendanceList}>
            {attendanceRecords.map((record, index) => {
              const StatusIcon = getStatusIcon(record.status);
              return (
                <Animated.View 
                  key={record.id} 
                  entering={FadeInDown.delay(index * 50)}
                  style={styles.attendanceCard}
                >
                  <View style={styles.attendanceDate}>
                    <Calendar size={16} color="#6B7280" />
                    <Text style={styles.attendanceDateText}>
                      {new Date(record.date).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                  
                  <View style={styles.attendanceStatus}>
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: getStatusColor(record.status) + '20' }
                    ]}>
                      <StatusIcon size={16} color={getStatusColor(record.status)} />
                      <Text style={[
                        styles.statusText, 
                        { color: getStatusColor(record.status) }
                      ]}>
                        {getStatusText(record.status)}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}
      </Animated.View>

      {/* Info Card */}
      <Animated.View entering={FadeInUp.delay(500)} style={styles.infoCard}>
        <Text style={styles.infoTitle}>Informasi Absensi</Text>
        <Text style={styles.infoText}>
          • Absensi otomatis tercatat saat mengirim setoran{'\n'}
          • Status "Hadir" jika ada setoran di hari tersebut{'\n'}
          • Guru dapat mengubah status menjadi "Izin" jika diperlukan{'\n'}
          • Pantau kehadiran untuk evaluasi pembelajaran
        </Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  headerGradient: {
    paddingHorizontal: Math.max(24, width * 0.05),
    paddingBottom: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerIcon: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: Math.min(28, width * 0.07),
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: Math.min(16, width * 0.04),
    color: 'white',
    opacity: 0.9,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Math.max(16, width * 0.04),
    paddingVertical: 20,
    gap: Math.max(12, width * 0.03),
    marginTop: -16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Math.max(16, width * 0.04),
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statNumber: {
    fontSize: Math.min(20, width * 0.05),
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: Math.min(12, width * 0.03),
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: 'white',
    marginHorizontal: Math.max(16, width * 0.04),
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  progressContainer: {
    gap: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginHorizontal: Math.max(16, width * 0.04),
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: Math.min(20, width * 0.05),
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Math.max(40, width * 0.1),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyText: {
    fontSize: Math.min(18, width * 0.045),
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: Math.min(14, width * 0.035),
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  attendanceList: {
    gap: 12,
  },
  attendanceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  attendanceDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  attendanceDateText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  attendanceStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'white',
    marginHorizontal: Math.max(16, width * 0.04),
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});