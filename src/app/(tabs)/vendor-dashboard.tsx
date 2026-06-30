import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Pressable, 
  ScrollView, 
  Switch, 
  ActivityIndicator, 
  TextInput, 
  Alert,
  RefreshControl
} from 'react-native';
import Animated, { FadeInUp, FadeInDown, FadeInRight, FadeInLeft, Layout } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/config/supabase';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function VendorDashboard() {
  const { profile, signOut, user, refreshProfile } = useAuth();
  const router = useRouter();
  const [online, setOnline] = useState(profile?.is_visible !== false);

  // DB States
  const [services, setServices] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Form States for Service
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [addingService, setAddingService] = useState(false);

  // Focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [priceFocused, setPriceFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  // Booking Estimator States
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [estimatedTimeInput, setEstimatedTimeInput] = useState('');
  const [submittingEstimate, setSubmittingEstimate] = useState(false);
  const [showEstimateDialog, setShowEstimateDialog] = useState(false);
  const [estFocused, setEstFocused] = useState(false);

  // Reviews States
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchServices(), fetchBookings(), fetchReviews()]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const syncVisibility = async (val: boolean) => {
    setOnline(val);
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_visible: val })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update visibility');
      setOnline(!val);
    }
  };

  const fetchServices = async () => {
    if (!user) return;
    setLoadingServices(true);
    try {
      const { data, error } = await supabase
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setServices(data || []);
    } catch (err: any) {
      console.error('Error fetching services:', err.message);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchBookings = async () => {
    if (!user) return;
    setLoadingBookings(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          customer_id,
          vendor_id,
          service_id,
          customer_phone,
          customer_address,
          status,
          estimated_time,
          created_at,
          profiles!bookings_customer_id_fkey (
            name
          ),
          vendor_services (
            name,
            price
          )
        `)
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBookings(data || []);
    } catch (err: any) {
      console.error('Error fetching bookings:', err.message);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleAddService = async () => {
    if (!serviceName.trim() || !servicePrice.trim()) {
      Alert.alert('Error', 'Please fill name and price details');
      return;
    }
    const parsedPrice = parseFloat(servicePrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Error', 'Please enter a valid positive price');
      return;
    }
    if (!user) return;
    setAddingService(true);
    try {
      const { error } = await supabase
        .from('vendor_services')
        .insert({
          vendor_id: user.id,
          name: serviceName.trim(),
          price: parsedPrice,
          description: serviceDesc.trim()
        });
      if (error) throw error;
      
      Alert.alert('Success', 'Service added to catalog');
      setServiceName('');
      setServicePrice('');
      setServiceDesc('');
      setShowAddServiceForm(false);
      fetchServices();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add service');
    } finally {
      setAddingService(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    Alert.alert(
      'Remove Service',
      'Are you sure you want to remove this service from your catalog?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('vendor_services')
                .delete()
                .eq('id', serviceId);
              if (error) throw error;
              fetchServices();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete service');
            }
          }
        }
      ]
    );
  };

  const handleAcceptBooking = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setEstimatedTimeInput('');
    setShowEstimateDialog(true);
  };

  const submitAcceptBooking = async () => {
    if (!selectedBookingId || !estimatedTimeInput.trim()) {
      Alert.alert('Error', 'Please specify an estimated time');
      return;
    }
    setSubmittingEstimate(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'accepted',
          estimated_time: estimatedTimeInput.trim()
        })
        .eq('id', selectedBookingId);
      if (error) throw error;

      Alert.alert('Success', 'Request accepted');
      setShowEstimateDialog(false);
      setSelectedBookingId(null);
      fetchBookings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update request');
    } finally {
      setSubmittingEstimate(false);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to decline this booking request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookings')
                .update({ status: 'rejected' })
                .eq('id', bookingId);
              if (error) throw error;
              fetchBookings();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to reject booking');
            }
          }
        }
      ]
    );
  };

  const handleCompleteBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);
      if (error) throw error;
      fetchBookings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark service complete');
    }
  };

  useEffect(() => {
    if (profile) {
      setOnline(profile.is_visible !== false);
    }
  }, [profile]);

  const fetchReviews = async () => {
    if (!user) return;
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          profiles!reviews_customer_id_fkey (
            name
          )
        `)
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setReviews(data || []);
      if (data && data.length > 0) {
        const sum = data.reduce((acc, curr) => acc + curr.rating, 0);
        setAverageRating(parseFloat((sum / data.length).toFixed(1)));
      } else {
        setAverageRating(0);
      }
    } catch (err: any) {
      console.error('Error fetching reviews:', err.message);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchBookings();
    fetchReviews();

    if (!user) return;

    const subscription = supabase
      .channel('bookings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `vendor_id=eq.${user.id}`,
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const pendingRequests = bookings.filter(b => b.status === 'pending');
  const activeRequests = bookings.filter(b => b.status === 'accepted');
  const pastJobs = bookings.filter(b => b.status === 'completed' || b.status === 'rejected');

  const metrics = [
    { label: 'Active Services', value: `${services.length}`, growth: 'Listed', color: '#00E5FF' },
    { label: 'Pending Requests', value: `${pendingRequests.length}`, growth: 'Incoming', color: '#FFD700' },
    { label: 'Ongoing Orders', value: `${activeRequests.length}`, growth: 'Progress', color: '#39FF14' },
    { label: 'Average Rating', value: averageRating > 0 ? `⭐ ${averageRating}` : 'N/A', growth: `${reviews.length} reviews`, color: '#FFD700' },
  ];

  if (profile?.is_blocked === true) {
    return (
      <View style={styles.blockedScreenContainer}>
        <View style={styles.blockedScreenCard}>
          <ThemedText style={styles.blockedScreenTitle}>⚠️ Account Blocked</ThemedText>
          <ThemedText style={styles.blockedScreenText}>
            Your vendor account has been blocked by the administrator of your city.
            You cannot edit catalog services, visibility status is locked to offline, and new booking queries are blocked.
          </ThemedText>
          <ThemedText style={styles.blockedScreenContact}>
            Please contact your local city administrator to resolve this issue.
          </ThemedText>
          <Pressable style={[styles.logoutBtn, { marginTop: Spacing.two }]} onPress={handleLogout}>
            <ThemedText style={styles.logoutBtnText}>Log Out</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#050B14', '#0A192F', '#050B14']} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content} 
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
        }
      >
        {/* Header Panel */}
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.greeting}>Vendor Portal</ThemedText>
          <ThemedText style={styles.userName}>{profile?.name || 'Shop Owner'}</ThemedText>
        </View>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <ThemedText style={styles.logoutBtnText}>Log Out</ThemedText>
        </Pressable>
      </View>

      {/* Online Status Toggle */}
      <View style={[styles.statusCard, { borderColor: online ? '#39FF1430' : 'rgba(255, 255, 255, 0.1)' }]}>
        <View style={styles.statusInfo}>
          <View style={[styles.statusDot, { backgroundColor: online ? '#39FF14' : '#FF3333' }]} />
          <View>
            <ThemedText style={styles.statusTitle}>
              Market Visibility: {online ? 'ONLINE' : 'OFFLINE'}
            </ThemedText>
            <ThemedText style={styles.statusSub}>
              {online ? 'Visible to customers searching for services' : 'Hidden from customer search results'}
            </ThemedText>
          </View>
        </View>
        <Switch
          trackColor={{ false: '#767577', true: '#39FF1430' }}
          thumbColor={online ? '#39FF14' : '#f4f3f4'}
          onValueChange={syncVisibility}
          value={online}
        />
      </View>

      {/* Business Metrics Grid */}
      <ThemedText style={styles.sectionTitle}>Overview</ThemedText>
      <View style={styles.metricsContainer}>
        {metrics.map((met, idx) => (
          <Animated.View 
            key={idx} 
            style={styles.metricCard}
            entering={FadeInDown.delay(idx * 100).springify()}
            layout={Layout.springify()}
          >
            <ThemedText style={styles.metricLabel}>{met.label}</ThemedText>
            <View style={styles.metricValueRow}>
              <ThemedText style={styles.metricValue}>{met.value}</ThemedText>
              <View style={[styles.growthBadge, { backgroundColor: `${met.color}15` }]}>
                <ThemedText style={{ color: met.color, fontSize: 10, fontWeight: '700' }}>
                  {met.growth}
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Accept Booking Estimated Time Overlay dialog */}
      {showEstimateDialog && (
        <View style={styles.dialogCard}>
          <ThemedText style={styles.dialogTitle}>⏳ Set Estimated Arrival Time</ThemedText>
          <ThemedText style={styles.dialogText}>
            Provide an estimate for the customer (e.g. "30-45 mins", "Tomorrow 9 AM")
          </ThemedText>
          <TextInput
            style={[styles.input, estFocused && styles.inputActive]}
            placeholder="e.g. 45 mins"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            value={estimatedTimeInput}
            onChangeText={setEstimatedTimeInput}
            onFocus={() => setEstFocused(true)}
            onBlur={() => setEstFocused(false)}
          />
          <View style={styles.dialogActions}>
            <Pressable 
              style={[styles.smallBtn, styles.cancelBtn]} 
              onPress={() => {
                setShowEstimateDialog(false);
                setSelectedBookingId(null);
              }}
            >
              <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
            </Pressable>
            <Pressable 
              style={[styles.smallBtn, styles.confirmBtn]} 
              onPress={submitAcceptBooking}
              disabled={submittingEstimate}
            >
              {submittingEstimate ? (
                <ActivityIndicator size="small" color="#050608" />
              ) : (
                <ThemedText style={styles.confirmBtnText}>Accept Request</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Booking Requests moderation panel */}
      <ThemedText style={styles.sectionTitle}>Incoming Requests ({pendingRequests.length})</ThemedText>
      {loadingBookings ? (
        <ActivityIndicator size="small" color="#00E5FF" />
      ) : pendingRequests.length === 0 ? (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>No pending bookings found.</ThemedText>
        </View>
      ) : (
        <View style={{ gap: Spacing.three }}>
          {pendingRequests.map((b, idx) => (
            <Animated.View 
              key={b.id} 
              style={styles.bookingCard}
              entering={FadeInRight.delay(idx * 150).springify()}
              layout={Layout.springify()}
            >
              <View style={styles.bookingHeader}>
                <ThemedText style={styles.bookingServiceTitle}>
                  🛠️ {b.vendor_services?.name || 'Service'}
                </ThemedText>
                <ThemedText style={styles.bookingPrice}>
                  ₹{b.vendor_services?.price || '0.00'}
                </ThemedText>
              </View>
              <View style={styles.bookingDetails}>
                <ThemedText style={styles.detailText}>
                  👤 Customer: <ThemedText style={styles.boldText}>{b.profiles?.name || 'Client'}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  📞 Phone: <ThemedText style={styles.boldText}>{b.customer_phone}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  📍 Address: <ThemedText style={styles.boldText}>{b.customer_address}</ThemedText>
                </ThemedText>
              </View>
              <View style={styles.bookingActionRow}>
                <Pressable 
                  style={({pressed}) => [styles.actionBtn, styles.declineBtn, pressed && {opacity: 0.7}]}
                  onPress={() => handleRejectBooking(b.id)}
                >
                  <ThemedText style={styles.declineText}>Decline</ThemedText>
                </Pressable>
                <Pressable 
                  style={({pressed}) => [styles.actionBtn, styles.acceptBtn, pressed && {opacity: 0.7}]}
                  onPress={() => handleAcceptBooking(b.id)}
                >
                  <ThemedText style={styles.acceptText}>Accept</ThemedText>
                </Pressable>
              </View>
            </Animated.View>
          ))}
        </View>
      )}

      {/* Ongoing service tickets */}
      <ThemedText style={styles.sectionTitle}>Active Jobs ({activeRequests.length})</ThemedText>
      {activeRequests.length === 0 ? (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>No ongoing service jobs.</ThemedText>
        </View>
      ) : (
        <View style={{ gap: Spacing.three }}>
          {activeRequests.map((b, idx) => (
            <Animated.View 
              key={b.id} 
              style={styles.bookingCard}
              entering={FadeInRight.delay(idx * 150).springify()}
              layout={Layout.springify()}
            >
              <View style={styles.bookingHeader}>
                <ThemedText style={styles.bookingServiceTitle}>
                  ⚡ {b.vendor_services?.name || 'Service'}
                </ThemedText>
                <ThemedText style={styles.bookingEstTime}>
                  ETA: {b.estimated_time}
                </ThemedText>
              </View>
              <View style={styles.bookingDetails}>
                <ThemedText style={styles.detailText}>
                  👤 Customer: <ThemedText style={styles.boldText}>{b.profiles?.name || 'Client'}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  📞 Phone: <ThemedText style={styles.boldText}>{b.customer_phone}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.detailText}>
                  📍 Address: <ThemedText style={styles.boldText}>{b.customer_address}</ThemedText>
                </ThemedText>
              </View>
              <Pressable 
                style={({pressed}) => [styles.completeJobBtn, pressed && {opacity: 0.7}]}
                onPress={() => handleCompleteBooking(b.id)}
              >
                <ThemedText style={styles.completeJobText}>Mark as Completed</ThemedText>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}

      {/* Job History panel */}
      <ThemedText style={styles.sectionTitle}>📜 Job History ({pastJobs.length})</ThemedText>
      {loadingBookings ? (
        <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: Spacing.two }} />
      ) : pastJobs.length === 0 ? (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>No completed or rejected jobs in history.</ThemedText>
        </View>
      ) : (
        <View style={{ gap: Spacing.three }}>
          {pastJobs.map((b) => {
            const statusColor = b.status === 'completed' ? '#39FF14' : '#FF3333';
            return (
              <Animated.View 
                key={b.id} 
                style={styles.bookingCard}
                entering={FadeInLeft.delay(100).springify()}
              >
                <View style={styles.bookingHeader}>
                  <ThemedText style={styles.bookingServiceTitle}>
                    {b.status === 'completed' ? '✅' : '❌'} {b.vendor_services?.name || 'Service'}
                  </ThemedText>
                  <View style={{
                    borderWidth: 1,
                    borderColor: `${statusColor}30`,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: `${statusColor}10`
                  }}>
                    <ThemedText style={{ color: statusColor, fontSize: 10, fontWeight: '800' }}>
                      {b.status.toUpperCase()}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.bookingDetails}>
                  <ThemedText style={styles.detailText}>
                    👤 Customer: <ThemedText style={styles.boldText}>{b.profiles?.name || 'Client'}</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    📞 Phone: <ThemedText style={styles.boldText}>{b.customer_phone}</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    📍 Address: <ThemedText style={styles.boldText}>{b.customer_address}</ThemedText>
                  </ThemedText>
                  <ThemedText style={styles.detailText}>
                    💰 Earnings: <ThemedText style={styles.boldText}>₹{b.vendor_services?.price || '0.00'}</ThemedText>
                  </ThemedText>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Catalog Services management panel */}
      <View style={styles.rowHeader}>
        <ThemedText style={styles.sectionTitle}>Manage Service Catalog</ThemedText>
        <Pressable 
          style={styles.addBtn} 
          onPress={() => setShowAddServiceForm(!showAddServiceForm)}
        >
          <ThemedText style={styles.addBtnText}>
            {showAddServiceForm ? 'Close Form' : '+ Add Service'}
          </ThemedText>
        </Pressable>
      </View>

      {showAddServiceForm && (
        <View style={styles.formCard}>
          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Service Name</ThemedText>
            <TextInput
              style={[styles.input, nameFocused && styles.inputActive]}
              placeholder="e.g. Professional Fan Fixing"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              value={serviceName}
              onChangeText={setServiceName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Service Price (₹)</ThemedText>
            <TextInput
              style={[styles.input, priceFocused && styles.inputActive]}
              placeholder="e.g. 29.99"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              keyboardType="numeric"
              value={servicePrice}
              onChangeText={servicePrice => setServicePrice(servicePrice.replace(/[^0-9.]/g, ''))}
              onFocus={() => setPriceFocused(true)}
              onBlur={() => setPriceFocused(false)}
            />
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Description</ThemedText>
            <TextInput
              style={[styles.textArea, descFocused && styles.inputActive]}
              placeholder="e.g. Full diagnosis, wire adjustment, fan motor alignment checkup."
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              multiline
              numberOfLines={3}
              value={serviceDesc}
              onChangeText={setServiceDesc}
              onFocus={() => setDescFocused(true)}
              onBlur={() => setDescFocused(false)}
            />
          </View>

          <Pressable 
            style={styles.saveBtn} 
            onPress={handleAddService}
            disabled={addingService}
          >
            {addingService ? (
              <ActivityIndicator size="small" color="#050608" />
            ) : (
              <ThemedText style={styles.saveBtnText}>Save Service to Catalog</ThemedText>
            )}
          </Pressable>
        </View>
      )}

      {loadingServices ? (
        <ActivityIndicator size="small" color="#00E5FF" />
      ) : services.length === 0 ? (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>No catalog services added. Add services above to receive customer bookings!</ThemedText>
        </View>
      ) : (
        <View style={{ gap: Spacing.two }}>
          {services.map((item) => (
            <View key={item.id} style={styles.catalogCard}>
              <View style={styles.catalogHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.catalogName}>{item.name}</ThemedText>
                  <ThemedText style={styles.catalogPrice}>₹{item.price.toFixed(2)}</ThemedText>
                </View>
                <Pressable 
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteService(item.id)}
                >
                  <ThemedText style={styles.deleteBtnText}>🗑️</ThemedText>
                </Pressable>
              </View>
              {item.description ? (
                <ThemedText style={styles.catalogDesc}>{item.description}</ThemedText>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Customer Reviews Feed */}
      <ThemedText style={styles.sectionTitle}>🌟 Customer Reviews</ThemedText>
      {loadingReviews ? (
        <ActivityIndicator size="small" color="#FFD700" style={{ marginVertical: Spacing.three }} />
      ) : reviews.length === 0 ? (
        <View style={styles.emptyCard}>
          <ThemedText style={styles.emptyText}>No customer reviews found yet.</ThemedText>
        </View>
      ) : (
        <View style={{ gap: Spacing.three }}>
          {reviews.map((rev) => (
            <View key={rev.id} style={styles.reviewItemCard}>
              <View style={styles.reviewItemHeader}>
                <ThemedText style={styles.reviewItemCustomer}>{rev.profiles?.name || 'Customer'}</ThemedText>
                <View style={styles.reviewStarsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <ThemedText key={star} style={{ fontSize: 12, color: star <= rev.rating ? '#FFD700' : 'rgba(255,255,255,0.15)' }}>★</ThemedText>
                  ))}
                </View>
              </View>
              {rev.comment ? (
                <ThemedText style={styles.reviewItemComment}>"{rev.comment}"</ThemedText>
              ) : null}
              <ThemedText style={styles.reviewItemDate}>{new Date(rev.created_at).toLocaleDateString()}</ThemedText>
            </View>
          ))}
        </View>
      )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  greeting: {
    fontSize: 16,
    color: '#B0B4BA',
    fontWeight: '500',
  },
  userName: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  logoutBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  logoutBtnText: {
    color: '#FF3333',
    fontWeight: '700',
    fontSize: 13,
  },
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusSub: {
    fontSize: 11,
    color: '#B0B4BA',
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: Spacing.two,
    letterSpacing: 0.5,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metricCard: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: Spacing.three,
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B0B4BA',
  },
  metricValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  growthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#B0B4BA',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 16,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  addBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  addBtnText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    height: 44,
    paddingHorizontal: Spacing.two,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    minHeight: 70,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  inputActive: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.02)',
  },
  saveBtn: {
    backgroundColor: '#00E5FF',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  saveBtnText: {
    color: '#050608',
    fontWeight: '800',
    fontSize: 13,
  },
  catalogCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.three,
    gap: 4,
  },
  catalogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catalogName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  catalogPrice: {
    fontSize: 13,
    color: '#00E5FF',
    fontWeight: '700',
    marginTop: 2,
  },
  catalogDesc: {
    fontSize: 12,
    color: '#B0B4BA',
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 2,
  },
  deleteBtn: {
    padding: Spacing.one,
  },
  deleteBtnText: {
    fontSize: 15,
  },
  bookingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 6,
  },
  bookingServiceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bookingPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00E5FF',
  },
  bookingEstTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookingDetails: {
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#B0B4BA',
    lineHeight: 16,
  },
  boldText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bookingActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  declineBtn: {
    borderColor: 'rgba(255, 51, 51, 0.3)',
    backgroundColor: 'rgba(255, 51, 51, 0.02)',
  },
  declineText: {
    color: '#FF3333',
    fontWeight: '700',
    fontSize: 12,
  },
  acceptBtn: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  acceptText: {
    color: '#050608',
    fontWeight: '800',
    fontSize: 12,
  },
  completeJobBtn: {
    backgroundColor: '#39FF14',
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  completeJobText: {
    color: '#050608',
    fontWeight: '800',
    fontSize: 12,
  },
  dialogCard: {
    backgroundColor: '#0A0C10',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00E5FF',
    padding: Spacing.four,
    gap: Spacing.three,
    marginVertical: Spacing.two,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  dialogTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dialogText: {
    fontSize: 12,
    color: '#B0B4BA',
    lineHeight: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  smallBtn: {
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  confirmBtn: {
    backgroundColor: '#00E5FF',
  },
  confirmBtnText: {
    color: '#050608',
    fontWeight: '800',
    fontSize: 12,
  },
  blockedScreenContainer: {
    flex: 1,
    backgroundColor: '#050608',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  blockedScreenCard: {
    backgroundColor: 'rgba(255, 51, 51, 0.04)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 51, 0.15)',
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  blockedScreenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF3333',
  },
  blockedScreenText: {
    fontSize: 14,
    color: '#B0B4BA',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  blockedScreenContact: {
    fontSize: 13,
    color: '#FFD700',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
  },
  reviewItemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.three,
    gap: 6,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewItemCustomer: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reviewStarsRow: {
    flexDirection: 'row',
  },
  reviewItemComment: {
    fontSize: 13,
    color: '#B0B4BA',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  reviewItemDate: {
    fontSize: 10,
    color: '#B0B4BA',
    opacity: 0.6,
    alignSelf: 'flex-end',
  },
});
