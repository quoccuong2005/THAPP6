// src/screens/CreateGroupScreen.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useApp } from '../context/AppContext';
import { createGroup } from '../services/groupService';
import { errorMessage } from '../services/errors';

export default function CreateGroupScreen({ navigation }) {
  const { user, contacts } = useApp();
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) { return contacts; }
    const q = searchQuery.toLowerCase().trim();
    return contacts.filter(
      c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  const toggleSelect = id => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên nhóm.');
      return;
    }
    if (selectedIds.size < 2) {
      Alert.alert('Chưa đủ thành viên', 'Vui lòng chọn tối thiểu 2 thành viên ngoài bản thân.');
      return;
    }

    setLoading(true);
    try {
      const groupId = await createGroup(
        name,
        user.id,
        user.name,
        Array.from(selectedIds)
      );
      navigation.replace('ChatDetail', { convId: groupId });
    } catch (error) {
      Alert.alert('Không thể tạo nhóm', errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const renderContactItem = ({ item }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.contactItem, isSelected && styles.contactItemSelected]}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => toggleSelect(item.id)}
        >
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={22}
            color={isSelected ? '#4F46E5' : '#9CA3AF'}
          />
        </TouchableOpacity>

        <View style={styles.avatarWrapper}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
          {item.isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactEmail} numberOfLines={1}>{item.email}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const canCreate = groupName.trim().length > 0 && selectedIds.size >= 2;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Tạo nhóm mới</Text>

        <TouchableOpacity
          style={[styles.createButton, !canCreate && styles.createButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={!canCreate || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.createButtonText, !canCreate && styles.createButtonTextDisabled]}>
              Tạo ({selectedIds.size})
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Group Name Input */}
      <View style={styles.inputSection}>
        <View style={styles.groupAvatarPlaceholder}>
          <Ionicons name="people" size={28} color="#4F46E5" />
        </View>
        <TextInput
          style={styles.nameInput}
          placeholder="Nhập tên nhóm trò chuyện..."
          placeholderTextColor="#9CA3AF"
          value={groupName}
          onChangeText={setGroupName}
          maxLength={60}
        />
      </View>

      {/* Member count status */}
      <View style={styles.memberStatusRow}>
        <Text style={styles.sectionHeader}>
          CHỌN THÀNH VIÊN ({selectedIds.size} đã chọn, tối thiểu 2)
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
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

      {/* Contact List */}
      <FlatList
        data={filteredContacts}
        keyExtractor={item => item.id}
        renderItem={renderContactItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Không tìm thấy bạn bè phù hợp</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  createButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: '#9CA3AF',
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  groupAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 8,
  },
  memberStatusRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    padding: 0,
  },
  listContent: {
    paddingBottom: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactItemSelected: {
    backgroundColor: '#F5F3FF',
  },
  checkbox: {
    paddingRight: 12,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  contactEmail: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
});
