// src/screens/ChatDetailScreen.js
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { conversationId, formatTime, orderedMessages } from '../services/chatModel';
import {
  observeChat,
  observeMessagesPaged,
  observeTyping,
  observeReadStatus,
  setTyping,
  sendMessage,
  recallMessage,
  toggleReaction,
} from '../services/chatService';
import { formatLastSeen } from '../services/presenceService';
import { currentLocation, openLocation } from '../services/locationService';
import { pickImageFromGallery, capturePhoto, uploadImageToCloudinary } from '../services/uploadService';
import { updateGroupName, leaveGroup } from '../services/groupService';
import { errorMessage } from '../services/errors';
import { useApp } from '../context/AppContext';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];
const PAGE_SIZE_STEP = 20;

export default function ChatDetailScreen({ route, navigation }) {
  const { convId: routeConvId, peerId: routePeerId } = route.params || {};
  const { user, contacts, markConversationAsRead, appActive } = useApp();
  const uid = user?.id;

  // Resolve conversation ID & peer ID
  const peerId = routePeerId || (routeConvId && routeConvId.includes('__') ? routeConvId.split('__').find(id => id !== uid) : null);
  const convId = routeConvId || (peerId && uid ? conversationId(uid, peerId) : null);

  const [inputText, setInputText] = useState('');
  const [chat, setChat] = useState(null);
  const [messagesMap, setMessagesMap] = useState({});
  const [typingMap, setTypingMap] = useState({});
  const [readStatusMap, setReadStatusMap] = useState({});
  const [pageSize, setPageSize] = useState(PAGE_SIZE_STEP);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);

  // Search in chat
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected message for action menu (Long Press)
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Replying message state
  const [replyingTo, setReplyingTo] = useState(null);

  // Full-screen image preview
  const [previewImage, setPreviewImage] = useState(null);

  // Temporary uploading image bubbles
  const [tempUploads, setTempUploads] = useState([]);

  // Group info modal
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const flatListRef = useRef(null);
  const typingTimerRef = useRef(null);
  const focused = useIsFocused();

  const isGroup = chat?.type === 'group' || (convId && convId.startsWith('group_'));

  const targetUser = useMemo(() => {
    if (isGroup) {
      const memberUids = Object.keys(chat?.members || {});
      const onlineMembers = memberUids.filter(mId => contacts.find(c => c.id === mId)?.isOnline || mId === uid);
      return {
        id: convId,
        name: chat?.name || 'Nhóm',
        isGroup: true,
        avatar: 'https://ui-avatars.com/api/?background=4F46E5&color=fff&name=' + encodeURIComponent(chat?.name || 'Group'),
        onlineCount: onlineMembers.length,
        totalMembers: memberUids.length,
        isOnline: onlineMembers.length > 0,
      };
    }
    const found = contacts.find(c => c.id === peerId);
    return found || { name: 'Người dùng', avatar: 'https://ui-avatars.com/api/?background=4F46E5&color=fff&name=User', isOnline: false, lastSeen: null };
  }, [isGroup, chat, contacts, convId, peerId, uid]);

  // Combine real-time paged messages
  const messages = useMemo(() => {
    const combined = { ...(chat?.messages || {}), ...messagesMap };
    let list = orderedMessages(combined);
    if (isSearching && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(m => m.text && m.text.toLowerCase().includes(q));
    }
    return list;
  }, [chat?.messages, messagesMap, isSearching, searchQuery]);

  const latestMessage = messages[messages.length - 1];
  const latestKey = latestMessage?.id;

  // Realtime listeners
  useEffect(() => {
    if (!convId) return;
    setLoading(true);
    setError('');

    const unsubChat = observeChat(convId, data => {
      setChat(data);
      setLoading(false);
    }, failure => {
      setError(errorMessage(failure));
      setLoading(false);
    });

    const unsubMessages = observeMessagesPaged(convId, pageSize, data => {
      setMessagesMap(data || {});
      setLoading(false);
      setLoadingMore(false);
    }, failure => {
      setError(errorMessage(failure));
      setLoading(false);
      setLoadingMore(false);
    });

    const unsubTyping = observeTyping(convId, data => {
      setTypingMap(data || {});
    });

    const unsubRead = observeReadStatus(convId, data => {
      setReadStatusMap(data || {});
    });

    return () => {
      unsubChat();
      unsubMessages();
      unsubTyping();
      unsubRead();
      // Clear typing status on screen exit
      if (uid) {
        setTyping(convId, uid, false).catch(() => {});
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, [convId, pageSize, uid]);

  // Mark read when focused
  useEffect(() => {
    if (focused && appActive && convId && latestKey) {
      markConversationAsRead(convId, latestKey).catch(failure => setError(errorMessage(failure)));
    }
  }, [convId, latestKey, focused, appActive, markConversationAsRead]);

  // Typing status management: automatically expires after 3 seconds of inactivity
  const handleInputChange = text => {
    setInputText(text);
    if (!convId || !uid) return;

    // Set typing
    setTyping(convId, uid, true).catch(() => {});

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      setTyping(convId, uid, false).catch(() => {});
    }, 3000);
  };

  // Determine typing label for header
  const typingLabel = useMemo(() => {
    const typingUids = Object.keys(typingMap).filter(id => id !== uid && typingMap[id]);
    if (typingUids.length === 0) return null;

    if (isGroup) {
      const names = typingUids.map(id => contacts.find(c => c.id === id)?.name || 'Ai đó');
      if (names.length === 1) {
        return `${names[0]} đang soạn tin…`;
      }
      return `${names.length} người đang soạn tin…`;
    }
    return 'đang soạn tin…';
  }, [typingMap, uid, isGroup, contacts]);

  // Send text message
  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText;

    // Turn off typing immediately
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    setTyping(convId, uid, false).catch(() => {});

    setSending(true);
    setError('');
    try {
      const payload = {
        type: 'text',
        text,
        senderName: user.name,
      };
      if (replyingTo) {
        payload.replyTo = {
          id: replyingTo.id,
          text: replyingTo.recalled ? 'Tin nhắn đã thu hồi' : (replyingTo.type === 'image' ? '📷 Hình ảnh' : (replyingTo.type === 'location' ? '📍 Vị trí' : replyingTo.text)),
          senderName: replyingTo.senderName || (replyingTo.senderId === uid ? 'Bạn' : targetUser.name),
          type: replyingTo.type,
        };
      }

      await sendMessage(uid, convId, payload, user.name);
      setInputText('');
      setReplyingTo(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSending(false);
    }
  };

  // Send location message
  const handleLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const coordinates = await currentLocation();
      await sendMessage(uid, convId, {
        type: 'location',
        ...coordinates,
        senderName: user.name,
      }, user.name);
    } catch (failure) {
      Alert.alert('Không thể gửi vị trí', errorMessage(failure));
    } finally {
      setLocating(false);
    }
  };

  // Image actions (Camera or Gallery)
  const handlePickImage = () => {
    Alert.alert(
      'Gửi hình ảnh',
      'Chọn phương thức chụp ảnh hoặc lấy từ thư viện ảnh',
      [
        {
          text: 'Chụp ảnh',
          onPress: async () => {
            try {
              const photo = await capturePhoto();
              if (photo) {
                uploadAndSendImage(photo);
              }
            } catch (err) {
              Alert.alert('Lỗi chụp ảnh', errorMessage(err));
            }
          },
        },
        {
          text: 'Chọn từ thư viện',
          onPress: async () => {
            try {
              const asset = await pickImageFromGallery();
              if (asset) {
                uploadAndSendImage(asset);
              }
            } catch (err) {
              Alert.alert('Lỗi chọn ảnh', errorMessage(err));
            }
          },
        },
        { text: 'Hủy', style: 'cancel' },
      ]
    );
  };

  const uploadAndSendImage = async asset => {
    const tempId = 'temp_' + Date.now();
    const tempItem = {
      tempId,
      uri: asset.uri,
      asset,
      loading: true,
      error: null,
    };

    setTempUploads(prev => [...prev, tempItem]);

    try {
      const imageUrl = await uploadImageToCloudinary(asset);
      await sendMessage(uid, convId, {
        type: 'image',
        imageUrl,
        senderName: user.name,
      }, user.name);

      setTempUploads(prev => prev.filter(t => t.tempId !== tempId));
    } catch (err) {
      setTempUploads(prev =>
        prev.map(t => (t.tempId === tempId ? { ...t, loading: false, error: errorMessage(err) } : t))
      );
    }
  };

  const retryUpload = item => {
    setTempUploads(prev =>
      prev.map(t => (t.tempId === item.tempId ? { ...t, loading: true, error: null } : t))
    );
    uploadImageToCloudinary(item.asset)
      .then(imageUrl => {
        return sendMessage(uid, convId, {
          type: 'image',
          imageUrl,
          senderName: user.name,
        }, user.name);
      })
      .then(() => {
        setTempUploads(prev => prev.filter(t => t.tempId !== item.tempId));
      })
      .catch(err => {
        setTempUploads(prev =>
          prev.map(t => (t.tempId === item.tempId ? { ...t, loading: false, error: errorMessage(err) } : t))
        );
      });
  };

  // Recall message
  const handleRecall = async msg => {
    setMenuVisible(false);
    if (!msg || msg.senderId !== uid) return;
    try {
      await recallMessage(convId, msg.id, uid);
    } catch (err) {
      Alert.alert('Lỗi', errorMessage(err));
    }
  };

  // Toggle reaction
  const handleReaction = async emoji => {
    setMenuVisible(false);
    if (!selectedMsg) return;
    try {
      await toggleReaction(
        convId,
        selectedMsg.id,
        uid,
        user.name,
        emoji,
        selectedMsg.senderId
      );
    } catch (err) {
      Alert.alert('Lỗi', errorMessage(err));
    }
  };

  const handleOpenLocation = useCallback(item => {
    openLocation(item.latitude, item.longitude).catch(() =>
      Alert.alert('Không mở được bản đồ', 'Vui lòng thử lại.')
    );
  }, []);

  // Long press open menu
  const handleLongPress = item => {
    setSelectedMsg(item);
    setMenuVisible(true);
  };

  // Load more older messages
  const handleLoadMore = () => {
    if (loadingMore || messages.length < pageSize) return;
    setLoadingMore(true);
    setPageSize(prev => prev + PAGE_SIZE_STEP);
  };

  // Scroll to original replied message
  const scrollToMessage = msgId => {
    const index = messages.findIndex(m => m.id === msgId);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  };

  // Render individual message item
  const renderMessageItem = ({ item }) => {
    const isSender = item.senderId === uid;
    const isSystem = item.type === 'system';

    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.text}</Text>
        </View>
      );
    }

    const isLastOwnMessage = isSender && item.id === latestKey;

    // Check read status for direct chat
    let readInfo = null;
    if (isLastOwnMessage && !isGroup && peerId) {
      const peerRead = readStatusMap[peerId];
      if (peerRead && (peerRead.lastReadTime >= (item.createdAt || 0) || peerRead.lastMessageId >= item.id)) {
        readInfo = `Đã xem ${formatTime(peerRead.lastReadTime)}`;
      } else {
        readInfo = 'Đã gửi';
      }
    }

    // Aggregate reactions
    const reactionCounts = {};
    Object.values(item.reactions || {}).forEach(emoji => {
      reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
    });

    const isRecalled = item.recalled;

    return (
      <View
        style={[
          styles.messageRow,
          isSender ? styles.messageRowSender : styles.messageRowReceiver,
        ]}
      >
        {!isSender && (
          <Image
            source={{
              uri:
                (isGroup && contacts.find(c => c.id === item.senderId)?.avatar) ||
                targetUser.avatar,
            }}
            style={styles.messageAvatar}
          />
        )}

        <View style={styles.bubbleWrapper}>
          {/* Sender name for group chats */}
          {!isSender && isGroup && (
            <Text style={styles.groupSenderName}>
              {item.senderName || contacts.find(c => c.id === item.senderId)?.name || 'Thành viên'}
            </Text>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleLongPress(item)}
            style={[
              styles.bubble,
              isSender ? styles.bubbleSender : styles.bubbleReceiver,
              isRecalled && styles.bubbleRecalled,
            ]}
          >
            {/* Reply Quote Block */}
            {item.replyTo && (
              <TouchableOpacity
                onPress={() => scrollToMessage(item.replyTo.id)}
                style={[
                  styles.quoteBox,
                  isSender ? styles.quoteBoxSender : styles.quoteBoxReceiver,
                ]}
              >
                <Text style={styles.quoteSender}>{item.replyTo.senderName}</Text>
                <Text style={styles.quoteText} numberOfLines={1}>
                  {item.replyTo.text}
                </Text>
              </TouchableOpacity>
            )}

            {/* Recalled Message */}
            {isRecalled ? (
              <View style={styles.recalledRow}>
                <Ionicons name="ban-outline" size={16} color={isSender ? '#E0E7FF' : '#9CA3AF'} />
                <Text style={[styles.recalledMessageText, isSender ? styles.recalledTextSender : styles.recalledTextReceiver]}>
                  Tin nhắn đã được thu hồi
                </Text>
              </View>
            ) : item.type === 'image' ? (
              <TouchableOpacity
                onPress={() => setPreviewImage(item.imageUrl)}
                style={styles.imageContainer}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
              </TouchableOpacity>
            ) : item.type === 'location' ? (
              <TouchableOpacity
                accessibilityRole="link"
                accessibilityLabel="Mở vị trí trên Google Maps"
                onPress={() => handleOpenLocation(item)}
                style={styles.locationCard}
              >
                <Ionicons name="location" size={28} color={isSender ? '#fff' : '#4F46E5'} />
                <Text style={[styles.locationTitle, isSender ? styles.messageTextSender : styles.messageTextReceiver]}>
                  Vị trí hiện tại
                </Text>
                <Text style={isSender ? styles.messageTextSender : styles.messageTextReceiver}>
                  {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                </Text>
                <Text style={isSender ? styles.messageTimeSender : styles.messageTimeReceiver}>
                  Nhấn để mở Google Maps ↗
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.messageText, isSender ? styles.messageTextSender : styles.messageTextReceiver]}>
                {item.text}
              </Text>
            )}

            {/* Message Meta (time & check icon) */}
            <View style={styles.messageMeta}>
              <Text
                style={[
                  styles.messageTime,
                  isSender ? styles.messageTimeSender : styles.messageTimeReceiver,
                ]}
              >
                {formatTime(item.createdAt)}
              </Text>
              {isSender && (
                <Ionicons
                  name={readInfo?.startsWith('Đã xem') ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={readInfo?.startsWith('Đã xem') ? '#67E8F9' : '#C7D2FE'}
                  style={styles.checkIcon}
                />
              )}
            </View>
          </TouchableOpacity>

          {/* Reactions bar below bubble */}
          {Object.keys(reactionCounts).length > 0 && !isRecalled && (
            <View style={[styles.reactionsRow, isSender ? styles.reactionsRowSender : styles.reactionsRowReceiver]}>
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBadge}
                  onPress={() => toggleReaction(convId, item.id, uid, user.name, emoji, item.senderId)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Read status subtitle under latest message */}
          {readInfo && (
            <Text style={styles.readStatusText}>{readInfo}</Text>
          )}
        </View>
      </View>
    );
  };

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

        <TouchableOpacity
          style={styles.headerInfoContainer}
          onPress={() => {
            if (isGroup) {
              setNewGroupName(chat?.name || '');
              setGroupModalVisible(true);
            }
          }}
          activeOpacity={isGroup ? 0.7 : 1}
        >
          <View style={styles.headerAvatarContainer}>
            {isGroup ? (
              <View style={styles.headerGroupAvatar}>
                <Ionicons name="people" size={20} color="#4F46E5" />
              </View>
            ) : (
              <Image source={{ uri: targetUser.avatar }} style={styles.headerAvatar} />
            )}
            {targetUser.isOnline && <View style={styles.headerOnlineDot} />}
          </View>

          <View style={styles.headerUserInfo}>
            <Text style={styles.headerUserName} numberOfLines={1}>
              {targetUser.name}
            </Text>
            <Text style={[styles.headerStatus, typingLabel && styles.typingStatus]} numberOfLines={1}>
              {typingLabel
                ? typingLabel
                : isGroup
                ? `${targetUser.onlineCount}/${targetUser.totalMembers} trực tuyến`
                : targetUser.isOnline
                ? 'Đang hoạt động'
                : formatLastSeen(targetUser.lastSeen)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Search button in header */}
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => {
            setIsSearching(prev => !prev);
            setSearchQuery('');
          }}
        >
          <Ionicons name={isSearching ? 'close' : 'search'} size={22} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Search Bar if searching */}
      {isSearching && (
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchBarInput}
            placeholder="Tìm kiếm tin nhắn trong đoạn chat..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      )}

      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {loading && <ActivityIndicator color="#4F46E5" style={styles.loader} />}

      {/* Messages List Area */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => {
            if (!loadingMore) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onScroll={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y <= 10) {
              handleLoadMore();
            }
          }}
          scrollEventThrottle={200}
          ListHeaderComponent={
            loadingMore ? (
              <View style={styles.loadingMoreWrapper}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <Text style={styles.loadingMoreText}>Đang tải thêm tin nhắn…</Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            tempUploads.length > 0 ? (
              <View>
                {tempUploads.map(t => (
                  <View key={t.tempId} style={[styles.messageRow, styles.messageRowSender]}>
                    <View style={[styles.bubble, styles.bubbleSender, styles.tempBubble]}>
                      <Image source={{ uri: t.uri }} style={styles.tempImage} />
                      {t.loading ? (
                        <View style={styles.tempOverlay}>
                          <ActivityIndicator color="#FFFFFF" size="large" />
                          <Text style={styles.tempText}>Đang tải ảnh…</Text>
                        </View>
                      ) : t.error ? (
                        <View style={styles.tempErrorOverlay}>
                          <Ionicons name="alert-circle" size={28} color="#EF4444" />
                          <Text style={styles.tempErrorText}>Lỗi tải lên</Text>
                          <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => retryUpload(t)}
                          >
                            <Ionicons name="refresh" size={14} color="#FFFFFF" />
                            <Text style={styles.retryText}>Thử lại</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={50} color="#D1D5DB" />
                <Text style={styles.emptyChatTitle}>Bắt đầu cuộc trò chuyện!</Text>
                <Text style={styles.emptyChatSub}>
                  Gửi tin nhắn đầu tiên cho {targetUser.name}
                </Text>
              </View>
            )
          }
        />

        {/* Replying Banner */}
        {replyingTo && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerContent}>
              <Text style={styles.replyBannerTitle}>
                Trả lời {replyingTo.senderName || 'Tin nhắn'}
              </Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {replyingTo.recalled
                  ? 'Tin nhắn đã thu hồi'
                  : replyingTo.type === 'image'
                  ? '📷 Hình ảnh'
                  : replyingTo.type === 'location'
                  ? '📍 Vị trí'
                  : replyingTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyBannerClose}>
              <Ionicons name="close-circle" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachBtn}
            accessibilityLabel="Gửi ảnh"
            onPress={handlePickImage}
          >
            <Ionicons name="camera-outline" size={24} color="#4F46E5" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.attachBtn}
            accessibilityLabel="Gửi vị trí hiện tại"
            onPress={handleLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator color="#4F46E5" size="small" />
            ) : (
              <Ionicons name="location-outline" size={24} color="#4F46E5" />
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={4000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            <Ionicons
              name={sending ? 'hourglass-outline' : 'send'}
              size={18}
              color={inputText.trim() ? '#FFFFFF' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Message Long Press Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuCard}>
            {/* Reactions row */}
            <View style={styles.modalReactionsRow}>
              {REACTION_EMOJIS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => handleReaction(emoji)}
                >
                  <Text style={styles.emojiIcon}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.menuDivider} />

            {/* Actions list */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setReplyingTo(selectedMsg);
                setMenuVisible(false);
              }}
            >
              <Ionicons name="arrow-undo-outline" size={20} color="#374151" />
              <Text style={styles.menuItemText}>Trả lời</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                Alert.alert('Đã sao chép', 'Nội dung tin nhắn đã được sao chép.');
              }}
            >
              <Ionicons name="copy-outline" size={20} color="#374151" />
              <Text style={styles.menuItemText}>Sao chép</Text>
            </TouchableOpacity>

            {/* Recall option (only own messages and not yet recalled) */}
            {selectedMsg?.senderId === uid && !selectedMsg?.recalled && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleRecall(selectedMsg)}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>Thu hồi</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Image Preview Modal */}
      <Modal
        visible={Boolean(previewImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setPreviewImage(null)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Group Info & Management Modal */}
      <Modal
        visible={groupModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGroupModalVisible(false)}
      >
        <View style={styles.groupModalOverlay}>
          <View style={styles.groupModalContent}>
            <View style={styles.groupModalHeader}>
              <Text style={styles.groupModalTitle}>Thông tin nhóm</Text>
              <TouchableOpacity onPress={() => setGroupModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.groupModalBody}>
              <View style={styles.groupModalSection}>
                <Text style={styles.groupModalLabel}>Tên nhóm</Text>
                <View style={styles.groupNameEditRow}>
                  <TextInput
                    style={styles.groupNameInput}
                    value={newGroupName}
                    onChangeText={setNewGroupName}
                  />
                  <TouchableOpacity
                    style={styles.saveGroupNameBtn}
                    onPress={async () => {
                      if (!newGroupName.trim()) return;
                      try {
                        await updateGroupName(convId, newGroupName, uid, user.name);
                        Alert.alert('Thành công', 'Đã đổi tên nhóm.');
                      } catch (err) {
                        Alert.alert('Lỗi', errorMessage(err));
                      }
                    }}
                  >
                    <Text style={styles.saveGroupNameText}>Lưu</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.groupModalLabel}>
                Thành viên ({Object.keys(chat?.members || {}).length})
              </Text>
              {Object.keys(chat?.members || {}).map(mId => {
                const member = contacts.find(c => c.id === mId) || (mId === uid ? user : { name: 'Người dùng', email: '' });
                const isMemberOnline = member?.isOnline;
                return (
                  <View key={mId} style={styles.groupMemberRow}>
                    <Image source={{ uri: member?.avatar }} style={styles.groupMemberAvatar} />
                    <View style={styles.groupMemberInfo}>
                      <Text style={styles.groupMemberName}>
                        {member?.name} {mId === uid && '(Bạn)'}
                      </Text>
                      <Text style={styles.groupMemberStatus}>
                        {isMemberOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
                      </Text>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.leaveGroupBtn}
                onPress={() => {
                  Alert.alert('Rời nhóm', 'Bạn có chắc chắn muốn rời nhóm này?', [
                    { text: 'Hủy', style: 'cancel' },
                    {
                      text: 'Rời nhóm',
                      style: 'destructive',
                      onPress: async () => {
                        setGroupModalVisible(false);
                        try {
                          await leaveGroup(convId, uid, user.name);
                          navigation.navigate('Main');
                        } catch (err) {
                          Alert.alert('Lỗi', errorMessage(err));
                        }
                      },
                    },
                  ]);
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={styles.leaveGroupText}>Rời khỏi nhóm</Text>
              </TouchableOpacity>
            </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  headerInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerGroupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerOnlineDot: {
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
  headerUserInfo: {
    flex: 1,
  },
  headerUserName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  typingStatus: {
    color: '#4F46E5',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  headerActionBtn: {
    padding: 6,
    marginLeft: 6,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    padding: 4,
  },
  error: {
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  loader: {
    paddingVertical: 8,
  },
  chatArea: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexGrow: 1,
  },
  loadingMoreWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageRowSender: {
    justifyContent: 'flex-end',
  },
  messageRowReceiver: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  bubbleWrapper: {
    maxWidth: '75%',
  },
  groupSenderName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleSender: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 4,
  },
  bubbleReceiver: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bubbleRecalled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recalledRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recalledMessageText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginLeft: 6,
  },
  recalledTextSender: {
    color: '#E0E7FF',
  },
  recalledTextReceiver: {
    color: '#6B7280',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextSender: {
    color: '#FFFFFF',
  },
  messageTextReceiver: {
    color: '#1F2937',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  messageTimeSender: {
    color: '#C7D2FE',
  },
  messageTimeReceiver: {
    color: '#9CA3AF',
  },
  checkIcon: {
    marginLeft: 4,
  },
  readStatusText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: 2,
    marginRight: 4,
  },
  quoteBox: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 2,
    marginBottom: 6,
    borderRadius: 2,
  },
  quoteBoxSender: {
    borderLeftColor: '#A5B4FC',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  quoteBoxReceiver: {
    borderLeftColor: '#4F46E5',
    backgroundColor: '#F3F4F6',
  },
  quoteSender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  quoteText: {
    fontSize: 12,
    color: '#4B5563',
  },
  reactionsRow: {
    flexDirection: 'row',
    marginTop: -6,
    zIndex: 10,
  },
  reactionsRowSender: {
    justifyContent: 'flex-end',
    marginRight: 4,
  },
  reactionsRowReceiver: {
    justifyContent: 'flex-start',
    marginLeft: 4,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    marginLeft: 2,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  locationCard: {
    padding: 4,
    gap: 4,
  },
  locationTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tempBubble: {
    position: 'relative',
    overflow: 'hidden',
  },
  tempImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    opacity: 0.6,
  },
  tempOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 6,
  },
  tempErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 11,
    marginLeft: 4,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#C7D2FE',
  },
  replyBannerContent: {
    flex: 1,
  },
  replyBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  replyBannerText: {
    fontSize: 12,
    color: '#4B5563',
  },
  replyBannerClose: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  attachBtn: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 6,
    fontSize: 15,
    maxHeight: 100,
    color: '#1F2937',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#4F46E5',
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 10,
  },
  emptyChatSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    elevation: 5,
  },
  modalReactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  emojiBtn: {
    padding: 4,
  },
  emojiIcon: {
    fontSize: 26,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  menuItemText: {
    fontSize: 15,
    color: '#1F2937',
    marginLeft: 12,
  },
  menuItemDanger: {
    color: '#EF4444',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
  groupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  groupModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 18,
  },
  groupModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  groupModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  groupModalBody: {
    marginTop: 12,
  },
  groupModalSection: {
    marginBottom: 16,
  },
  groupModalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  groupNameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupNameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: '#1F2937',
  },
  saveGroupNameBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
  saveGroupNameText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  groupMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  groupMemberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  groupMemberInfo: {
    flex: 1,
  },
  groupMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  groupMemberStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  leaveGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  leaveGroupText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 6,
  },
});
