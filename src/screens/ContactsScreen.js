// src/screens/ContactsScreen.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useApp } from '../context/AppContext';

export default function ContactsScreen({ navigation }) {
  const { contacts } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'online'

  // Lọc danh bạ theo tìm kiếm và trạng thái trực tuyến
  const filteredContacts = useMemo(() => {
    let result = contacts;

    if (filterType === 'online') {
      result = result.filter(c => c.isOnline);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      );
    }

    return result;
  }, [contacts, filterType, searchQuery]);

  // Nhấn vào một người dùng để mở cuộc trò chuyện tương ứng
  const handleSelectContact = contact => {
    navigation.navigate('ChatDetail', { peerId: contact.id });
  };

  const renderContactItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.contactItem}
        onPress={() => handleSelectContact(item)}
        activeOpacity={0.7}
      >
        {/* Ảnh đại diện */}
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          <View
            style={[
              styles.statusDot,
              item.isOnline ? styles.onlineColor : styles.offlineColor,
            ]}
          />
        </View>

        {/* Thông tin người dùng */}
        <View style={styles.infoWrapper}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactBio} numberOfLines={1}>
            {item.email}
          </Text>
        </View>

        {/* Trạng thái trực tuyến & Nút Chat */}
        <View style={styles.actionWrapper}>
          <View
            style={[
              styles.statusBadge,
              item.isOnline ? styles.onlineBadge : styles.offlineBadge,
            ]}
          >
            <View
              style={[
                styles.badgeIndicator,
                item.isOnline ? styles.onlineColor : styles.offlineColor,
              ]}
            />
            <Text
              style={[
                styles.statusBadgeText,
                item.isOnline ? styles.onlineBadgeText : styles.offlineBadgeText,
              ]}
            >
              {item.isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => handleSelectContact(item)}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color="#4F46E5" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Danh bạ</Text>
          <Text style={styles.headerSubtitle}>
            {contacts.length} người dùng trên hệ thống
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createGroupBtn}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <Ionicons name="people" size={18} color="#4F46E5" />
          <Text style={styles.createGroupText}>Tạo nhóm</Text>
        </TouchableOpacity>
      </View>

      {/* Ô tìm kiếm */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên hoặc email..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bộ lọc tab */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, filterType === 'all' && styles.tabButtonActive]}
          onPress={() => setFilterType('all')}
        >
          <Text
            style={[
              styles.tabText,
              filterType === 'all' && styles.tabTextActive,
            ]}
          >
            Tất cả ({contacts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            filterType === 'online' && styles.tabButtonActive,
          ]}
          onPress={() => setFilterType('online')}
        >
          <Text
            style={[
              styles.tabText,
              filterType === 'online' && styles.tabTextActive,
            ]}
          >
            Đang trực tuyến ({contacts.filter(c => c.isOnline).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách người dùng */}
      <FlatList
        data={filteredContacts}
        keyExtractor={item => item.id}
        renderItem={renderContactItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={EmptyContacts}
      />
    </SafeAreaView>
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

function EmptyContacts() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={56} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Không tìm thấy người dùng</Text>
      <Text style={styles.emptyText}>Thử tìm kiếm với tên hoặc từ khóa khác</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  createGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createGroupText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    marginLeft: 6,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabButton: {
    paddingVertical: 10,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#4F46E5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  listContent: {
    flexGrow: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  onlineColor: {
    backgroundColor: '#10B981',
  },
  offlineColor: {
    backgroundColor: '#9CA3AF',
  },
  infoWrapper: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  contactBio: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  actionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  onlineBadge: {
    backgroundColor: '#ECFDF5',
  },
  offlineBadge: {
    backgroundColor: '#F3F4F6',
  },
  badgeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  onlineBadgeText: {
    color: '#059669',
  },
  offlineBadgeText: {
    color: '#6B7280',
  },
  chatButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 82,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginTop: 14,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
  },
});
