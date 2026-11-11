// src/services/uploadService.js
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { cloudinaryConfig } from './cloudinaryConfig';

const IMAGE_PICKER_OPTIONS = {
  mediaType: 'photo',
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8,
  includeBase64: false,
};

export async function requestCameraPermission() {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Quyền sử dụng máy ảnh',
          message: 'Ứng dụng cần quyền truy cập camera để chụp ảnh gửi trong tin nhắn.',
          buttonPositive: 'Đồng ý',
          buttonNegative: 'Từ chối',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
}

export function pickImageFromGallery() {
  return new Promise((resolve, reject) => {
    launchImageLibrary(IMAGE_PICKER_OPTIONS, response => {
      if (response.didCancel) {
        resolve(null);
      } else if (response.errorCode) {
        reject(new Error(response.errorMessage || 'Lỗi khi chọn ảnh từ thư viện.'));
      } else if (response.assets && response.assets.length > 0) {
        resolve(response.assets[0]);
      } else {
        resolve(null);
      }
    });
  });
}

export async function capturePhoto() {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    Alert.alert('Quyền truy cập bị từ chối', 'Bạn cần cấp quyền máy ảnh trong cài đặt để chụp ảnh.');
    return null;
  }

  return new Promise((resolve, reject) => {
    launchCamera(IMAGE_PICKER_OPTIONS, response => {
      if (response.didCancel) {
        resolve(null);
      } else if (response.errorCode) {
        reject(new Error(response.errorMessage || 'Lỗi khi chụp ảnh.'));
      } else if (response.assets && response.assets.length > 0) {
        resolve(response.assets[0]);
      } else {
        resolve(null);
      }
    });
  });
}

export async function uploadImageToCloudinary(asset) {
  if (!cloudinaryConfig.cloudName || cloudinaryConfig.cloudName === 'demo' && cloudinaryConfig.uploadPreset === 'unsigned_preset') {
    // If not configured, we provide a mock/placeholder url or raise notice
    // But still attempt upload if configured
  }

  const uri = asset.uri;
  const fileName = asset.fileName || 'upload.jpg';
  const type = asset.type || 'image/jpeg';

  const data = new FormData();
  data.append('file', {
    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
    type: type,
    name: fileName,
  });
  data.append('upload_preset', cloudinaryConfig.uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
  const response = await fetch(url, {
    method: 'POST',
    body: data,
  });

  const result = await response.json();
  if (!response.ok) {
    const errorMsg = result.error?.message || '';
    if (errorMsg.includes('Unknown API key') || errorMsg.includes('Upload preset must be specified')) {
      throw new Error('Chưa cấu hình Unsigned Upload Preset trên Cloudinary. Hãy kiểm tra cloudName và chuyển Signing Mode của preset thành Unsigned.');
    }
    throw new Error(errorMsg || 'Tải ảnh lên Cloudinary thất bại.');
  }

  return result.secure_url;
}
