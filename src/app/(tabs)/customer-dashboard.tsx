import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Pressable, 
  ScrollView, 
  TextInput, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/config/supabase';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface LocationItem {
  id: string;
  name: string;
}

interface CategoryItem {
  id: string;
  name: string;
}

interface VendorApplication {
  id: string;
  owner_name: string;
  category_id: string;
  location_id: string;
  detailed_address: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function CustomerDashboard() {
  const { profile, signOut, user, refreshProfile } = useAuth();
  const router = useRouter();

  // Collapsible state for Become a Vendor Form
  const [showVendorForm, setShowVendorForm] = useState(false);

  // Address states
  const [addressInput, setAddressInput] = useState(profile?.address || '');
  const [savingAddress, setSavingAddress] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressSettingFocused, setAddressSettingFocused] = useState(false);

  // DB lists
  const [dbLocations, setDbLocations] = useState<LocationItem[]>([]);
  const [dbCategories, setDbCategories] = useState<CategoryItem[]>([]);
  const [loadingFormConfig, setLoadingFormConfig] = useState(false);

  // Active Dashboard filters
  const [selectedDashboardLocationId, setSelectedDashboardLocationId] = useState<string | null>(null);
  const [selectedDashboardCategoryId, setSelectedDashboardCategoryId] = useState<string | null>(null);

  // Vendors list
  const [vendors, setVendors] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Become a Vendor Form states
  const [ownerName, setOwnerName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [detailedAddress, setDetailedAddress] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active Application state
  const [application, setApplication] = useState<VendorApplication | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);

  // Focus states for Become a Vendor
  const [ownerFocused, setOwnerFocused] = useState(false);
  const [addressFocused, setAddressFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  // Vendor Services browsing states
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [loadingVendorServices, setLoadingVendorServices] = useState(false);

  // Customer Bookings states
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [loadingCustBookings, setLoadingCustBookings] = useState(false);

  // Booking modal/form states
  const [bookingService, setBookingService] = useState<any | null>(null);
  const [bookingPhone, setBookingPhone] = useState('');
  const [bookingAddress, setBookingAddress] = useState(profile?.address || '');
  const [placingBooking, setPlacingBooking] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingPhoneFocused, setBookingPhoneFocused] = useState(false);
  const [bookingAddressFocused, setBookingAddressFocused] = useState(false);

  // Reviews & Complaints filing states
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingCommentFocused, setRatingCommentFocused] = useState(false);

  const [complaintBookingId, setComplaintBookingId] = useState<string | null>(null);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintSubjectFocused, setComplaintSubjectFocused] = useState(false);
  const [complaintDescFocused, setComplaintDescFocused] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const checkApplicationStatus = async () => {
    if (!user) return;
    setLoadingApp(true);
    try {
      const { data, error } = await supabase
        .from('vendor_applications')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      setApplication(data);
    } catch (err: any) {
      console.error('Error checking vendor application:', err.message);
    } finally {
      setLoadingApp(false);
    }
  };

  const loadFormConfig = async () => {
    setLoadingFormConfig(true);
    try {
      const [locRes, catRes] = await Promise.all([
        supabase.from('locations').select('*').order('name', { ascending: true }),
        supabase.from('service_categories').select('*').order('name', { ascending: true })
      ]);

      if (locRes.error) throw locRes.error;
      if (catRes.error) throw catRes.error;

      setDbLocations(locRes.data || []);
      setDbCategories(catRes.data || []);
    } catch (err: any) {
      console.error('Error loading form configurations:', err.message);
    } finally {
      setLoadingFormConfig(false);
    }
  };

  const fetchVendors = async () => {
    if (!selectedDashboardLocationId) return;
    setLoadingVendors(true);
    try {
      let query = supabase
        .from('vendor_applications')
        .select(`
          id,
          owner_name,
          category_id,
          location_id,
          detailed_address,
          description,
          status,
          service_categories (
            name
          ),
          profiles!inner (
            is_visible,
            is_blocked,
            reviews!reviews_vendor_id_fkey ( rating )
          )
        `)
        .eq('status', 'approved')
        .eq('location_id', selectedDashboardLocationId)
        .eq('profiles.is_visible', true)
        .eq('profiles.is_blocked', false);

      if (selectedDashboardCategoryId) {
        query = query.eq('category_id', selectedDashboardCategoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVendors(data || []);
    } catch (err: any) {
      console.error('Error fetching vendors:', err.message);
    } finally {
      setLoadingVendors(false);
    }
  };

  const fetchCustomerBookings = async () => {
    if (!user) return;
    setLoadingCustBookings(true);
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
          profiles!bookings_vendor_id_fkey (
            name
          ),
          vendor_services (
            name,
            price
          ),
          reviews (
            id,
            rating,
            comment
          ),
          complaints (
            id,
            subject,
            description,
            status,
            admin_notes
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomerBookings(data || []);
    } catch (err: any) {
      console.error('Error fetching customer bookings:', err.message);
    } finally {
      setLoadingCustBookings(false);
    }
  };

  const handleRateService = async (booking: any) => {
    if (!user) return;
    if (ratingValue < 1 || ratingValue > 5) {
      Alert.alert('Error', 'Please select a rating between 1 and 5 stars.');
      return;
    }
    setSubmittingRating(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          booking_id: booking.id,
          customer_id: user.id,
          vendor_id: booking.vendor_id,
          rating: ratingValue,
          comment: ratingComment.trim() || null
        });

      if (error) throw error;

      Alert.alert('Success', 'Thank you for your review!');
      setRatingBookingId(null);
      setRatingComment('');
      setRatingValue(5);
      fetchCustomerBookings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit review');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleFileComplaint = async (booking: any) => {
    if (!user) return;
    if (!complaintSubject.trim() || !complaintDescription.trim()) {
      Alert.alert('Error', 'Please enter a subject and detailed description.');
      return;
    }
    setSubmittingComplaint(true);
    try {
      const { error } = await supabase
        .from('complaints')
        .insert({
          booking_id: booking.id,
          customer_id: user.id,
          vendor_id: booking.vendor_id,
          subject: complaintSubject.trim(),
          description: complaintDescription.trim(),
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert('Success', 'Your complaint has been submitted. Local city admin will review it.');
      setComplaintBookingId(null);
      setComplaintSubject('');
      setComplaintDescription('');
      fetchCustomerBookings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to file complaint');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const toggleExpandVendor = async (vendorId: string) => {
    if (expandedVendorId === vendorId) {
      setExpandedVendorId(null);
      setVendorServices([]);
      return;
    }
    setExpandedVendorId(vendorId);
    setLoadingVendorServices(true);
    try {
      const { data, error } = await supabase
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('name', { ascending: true });
      if (error) throw error;
      setVendorServices(data || []);
    } catch (err: any) {
      console.error('Error fetching vendor services:', err.message);
    } finally {
      setLoadingVendorServices(false);
    }
  };

  const handlePlaceBooking = async () => {
    if (!bookingPhone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    if (!bookingAddress.trim()) {
      Alert.alert('Error', 'Please enter your delivery address');
      return;
    }
    if (!user || !bookingService) return;
    setPlacingBooking(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          vendor_id: bookingService.vendor_id,
          service_id: bookingService.id,
          customer_phone: bookingPhone.trim(),
          customer_address: bookingAddress.trim(),
          status: 'pending'
        });
      if (error) throw error;
      
      Alert.alert('Success', 'Your booking request has been submitted to the vendor!');
      setShowBookingModal(false);
      setBookingService(null);
      fetchCustomerBookings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to place booking');
    } finally {
      setPlacingBooking(false);
    }
  };

  useEffect(() => {
    checkApplicationStatus();
    loadFormConfig();
    fetchCustomerBookings();
  }, [user]);

  useEffect(() => {
    if (profile?.address) {
      setAddressInput(profile.address);
      setBookingAddress(profile.address);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.location_id) {
      setSelectedDashboardLocationId(profile.location_id);
    } else if (dbLocations.length > 0 && !selectedDashboardLocationId) {
      setSelectedDashboardLocationId(dbLocations[0].id);
    }
  }, [profile, dbLocations]);

  useEffect(() => {
    fetchVendors();
  }, [selectedDashboardLocationId, selectedDashboardCategoryId]);

  const handleSaveAddress = async () => {
    if (!user) return;
    if (!addressInput.trim()) {
      Alert.alert('Error', 'Please enter a valid address');
      return;
    }
    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ address: addressInput.trim() })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert('Success', 'Address updated successfully');
      await refreshProfile();
      setShowAddressForm(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSubmitVendorForm = async () => {
    if (!ownerName.trim() || !selectedCategoryId || !selectedLocationId || !detailedAddress.trim() || !shopDescription.trim()) {
      Alert.alert('Error', 'Please fill in all form fields');
      return;
    }

    if (!user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('vendor_applications')
        .upsert({
          id: user.id,
          owner_name: ownerName.trim(),
          category_id: selectedCategoryId,
          location_id: selectedLocationId,
          detailed_address: detailedAddress.trim(),
          description: shopDescription.trim(),
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert('Success', 'Application submitted! Under review.');
      setOwnerName('');
      setDetailedAddress('');
      setShopDescription('');
      setSelectedCategoryId(null);
      setSelectedLocationId(null);
      setShowVendorForm(false);
      checkApplicationStatus();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryIconAndColor = (name: string) => {
    const norm = name.toLowerCase().replace(/\s+/g, '');
    if (norm.includes('laundry')) return { icon: '🧺', color: '#00E5FF' };
    if (norm.includes('electrician') || norm.includes('electrection')) return { icon: '⚡', color: '#9C3FEF' };
    if (norm.includes('plumbing') || norm.includes('pumbing')) return { icon: '🚰', color: '#FF007F' };
    if (norm.includes('clean') || norm.includes('houseclean')) return { icon: '🧹', color: '#39FF14' };
    return { icon: '🛠️', color: '#B0B4BA' };
  };

  const activeBookings = customerBookings.filter(b => b.status === 'pending' || b.status === 'accepted');
  const pastBookings = customerBookings.filter(b => b.status === 'completed' || b.status === 'rejected');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header Panel */}
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.greeting}>Hello,</ThemedText>
          <ThemedText style={styles.userName}>{profile?.name || 'Customer'}</ThemedText>
        </View>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <ThemedText style={styles.logoutBtnText}>Log Out</ThemedText>
        </Pressable>
      </View>

      {/* Banner */}
      <View style={styles.banner}>
        <ThemedText style={styles.bannerText}>Professional Local Services</ThemedText>
        <ThemedText style={styles.bannerSub}>Find laundry, electrician, plumbing & housecleaning vendors near you</ThemedText>
      </View>

      {/* Delivery Address Section */}
      <View style={styles.addressCard}>
        <View style={styles.addressHeader}>
          <ThemedText style={styles.addressLabel}>📍 Delivery Address</ThemedText>
          <Pressable 
            style={styles.addressEditBtn}
            onPress={() => setShowAddressForm(!showAddressForm)}
          >
            <ThemedText style={styles.addressEditBtnText}>
              {profile?.address ? 'Edit Address' : 'Set Address'}
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText style={styles.addressValue}>
          {profile?.address || 'No address saved yet. Please set your delivery address.'}
        </ThemedText>

        {showAddressForm && (
          <View style={styles.addressFormContainer}>
            <TextInput
              style={[styles.input, addressSettingFocused && styles.inputActive]}
              placeholder="Enter your flat/street address here..."
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              value={addressInput}
              onChangeText={setAddressInput}
              onFocus={() => setAddressSettingFocused(true)}
              onBlur={() => setAddressSettingFocused(false)}
            />
            <Pressable 
              style={styles.saveAddressBtn}
              onPress={handleSaveAddress}
              disabled={savingAddress}
            >
              {savingAddress ? (
                <ActivityIndicator size="small" color="#050608" />
              ) : (
                <ThemedText style={styles.saveAddressBtnText}>Save Address</ThemedText>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {/* Become a Vendor Hidden Submenu Section */}
      {loadingApp ? (
        <ActivityIndicator size="small" color="#9C3FEF" />
      ) : application?.status === 'pending' ? (
        <View style={styles.reviewCard}>
          <ThemedText style={styles.reviewCardTitle}>⏳ Application Under Review</ThemedText>
          <ThemedText style={styles.reviewCardText}>
            Your application for becoming a Vendor is currently under review by our city admins. You will gain access to the Vendor Dashboard once approved.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.menuContainer}>
          <Pressable 
            style={styles.menuHeader} 
            onPress={() => setShowVendorForm(!showVendorForm)}
          >
            <ThemedText style={styles.menuTitle}>🏪 Become a Vendor Partner</ThemedText>
            <ThemedText style={styles.menuArrow}>{showVendorForm ? '▲' : '▼'}</ThemedText>
          </Pressable>

          {showVendorForm && (
            <View style={styles.formContainer}>
              <ThemedText style={styles.formIntro}>
                Apply to list your local service shop on our plugus marketplace!
              </ThemedText>

              {loadingFormConfig ? (
                <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: Spacing.three }} />
              ) : (
                <>
                  {/* Owner Name */}
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Owner Name</ThemedText>
                    <TextInput
                      style={[styles.input, ownerFocused && styles.inputActive]}
                      placeholder="e.g. John Doe"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      autoCorrect={false}
                      value={ownerName}
                      onChangeText={setOwnerName}
                      onFocus={() => setOwnerFocused(true)}
                      onBlur={() => setOwnerFocused(false)}
                    />
                  </View>

                  {/* Category of Service */}
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Service Category</ThemedText>
                    {dbCategories.length === 0 ? (
                      <ThemedText style={styles.emptyFieldText}>No categories available.</ThemedText>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSelector}>
                        {dbCategories.map((cat) => {
                          const catMeta = getCategoryIconAndColor(cat.name);
                          return (
                            <Pressable 
                              key={cat.id} 
                              style={[
                                styles.selectorTag, 
                                selectedCategoryId === cat.id && styles.selectorTagActive
                              ]}
                              onPress={() => setSelectedCategoryId(cat.id)}
                            >
                              <ThemedText style={[
                                styles.selectorTagText,
                                selectedCategoryId === cat.id && styles.selectorTagTextActive
                              ]}>
                                {catMeta.icon} {cat.name}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>

                  {/* Service City Location */}
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Operating City</ThemedText>
                    {dbLocations.length === 0 ? (
                      <ThemedText style={styles.emptyFieldText}>No cities active.</ThemedText>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSelector}>
                        {dbLocations.map((loc) => (
                          <Pressable 
                            key={loc.id} 
                            style={[
                              styles.selectorTag, 
                              selectedLocationId === loc.id && styles.selectorTagActive
                            ]}
                            onPress={() => setSelectedLocationId(loc.id)}
                          >
                            <ThemedText style={[
                              styles.selectorTagText,
                              selectedLocationId === loc.id && styles.selectorTagTextActive
                            ]}>
                              📍 {loc.name}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>

                  {/* Detailed Address */}
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Detailed Address</ThemedText>
                    <TextInput
                      style={[styles.input, addressFocused && styles.inputActive]}
                      placeholder="e.g. Suite 4B, 101 Broadway Ave"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      autoCorrect={false}
                      value={detailedAddress}
                      onChangeText={setDetailedAddress}
                      onFocus={() => setAddressFocused(true)}
                      onBlur={() => setAddressFocused(false)}
                    />
                  </View>

                  {/* Description of their shop */}
                  <View style={styles.inputGroup}>
                    <ThemedText style={styles.inputLabel}>Shop Description</ThemedText>
                    <TextInput
                      style={[styles.textArea, descFocused && styles.inputActive]}
                      placeholder="e.g. Local laundry shop providing professional washing and dry cleaning services."
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      multiline
                      numberOfLines={4}
                      value={shopDescription}
                      onChangeText={setShopDescription}
                      onFocus={() => setDescFocused(true)}
                      onBlur={() => setDescFocused(false)}
                    />
                  </View>

                  {/* Submit Button */}
                  <Pressable 
                    style={styles.submitBtn} 
                    onPress={handleSubmitVendorForm}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={styles.submitBtnText}>Submit Partnership Application</ThemedText>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {/* Booking Confirmation Dialog Overlay */}
      {showBookingModal && bookingService && (
        <View style={styles.bookingModalContainer}>
          <ThemedText style={styles.bookingModalTitle}>Confirm Booking Request</ThemedText>
          <ThemedText style={styles.bookingModalSubtitle}>
            Booking: <ThemedText style={styles.boldWhiteText}>{bookingService.name}</ThemedText> (₹{bookingService.price.toFixed(2)})
          </ThemedText>
          
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Contact Phone Number</ThemedText>
            <TextInput
              style={[styles.input, bookingPhoneFocused && styles.inputActive]}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              keyboardType="phone-pad"
              value={bookingPhone}
              onChangeText={setBookingPhone}
              onFocus={() => setBookingPhoneFocused(true)}
              onBlur={() => setBookingPhoneFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Service Delivery Address</ThemedText>
            <TextInput
              style={[styles.input, bookingAddressFocused && styles.inputActive]}
              placeholder="Confirm your delivery address..."
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              value={bookingAddress}
              onChangeText={setBookingAddress}
              onFocus={() => setBookingAddressFocused(true)}
              onBlur={() => setBookingAddressFocused(false)}
            />
          </View>

          <View style={styles.bookingModalActions}>
            <Pressable 
              style={[styles.smallModalBtn, styles.modalCancelBtn]} 
              onPress={() => {
                setShowBookingModal(false);
                setBookingService(null);
              }}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </Pressable>
            
            <Pressable 
              style={[styles.smallModalBtn, styles.modalConfirmBtn]} 
              onPress={handlePlaceBooking}
              disabled={placingBooking}
            >
              {placingBooking ? (
                <ActivityIndicator size="small" color="#050608" />
              ) : (
                <ThemedText style={styles.modalConfirmText}>Confirm Booking</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Browse Locations Selector */}
      <View style={styles.inputGroup}>
        <ThemedText style={styles.sectionTitle}>📍 Service Locations</ThemedText>
        {dbLocations.length === 0 ? (
          <ThemedText style={styles.emptyFieldText}>No locations available.</ThemedText>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSelector}>
            {dbLocations.map((loc) => {
              const isActive = selectedDashboardLocationId === loc.id;
              return (
                <Pressable 
                  key={loc.id} 
                  style={[
                    styles.selectorTag, 
                    isActive && styles.selectorTagActive
                  ]}
                  onPress={() => setSelectedDashboardLocationId(loc.id)}
                >
                  <ThemedText style={[
                    styles.selectorTagText,
                    isActive && styles.selectorTagTextActive
                  ]}>
                    📍 {loc.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Category Selection Filter */}
      <View style={styles.inputGroup}>
        <ThemedText style={styles.sectionTitle}>🧺 Explore Categories</ThemedText>
        {dbCategories.length === 0 ? (
          <ThemedText style={styles.emptyFieldText}>No categories active.</ThemedText>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollSelector}>
            <Pressable 
              style={[
                styles.selectorTag, 
                selectedDashboardCategoryId === null && styles.selectorTagActive
              ]}
              onPress={() => setSelectedDashboardCategoryId(null)}
            >
              <ThemedText style={[
                styles.selectorTagText,
                selectedDashboardCategoryId === null && styles.selectorTagTextActive
              ]}>
                🌟 All Services
              </ThemedText>
            </Pressable>
            {dbCategories.map((cat) => {
              const isActive = selectedDashboardCategoryId === cat.id;
              const catMeta = getCategoryIconAndColor(cat.name);
              return (
                <Pressable 
                  key={cat.id} 
                  style={[
                    styles.selectorTag, 
                    isActive && styles.selectorTagActive
                  ]}
                  onPress={() => setSelectedDashboardCategoryId(cat.id)}
                >
                  <ThemedText style={[
                    styles.selectorTagText,
                    isActive && styles.selectorTagTextActive
                  ]}>
                    {catMeta.icon} {cat.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Vendors Listing */}
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.sectionTitle}>
          🏪 Approved Service Providers
        </ThemedText>
        
        {loadingVendors ? (
          <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: Spacing.four }} />
        ) : vendors.length === 0 ? (
          <View style={styles.emptyVendorsCard}>
            <ThemedText style={styles.emptyVendorsText}>
              No service vendors currently registered/approved in this area.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.vendorGrid}>
            {vendors.map((v) => {
              const catName = v.service_categories?.name || 'Service';
              const catMeta = getCategoryIconAndColor(catName);
              const isExpanded = expandedVendorId === v.id;
              return (
                <View key={v.id} style={[styles.vendorCard, { borderColor: `${catMeta.color}30` }]}>
                  <View style={styles.vendorCardHeader}>
                    <View style={[styles.vendorIconContainer, { backgroundColor: `${catMeta.color}15` }]}>
                      <ThemedText style={styles.vendorIcon}>{catMeta.icon}</ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ThemedText style={styles.vendorName}>{v.owner_name}</ThemedText>
                        {(() => {
                          const vendorReviews = v.profiles?.reviews || [];
                          if (vendorReviews.length > 0) {
                            const avg = vendorReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / vendorReviews.length;
                            return <ThemedText style={{ fontSize: 13, color: '#FFD700', fontWeight: 'bold' }}>⭐ {avg.toFixed(1)}</ThemedText>;
                          }
                          return <ThemedText style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>New</ThemedText>;
                        })()}
                      </View>
                      <View style={[styles.categoryBadge, { backgroundColor: `${catMeta.color}25` }]}>
                        <ThemedText style={[styles.categoryBadgeText, { color: catMeta.color }]}>
                          {catName}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <ThemedText style={styles.vendorDesc}>{v.description}</ThemedText>
                  <View style={styles.vendorAddressRow}>
                    <ThemedText style={styles.vendorAddressText}>📍 {v.detailed_address}</ThemedText>
                  </View>

                  {/* Expanded Vendor Services */}
                  <Pressable 
                    style={styles.expandServicesHeader}
                    onPress={() => toggleExpandVendor(v.id)}
                  >
                    <ThemedText style={styles.expandServicesText}>
                      {isExpanded ? 'Hide Services ▲' : 'Browse Services ▼'}
                    </ThemedText>
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.servicesContainer}>
                      {loadingVendorServices ? (
                        <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: Spacing.two }} />
                      ) : vendorServices.length === 0 ? (
                        <ThemedText style={styles.noServicesText}>
                          No services listed by this vendor yet.
                        </ThemedText>
                      ) : (
                        <View style={{ gap: Spacing.two }}>
                          {vendorServices.map((service) => (
                            <View key={service.id} style={styles.serviceRow}>
                              <View style={{ flex: 1 }}>
                                <ThemedText style={styles.serviceName}>{service.name}</ThemedText>
                                {service.description ? (
                                  <ThemedText style={styles.serviceDesc}>{service.description}</ThemedText>
                                ) : null}
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                <ThemedText style={styles.servicePrice}>₹{service.price.toFixed(2)}</ThemedText>
                                <Pressable 
                                  style={styles.bookServiceBtn}
                                  onPress={() => {
                                    setBookingService(service);
                                    setBookingPhone('');
                                    setBookingAddress(profile?.address || '');
                                    setShowBookingModal(true);
                                  }}
                                >
                                  <ThemedText style={styles.bookServiceText}>Book</ThemedText>
                                </Pressable>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Active Service Orders */}
      <View style={{ flex: 1, marginTop: Spacing.two }}>
        <ThemedText style={styles.sectionTitle}>📅 Active Service Orders ({activeBookings.length})</ThemedText>
        {loadingCustBookings ? (
          <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: Spacing.three }} />
        ) : activeBookings.length === 0 ? (
          <View style={styles.emptyVendorsCard}>
            <ThemedText style={styles.emptyVendorsText}>
              No active service orders currently in progress.
            </ThemedText>
          </View>
        ) : (
          <View style={{ gap: Spacing.three, marginTop: Spacing.one }}>
            {activeBookings.map((b) => {
              const statusColor = 
                b.status === 'pending' ? '#FFD700' :
                b.status === 'accepted' ? '#00E5FF' :
                b.status === 'completed' ? '#39FF14' : '#FF3333';

              return (
                <View key={b.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.orderService}>{b.vendor_services?.name || 'Service'}</ThemedText>
                      <ThemedText style={styles.orderVendor}>By: {b.profiles?.name || 'Vendor'}</ThemedText>
                    </View>
                    <ThemedText style={[styles.orderStatus, { color: statusColor, borderColor: statusColor }]}>
                      {b.status.toUpperCase()}
                    </ThemedText>
                  </View>
                  
                  {b.status === 'accepted' && b.estimated_time && (
                    <View style={styles.etaContainer}>
                      <ThemedText style={styles.etaText}>
                        ⏳ Estimated Arrival: <ThemedText style={styles.etaValue}>{b.estimated_time}</ThemedText>
                      </ThemedText>
                    </View>
                  )}
                  
                  <View style={styles.orderDetailsRow}>
                    <ThemedText style={styles.orderDetailText}>💰 Price: ₹{b.vendor_services?.price || '0.00'}</ThemedText>
                    <ThemedText style={styles.orderDetailText}>📍 Address: {b.customer_address}</ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Service Order History */}
      <View style={{ flex: 1, marginTop: Spacing.three }}>
        <ThemedText style={styles.sectionTitle}>📜 Service Order History ({pastBookings.length})</ThemedText>
        {loadingCustBookings ? (
          <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: Spacing.three }} />
        ) : pastBookings.length === 0 ? (
          <View style={styles.emptyVendorsCard}>
            <ThemedText style={styles.emptyVendorsText}>
              No completed or rejected service orders.
            </ThemedText>
          </View>
        ) : (
          <View style={{ gap: Spacing.three, marginTop: Spacing.one }}>
            {pastBookings.map((b) => {
              const statusColor = 
                b.status === 'completed' ? '#39FF14' : '#FF3333';

              const review = b.reviews ? (Array.isArray(b.reviews) ? b.reviews[0] : b.reviews) : null;
              const complaintsList = b.complaints ? (Array.isArray(b.complaints) ? b.complaints : [b.complaints]) : [];

              return (
                <View key={b.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.orderService}>{b.vendor_services?.name || 'Service'}</ThemedText>
                      <ThemedText style={styles.orderVendor}>By: {b.profiles?.name || 'Vendor'}</ThemedText>
                    </View>
                    <ThemedText style={[styles.orderStatus, { color: statusColor, borderColor: statusColor }]}>
                      {b.status.toUpperCase()}
                    </ThemedText>
                  </View>
                  
                  <View style={styles.orderDetailsRow}>
                    <ThemedText style={styles.orderDetailText}>💰 Price: ₹{b.vendor_services?.price || '0.00'}</ThemedText>
                    <ThemedText style={styles.orderDetailText}>📍 Address: {b.customer_address}</ThemedText>
                  </View>

                  <View style={styles.orderActionsContainer}>
                    {/* Review Section */}
                    {review ? (
                      <View style={styles.reviewShowCard}>
                        <ThemedText style={styles.reviewShowTitle}>🌟 Your Review</ThemedText>
                        <View style={styles.ratingStarsRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <ThemedText key={star} style={{ fontSize: 14, color: star <= review.rating ? '#FFD700' : 'rgba(255,255,255,0.2)' }}>★</ThemedText>
                          ))}
                        </View>
                        {review.comment ? (
                          <ThemedText style={styles.reviewShowComment}>"{review.comment}"</ThemedText>
                        ) : null}
                      </View>
                    ) : (
                      ratingBookingId === b.id ? (
                        <View style={styles.inlineFormCard}>
                          <ThemedText style={styles.inlineFormTitle}>⭐ Rate Service</ThemedText>
                          <View style={styles.ratingSelectorRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Pressable key={star} onPress={() => setRatingValue(star)} style={{ padding: 4 }}>
                                <ThemedText style={{ fontSize: 24, color: star <= ratingValue ? '#FFD700' : 'rgba(255,255,255,0.2)' }}>★</ThemedText>
                              </Pressable>
                            ))}
                          </View>
                          <TextInput
                            style={[styles.smallInput, ratingCommentFocused && styles.inputActive]}
                            placeholder="Write feedback comment (optional)..."
                            placeholderTextColor="rgba(255, 255, 255, 0.3)"
                            value={ratingComment}
                            onChangeText={setRatingComment}
                            onFocus={() => setRatingCommentFocused(true)}
                            onBlur={() => setRatingCommentFocused(false)}
                          />
                          <View style={styles.inlineFormActions}>
                            <Pressable style={styles.inlineCancelBtn} onPress={() => setRatingBookingId(null)}>
                              <ThemedText style={styles.inlineCancelText}>Cancel</ThemedText>
                            </Pressable>
                            <Pressable style={styles.inlineSubmitBtn} onPress={() => handleRateService(b)} disabled={submittingRating}>
                              {submittingRating ? (
                                <ActivityIndicator size="small" color="#050608" />
                              ) : (
                                <ThemedText style={styles.inlineSubmitText}>Submit Review</ThemedText>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        b.status === 'completed' && (
                          <Pressable 
                            style={styles.actionOutlineBtn}
                            onPress={() => {
                              setRatingBookingId(b.id);
                              setRatingValue(5);
                              setRatingComment('');
                              setComplaintBookingId(null);
                            }}
                          >
                            <ThemedText style={styles.actionOutlineBtnText}>⭐ Rate Service</ThemedText>
                          </Pressable>
                        )
                      )
                    )}

                    {/* Complaint Section */}
                    {complaintsList.length > 0 ? (
                      <View style={{ gap: Spacing.two, marginTop: Spacing.one }}>
                        {complaintsList.map((complaint: any) => (
                          <View key={complaint.id} style={styles.complaintShowCard}>
                            <View style={styles.complaintShowHeader}>
                              <ThemedText style={styles.complaintShowTitle}>⚠️ Complaint filed</ThemedText>
                              <View style={[styles.complaintStatusBadge, { 
                                backgroundColor: complaint.status === 'resolved' ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 215, 0, 0.15)',
                                borderColor: complaint.status === 'resolved' ? '#39FF14' : '#FFD700'
                              }]}>
                                <ThemedText style={[styles.complaintStatusText, { color: complaint.status === 'resolved' ? '#39FF14' : '#FFD700' }]}>
                                  {complaint.status.toUpperCase()}
                                </ThemedText>
                              </View>
                            </View>
                            <ThemedText style={styles.complaintShowSubject}>
                              <ThemedText style={{fontWeight: '700', color: '#FFFFFF'}}>Subject:</ThemedText> {complaint.subject}
                            </ThemedText>
                            <ThemedText style={styles.complaintShowDesc}>{complaint.description}</ThemedText>
                            {complaint.admin_notes ? (
                              <View style={styles.adminNotesContainer}>
                                <ThemedText style={styles.adminNotesTitle}>📝 Admin Resolution Notes:</ThemedText>
                                <ThemedText style={styles.adminNotesText}>{complaint.admin_notes}</ThemedText>
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : (
                      complaintBookingId === b.id ? (
                        <View style={styles.inlineFormCard}>
                          <ThemedText style={styles.inlineFormTitle}>⚠️ File Complaint</ThemedText>
                          <TextInput
                            style={[styles.smallInput, complaintSubjectFocused && styles.inputActive]}
                            placeholder="Complaint Subject (e.g. Service quality, timing)..."
                            placeholderTextColor="rgba(255, 255, 255, 0.3)"
                            value={complaintSubject}
                            onChangeText={setComplaintSubject}
                            onFocus={() => setComplaintSubjectFocused(true)}
                            onBlur={() => setComplaintSubjectFocused(false)}
                          />
                          <TextInput
                            style={[styles.smallTextArea, complaintDescFocused && styles.inputActive]}
                            placeholder="Detailed explanation of the issue..."
                            placeholderTextColor="rgba(255, 255, 255, 0.3)"
                            multiline
                            numberOfLines={3}
                            value={complaintDescription}
                            onChangeText={setComplaintDescription}
                            onFocus={() => setComplaintDescFocused(true)}
                            onBlur={() => setComplaintDescFocused(false)}
                          />
                          <View style={styles.inlineFormActions}>
                            <Pressable style={styles.inlineCancelBtn} onPress={() => setComplaintBookingId(null)}>
                              <ThemedText style={styles.inlineCancelText}>Cancel</ThemedText>
                            </Pressable>
                            <Pressable style={[styles.inlineSubmitBtn, { backgroundColor: '#FF3333' }]} onPress={() => handleFileComplaint(b)} disabled={submittingComplaint}>
                              {submittingComplaint ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <ThemedText style={[styles.inlineSubmitText, { color: '#FFFFFF' }]}>Submit Complaint</ThemedText>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable 
                          style={[styles.actionDangerOutlineBtn, { marginTop: Spacing.one }]}
                          onPress={() => {
                            setComplaintBookingId(b.id);
                            setComplaintSubject('');
                            setComplaintDescription('');
                            setRatingBookingId(null);
                          }}
                        >
                          <ThemedText style={styles.actionDangerOutlineBtnText}>⚠️ File Complaint</ThemedText>
                        </Pressable>
                      )
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050608',
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
  banner: {
    backgroundColor: 'rgba(156, 63, 239, 0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(156, 63, 239, 0.15)',
    padding: Spacing.four,
    gap: Spacing.one,
  },
  bannerText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bannerSub: {
    fontSize: 13,
    color: '#B0B4BA',
    fontWeight: '500',
  },
  reviewCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  reviewCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFD700',
  },
  reviewCardText: {
    fontSize: 13,
    color: '#B0B4BA',
    fontWeight: '500',
    lineHeight: 18,
  },
  menuContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  menuArrow: {
    color: '#B0B4BA',
    fontSize: 10,
    fontWeight: '700',
  },
  formContainer: {
    padding: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    gap: Spacing.three,
  },
  formIntro: {
    fontSize: 12,
    color: '#B0B4BA',
    fontWeight: '500',
    lineHeight: 16,
  },
  inputGroup: {
    gap: Spacing.one,
  },
  inputLabel: {
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
    minHeight: 80,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  inputActive: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.02)',
  },
  scrollSelector: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  selectorTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: Spacing.two,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  selectorTagActive: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
  },
  selectorTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B0B4BA',
  },
  selectorTagTextActive: {
    color: '#FFFFFF',
  },
  emptyFieldText: {
    fontSize: 11,
    color: '#FF3333',
    fontStyle: 'italic',
  },
  submitBtn: {
    backgroundColor: '#00E5FF',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  submitBtnText: {
    color: '#050608',
    fontWeight: '800',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: Spacing.two,
    letterSpacing: 0.5,
  },
  addressCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#00E5FF',
  },
  addressEditBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  addressEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addressValue: {
    fontSize: 13,
    color: '#B0B4BA',
    lineHeight: 18,
  },
  addressFormContainer: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  saveAddressBtn: {
    backgroundColor: '#00E5FF',
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveAddressBtnText: {
    color: '#050608',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyVendorsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  emptyVendorsText: {
    color: '#B0B4BA',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  vendorGrid: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  vendorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  vendorCardHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  vendorIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorIcon: {
    fontSize: 18,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  vendorDesc: {
    fontSize: 13,
    color: '#B0B4BA',
    lineHeight: 18,
  },
  vendorAddressRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
  },
  vendorAddressText: {
    fontSize: 12,
    color: '#B0B4BA',
    fontWeight: '500',
  },
  expandServicesHeader: {
    marginTop: Spacing.two,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  expandServicesText: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '700',
  },
  servicesContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    padding: Spacing.two,
    marginTop: Spacing.one,
  },
  noServicesText: {
    fontSize: 12,
    color: '#B0B4BA',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: Spacing.two,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  serviceDesc: {
    fontSize: 11,
    color: '#B0B4BA',
    marginTop: 2,
    lineHeight: 14,
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00E5FF',
  },
  bookServiceBtn: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bookServiceText: {
    color: '#050608',
    fontSize: 11,
    fontWeight: '800',
  },
  bookingModalContainer: {
    backgroundColor: '#0A0C10',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00E5FF',
    padding: Spacing.four,
    gap: Spacing.three,
    marginVertical: Spacing.two,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  bookingModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00E5FF',
  },
  bookingModalSubtitle: {
    fontSize: 13,
    color: '#B0B4BA',
  },
  boldWhiteText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bookingModalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
    marginTop: Spacing.one,
  },
  smallModalBtn: {
    height: 38,
    paddingHorizontal: Spacing.four,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  modalConfirmBtn: {
    backgroundColor: '#00E5FF',
  },
  modalConfirmText: {
    color: '#050608',
    fontWeight: '800',
    fontSize: 12,
  },
  orderCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderService: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  orderVendor: {
    fontSize: 12,
    color: '#B0B4BA',
    marginTop: 2,
  },
  orderStatus: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  etaContainer: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    padding: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  etaText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  etaValue: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  orderDetailsRow: {
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: Spacing.two,
  },
  orderDetailText: {
    fontSize: 11,
    color: '#B0B4BA',
  },
  orderActionsContainer: {
    marginTop: Spacing.two,
    gap: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: Spacing.two,
  },
  actionOutlineBtn: {
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.02)',
  },
  actionOutlineBtnText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
  },
  actionDangerOutlineBtn: {
    borderWidth: 1,
    borderColor: '#FF3333',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 51, 51, 0.02)',
  },
  actionDangerOutlineBtnText: {
    color: '#FF3333',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineFormCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  inlineFormTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ratingSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  smallInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    height: 36,
    paddingHorizontal: Spacing.two,
    color: '#FFFFFF',
    fontSize: 12,
  },
  smallTextArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    minHeight: 60,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  inlineFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  inlineCancelBtn: {
    paddingHorizontal: Spacing.three,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  inlineCancelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  inlineSubmitBtn: {
    paddingHorizontal: Spacing.three,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
  },
  inlineSubmitText: {
    color: '#050608',
    fontSize: 11,
    fontWeight: '800',
  },
  reviewShowCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: Spacing.two,
    gap: 4,
  },
  reviewShowTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD700',
  },
  ratingStarsRow: {
    flexDirection: 'row',
  },
  reviewShowComment: {
    fontSize: 12,
    color: '#B0B4BA',
    fontStyle: 'italic',
  },
  complaintShowCard: {
    backgroundColor: 'rgba(255, 51, 51, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 51, 0.1)',
    borderRadius: 12,
    padding: Spacing.two,
    gap: 4,
  },
  complaintShowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  complaintShowTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF3333',
  },
  complaintStatusBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  complaintStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  complaintShowSubject: {
    fontSize: 12,
    color: '#B0B4BA',
  },
  complaintShowDesc: {
    fontSize: 11,
    color: '#B0B4BA',
    opacity: 0.8,
  },
  adminNotesContainer: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 4,
  },
  adminNotesTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#39FF14',
  },
  adminNotesText: {
    fontSize: 11,
    color: '#B0B4BA',
    fontStyle: 'italic',
  },
});
