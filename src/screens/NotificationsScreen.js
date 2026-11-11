// src/screens/NotificationsScreen.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { useApp } from '../context/AppContext';
import { formatTime } from '../services/chatModel';

export default function NotificationsScreen({ navigation }) {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    totalUnreadNotifications,
  } = useApp();

  const [filterType, setFilterType] = useState('all'); // 'all' | 'unread'

  const filteredNotifications = useMemo(() => {
    if (filterType === 'unread') {
      return notifications.filter(n => !n.read);
    }
    return notifications;
  }, [notifications, filterType]);

  const getNotificationIcon = type => {
    switch (type) {
      case 'message':
        return { name: 'chatbubble-ellipses', color: '#4F46E5', bg: '#EEF2FF' };
      case 'group':
        return { name: 'people', color: '#10B981', bg: '#ECFDF5' };
      case 'reaction':
        return { name: 'heart', color: '#EF4444', bg: '#FEF2F2' };
      default:
        return { name: 'notifications', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const handleOpenNotification = item => {
    markNotificationAsRead(item.id);
    if (item.convId) {
      navigation.navigate('ChatDetail', { convId: item.convId });
    }
  };

  const renderNotificationItem = ({ item }) => {
    const iconConfig = getNotificationIcon(item.type);
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[
          styles.notifItem,
          isUnread ? styles.notifItemUnread : styles.notifItemRead,
        ]}
        onPress={() => handleOpenNotification(item)}
        activeOpacity={0.7}
      >
        {/* Icon đại diện loại thông báo */}
        <View style={[styles.iconWrapper, { backgroundColor: iconConfig.bg }]}>
          <Ionicons name={iconConfig.name} size={22} color={iconConfig.color} />
        </View>

        {/* Nội dung thông báo */}
        <View style={styles.contentWrapper}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.notifTitle,
                isUnread && styles.notifTitleUnread,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          <Text
            style={[
              styles.notifContent,
              isUnread && styles.notifContentUnread,
            ]}
          >
            {item.content}
          </Text>

          <View style={styles.footerRow}>
            <View style={styles.timeWrapper}>
              <Ionicons name="time-outline" size={13} color="#9CA3AF" />
              <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
            </View>

            {/* Nút/Nhãn trạng thái */}
            <View style={styles.statusLabelContainer}>
              {isUnread ? (
                <TouchableOpacity
                  style={styles.markReadBtn}
                  onPress={() => markNotificationAsRead(item.id)}
                >
                  <Ionicons name="checkmark" size={12} color="#4F46E5" />
                  <Text style={styles.markReadText}>Đánh dấu đã đọc</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.readBadge}>
                  <Ionicons name="checkmark-done" size={13} color="#9CA3AF" />
                  <Text style={styles.readBadgeText}>Đã đọc</Text>
                </View>
              )}
            </View>
          </View>
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
          <Text style={styles.headerTitle}>Thông báo</Text>
          <Text style={styles.headerSubtitle}>
            {totalUnreadNotifications > 0
              ? `Bạn có ${totalUnreadNotifications} thông báo chưa đọc`
              : 'Tất cả thông báo đã được đọc'}
          </Text>
        </View>

        {/* Nút Đánh dấu tất cả là đã đọc */}
        {totalUnreadNotifications > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={markAllNotificationsAsRead}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-done-outline" size={16} color="#4F46E5" />
            <Text style={styles.markAllText}>Đọc tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bộ lọc tab: Tất cả / Chưa đọc */}
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
            Tất cả ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            filterType === 'unread' && styles.tabButtonActive,
          ]}
          onPress={() => setFilterType('unread')}
        >
          <Text
            style={[
              styles.tabText,
              filterType === 'unread' && styles.tabTextActive,
            ]}
          >
            Chưa đọc ({totalUnreadNotifications})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách thông báo */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={item => item.id}
        renderItem={renderNotificationItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={EmptyNotifications}
      />
    </SafeAreaView>
  );
}

function ItemSeparator() {
  return <View style={styles.separator} />;
}

function EmptyNotifications() {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={60} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Không có thông báo nào</Text>
      <Text style={styles.emptySubtitle}>
        Bạn đã cập nhật hết tất cả tin tức mới nhất!
      </Text>
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
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    marginLeft: 4,
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
  notifItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  notifItemUnread: {
    backgroundColor: '#F5F3FF',
  },
  notifItemRead: {
    backgroundColor: '#FFFFFF',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contentWrapper: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  notifTitleUnread: {
    color: '#111827',
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F46E5',
    marginLeft: 8,
  },
  notifContent: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 8,
  },
  notifContentUnread: {
    color: '#4B5563',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  statusLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  markReadText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
    marginLeft: 4,
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readBadgeText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
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
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 6,
  },
});
