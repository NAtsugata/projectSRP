import { useAuthStore } from '../store/authStore';
import { cerfaStorageKey } from './cerfaScope';

export function currentCerfaStorageKey(base) {
    return cerfaStorageKey(base, useAuthStore.getState().profile);
}
