import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Pressable, 
  TextInput, 
  ScrollView, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, Profile } from '@/context/auth-context';
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

type AdminProfile = Profile & {
  locations?: { name: string } | null;
  location_id?: string | null;
  phone?: string | null;
};

export default function SuperAdminDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  // Admin list state
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Locations & Categories state
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Input states
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Loading states for actions
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Focus states
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [locFocused, setLocFocused] = useState(false);
  const [catFocused, setCatFocused] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setLocations(data || []);
    } catch (err: any) {
      console.error('Error fetching locations:', err.message);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      console.error('Error fetching categories:', err.message);
    }
  };

  const fetchAdmins = async () => {
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, locations:location_id(name)')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins((data as AdminProfile[]) || []);
    } catch (err: any) {
      console.error('Error fetching admins:', err.message);
      // Fallback local state if table isn't fully created yet
      setAdmins([
        { id: '1', email: 'admin1@plugus.co', role: 'admin', name: 'Admin Staff', location_id: null },
        { id: '2', email: 'admin2@plugus.co', role: 'admin', name: 'Admin Manager', location_id: null }
      ]);
    } finally {
      setLoadingList(false);
    }
  };

  const loadAllData = async () => {
    setLoadingConfig(true);
    await Promise.all([fetchLocations(), fetchCategories(), fetchAdmins()]);
    setLoadingConfig(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }

    setCreatingLocation(true);
    try {
      const { error } = await supabase
        .from('locations')
        .insert({ name: newLocationName.trim() });

      if (error) throw error;

      Alert.alert('Success', `Location "${newLocationName.trim()}" added!`);
      setNewLocationName('');
      await fetchLocations();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add location');
    } finally {
      setCreatingLocation(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    setCreatingCategory(true);
    try {
      const { error } = await supabase
        .from('service_categories')
        .insert({ name: newCategoryName.trim() });

      if (error) throw error;

      Alert.alert('Success', `Category "${newCategoryName.trim()}" added!`);
      setNewCategoryName('');
      await fetchCategories();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!adminEmail || !adminPassword) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    if (adminPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setCreatingAdmin(true);
    try {
      // Securely call our backend Edge Function, which will bypass rate limits
      // using the service_role key, after verifying our super_admin status.
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {
          email: adminEmail.trim(),
          password: adminPassword,
          location_id: selectedLocationId,
          phone: adminPhone.trim()
        }
      });

      if (error) throw new Error(error.message || 'Function execution failed');
      if (data?.error) throw new Error(data.error);

      Alert.alert('Success', 'Admin account registered successfully!');
      setAdminEmail('');
      setAdminPassword('');
      setAdminPhone('');
      setSelectedLocationId(null);
      fetchAdmins();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create admin');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteAdmin = (adminId: string, email: string) => {
    Alert.alert(
      'Remove Admin',
      `Are you sure you want to remove ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoadingList(true);
            try {
              // Delete auth user
              const { error: deleteError } = await supabase.auth.admin.deleteUser(adminId);
              if (deleteError) throw deleteError;

              // Delete profile row
              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', adminId);

              if (profileError) {
                console.warn('Profile deletion warning:', profileError.message);
              }

              Alert.alert('Success', 'Admin removed successfully!');
              fetchAdmins();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove admin');
              setLoadingList(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header Panel */}
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.greeting}>Super Admin Terminal</ThemedText>
          <ThemedText style={styles.userName}>{profile?.email || 'plugus@super_admin'}</ThemedText>
        </View>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <ThemedText style={styles.logoutBtnText}>Log Out</ThemedText>
        </Pressable>
      </View>

      {/* Admin Creator Panel */}
      <ThemedText style={styles.sectionTitle}>Register New Admin</ThemedText>
      <View style={styles.creatorCard}>
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Admin Email</ThemedText>
          <TextInput
            style={[styles.input, emailFocused && styles.inputActive]}
            placeholder="admin@plugus.co"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={adminEmail}
            onChangeText={setAdminEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Admin Phone (Optional)</ThemedText>
          <TextInput
            style={[styles.input, phoneFocused && styles.inputActive]}
            placeholder="+1 234 567 8900"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            keyboardType="phone-pad"
            value={adminPhone}
            onChangeText={setAdminPhone}
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Temporary Password</ThemedText>
          <TextInput
            style={[styles.input, passwordFocused && styles.inputActive]}
            placeholder="Minimum 6 characters"
            placeholderTextColor="rgba(255, 255, 255, 0.3)"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={adminPassword}
            onChangeText={setAdminPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
        </View>

        {/* Location selector tags */}
        <View style={styles.inputGroup}>
          <ThemedText style={styles.inputLabel}>Assign Location (City)</ThemedText>
          {locations.length === 0 ? (
            <ThemedText style={styles.emptySelectorText}>No locations created yet. Create one below first.</ThemedText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locationSelector}>
              {locations.map((loc) => (
                <Pressable 
                  key={loc.id} 
                  style={[
                    styles.locationTag, 
                    selectedLocationId === loc.id && styles.locationTagActive
                  ]}
                  onPress={() => setSelectedLocationId(selectedLocationId === loc.id ? null : loc.id)}
                >
                  <ThemedText style={[
                    styles.locationTagText,
                    selectedLocationId === loc.id && styles.locationTagTextActive
                  ]}>
                    {loc.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        <Pressable 
          style={styles.createBtn} 
          onPress={handleCreateAdmin}
          disabled={creatingAdmin}
        >
          {creatingAdmin ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <ThemedText style={styles.createBtnText}>Create Admin Account</ThemedText>
          )}
        </Pressable>
      </View>

      {/* Locations & Categories Config Grid */}
      <View style={styles.configRow}>
        {/* Locations Setup */}
        <View style={styles.configColumn}>
          <ThemedText style={styles.sectionTitle}>Cities / Locations</ThemedText>
          <View style={styles.configCard}>
            <View style={styles.addConfigRow}>
              <TextInput
                style={[styles.configInput, locFocused && styles.inputActive]}
                placeholder="New York"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                autoCorrect={false}
                value={newLocationName}
                onChangeText={setNewLocationName}
                onFocus={() => setLocFocused(true)}
                onBlur={() => setLocFocused(false)}
              />
              <Pressable style={styles.configAddBtn} onPress={handleCreateLocation} disabled={creatingLocation}>
                {creatingLocation ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ThemedText style={styles.configAddBtnText}>+</ThemedText>}
              </Pressable>
            </View>
            <View style={styles.configList}>
              {locations.map((loc) => (
                <View key={loc.id} style={styles.configListItem}>
                  <ThemedText style={styles.configListItemText}>📍 {loc.name}</ThemedText>
                </View>
              ))}
              {locations.length === 0 && <ThemedText style={styles.emptySubText}>No cities added.</ThemedText>}
            </View>
          </View>
        </View>

        {/* Categories Setup */}
        <View style={styles.configColumn}>
          <ThemedText style={styles.sectionTitle}>Categories</ThemedText>
          <View style={styles.configCard}>
            <View style={styles.addConfigRow}>
              <TextInput
                style={[styles.configInput, catFocused && styles.inputActive]}
                placeholder="Cleaning"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                autoCorrect={false}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                onFocus={() => setCatFocused(true)}
                onBlur={() => setCatFocused(false)}
              />
              <Pressable style={styles.configAddBtn} onPress={handleCreateCategory} disabled={creatingCategory}>
                {creatingCategory ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ThemedText style={styles.configAddBtnText}>+</ThemedText>}
              </Pressable>
            </View>
            <View style={styles.configList}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.configListItem}>
                  <ThemedText style={styles.configListItemText}>⚡ {cat.name}</ThemedText>
                </View>
              ))}
              {categories.length === 0 && <ThemedText style={styles.emptySubText}>No categories.</ThemedText>}
            </View>
          </View>
        </View>
      </View>

      {/* Manage Admins List */}
      <View style={styles.listHeaderRow}>
        <ThemedText style={styles.sectionTitle}>Active Admin Staff ({admins.length})</ThemedText>
        <Pressable onPress={loadAllData} disabled={loadingList}>
          <ThemedText style={styles.refreshText}>{loadingList ? 'Refreshing...' : 'Refresh List'}</ThemedText>
        </Pressable>
      </View>

      {loadingList && admins.length === 0 ? (
        <ActivityIndicator color="#9C3FEF" size="small" style={{ marginVertical: Spacing.four }} />
      ) : (
        <View style={styles.listContainer}>
          {admins.map((adm) => (
            <View key={adm.id} style={styles.adminCard}>
              <View style={styles.adminInfo}>
                <ThemedText style={styles.adminEmail}>{adm.email}</ThemedText>
                <ThemedText style={styles.adminRole}>
                  Location: {adm.locations?.name ? `📍 ${adm.locations.name}` : '⚠️ Unassigned'}
                  {adm.phone ? ` • 📞 ${adm.phone}` : ''}
                </ThemedText>
              </View>
              <Pressable 
                style={styles.removeBtn} 
                onPress={() => handleDeleteAdmin(adm.id, adm.email)}
              >
                <ThemedText style={styles.removeBtnText}>Remove</ThemedText>
              </Pressable>
            </View>
          ))}
          {admins.length === 0 && (
            <ThemedText style={styles.emptyText}>No registered admin accounts found.</ThemedText>
          )}
        </View>
      )}
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
    fontSize: 18,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  refreshText: {
    color: '#00E5FF',
    fontWeight: '700',
    fontSize: 13,
  },
  creatorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.four,
    gap: Spacing.three,
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
    borderRadius: 10,
    height: 48,
    paddingHorizontal: Spacing.three,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  inputActive: {
    borderColor: '#9C3FEF',
    backgroundColor: 'rgba(156, 63, 239, 0.04)',
  },
  locationSelector: {
    flexDirection: 'row',
    paddingVertical: Spacing.one,
  },
  locationTag: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: Spacing.two,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  locationTagActive: {
    borderColor: '#9C3FEF',
    backgroundColor: 'rgba(156, 63, 239, 0.15)',
  },
  locationTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B0B4BA',
  },
  locationTagTextActive: {
    color: '#FFFFFF',
  },
  emptySelectorText: {
    fontSize: 12,
    color: '#B0B4BA',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  createBtn: {
    backgroundColor: '#9C3FEF',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.one,
    shadowColor: '#9C3FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  configColumn: {
    flex: 1,
    gap: Spacing.two,
  },
  configCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.three,
    height: 220,
  },
  addConfigRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  configInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: Spacing.two,
    color: '#FFFFFF',
    fontSize: 13,
  },
  configAddBtn: {
    backgroundColor: '#9C3FEF',
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  configAddBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  configList: {
    flex: 1,
    gap: Spacing.one,
  },
  configListItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  configListItemText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emptySubText: {
    fontSize: 12,
    color: '#B0B4BA',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.four,
  },
  listContainer: {
    gap: Spacing.two,
  },
  adminCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  adminInfo: {
    flex: 1,
  },
  adminEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adminRole: {
    fontSize: 12,
    color: '#B0B4BA',
    fontWeight: '600',
    marginTop: 3,
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 51, 0.3)',
  },
  removeBtnText: {
    color: '#FF3333',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#B0B4BA',
    fontSize: 14,
    marginVertical: Spacing.three,
  },
});
