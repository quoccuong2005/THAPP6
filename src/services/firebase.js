import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig.js';

export const firebaseConfigured = ['apiKey', 'projectId', 'appId', 'databaseURL']
  .every(key => Boolean(firebaseConfig[key]?.trim()));
let services;
export function getFirebase() {
  if (!firebaseConfigured) {
    throw new Error('Chưa cấu hình Firebase. Xem FIREBASE_SETUP.md và src/services/firebaseConfig.js.');
  }
  if (!services) {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    let auth;
    try {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch (error) {
      if (error.code !== 'auth/already-initialized') { throw error; }
      auth = getAuth(app);
    }
    services = { auth, db: getDatabase(app) };
  }
  return services;
}
