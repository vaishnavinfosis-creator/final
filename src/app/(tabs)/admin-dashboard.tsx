import { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/config/supabase';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface LocationInfo {
  id: string;
  name: string;
}

interface VendorRequest {
  id: string;
  owner_name: string;
  detailed_address: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  category_id: string;
  location_id: string;
  service_categories?: { name: string } | null;
  created_at: string;
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  // Location info
  const [assignedLocation, setAssignedLocation] = useState<LocationInfo | null>(null);

  // Vendor applications list
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<'approved' | 'rejected' | null>(null);

  // Approved vendors management
  const [approvedVendors, setApprovedVendors] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Complaints states
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [activeComplaintId, setActiveComplaintId] = useState<string | null>(null);
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const fetchLocationInfo = async () => {
    if (!profile?.location_id) return;
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', profile.location_id)
        .single();
      
      if (error) throw error;
      setAssignedLocation(data);
    } catch (err: any) {
      console.error('Error fetching location info:', err.message);
    }
  };

  const fetchVendorRequests = async () => {
    if (!profile?.location_id) return;
    setLoadingList(true);
    try {
      const { data, error } = await supabase
        .from('vendor_applications')
        .select('*, service_categories:category_id(name)')
        .eq('location_id', profile.location_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRequests((data as VendorRequest[]) || []);
    } catch (err: any) {
      console.error('Error fetching vendor requests:', err.message);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchApprovedVendors = async () => {
    if (!profile?.location_id) return;
    setLoadingVendors(true);
    try {
      const { data, error } = await supabase
        .from('vendor_applications')
        .select(`
          id,
          owner_name,
          detailed_address,
          description,
          status,
          category_id,
          location_id,
          service_categories (
            name
          ),
          profiles!inner (
            is_blocked
          )
        `)
        .eq('location_id', profile.location_id)
        .eq('status', 'approved')
        .order('owner_name', { ascending: true });

      if (error) throw error;
      setApprovedVendors(data || []);
    } catch (err: any) {
      console.error('Error fetching approved vendors:', err.message);
    } finally {
      setLoadingVendors(false);
    }
  };

  const handleDecision = async (requestId: string, approve: boolean) => {
    setActioningId(requestId);
    const status = approve ? 'approved' : 'rejected';
    setDecisionType(status);
    try {
      const { error } = await supabase
        .from('vendor_applications')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert(
        'Success', 
        `Application was successfully ${status}! ${approve ? 'The user is now upgraded to Vendor.' : ''}`
      );
      fetchVendorRequests();
      fetchApprovedVendors();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update application');
    } finally {
      setActioningId(null);
      setDecisionType(null);
    }
  };

  const handleToggleBlock = async (vendorId: string, currentBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: !currentBlocked })
        .eq('id', vendorId);
      if (error) throw error;
      Alert.alert('Success', `Vendor has been ${!currentBlocked ? 'blocked' : 'unblocked'} successfully.`);
      fetchApprovedVendors();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update vendor block status');
    }
  };

  const handleRemoveVendor = async (vendorId: string) => {
    Alert.alert(
      'Remove Vendor',
      'Are you sure you want to remove this vendor? This will demote them back to a customer role and reject their vendor status.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('vendor_applications')
                .update({ status: 'rejected' })
                .eq('id', vendorId);
              if (error) throw error;
              Alert.alert('Success', 'Vendor removed successfully');
              fetchApprovedVendors();
              fetchVendorRequests();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove vendor');
            }
          }
        }
      ]
    );
  };

  const fetchComplaints = async () => {
    if (!profile?.location_id) return;
    setLoadingComplaints(true);
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          id,
          booking_id,
          customer_id,
          vendor_id,
          subject,
          description,
          status,
          admin_notes,
          created_at,
          customer:profiles!complaints_customer_id_fkey (
            name,
            email
          ),
          vendor:profiles!complaints_vendor_id_fkey (
            name
          ),
          bookings (
            id,
            vendor_services (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (err: any) {
      console.error('Error fetching complaints:', err.message);
    } finally {
      setLoadingComplaints(false);
    }
  };

  const handleResolveComplaint = async (complaintId: string) => {
    if (!adminNotesInput.trim()) {
      Alert.alert('Error', 'Please enter resolution notes before resolving.');
      return;
    }
    setSubmittingResolution(true);
    try {
      const { error } = await supabase
        .from('complaints')
        .update({
          status: 'resolved',
          admin_notes: adminNotesInput.trim()
        })
        .eq('id', complaintId);
      
      if (error) throw error;
      Alert.alert('Success', 'Complaint has been resolved.');
      setAdminNotesInput('');
      setActiveComplaintId(null);
      fetchComplaints();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resolve complaint');
    } finally {
      setSubmittingResolution(false);
    }
  };

  const loadData = async () => {
    if (profile?.location_id) {
      await Promise.all([
        fetchLocationInfo(), 
        fetchVendorRequests(),
        fetchApprovedVendors(),
        fetchComplaints()
      ]);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  const getCategoryIcon = (name: string) => {
    const norm = name.toLowerCase().replace(/\s+/g, '');
    if (norm.includes('laundry')) return '🧺';
    if (norm.includes('electrician') || norm.includes('electrection')) return '⚡';
    if (norm.includes('plumbing') || norm.includes('pumbing')) return '🚰';
    if (norm.includes('clean') || norm.includes('houseclean')) return '🧹';
    return '🛠️';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Panel */}
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.greeting}>Administrator Portal</ThemedText>
          <ThemedText style={styles.userName}>{profile?.name || 'Staff Admin'}</ThemedText>
        </View>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <ThemedText style={styles.logoutBtnText}>Log Out</ThemedText>
        </Pressable>
      </View>

      {/* Assignment Status warning/banner */}
      {!profile?.location_id ? (
        <View style={styles.warningCard}>
          <ThemedText style={styles.warningTitle}>⚠️ Unassigned Admin Account</ThemedText>
          <ThemedText style={styles.warningText}>
            You have not been assigned to a operating city yet. Please ask the Super Admin to map your account to a location in order to receive vendor applications.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.locationCard}>
          <ThemedText style={styles.locationTitle}>📍 Assigned Operating City</ThemedText>
          <ThemedText style={styles.locationName}>
            {assignedLocation ? assignedLocation.name : 'Loading location...'}
          </ThemedText>
        </View>
      )}

      {profile?.location_id && (
        <>
          {/* Moderation section header */}
          <View style={styles.listHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Pending Vendor Applications ({requests.length})</ThemedText>
            <Pressable onPress={fetchVendorRequests} disabled={loadingList}>
              <ThemedText style={styles.refreshText}>{loadingList ? 'Refreshing...' : 'Refresh'}</ThemedText>
            </Pressable>
          </View>

          {/* Requests list container */}
          {loadingList && requests.length === 0 ? (
            <ActivityIndicator color="#00E5FF" size="small" style={{ marginVertical: Spacing.four }} />
          ) : (
            <View style={styles.listContainer}>
              {requests.map((req) => (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <ThemedText style={styles.requestOwner}>{req.owner_name}</ThemedText>
                    <View style={styles.categoryBadge}>
                      <ThemedText style={styles.categoryBadgeText}>
                        {getCategoryIcon(req.service_categories?.name || '')} {req.service_categories?.name || 'Service'}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText style={styles.requestFieldLabel}>Detailed Address:</ThemedText>
                  <ThemedText style={styles.requestFieldText}>{req.detailed_address}</ThemedText>

                  <ThemedText style={styles.requestFieldLabel}>Shop Description:</ThemedText>
                  <ThemedText style={styles.requestFieldText}>{req.description}</ThemedText>

                  <View style={styles.actionRow}>
                    <Pressable 
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => handleDecision(req.id, false)}
                      disabled={actioningId !== null}
                    >
                      {actioningId === req.id && decisionType === 'rejected' ? (
                        <ActivityIndicator color="#FF3333" size="small" />
                      ) : (
                        <ThemedText style={styles.rejectBtnText}>Reject</ThemedText>
                      )}
                    </Pressable>
                    <Pressable 
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => handleDecision(req.id, true)}
                      disabled={actioningId !== null}
                    >
                      {actioningId === req.id && decisionType === 'approved' ? (
                        <ActivityIndicator color="#050608" size="small" />
                      ) : (
                        <ThemedText style={styles.approveBtnText}>Approve & Upgrade</ThemedText>
                      )}
                    </Pressable>
                  </View>
                </View>
              ))}
              {requests.length === 0 && (
                <View style={styles.emptyCard}>
                  <ThemedText style={styles.emptyText}>🎉 No pending vendor applications for your city!</ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Approved Vendors Management Section */}
          <View style={styles.listHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Manage Active Vendors ({approvedVendors.length})</ThemedText>
            <Pressable onPress={fetchApprovedVendors} disabled={loadingVendors}>
              <ThemedText style={styles.refreshText}>{loadingVendors ? 'Refreshing...' : 'Refresh'}</ThemedText>
            </Pressable>
          </View>

          {loadingVendors && approvedVendors.length === 0 ? (
            <ActivityIndicator color="#00E5FF" size="small" style={{ marginVertical: Spacing.four }} />
          ) : (
            <View style={styles.listContainer}>
              {approvedVendors.map((vendor) => {
                const isBlocked = vendor.profiles?.is_blocked === true;
                const catName = vendor.service_categories?.name || 'Service';
                return (
                  <View key={vendor.id} style={[styles.requestCard, isBlocked && styles.blockedCard]}>
                    <View style={styles.requestHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ThemedText style={styles.requestOwner}>{vendor.owner_name}</ThemedText>
                          {isBlocked && (
                            <View style={styles.blockedBadge}>
                              <ThemedText style={styles.blockedBadgeText}>BLOCKED</ThemedText>
                            </View>
                          )}
                        </View>
                        <View style={[styles.categoryBadge, { alignSelf: 'flex-start', marginTop: 4 }]}>
                          <ThemedText style={styles.categoryBadgeText}>
                            {getCategoryIcon(catName)} {catName}
                          </ThemedText>
                        </View>
                      </View>
                    </View>

                    <ThemedText style={styles.requestFieldLabel}>Detailed Address:</ThemedText>
                    <ThemedText style={styles.requestFieldText}>{vendor.detailed_address}</ThemedText>

                    <ThemedText style={styles.requestFieldLabel}>Shop Description:</ThemedText>
                    <ThemedText style={styles.requestFieldText}>{vendor.description}</ThemedText>

                    <View style={styles.actionRow}>
                      <Pressable 
                        style={[
                          styles.actionBtn, 
                          isBlocked ? styles.unblockBtn : styles.blockBtn
                        ]}
                        onPress={() => handleToggleBlock(vendor.id, isBlocked)}
                      >
                        <ThemedText style={isBlocked ? styles.unblockBtnText : styles.blockBtnText}>
                          {isBlocked ? '🔓 Unblock' : '🚫 Block'}
                        </ThemedText>
                      </Pressable>
                      <Pressable 
                        style={[styles.actionBtn, styles.removeBtn]}
                        onPress={() => handleRemoveVendor(vendor.id)}
                      >
                        <ThemedText style={styles.removeBtnText}>Demote / Remove</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {approvedVendors.length === 0 && (
                <View style={styles.emptyCard}>
                  <ThemedText style={styles.emptyText}>No approved vendors listed in your city.</ThemedText>
                </View>
              )}
            </View>
          )}

          {/* Customer Complaints Section */}
          <View style={styles.listHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Customer Complaints Feed ({complaints.length})</ThemedText>
            <Pressable onPress={fetchComplaints} disabled={loadingComplaints}>
              <ThemedText style={styles.refreshText}>{loadingComplaints ? 'Refreshing...' : 'Refresh'}</ThemedText>
            </Pressable>
          </View>

          {loadingComplaints && complaints.length === 0 ? (
            <ActivityIndicator color="#FF3333" size="small" style={{ marginVertical: Spacing.four }} />
          ) : (
            <View style={styles.listContainer}>
              {complaints.map((c) => {
                const isResolved = c.status === 'resolved';
                return (
                  <View key={c.id} style={styles.complaintCard}>
                    <View style={styles.complaintHeader}>
                      <ThemedText style={styles.complaintTitle}>⚠️ {c.subject}</ThemedText>
                      <View style={[styles.blockedBadge, { 
                        backgroundColor: isResolved ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 215, 0, 0.15)' 
                      }]}>
                        <ThemedText style={[styles.blockedBadgeText, { 
                          color: isResolved ? '#39FF14' : '#FFD700' 
                        }]}>
                          {c.status.toUpperCase()}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.complaintMetaRow}>
                      <ThemedText style={styles.complaintMetaText}>
                        👤 Customer: <ThemedText style={{fontWeight: '700', color: '#FFFFFF'}}>{c.customer?.name || 'Client'}</ThemedText>
                      </ThemedText>
                      <ThemedText style={styles.complaintMetaText}>
                        🏪 Vendor: <ThemedText style={{fontWeight: '700', color: '#FFFFFF'}}>{c.vendor?.name || 'Shop'}</ThemedText>
                      </ThemedText>
                      <ThemedText style={styles.complaintMetaText}>
                        🛠️ Service: <ThemedText style={{fontWeight: '700', color: '#FFFFFF'}}>{c.bookings?.vendor_services?.name || 'Service'}</ThemedText>
                      </ThemedText>
                    </View>

                    <ThemedText style={styles.requestFieldLabel}>Description:</ThemedText>
                    <ThemedText style={styles.complaintDescText}>{c.description}</ThemedText>

                    {isResolved ? (
                      <View style={styles.adminNotesContainer}>
                        <ThemedText style={styles.adminNotesTitle}>📝 Resolution Notes:</ThemedText>
                        <ThemedText style={styles.adminNotesText}>{c.admin_notes}</ThemedText>
                      </View>
                    ) : (
                      activeComplaintId === c.id ? (
                        <View style={styles.resolutionForm}>
                          <TextInput
                            style={[styles.resolutionInput, notesFocused && styles.inputActive]}
                            placeholder="Enter resolution notes..."
                            placeholderTextColor="rgba(255, 255, 255, 0.3)"
                            multiline
                            numberOfLines={3}
                            value={adminNotesInput}
                            onChangeText={setAdminNotesInput}
                            onFocus={() => setNotesFocused(true)}
                            onBlur={() => setNotesFocused(false)}
                          />
                          <View style={styles.resolutionActions}>
                            <Pressable 
                              style={[styles.smallBtn, styles.cancelBtn]} 
                              onPress={() => {
                                setActiveComplaintId(null);
                                setAdminNotesInput('');
                              }}
                            >
                              <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
                            </Pressable>
                            <Pressable 
                              style={styles.resolutionSubmitBtn}
                              onPress={() => handleResolveComplaint(c.id)}
                              disabled={submittingResolution}
                            >
                              {submittingResolution ? (
                                <ActivityIndicator size="small" color="#050608" />
                              ) : (
                                <ThemedText style={styles.resolutionSubmitBtnText}>Mark as Resolved</ThemedText>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable 
                          style={styles.resolveActionBtn}
                          onPress={() => {
                            setActiveComplaintId(c.id);
                            setAdminNotesInput('');
                          }}
                        >
                          <ThemedText style={styles.resolveActionBtnText}>Resolve Complaint</ThemedText>
                        </Pressable>
                      )
                    )}
                  </View>
                );
              })}
              {complaints.length === 0 && (
                <View style={styles.emptyCard}>
                  <ThemedText style={styles.emptyText}>🎉 No complaints registered in your city!</ThemedText>
                </View>
              )}
            </View>
          )}
        </>
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
  warningCard: {
    backgroundColor: 'rgba(255, 51, 51, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 51, 0.15)',
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FF3333',
  },
  warningText: {
    fontSize: 13,
    color: '#B0B4BA',
    fontWeight: '500',
    lineHeight: 18,
  },
  locationCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    borderRadius: 16,
    padding: Spacing.three,
    gap: 4,
  },
  locationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5FF',
    opacity: 0.8,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginTop: Spacing.two,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  refreshText: {
    color: '#00E5FF',
    fontWeight: '700',
    fontSize: 13,
  },
  listContainer: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  requestCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  requestOwner: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  categoryBadge: {
    backgroundColor: 'rgba(156, 63, 239, 0.15)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#9C3FEF',
    fontSize: 10,
    fontWeight: '700',
  },
  requestFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00E5FF',
    marginTop: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requestFieldText: {
    fontSize: 13,
    color: '#B0B4BA',
    fontWeight: '500',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  rejectBtn: {
    borderColor: 'rgba(255, 51, 51, 0.3)',
    backgroundColor: 'rgba(255, 51, 51, 0.02)',
  },
  rejectBtnText: {
    color: '#FF3333',
    fontWeight: '700',
    fontSize: 13,
  },
  approveBtn: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  approveBtnText: {
    color: '#050608',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#B0B4BA',
    fontWeight: '500',
    fontSize: 13,
  },
  blockedCard: {
    borderColor: 'rgba(255, 51, 51, 0.2)',
    backgroundColor: 'rgba(255, 51, 51, 0.01)',
    opacity: 0.8,
  },
  blockedBadge: {
    backgroundColor: 'rgba(255, 51, 51, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockedBadgeText: {
    color: '#FF3333',
    fontSize: 9,
    fontWeight: '800',
  },
  blockBtn: {
    borderColor: 'rgba(255, 51, 51, 0.3)',
    backgroundColor: 'rgba(255, 51, 51, 0.02)',
  },
  blockBtnText: {
    color: '#FF3333',
    fontWeight: '700',
    fontSize: 13,
  },
  unblockBtn: {
    borderColor: 'rgba(57, 255, 20, 0.3)',
    backgroundColor: 'rgba(57, 255, 20, 0.02)',
  },
  unblockBtnText: {
    color: '#39FF14',
    fontWeight: '700',
    fontSize: 13,
  },
  removeBtn: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  removeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  complaintCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  complaintTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  complaintMetaRow: {
    gap: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    padding: Spacing.two,
    borderRadius: 8,
  },
  complaintMetaText: {
    fontSize: 12,
    color: '#B0B4BA',
  },
  complaintDescText: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  resolveActionBtn: {
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderWidth: 1,
    borderColor: '#39FF14',
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  resolveActionBtnText: {
    color: '#39FF14',
    fontWeight: '700',
    fontSize: 12,
  },
  resolutionForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    padding: Spacing.two,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.2)',
  },
  resolutionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    minHeight: 60,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  resolutionActions: {
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
  resolutionSubmitBtn: {
    backgroundColor: '#39FF14',
    paddingHorizontal: Spacing.three,
    height: 36,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resolutionSubmitBtnText: {
    color: '#050608',
    fontSize: 11,
    fontWeight: '800',
  },
  adminNotesContainer: {
    marginTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: Spacing.two,
  },
  adminNotesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#39FF14',
  },
  adminNotesText: {
    fontSize: 12,
    color: '#B0B4BA',
    fontStyle: 'italic',
  },
  inputActive: {
    borderColor: '#39FF14',
    backgroundColor: 'rgba(57, 255, 20, 0.02)',
  },
});
