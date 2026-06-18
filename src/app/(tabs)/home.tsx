import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '@/context/auth-context';
import CustomerDashboard from './customer-dashboard';
import VendorDashboard from './vendor-dashboard';
import AdminDashboard from './admin-dashboard';
import SuperAdminDashboard from './super-admin-dashboard';

export default function HomeScreen() {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9C3FEF" />
      </View>
    );
  }

  if (role === 'super_admin') {
    return <SuperAdminDashboard />;
  }

  if (role === 'admin') {
    return <AdminDashboard />;
  }

  if (role === 'vendor') {
    return <VendorDashboard />;
  }

  // Default fallback is Customer role
  return <CustomerDashboard />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050608',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
