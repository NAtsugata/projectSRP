// src/hooks/index.js
// Export centralisé de tous les hooks personnalisés

export { useAsync } from './useAsync';
export { useForm } from './useForm';
export { useLocalStorage } from './useLocalStorage';
export { useDebounce } from './useDebounce';
export { useGeolocation } from './useGeolocation';
export { default as useMobileFileManager } from './useMobileFileManager';
export { useChecklistPDFGenerator } from './useChecklistPDFGenerator';
export {
  useMobileUpload,
  useDeviceCapabilities,
  useFileValidation,
  useImageCompression,
  useOfflineUpload,
  useResilientUpload
} from './useMobileUpload';
