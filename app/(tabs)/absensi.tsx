import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Dimensions, Alert, Modal, TextInput } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, CircleCheck as CheckCircle, Circle as XCircle, Clock, User, ChartBar as BarChart3, MapPin, Download, Filter, X, FileText } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'hadir' | 'tidak_hadir' | 'izin';
  noted_by?: string;
  created_at: string;
  student?: {
    name: string;
  };
}

interface AttendanceStats {
  totalDays: number;
  hadirCount: number;
  izinCount: number;
  tidakHadirCount: number;
  percentage: number;
}

interface StudentAttendance {
  id: string;
  name: string;
  attendanceRecords: AttendanceRecord[];
  stats: AttendanceStats;
}

export default function AbsensiScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [studentsAttendance, setStudentsAttendance] = useState<StudentAttendance[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalDays: 0,
    hadirCount: 0,
    izinCount: 0,
    tidakHadirCount: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAttendanceData = async () => {
    if (!profile) return;

    try {
      if (profile.role === 'siswa') {
        await fetchStudentAttendance();
      } else if (profile.role === 'guru' || profile.role === 'ortu') {
        await fetchClassAttendance();
      }
    } catch (error) {
      console.error('Error in fetchAttendanceData:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStudentAttendance = async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', profile?.id)
      .order('date', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching attendance:', error);
      return;
    }

    const records = data || [];
    setAttendanceRecords(records);
    calculateStats(records);
  };

  const fetchClassAttendance = async () => {
    if (!profile?.organize_id) return;

    // Get all students in the organize
    const { data: studentsData, error: studentsError } = await supabase
      .from('users')
      .select('id, name')
      .eq('organize_id', profile.organize_id)
      .eq('role', 'siswa')
      .order('name');

    if (studentsError || !studentsData) {
      console.error('Error fetching students:', studentsError);
      return;
    }

    // Get attendance records for all students
    const studentsWithAttendance = await Promise.all(
      studentsData.map(async (student) => {
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', student.id)
          .order('date', { ascending: false })
          .limit(30);

        const records = attendanceData || [];
        const stats = calculateStatsForStudent(records);

        return {
          id: student.id,
          name: student.name,
          attendanceRecords: records,
          stats,
        };
      })
    );

    setStudentsAttendance(studentsWithAttendance);
  };

  const calculateStats = (records: AttendanceRecord[]) => {
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
  };

  const calculateStatsForStudent = (records: AttendanceRecord[]): AttendanceStats => {
    const totalDays = records.length;
    const hadirCount = records.filter(r => r.status === 'hadir').length;
    const izinCount = records.filter(r => r.status === 'izin').length;
    const tidakHadirCount = records.filter(r => r.status === 'tidak_hadir').length;
    const percentage = totalDays > 0 ? Math.round((hadirCount / totalDays) * 100) : 0;

    return {
      totalDays,
      hadirCount,
      izinCount,
      tidakHadirCount,
      percentage,
    };
  };

  const exportToPDF = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Mohon pilih tanggal mulai dan selesai');
      return;
    }

    try {
      // Get attendance data for the date range
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select(`
          *,
          student:student_id(name)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) {
        Alert.alert('Error', 'Gagal mengambil data absensi');
        return;
      }

      // Create CSV content
      let csvContent = 'Tanggal,Nama Siswa,Status\n';
      
      attendanceData?.forEach(record => {
        const statusText = record.status === 'hadir' ? 'Hadir' : 
                          record.status === 'izin' ? 'Izin' : 'Tidak Hadir';
        csvContent += `${record.date},${record.student?.name || 'Unknown'},${statusText}\n`;
      });

      // Save to file
      const fileName = `absensi_${startDate}_${endDate}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Sukses', `File disimpan di: ${fileUri}`);
      }

      setShowExportModal(false);
      setStartDate('');
      setEndDate('');
    } catch (error) {
      Alert.alert('Error', 'Gagal mengekspor data');
      console.error('Export error:', error);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [profile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAttendanceData();
  };

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

  // Student View
  if (profile?.role === 'siswa') {
    return (
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
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
            <Text style={styles.headerTitle}>Absensi Saya</Text>
            <Text style={styles.headerSubtitle}>Riwayat kehadiran Anda</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.statsContainer}>
          <View style={[styles.statCard, { borderLeftColor: '#8B5CF6' }]}>
            <BarChart3 size={24} color="#8B5CF6" />
            <Text style={styles.statNumber}>{stats.percentage}%</Text>
            <Text style={styles.statLabel}>Persentase Hadir</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
            <CheckCircle size={24} color="#10B981" />
            <Text style={styles.statNumber}>{stats.hadirCount}</Text>
            <Text style={styles.statLabel}>Hadir</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
            <Clock size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>{stats.izinCount}</Text>
            <Text style={styles.statLabel}>Izin</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Riwayat Absensi</Text>
          {attendanceRecords.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Belum ada data absensi</Text>
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
                    <LinearGradient
                      colors={['#FFFFFF', '#F8FAFC']}
                      style={styles.attendanceGradient}
                    >
                      <View style={styles.attendanceDate}>
                        <Calendar size={16} color="#64748B" />
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
                    </LinearGradient>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    );
  }

  // Teacher/Parent View
  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <Animated.View 
        entering={FadeInUp.delay(100)}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <LinearGradient
          colors={['#3B82F6', '#2563EB']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerIcon}>
            <Users size={32} color="white" />
          </View>
          <Text style={styles.headerTitle}>Rekap Absensi</Text>
          <Text style={styles.headerSubtitle}>
            {profile?.role === 'guru' ? 'Kelola absensi siswa' : 'Pantau kehadiran anak'}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* Export Button */}
      <Animated.View entering={FadeInUp.delay(200)} style={styles.exportContainer}>
        <Pressable 
          style={styles.exportButton}
          onPress={() => setShowExportModal(true)}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.exportGradient}
          >
            <Download size={20} color="white" />
            <Text style={styles.exportButtonText}>Export ke CSV</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Students Attendance List */}
      <Animated.View entering={FadeInUp.delay(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>Daftar Siswa</Text>
        {studentsAttendance.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Belum ada data siswa</Text>
          </View>
        ) : (
          <View style={styles.studentsList}>
            {studentsAttendance.map((student, index) => (
              <Animated.View 
                key={student.id} 
                entering={FadeInDown.delay(index * 100)}
                style={styles.studentCard}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC']}
                  style={styles.studentGradient}
                >
                  <View style={styles.studentHeader}>
                    <View style={styles.studentInfo}>
                      <View style={styles.studentAvatar}>
                        <Text style={styles.studentInitial}>
                          {student.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.studentStats}>
                          {student.stats.percentage}% kehadiran • {student.stats.totalDays} hari
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.studentStatsRow}>
                    <View style={styles.studentStatItem}>
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.studentStatNumber}>{student.stats.hadirCount}</Text>
                      <Text style={styles.studentStatLabel}>Hadir</Text>
                    </View>
                    <View style={styles.studentStatItem}>
                      <Clock size={16} color="#F59E0B" />
                      <Text style={styles.studentStatNumber}>{student.stats.izinCount}</Text>
                      <Text style={styles.studentStatLabel}>Izin</Text>
                    </View>
                    <View style={styles.studentStatItem}>
                      <XCircle size={16} color="#EF4444" />
                      <Text style={styles.studentStatNumber}>{student.stats.tidakHadirCount}</Text>
                      <Text style={styles.studentStatLabel}>Alpa</Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${student.stats.percentage}%`,
                          backgroundColor: student.stats.percentage >= 80 ? '#10B981' : 
                                          student.stats.percentage >= 60 ? '#F59E0B' : '#EF4444'
                        }
                      ]} 
                    />
                  </View>

                  {/* Recent Attendance */}
                  <View style={styles.recentAttendance}>
                    <Text style={styles.recentTitle}>5 Hari Terakhir:</Text>
                    <View style={styles.recentDots}>
                      {student.attendanceRecords.slice(0, 5).map((record, idx) => {
                        const StatusIcon = getStatusIcon(record.status);
                        return (
                          <View 
                            key={idx}
                            style={[
                              styles.recentDot,
                              { backgroundColor: getStatusColor(record.status) + '20' }
                            ]}
                          >
                            <StatusIcon size={12} color={getStatusColor(record.status)} />
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <FileText size={24} color="#3B82F6" />
              <Text style={styles.modalTitle}>Export Data Absensi</Text>
              <Pressable onPress={() => setShowExportModal(false)}>
                <X size={24} color="#6B7280" />
              </Pressable>
            </View>
            
            <Text style={styles.modalText}>
              Pilih rentang tanggal untuk mengekspor data absensi
            </Text>

            <View style={styles.dateInputs}>
              <View style={styles.dateInputContainer}>
                <Text style={styles.dateLabel}>Tanggal Mulai</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              
              <View style={styles.dateInputContainer}>
                <Text style={styles.dateLabel}>Tanggal Selesai</Text>
                <TextInput
                  style={styles.dateInput}
                  placeholder="YYYY-MM-DD"
                  value={endDate}
                  onChangeText={setEndDate}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <Pressable 
                style={styles.modalCancelButton}
                onPress={() => setShowExportModal(false)}
              >
                <Text style={styles.modalCancelText}>Batal</Text>
              </Pressable>
              
              <Pressable 
                style={styles.modalConfirmButton}
                onPress={exportToPDF}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.modalConfirmGradient}
                >
                  <Download size={16} color="white" />
                  <Text style={styles.modalConfirmText}>Export</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    shadowColor: '#3B82F6',
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
  exportContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: -16,
  },
  exportButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  exportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    borderLeftWidth: 4,
  },
  statNumber: {
    fontSize: Math.min(24, width * 0.06),
    fontWeight: 'bold',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: Math.min(12, width * 0.03),
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    marginHorizontal: Math.max(16, width * 0.04),
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: Math.min(20, width * 0.05),
    fontWeight: 'bold',
    color: '#1E293B',
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
    color: '#64748B',
    marginTop: 16,
  },
  attendanceList: {
    gap: 12,
  },
  attendanceCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  attendanceGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  attendanceDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  attendanceDateText: {
    fontSize: 14,
    color: '#1E293B',
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
  studentsList: {
    gap: 16,
  },
  studentCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  studentGradient: {
    padding: 20,
  },
  studentHeader: {
    marginBottom: 16,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInitial: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  studentStats: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  studentStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  studentStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  studentStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  studentStatLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  recentAttendance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  recentDots: {
    flexDirection: 'row',
    gap: 8,
  },
  recentDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  dateInputs: {
    gap: 16,
    marginBottom: 24,
  },
  dateInputContainer: {
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  dateInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  modalConfirmText: {
    color: 'white',
    fontWeight: 'bold',
  },
});