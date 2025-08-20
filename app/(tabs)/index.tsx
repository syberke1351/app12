import { AppLogo } from '@/components/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BookOpen, Award, Users, TrendingUp, Calendar, Star, Trophy, Clock, Target, CirclePlus as PlusCircle, Heart, CircleCheck as CheckCircle, Gift, ExternalLink, CircleX, Camera, FileText, Settings, ChartBar as BarChart3, MapPin, User } from 'lucide-react-native';
import React, { useEffect, useState, useRef } from 'react';
import { Dimensions, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import dayjs from 'dayjs';

const { width } = Dimensions.get('window');

interface DashboardStats {
  totalSetoran?: number;
  setoranPending?: number;
  setoranDiterima?: number;
  totalPoin?: number;
  labelCount?: number;
  totalSiswa?: number;
  recentActivity?: any[];
  hafalanProgress?: number;
  murojaahProgress?: number;
  attendanceStats?: {
    totalStudents: number;
    presentToday: number;
    absentToday: number;
    excusedToday: number;
  };
}

interface PrayerTimes {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

const banners = [
  {
    id: "1",
    title: "💝 Wakaf Al-Quran",
    subtitle: "Berbagi pahala dengan mewakafkan Al-Quran",
    image: "https://images.pexels.com/photos/8111357/pexels-photo-8111357.jpeg?auto=compress&cs=tinysrgb&w=800",
    link: "https://www.rumahamal.org/project/wakaf_alquran_di_bulan_turunya_alquran",
    gradient: ['#059669', '#10B981']
  },
  {
    id: "2",
    title: "📖 Donasi Pendidikan",
    subtitle: "Bantu anak yatim mendapatkan pendidikan",
    image: "https://images.pexels.com/photos/8613089/pexels-photo-8613089.jpeg?auto=compress&cs=tinysrgb&w=800",
    link: "https://lazismudiy.or.id/campaign/donasi-buku",
    gradient: ['#3B82F6', '#6366F1']
  },
  {
    id: "3",
    title: "🤲 Infaq Jumat",
    subtitle: "Sedekah terbaik di hari yang berkah",
    image: "https://images.pexels.com/photos/8111120/pexels-photo-8111120.jpeg?auto=compress&cs=tinysrgb&w=800",
    link: "https://www.amalsholeh.com/infaq-shodaqoh-jum-at-masjid-muhajirin/seru",
    gradient: ['#8B5CF6', '#A855F7']
  }
];

export default function HomeScreen() {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [locationName, setLocationName] = useState('');
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string; timeLeft: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= banners.length) nextIndex = 0;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setCurrentIndex(nextIndex);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, banners.length]);

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (width * 0.85));
    setCurrentIndex(index);
  };

  const getPrayerTimes = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const city = address.city || address.region || 'Lokasi Anda';
      setLocationName(city);

      const response = await fetch(
        `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=2`
      );
      const data = await response.json();

      if (data.data) {
        const prayers = {
          fajr: data.data.timings.Fajr,
          dhuhr: data.data.timings.Dhuhr,
          asr: data.data.timings.Asr,
          maghrib: data.data.timings.Maghrib,
          isha: data.data.timings.Isha,
        };
        setPrayerTimes(prayers);
        
        const now = dayjs();
        const prayerList = [
          { name: 'Subuh', time: prayers.fajr },
          { name: 'Dzuhur', time: prayers.dhuhr },
          { name: 'Ashar', time: prayers.asr },
          { name: 'Maghrib', time: prayers.maghrib },
          { name: 'Isya', time: prayers.isha },
        ];

        for (let prayer of prayerList) {
          const prayerTime = dayjs(prayer.time, 'HH:mm');
          if (now.isBefore(prayerTime)) {
            setNextPrayer({
              name: prayer.name,
              time: prayer.time,
              timeLeft: prayerTime.from(now, true),
            });
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error getting prayer times:', error);
    }
  };

  const fetchDashboardData = async () => {
    if (!profile) return;

    try {
      switch (profile.role) {
        case 'siswa':
          await fetchSiswaStats();
          break;
        case 'guru':
          await fetchGuruStats();
          break;
        case 'ortu':
          await fetchOrtuStats();
          break;
        case 'admin':
          await fetchAdminStats();
          break;
      }
      await getPrayerTimes();
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSiswaStats = async () => {
    const { data: pointsData } = await supabase
      .from('siswa_poin')
      .select('*')
      .eq('siswa_id', profile?.id)
      .single();

    const { data: setoranData } = await supabase
      .from('setoran')
      .select('*')
      .eq('siswa_id', profile?.id)
      .order('created_at', { ascending: false });

    const { data: labelsData } = await supabase
      .from('labels')
      .select('*')
      .eq('siswa_id', profile?.id);

    const totalSetoran = setoranData?.length || 0;
    const setoranDiterima = setoranData?.filter(s => s.status === 'diterima').length || 0;
    const setoranPending = setoranData?.filter(s => s.status === 'pending').length || 0;
    const hafalanProgress = setoranData?.filter(s => s.jenis === 'hafalan' && s.status === 'diterima').length || 0;
    const murojaahProgress = setoranData?.filter(s => s.jenis === 'murojaah' && s.status === 'diterima').length || 0;

    setStats({
      totalSetoran,
      setoranDiterima,
      setoranPending,
      totalPoin: pointsData?.total_poin || 0,
      labelCount: labelsData?.length || 0,
      recentActivity: setoranData?.slice(0, 3) || [],
      hafalanProgress,
      murojaahProgress,
    });
  };

  const fetchGuruStats = async () => {
    const { count: pendingCount } = await supabase
      .from('setoran')
      .select('*', { count: 'exact', head: true })
      .eq('organize_id', profile?.organize_id)
      .eq('status', 'pending');

    const { count: siswaCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organize_id', profile?.organize_id)
      .eq('role', 'siswa');

    const today = new Date().toISOString().split('T')[0];
    const { data: studentsData } = await supabase
      .from('users')
      .select('id')
      .eq('organize_id', profile?.organize_id)
      .eq('role', 'siswa');

    let presentToday = 0;
    let absentToday = 0;
    let excusedToday = 0;

    if (studentsData) {
      for (const student of studentsData) {
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', student.id)
          .eq('date', today)
          .single();

        if (attendanceData) {
          switch (attendanceData.status) {
            case 'hadir': presentToday++; break;
            case 'izin': excusedToday++; break;
            case 'tidak_hadir': absentToday++; break;
          }
        } else {
          absentToday++;
        }
      }
    }

    const { data: recentSetoran } = await supabase
      .from('setoran')
      .select(`
        *,
        siswa:siswa_id(name)
      `)
      .eq('organize_id', profile?.organize_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3);

    setStats({
      setoranPending: pendingCount || 0,
      totalSiswa: siswaCount || 0,
      recentActivity: recentSetoran || [],
      attendanceStats: {
        totalStudents: siswaCount || 0,
        presentToday,
        absentToday,
        excusedToday,
      },
    });
  };

  const fetchOrtuStats = async () => {
    const { data: childrenData } = await supabase
      .from('users')
      .select('id, name')
      .eq('organize_id', profile?.organize_id)
      .eq('role', 'siswa');

    if (childrenData && childrenData.length > 0) {
      const childId = childrenData[0].id;
      
      const { data: setoranData } = await supabase
        .from('setoran')
        .select('*')
        .eq('siswa_id', childId);

      const { data: pointsData } = await supabase
        .from('siswa_poin')
        .select('*')
        .eq('siswa_id', childId)
        .single();

      const today = new Date().toISOString().split('T')[0];
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', childId)
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const presentCount = attendanceData?.filter(a => a.status === 'hadir').length || 0;
      const totalDays = attendanceData?.length || 0;

      setStats({
        totalSetoran: setoranData?.length || 0,
        setoranDiterima: setoranData?.filter(s => s.status === 'diterima').length || 0,
        setoranPending: setoranData?.filter(s => s.status === 'pending').length || 0,
        totalPoin: pointsData?.total_poin || 0,
        recentActivity: setoranData?.slice(0, 3) || [],
        attendanceStats: {
          totalStudents: 1,
          presentToday: presentCount,
          absentToday: totalDays - presentCount,
          excusedToday: 0,
        },
      });
    }
  };

  const fetchAdminStats = async () => {
    const { count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: organizesCount } = await supabase
      .from('organizes')
      .select('*', { count: 'exact', head: true });

    setStats({
      totalSiswa: usersCount || 0,
      totalSetoran: organizesCount || 0,
    });
  };

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'siswa': return 'Santri';
      case 'guru': return 'Ustadz/Ustadzah';
      case 'ortu': return 'Wali Santri';
      case 'admin': return 'Administrator';
      default: return role;
    }
  };

  const handleBannerPress = (link: string) => {
    Linking.openURL(link);
  };

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Enhanced Header */}
      <Animated.View entering={FadeInUp}>
        <LinearGradient
          colors={['#1E40AF', '#3B82F6', '#60A5FA']}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <AppLogo size="small" showText={false} />
              <View style={styles.greetingContainer}>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.userName}>{profile?.name}</Text>
                <Text style={styles.userRole}>{getRoleName(profile?.role || '')}</Text>
              </View>
            </View>
            <Pressable 
              style={styles.profileButton}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.profilePicture}
              >
                <Text style={styles.profileInitial}>
                  {profile?.name?.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </Animated.View>

      <View style={styles.content}>
        {/* Prayer Times Card - Enhanced Single Row */}
        {prayerTimes && (
          <Animated.View entering={FadeInUp.delay(150)} style={styles.prayerCard}>
            <LinearGradient
              colors={['#059669', '#10B981']}
              style={styles.prayerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.prayerHeader}>
                <View style={styles.prayerTitleContainer}>
                  <Clock size={20} color="white" />
                  <Text style={styles.prayerTitle}>Jadwal Sholat</Text>
                </View>
                <View style={styles.locationContainer}>
                  <MapPin size={16} color="white" />
                  <Text style={styles.locationText}>{locationName}</Text>
                </View>
              </View>
              
              {nextPrayer && (
                <View style={styles.nextPrayerBanner}>
                  <Text style={styles.nextPrayerLabel}>Sholat Berikutnya:</Text>
                  <Text style={styles.nextPrayerName}>{nextPrayer.name} - {nextPrayer.time}</Text>
                </View>
              )}

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.prayerTimesScroll}
              >
                {Object.entries({
                  'Subuh': prayerTimes?.fajr,
                  'Dzuhur': prayerTimes?.dhuhr,
                  'Ashar': prayerTimes?.asr,
                  'Maghrib': prayerTimes?.maghrib,
                  'Isya': prayerTimes?.isha,
                }).map(([name, time], index) => {
                  const isNext = nextPrayer?.name === name;
                  return (
                    <View 
                      key={name} 
                      style={[
                        styles.prayerTimeItem,
                        isNext && styles.prayerTimeItemActive
                      ]}
                    >
                      <Text style={[
                        styles.prayerName,
                        isNext && styles.prayerNameActive
                      ]}>
                        {name}
                      </Text>
                      <Text style={[
                        styles.prayerTime,
                        isNext && styles.prayerTimeActive
                      ]}>
                        {time}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Enhanced Stats Cards */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.statsContainer}>
          {profile?.role === 'siswa' && (
            <>
              <View style={[styles.statCard, { borderLeftColor: '#3B82F6' }]}>
                <TrendingUp size={24} color="#3B82F6" />
                <Text style={styles.statNumber}>{stats.totalPoin || 0}</Text>
                <Text style={styles.statLabel}>Total Poin</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
                <BookOpen size={24} color="#10B981" />
                <Text style={styles.statNumber}>{stats.setoranDiterima || 0}</Text>
                <Text style={styles.statLabel}>Diterima</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
                <Award size={24} color="#F59E0B" />
                <Text style={styles.statNumber}>{stats.labelCount || 0}</Text>
                <Text style={styles.statLabel}>Label Juz</Text>
              </View>
            </>
          )}
          
          {profile?.role === 'guru' && (
            <>
              <View style={[styles.statCard, { borderLeftColor: '#EF4444' }]}>
                <Clock size={24} color="#EF4444" />
                <Text style={styles.statNumber}>{stats.setoranPending || 0}</Text>
                <Text style={styles.statLabel}>Perlu Dinilai</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#3B82F6' }]}>
                <Users size={24} color="#3B82F6" />
                <Text style={styles.statNumber}>{stats.totalSiswa || 0}</Text>
                <Text style={styles.statLabel}>Total Santri</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
                <Award size={24} color="#10B981" />
                <Text style={styles.statNumber}>1</Text>
                <Text style={styles.statLabel}>Kelas Aktif</Text>
              </View>
            </>
          )}

          {profile?.role === 'ortu' && (
            <>
              <View style={[styles.statCard, { borderLeftColor: '#3B82F6' }]}>
                <TrendingUp size={24} color="#3B82F6" />
                <Text style={styles.statNumber}>{stats.totalPoin || 0}</Text>
                <Text style={styles.statLabel}>Poin Anak</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
                <BookOpen size={24} color="#10B981" />
                <Text style={styles.statNumber}>{stats.setoranDiterima || 0}</Text>
                <Text style={styles.statLabel}>Diterima</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
                <Clock size={24} color="#F59E0B" />
                <Text style={styles.statNumber}>{stats.setoranPending || 0}</Text>
                <Text style={styles.statLabel}>Menunggu</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Progress Cards for Students */}
        {profile?.role === 'siswa' && (
          <Animated.View entering={FadeInUp.delay(400)} style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Progress Pembelajaran</Text>
            <View style={styles.progressCards}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.progressCard}
              >
                <BookOpen size={24} color="white" />
                <Text style={styles.progressTitle}>Hafalan</Text>
                <Text style={styles.progressNumber}>{stats.hafalanProgress || 0}</Text>
                <Text style={styles.progressLabel}>Setoran Diterima</Text>
              </LinearGradient>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.progressCard}
              >
                <Target size={24} color="white" />
                <Text style={styles.progressTitle}>Murojaah</Text>
                <Text style={styles.progressNumber}>{stats.murojaahProgress || 0}</Text>
                <Text style={styles.progressLabel}>Setoran Diterima</Text>
              </LinearGradient>
            </View>
          </Animated.View>
        )}

        {/* Attendance Summary for Guru/Ortu */}
        {(profile?.role === 'guru' || profile?.role === 'ortu') && stats.attendanceStats && (
          <Animated.View entering={FadeInUp.delay(250)} style={styles.attendanceSection}>
            <Text style={styles.sectionTitle}>Absensi Hari Ini</Text>
            <View style={styles.attendanceCards}>
              <View style={[styles.attendanceCard, { borderLeftColor: '#3B82F6' }]}>
                <Users size={20} color="#3B82F6" />
                <Text style={styles.attendanceNumber}>{stats.attendanceStats.totalStudents}</Text>
                <Text style={styles.attendanceLabel}>Total Siswa</Text>
              </View>
              <View style={[styles.attendanceCard, { borderLeftColor: '#10B981' }]}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={styles.attendanceNumber}>{stats.attendanceStats.presentToday}</Text>
                <Text style={styles.attendanceLabel}>Hadir</Text>
              </View>
              <View style={[styles.attendanceCard, { borderLeftColor: '#F59E0B' }]}>
                <Clock size={20} color="#F59E0B" />
                <Text style={styles.attendanceNumber}>{stats.attendanceStats.excusedToday}</Text>
                <Text style={styles.attendanceLabel}>Izin</Text>
              </View>
              <View style={[styles.attendanceCard, { borderLeftColor: '#EF4444' }]}>
                <CircleX size={20} color="#EF4444" />
                <Text style={styles.attendanceNumber}>{stats.attendanceStats.absentToday}</Text>
                <Text style={styles.attendanceLabel}>Alpa</Text>
              </View>
            </View>
            
            <Pressable 
              style={styles.viewAllAttendanceButton}
              onPress={() => router.push('/(tabs)/absensi')}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.viewAllAttendanceGradient}
              >
                <Text style={styles.viewAllAttendanceText}>Lihat Detail Absensi</Text>
                <ExternalLink size={16} color="white" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* Enhanced Banner Ads */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.bannerSection}>
          <Text style={styles.sectionTitle}>Program Kebaikan</Text>
          <FlatList
            ref={flatListRef}
            data={banners}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width * 0.85}
            decelerationRate="fast"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <Pressable 
                onPress={() => handleBannerPress(item.link)} 
                style={styles.bannerCard}
              >
                <LinearGradient
                  colors={item.gradient}
                  style={styles.bannerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.bannerContent}>
                    <View style={styles.bannerTextContainer}>
                      <Text style={styles.bannerTitle}>{item.title}</Text>
                      <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                      <View style={styles.bannerButton}>
                        <Text style={styles.bannerButtonText}>Donasi Sekarang</Text>
                        <ExternalLink size={14} color="white" />
                      </View>
                    </View>
                    <View style={styles.bannerImageContainer}>
                      <Image source={{ uri: item.image }} style={styles.bannerImage} />
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            )}
          />

          <View style={styles.dotsContainer}>
            {banners.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { 
                    backgroundColor: index === currentIndex ? '#3B82F6' : '#CBD5E1',
                    width: index === currentIndex ? 24 : 8
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* Recent Activity */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Aktivitas Terbaru</Text>
          {stats.recentActivity && stats.recentActivity.length > 0 ? (
            <View style={styles.activityList}>
              {stats.recentActivity.map((activity, index) => (
                <Animated.View 
                  key={activity.id || index} 
                  entering={SlideInRight.delay(index * 100)}
                  style={styles.activityCard}
                >
                  <LinearGradient
                    colors={['#F8FAFC', '#F1F5F9']}
                    style={styles.activityGradient}
                  >
                    <View style={styles.activityIcon}>
                      <BookOpen size={20} color="#3B82F6" />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle}>
                        {profile?.role === 'guru' ? 
                          `${activity.siswa?.name} - ${activity.jenis === 'hafalan' ? 'Hafalan' : 'Murojaah'} ${activity.surah}` :
                          `${activity.jenis === 'hafalan' ? 'Hafalan' : 'Murojaah'} ${activity.surah}`
                        }
                      </Text>
                      <Text style={styles.activityDate}>
                        {new Date(activity.tanggal || activity.created_at).toLocaleDateString('id-ID')}
                      </Text>
                    </View>
                    <View style={[
                      styles.activityStatus,
                      { backgroundColor: activity.status === 'diterima' ? '#DCFCE7' : 
                                       activity.status === 'pending' ? '#FEF3C7' : '#FEE2E2' }
                    ]}>
                      <Text style={[
                        styles.activityStatusText,
                        { color: activity.status === 'diterima' ? '#10B981' : 
                                 activity.status === 'pending' ? '#F59E0B' : '#EF4444' }
                      ]}>
                        {activity.status === 'pending' ? 'Menunggu' : 
                         activity.status === 'diterima' ? 'Diterima' : 'Ditolak'}
                      </Text>
                    </View>
                  </LinearGradient>
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyActivity}>
              <Calendar size={48} color="#94A3B8" />
              <Text style={styles.emptyActivityText}>Belum ada aktivitas</Text>
            </View>
          )}
        </Animated.View>

        {/* Today's Quote */}
        <Animated.View entering={FadeInUp.delay(600)} style={styles.quoteCard}>
          <LinearGradient
            colors={['#F59E0B', '#F97316']}
            style={styles.quoteGradient}
          >
            <Star size={24} color="white" />
            <Text style={styles.quoteText}>
              "Dan sungguhnya telah Kami mudahkan Al-Quran untuk pelajaran, 
              maka adakah orang yang mengambil pelajaran?"
            </Text>
            <Text style={styles.quoteSource}>- QS. Al-Qamar: 17</Text>
          </LinearGradient>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerGradient: {
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  greetingContainer: {
    flex: 1,
  },
  profileButton: {
    alignItems: 'center',
  },
  profilePicture: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitial: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    fontWeight: '500',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  userRole: {
    fontSize: 14,
    color: 'white',
    opacity: 0.8,
    marginTop: 2,
    fontWeight: '500',
  },
  content: {
    padding: 20,
    marginTop: -24,
  },
  prayerCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  prayerGradient: {
    padding: 20,
  },
  prayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  prayerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prayerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
  nextPrayerBanner: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  nextPrayerLabel: {
    fontSize: 12,
    color: 'white',
    opacity: 0.8,
    marginBottom: 4,
  },
  nextPrayerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  prayerTimesScroll: {
    marginHorizontal: -8,
  },
  prayerTimeItem: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  prayerTimeItemActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 2,
    borderColor: 'white',
  },
  prayerName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    opacity: 0.8,
    marginBottom: 4,
  },
  prayerNameActive: {
    opacity: 1,
    fontWeight: 'bold',
  },
  prayerTime: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  prayerTimeActive: {
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderLeftWidth: 4,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: 24,
  },
  progressCards: {
    flexDirection: 'row',
    gap: 12,
  },
  progressCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  progressNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  progressLabel: {
    fontSize: 12,
    color: 'white',
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.9,
  },
  attendanceSection: {
    marginBottom: 24,
  },
  attendanceCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  attendanceCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
  },
  attendanceNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  attendanceLabel: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  viewAllAttendanceButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  viewAllAttendanceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  viewAllAttendanceText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerSection: {
    marginBottom: 24,
  },
  bannerCard: {
    width: width * 0.85,
    marginRight: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  bannerGradient: {
    padding: 20,
    minHeight: 160,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    marginBottom: 16,
    lineHeight: 20,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  activityList: {
    gap: 12,
  },
  activityCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activityGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 20,
  },
  activityDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  activityStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activityStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyActivity: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyActivityText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 16,
    fontWeight: '500',
  },
  quoteCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  quoteGradient: {
    padding: 24,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginTop: 16,
    marginBottom: 12,
    fontWeight: '500',
  },
  quoteSource: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    opacity: 0.9,
  },
});