import { AppLogo } from '@/components/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BookOpen, Award, Users, TrendingUp, Calendar, Star, Trophy, Clock, Target, CirclePlus as PlusCircle, Heart,CheckCircle, Gift, ExternalLink,CircleX, Camera, FileText, Settings, ChartBar as BarChart3, MapPin } from 'lucide-react-native';
import React, { useEffect, useState,useRef } from 'react';
import { Dimensions, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,TouchableOpacity } from 'react-native';
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
    image: "https://app.rumahamal.org/storage/assets/salman/crowdfunding/YqRaBbtwwyEl4qKh3rilGP7oGMjQsk9Z5vyEq43z.jpeg",
    link: "https://www.rumahamal.org/project/wakaf_alquran_di_bulan_turunya_alquran"
  },
  {
    id: "2",
    title: "📖 Donasi Buku",
    subtitle: "Bantu anak yatim mendapatkan ilmu",
    image: "https://lazismudiy.or.id/wp-content/uploads/2024/03/Buku-4.jpg",
    link: "https://lazismudiy.or.id/campaign/donasi-buku"
  },
  {
    id: "3",
    title: "🤲 Infaq Jumat",
    subtitle: "Sedekah terbaik di hari Jumat",
    image: "https://amalsholeh-s3.imgix.net/cover/mcm5rOSCWdhAEZNtggcVlIYdD3LuJB9be2ZA6WYy.jpg",
    link: "https://www.amalsholeh.com/infaq-shodaqoh-jum-at-masjid-muhajirin/seru"
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
    }, 4000); // 4 detik
    return () => clearInterval(interval);
  }, [currentIndex, banners.length]);
 const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (width * 0.7));
    setCurrentIndex(index);
  };

  const goToPrev = () => {
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = banners.length - 1;
    flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    setCurrentIndex(prevIndex);
  };

  const goToNext = () => {
    let nextIndex = currentIndex + 1;
    if (nextIndex >= banners.length) nextIndex = 0;
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setCurrentIndex(nextIndex);
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
        
        // Calculate next prayer
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
    // Get student points
    const { data: pointsData } = await supabase
      .from('siswa_poin')
      .select('*')
      .eq('siswa_id', profile?.id)
      .single();

    // Get setoran stats
    const { data: setoranData } = await supabase
      .from('setoran')
      .select('*')
      .eq('siswa_id', profile?.id)
      .order('created_at', { ascending: false });

    // Get labels count
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
    // Get pending setoran count
    const { count: pendingCount } = await supabase
      .from('setoran')
      .select('*', { count: 'exact', head: true })
      .eq('organize_id', profile?.organize_id)
      .eq('status', 'pending');

    // Get total students in organize
    const { count: siswaCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organize_id', profile?.organize_id)
      .eq('role', 'siswa');
  // Get today's attendance stats
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
          absentToday++; // Default to absent if no record
        }
      }
    }

    // Get recent setoran for review
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
    // Get children progress
    const { data: childrenData } = await supabase
      .from('users')
      .select('id, name')
      .eq('organize_id', profile?.organize_id)
      .eq('role', 'siswa');

    if (childrenData && childrenData.length > 0) {
      const childId = childrenData[0].id; // For demo, take first child
      
      const { data: setoranData } = await supabase
        .from('setoran')
        .select('*')
        .eq('siswa_id', childId);

      const { data: pointsData } = await supabase
        .from('siswa_poin')
        .select('*')
        .eq('siswa_id', childId)
        .single();
 // Get child's attendance stats
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
    // Get system-wide stats
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

const handlePress = (link: string) => {
  console.log("Open link:", link);
};

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInUp}>
        <View style={[styles.header, { marginBottom: 20 }]}>
          <LinearGradient
          colors={['#00A86B', '#008B5A']}
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
              <View style={styles.headerRight}>
                <View style={styles.profilePicture}>
                  <Text style={styles.profileInitial}>
                    {profile?.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </Animated.View>

      <View style={styles.content}>
 {/* Prayer Times Card */}
        {prayerTimes && (
         <Animated.View entering={FadeInUp.delay(150)} style={styles.container}>
      {/* Kubah Masjid */}
      <LinearGradient colors={['#059669', '#10B981']} style={styles.kubah}>
        <Clock size={24} color="white" />
        <Text style={styles.title}>Jadwal Sholat</Text>
        <MapPin size={18} color="white" />
      </LinearGradient>

      {/* Konten */}
      <View style={styles.content}>
        {nextPrayer && (
          <View style={styles.nextPrayerContainer}>
            <Text style={styles.nextPrayerLabel}>Sholat Berikutnya:</Text>
            <View style={styles.nextPrayerInfo}>
              <Text style={styles.nextPrayerName}>{nextPrayer.name}</Text>
              <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
            </View>
          </View>
        )}

        <View style={styles.prayerTimesGrid}>
          {Object.entries({
            'Subuh': prayerTimes?.fajr,
            'Dzuhur': prayerTimes?.dhuhr,
            'Ashar': prayerTimes?.asr,
            'Maghrib': prayerTimes?.maghrib,
            'Isya': prayerTimes?.isha,
          }).map(([name, time]) => (
            <View key={name} style={styles.prayerTimeItem}>
              <Text style={styles.prayerName}>{name}</Text>
              <Text style={styles.prayerTime}>{time}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.locationText}>{locationName}</Text>
      </View>
    </Animated.View>
        )}

        {/* Stats Cards */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.statsContainer}>
          {profile?.role === 'siswa' && (
            <>
              <View style={styles.statCard}>
              <TrendingUp size={20} color="#0066CC" />
                <Text style={styles.statNumber}>{stats.totalPoin || 0}</Text>
                <Text style={styles.statLabel}>Total Poin</Text>
              </View>
              <View style={styles.statCard}>
               <BookOpen size={20} color="#00A86B" />
                <Text style={styles.statNumber}>{stats.setoranDiterima || 0}</Text>
                <Text style={styles.statLabel}>Diterima</Text>
              </View>
              <View style={styles.statCard}>
             <Award size={20} color="#FF6B35" />
                <Text style={styles.statNumber}>{stats.labelCount || 0}</Text>
                <Text style={styles.statLabel}>Label Juz</Text>
              </View>
            </>
          )}
          
          {profile?.role === 'guru' && (
            <>
              <View style={styles.statCard}>
               <Clock size={20} color="#E74C3C" />
                <Text style={styles.statNumber}>{stats.setoranPending || 0}</Text>
                <Text style={styles.statLabel}>Perlu Dinilai</Text>
              </View>
              <View style={styles.statCard}>
                <Users size={20} color="#0066CC" />
                <Text style={styles.statNumber}>{stats.totalSiswa || 0}</Text>
                <Text style={styles.statLabel}>Total Santri</Text>
              </View>
              <View style={styles.statCard}>
                <Award size={20} color="#00A86B" />
                <Text style={styles.statNumber}>1</Text>
                <Text style={styles.statLabel}>Kelas Aktif</Text>
              </View>
            </>
          )}

          {profile?.role === 'ortu' && (
            <>
              <View style={styles.statCard}>
           <TrendingUp size={20} color="#0066CC" />
                <Text style={styles.statNumber}>{stats.totalPoin || 0}</Text>
                <Text style={styles.statLabel}>Poin Anak</Text>
              </View>
              <View style={styles.statCard}>
                 <BookOpen size={20} color="#00A86B" />
                <Text style={styles.statNumber}>{stats.setoranDiterima || 0}</Text>
                <Text style={styles.statLabel}>Diterima</Text>
              </View>
              <View style={styles.statCard}>
                <Clock size={20} color="#FF6B35" />
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
              <View style={styles.progressCard}>
                 <BookOpen size={20} color="#00A86B" />
                <Text style={styles.progressTitle}>Hafalan</Text>
                <Text style={styles.progressNumber}>{stats.hafalanProgress || 0}</Text>
                <Text style={styles.progressLabel}>Setoran Diterima</Text>
              </View>
              <View style={styles.progressCard}>
                 <Target size={20} color="#0066CC" />
                <Text style={styles.progressTitle}>Murojaah</Text>
                <Text style={styles.progressNumber}>{stats.murojaahProgress || 0}</Text>
                <Text style={styles.progressLabel}>Setoran Diterima</Text>
              </View>
            </View>
          </Animated.View>
        )}
   {/* Attendance Summary for Guru/Ortu */}
        {(profile?.role === 'guru' || profile?.role === 'ortu') && stats.attendanceStats && (
          <Animated.View entering={FadeInUp.delay(250)} style={styles.attendanceSection}>
            <Text style={styles.sectionTitle}>Absensi Hari Ini</Text>
            <View style={styles.attendanceCards}>
              <View style={styles.attendanceCard}>
                <Users size={20} color="#0066CC" />
                <Text style={styles.attendanceNumber}>{stats.attendanceStats.totalStudents}</Text>
                <Text style={styles.attendanceLabel}>Total Siswa</Text>
              </View>
              <View style={styles.attendanceCard}>
                <CheckCircle size={20} color="#00A86B" />
                <Text style={styles.attendanceNumber}>{stats.attendanceStats.presentToday}</Text>
                <Text style={styles.attendanceLabel}>Hadir</Text>
              </View>
              <View style={styles.attendanceCard}>
                <Clock size={20} color="#FF6B35" />
                <Text style={styles.attendanceNumber}>{stats.attendanceStats.excusedToday}</Text>
                <Text style={styles.attendanceLabel}>Izin</Text>
              </View>
              <View style={styles.attendanceCard}>
                <CircleX size={20} color="#E74C3C" />
                <Text style={styles.attendanceNumber}>{stats.attendanceStats.absentToday}</Text>
                <Text style={styles.attendanceLabel}>Alpa</Text>
              </View>
            </View>
            
            <Pressable 
              style={styles.viewAllAttendanceButton}
              onPress={() => router.push('/(tabs)/absensi')}
            >
              <Text style={styles.viewAllAttendanceText}>Lihat Detail Absensi</Text>
            </Pressable>
          </Animated.View>
        )}
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
                  <View style={styles.activityIcon}>
                    <BookOpen size={16} color="#00A86B" />
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
                    { backgroundColor: activity.status === 'diterima' ? '#E8F5E8' : 
                                     activity.status === 'pending' ? '#FFF3E0' : '#FFEBEE' }
                  ]}>
                    <Text style={[
                      styles.activityStatusText,
                     { color: activity.status === 'diterima' ? '#00A86B' : 
                               activity.status === 'pending' ? '#FF6B35' : '#E74C3C' }
                    ]}>
                      {activity.status === 'pending' ? 'Menunggu' : 
                       activity.status === 'diterima' ? 'Diterima' : 'Ditolak'}
                    </Text>
                  </View>
                </Animated.View>
              ))}
              
            </View>
          ) : (
            <View style={styles.emptyActivity}>
              <Calendar size={32} color="#9CA3AF" />
              <Text style={styles.emptyActivityText}>Belum ada aktivitas</Text>
            </View>
          )}
        </Animated.View>
<Animated.View entering={FadeInUp.delay(100)} style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={banners}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={width * 0.7}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Pressable onPress={() => handlePress(item.link)} style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.image} />
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </Pressable>
        )}
      />

      {/* Pagination Dots */}
      <View style={{...styles.dotsContainer, paddingBottom: 16}}>
        {banners.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { opacity: index === currentIndex ? 1 : 0.3 },
            ]}
          />
        ))}
      </View>

      {/* Panah Navigasi */}
      <TouchableOpacity style={[styles.arrow, { left: 10 }]} onPress={goToPrev}>
        <Text style={styles.arrowText}>{'‹'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.arrow, { right: 10 }]} onPress={goToNext}>
        <Text style={styles.arrowText}>{'›'}</Text>
      </TouchableOpacity>
    </Animated.View>
        {/* Today's Quote */}
        <Animated.View entering={FadeInUp.delay(600)} style={styles.quoteCard}>
         <Star size={20} color="#FF6B35" />
          <Text style={styles.quoteText}>
            "Dan sungguhnya telah Kami mudahkan Al-Quran untuk pelajaran, 
            maka adakah orang yang mengambil pelajaran?"
          </Text>
          <Text style={styles.quoteSource}>- QS. Al-Qamar: 17</Text>
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
  header: {
 shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerGradient: {
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
   card: {
    width: width * 0.9,
    marginRight: 16,
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 20 
  },
  image: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
  },
  textContainer: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111",
  },
  subtitle: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },
   dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginHorizontal: 4,
  },
  arrow: {
    position: 'absolute',
    top: '40%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 6,
    borderRadius: 20,
  },
  arrowText: {
    fontSize: 24,
    color: '#fff',
  },
  headerRight: {
    alignItems: 'center',
  },
  greetingContainer: {
    flex: 1,
  },
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitial: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  greeting: {
    fontSize: Math.min(16, width * 0.04),
    color: 'white',
    opacity: 0.9,
    fontWeight: '500',
  },
  userName: {
    fontSize: Math.min(24, width * 0.06),
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  userRole: {
    fontSize: Math.min(14, width * 0.035),
    color: 'white',
    opacity: 0.8,
    marginTop: 2,
    fontWeight: '500',
  },
  content: {
    padding: 20,
    marginTop: -24,
  },
  bannerContainer: {
    marginBottom: 20,
  },
  banner: {
    borderRadius: 16  ,
    padding: 20,
      shadowColor: '#00A86B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
  },
   prayerTimesCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  prayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
    
  prayerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  nextPrayerContainer: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
  },
  nextPrayerLabel: {
    fontSize: 12,
    color: '#16A34A',
    marginBottom: 4,
  },
   nextPrayerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
    nextPrayerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#065F46',
  },
  nextPrayerTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
   prayerTimesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
   prayerTimeItem: {
    width: '48%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    marginBottom: 8,
    alignItems: 'center',
  },
  prayerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#064E3B',
  },
    prayerTime: {
    fontSize: 14,
    color: '#047857',
  },
  locationText: {
    marginTop: 8,
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
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
    padding: 12,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  attendanceNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  attendanceLabel: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  viewAllAttendanceButton: {
    backgroundColor: '#0066CC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  viewAllAttendanceText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Math.max(12, width * 0.03),
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Math.max(16, width * 0.04),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statNumber: {
    fontSize: Math.min(24, width * 0.06),
    fontWeight: 'bold',
    color: '#1F2937',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: Math.min(12, width * 0.03),
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap", 
    justifyContent: "space-between",
  },
  quickActionCard: {
    width: 80,
    alignItems: "center",
    marginBottom: 20,
    
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25, // lingkaran penuh
    alignItems: "center",
    justifyContent: "center",
  
  },
  quickActionText: {
    marginTop: 6,
    fontSize: 12,
    textAlign: "center",
    fontWeight: 'bold', 
  },


  progressSection: {
    marginBottom: 24,
  },
  progressCards: {
    flexDirection: 'row',
    gap: Math.max(12, width * 0.03),
  },
  progressCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: Math.max(16, width * 0.04),
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  progressTitle: {
    fontSize: Math.min(14, width * 0.035),
    fontWeight: 'bold',
    color: '#1F2937',
  },
  progressNumber: {
    fontSize: Math.min(28, width * 0.07),
    fontWeight: 'bold',
     color: '#00A86B',
  },
  progressLabel: {
    fontSize: Math.min(12, width * 0.03),
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  activityList: {
    gap: 12,
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: Math.min(14, width * 0.035),
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
  },
  activityDate: {
    fontSize: Math.min(12, width * 0.03),
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  
  activityStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activityStatusText: {
    fontSize: Math.min(12, width * 0.03),
    fontWeight: '600',
  },
    kubah: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderTopLeftRadius: 100,  // bikin kaya kubah
    borderTopRightRadius: 100,
  },

  emptyActivity: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyActivityText: {
    fontSize: Math.min(14, width * 0.035),
    color: '#6B7280',
    marginTop: 12,
    fontWeight: '500',
  },
  quoteCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 20,
  },
  quoteText: {
    fontSize: Math.min(16, width * 0.04),
    color: '#1F2937',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  quoteSource: {
    fontSize: Math.min(14, width * 0.035),
    color: '#6B7280',
    fontWeight: '600',
  },
});