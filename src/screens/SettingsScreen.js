// src/screens/SettingsScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { errorMessage } from '../services/errors';
import { useApp } from '../context/AppContext';
import { capturePhoto, pickImageFromGallery, uploadImageToCloudinary } from '../services/uploadService';

export default function SettingsScreen() {
  const {
    user,
    logout,
    updateProfile,
    pushNotificationsEnabled,
    setPushNotificationsEnabled,
    darkModeEnabled,
    setDarkModeEnabled,
    soundEnabled,
    setSoundEnabled,
  } = useApp();

  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Không thể đăng xuất', errorMessage(error));
            }
          },
        },
      ]
    );
  };

  const handleChangeAvatar = () => {
    Alert.alert(
      'Đổi ảnh đại diện',
      'Chọn phương thức để cập nhật ảnh đại diện của bạn',
      [
        {
          text: 'Chụp ảnh mới',
          onPress: async () => {
            try {
              const photo = await capturePhoto();
              if (photo) {
                setUpdating(true);
                const url = await uploadImageToCloudinary(photo);
                await updateProfile({ avatar: url });
                Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới.');
              }
            } catch (err) {
              Alert.alert('Lỗi cập nhật ảnh', errorMessage(err));
            } finally {
              setUpdating(false);
            }
          },
        },
        {
          text: 'Chọn từ thư viện',
          onPress: async () => {
            try {
              const asset = await pickImageFromGallery();
              if (asset) {
                setUpdating(true);
                const url = await uploadImageToCloudinary(asset);
                await updateProfile({ avatar: url });
                Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới.');
              }
            } catch (err) {
              Alert.alert('Lỗi cập nhật ảnh', errorMessage(err));
            } finally {
              setUpdating(false);
            }
          },
        },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Lỗi', 'Họ tên không được để trống.');
      return;
    }
    setUpdating(true);
    try {
      await updateProfile({ name: nameInput.trim() });
      setEditNameModalVisible(false);
      Alert.alert('Thành công', 'Đã cập nhật họ tên.');
    } catch (err) {
      Alert.alert('Lỗi', errorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cài đặt</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Khối hiển thị thông tin tài khoản người dùng */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleChangeAvatar}
            disabled={updating}
            activeOpacity={0.8}
          >
            <Image
              source={{
                uri:
                  user?.avatar ||
                  'https://ui-avatars.com/api/?background=4F46E5&color=fff&name=User',
              }}
              style={styles.avatar}
            />
            <View style={styles.avatarEditBadge}>
              {updating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <TouchableOpacity
              onPress={() => {
                setNameInput(user?.name || '');
                setEditNameModalVisible(true);
              }}
              style={styles.nameRow}
            >
              <Text style={styles.profileName}>{user?.name || 'Người dùng'}</Text>
              <Ionicons name="pencil-outline" size={16} color="#4F46E5" style={styles.editIcon} />
            </TouchableOpacity>
            <Text style={styles.profileUsername}>{user?.email || ''}</Text>

            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Đang hoạt động</Text>
            </View>
          </View>
        </View>

        {/* Section 1: Cài đặt ứng dụng (Sử dụng Switch) */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Tùy chọn ứng dụng</Text>

          {/* Switch 1: Thông báo */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.iconBlueBg]}>
                <Ionicons name="notifications" size={20} color="#4F46E5" />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Thông báo đẩy</Text>
                <Text style={styles.settingDescription}>Nhận tin nhắn & cảnh báo mới</Text>
              </View>
            </View>
            <Switch
              value={pushNotificationsEnabled}
              onValueChange={setPushNotificationsEnabled}
              trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
              thumbColor={pushNotificationsEnabled ? '#4F46E5' : '#F4F3F4'}
            />
          </View>

          {/* Switch 2: Giao diện tối */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.iconYellowBg]}>
                <Ionicons name="moon" size={20} color="#D97706" />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Chế độ tối (Dark Mode)</Text>
                <Text style={styles.settingDescription}>Giảm mỏi mắt khi dùng ban đêm</Text>
              </View>
            </View>
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
              thumbColor={darkModeEnabled ? '#4F46E5' : '#F4F3F4'}
            />
          </View>

          {/* Switch 3: Âm thanh */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.iconGreenBg]}>
                <Ionicons name="volume-high" size={20} color="#059669" />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Âm thanh thông báo</Text>
                <Text style={styles.settingDescription}>Phát âm thanh khi có tin nhắn</Text>
              </View>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
              thumbColor={soundEnabled ? '#4F46E5' : '#F4F3F4'}
            />
          </View>
        </View>

        {/* Section 2: Tài khoản & Bảo mật */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Tài khoản & Hồ sơ</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setNameInput(user?.name || '');
              setEditNameModalVisible(true);
            }}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.iconGrayBg]}>
                <Ionicons name="person-circle-outline" size={20} color="#374151" />
              </View>
              <Text style={styles.menuTitle}>Đổi họ và tên</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleChangeAvatar}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.iconGrayBg]}>
                <Ionicons name="image-outline" size={20} color="#374151" />
              </View>
              <Text style={styles.menuTitle}>Đổi ảnh đại diện</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Section 3: Giới thiệu */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Thông tin ứng dụng</Text>

          <View style={styles.menuItem}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, styles.iconBlueBg]}>
                <Ionicons name="information-circle-outline" size={20} color="#4F46E5" />
              </View>
              <Text style={styles.menuTitle}>Phiên bản</Text>
            </View>
            <Text style={styles.versionBadge}>2.0.0 (TH6)</Text>
          </View>
        </View>

        {/* Nút Đăng xuất */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={styles.logoutIcon} />
          <Text style={styles.logoutButtonText}>Đăng xuất</Text>
        </TouchableOpacity>

        <Text style={styles.copyrightText}>
          TH Chat Mobile Application • Bài thực hành số 6 (React Native + Firebase)
        </Text>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={editNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đổi họ và tên</Text>
            <TextInput
              style={styles.nameTextInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Nhập họ tên mới..."
              placeholderTextColor="#9CA3AF"
              maxLength={60}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditNameModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveName}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: 14,
    marginHorizontal: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4F46E5',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  editIcon: {
    marginLeft: 6,
  },
  profileUsername: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconBlueBg: { backgroundColor: '#EEF2FF' },
  iconYellowBg: { backgroundColor: '#FEF3C7' },
  iconGreenBg: { backgroundColor: '#ECFDF5' },
  iconGrayBg: { backgroundColor: '#F3F4F6' },
  settingTextGroup: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  versionBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  copyrightText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  nameTextInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalSaveBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
