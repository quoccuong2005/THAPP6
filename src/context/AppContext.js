import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import { firebaseConfigured } from '../services/firebase';
import * as authService from '../services/authService';
import {
  observeUsers,
  observePresence,
  observeChatIndex,
  observeChat,
  markConversationAsRead,
  resumeDatabase,
} from '../services/chatService';
import {
  observeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService';
import { conversationSummary, userProfile } from '../services/chatModel';
import { startPresence } from '../services/presenceService';
import { errorMessage } from '../services/errors';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [authLoading, setAuthLoading] = useState(firebaseConfigured);
  const [profiles, setProfiles] = useState({});
  const [statuses, setStatuses] = useState({});
  const [chats, setChats] = useState({});
  const [userChats, setUserChats] = useState({});
  const [syncError, setSyncError] = useState('');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [notifications, setNotifications] = useState([]);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const reportError = useCallback(error => setSyncError(errorMessage(error)), []);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) { return; }
    return authService.observeAuth(next => {
      setProfiles({});
      setStatuses({});
      setChats({});
      setUserChats({});
      setNotifications([]);
      setSyncError('');
      setAccount(next);
      setAuthLoading(false);
    });
  }, []);

  const uid = account?.uid;

  useEffect(() => {
    if (!uid) { return; }
    let alive = true;
    resumeDatabase();
    authService.ensureProfile(account).catch(error => { if (alive) { reportError(error); } });

    const stops = [
      observeUsers(setProfiles, reportError),
      observePresence(setStatuses, reportError),
      observeNotifications(uid, setNotifications, reportError),
    ];

    const chatStops = new Map();
    stops.push(observeChatIndex(uid, index => {
      if (alive) {
        setUserChats(index || {});
      }
      for (const [id, stop] of chatStops) {
        if (!index[id]) {
          stop();
          chatStops.delete(id);
          setChats(previous => {
            const next = { ...previous };
            delete next[id];
            return next;
          });
        }
      }
      Object.keys(index || {}).forEach(id => {
        if (chatStops.has(id)) { return; }
        chatStops.set(id, observeChat(id, data => {
          if (alive) {
            setChats(previous => ({ ...previous, [id]: data }));
          }
        }, reportError));
      });
    }, reportError));

    return () => {
      alive = false;
      stops.forEach(stop => stop());
      chatStops.forEach(stop => stop());
    };
  }, [uid, account, reportError]);

  useEffect(() => {
    if (uid && appActive) {
      return startPresence(uid, reportError);
    }
  }, [uid, appActive, reportError]);

  const contacts = useMemo(() => Object.entries(profiles)
    .filter(([id]) => id !== uid)
    .map(([id, profile]) => userProfile(id, profile, statuses[id]))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi')), [profiles, statuses, uid]);

  const user = account ? { ...userProfile(uid, profiles[uid], statuses[uid]), email: account.email } : null;

  const conversations = useMemo(() => Object.entries(chats)
    .filter(([, data]) => data && (data.memberA === uid || data.memberB === uid || (data.members && data.members[uid])))
    .map(([id, data]) => conversationSummary(id, data, uid, profiles, statuses, userChats[id]))
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || (a.lastKey < b.lastKey ? 1 : a.lastKey > b.lastKey ? -1 : 0)),
    [chats, uid, profiles, statuses, userChats]);

  const handleMarkConversationAsRead = useCallback((id, key) => {
    if (uid) {
      return markConversationAsRead(id, uid, key);
    }
    return Promise.resolve();
  }, [uid]);

  const markNotificationAsRead = useCallback(id => {
    if (uid && id) {
      markNotificationRead(uid, id).catch(reportError);
    }
  }, [uid, reportError]);

  const markAllNotificationsAsRead = useCallback(() => {
    if (uid) {
      markAllNotificationsRead(uid).catch(reportError);
    }
  }, [uid, reportError]);

  const updateProfile = useCallback(async ({ name, avatar }) => {
    if (!uid) return;
    await authService.updateUserProfile(uid, { name, avatar });
  }, [uid]);

  const totalUnreadMessages = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversations]);

  const totalUnreadNotifications = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  return (
    <AppContext.Provider value={{
      user,
      authLoading,
      appActive,
      firebaseConfigured,
      syncError,
      contacts,
      conversations,
      reportError,
      markConversationAsRead: handleMarkConversationAsRead,
      login: authService.login,
      register: authService.register,
      logout: authService.logout,
      updateProfile,
      notifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      totalUnreadMessages,
      totalUnreadNotifications,
      pushNotificationsEnabled,
      setPushNotificationsEnabled,
      darkModeEnabled,
      setDarkModeEnabled,
      soundEnabled,
      setSoundEnabled,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) { throw new Error('useApp must be used within AppProvider'); }
  return context;
};
