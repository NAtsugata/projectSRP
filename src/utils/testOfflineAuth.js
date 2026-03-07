// Script de test pour l'authentification hors ligne
// À exécuter dans la console du navigateur

export async function testOfflineAuth() {
  console.log('=== TEST AUTHENTIFICATION HORS LIGNE ===\n');

  // 1. Test IndexedDB
  console.log('1️⃣ Test IndexedDB...');
  try {
    const { openDatabase, STORES_ENUM } = await import('./offlineStorage');
    const db = await openDatabase();
    console.log('✅ IndexedDB ouvert:', db.name, 'version', db.version);
    console.log('Stores disponibles:', [...db.objectStoreNames]);
  } catch (error) {
    console.error('❌ Erreur IndexedDB:', error);
    return;
  }

  // 2. Test sauvegarde session
  console.log('\n2️⃣ Test sauvegarde session...');
  try {
    const { cacheAuthSession } = await import('./offlineStorage');
    const testSession = {
      access_token: 'test-token',
      user: { id: 'test-user-id', email: 'test@example.com' }
    };
    await cacheAuthSession(testSession);
    console.log('✅ Session test sauvegardée');
  } catch (error) {
    console.error('❌ Erreur sauvegarde session:', error);
    return;
  }

  // 3. Test récupération session
  console.log('\n3️⃣ Test récupération session...');
  try {
    const { getCachedAuthSession } = await import('./offlineStorage');
    const session = await getCachedAuthSession();
    console.log('✅ Session récupérée:', session);
  } catch (error) {
    console.error('❌ Erreur récupération session:', error);
    return;
  }

  // 4. Test hash mot de passe
  console.log('\n4️⃣ Test hash mot de passe...');
  try {
    const encoder = new TextEncoder();
    const testPassword = 'test123';
    const data = encoder.encode(testPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    console.log('✅ Hash généré:', hash.substring(0, 20) + '...');

    // Test hash identique
    const hashBuffer2 = await crypto.subtle.digest('SHA-256', data);
    const hashArray2 = Array.from(new Uint8Array(hashBuffer2));
    const hash2 = hashArray2.map(b => b.toString(16).padStart(2, '0')).join('');
    console.log('✅ Hash identique:', hash === hash2);
  } catch (error) {
    console.error('❌ Erreur hash:', error);
    return;
  }

  // 5. Test sauvegarde credentials
  console.log('\n5️⃣ Test sauvegarde credentials...');
  try {
    const { cacheAuthCredentials } = await import('./offlineStorage');
    const testEmail = 'test@example.com';
    const testHash = 'testhash123';
    await cacheAuthCredentials(testEmail, testHash);
    console.log('✅ Credentials test sauvegardés');
  } catch (error) {
    console.error('❌ Erreur sauvegarde credentials:', error);
    return;
  }

  // 6. Test vérification credentials
  console.log('\n6️⃣ Test vérification credentials...');
  try {
    const { verifyOfflineCredentials } = await import('./offlineStorage');
    const valid = await verifyOfflineCredentials('test@example.com', 'testhash123');
    console.log('✅ Vérification credentials:', valid);

    const invalid = await verifyOfflineCredentials('test@example.com', 'wronghash');
    console.log('✅ Rejection credentials invalides:', !invalid);
  } catch (error) {
    console.error('❌ Erreur vérification credentials:', error);
    return;
  }

  // 7. Inspecter données réelles
  console.log('\n7️⃣ Inspection données réelles...');
  try {
    const { getFromStore, STORES_ENUM } = await import('./offlineStorage');

    const session = await getFromStore('auth', 'session');
    console.log('Session réelle:', session ? '✅ Existe' : '❌ Manquante');
    if (session) {
      console.log('  - Timestamp:', new Date(session.timestamp).toLocaleString());
      console.log('  - User:', session.value?.user?.email || 'N/A');
    }

    const credentials = await getFromStore('auth', 'credentials');
    console.log('Credentials réels:', credentials ? '✅ Existent' : '❌ Manquants');
    if (credentials) {
      console.log('  - Email:', credentials.email);
      console.log('  - Hash:', credentials.passwordHash?.substring(0, 20) + '...');
      console.log('  - Timestamp:', new Date(credentials.timestamp).toLocaleString());
    }

    const userData = await getFromStore('userData', 'current_user');
    console.log('User data:', userData ? '✅ Existe' : '❌ Manquant');
    if (userData) {
      console.log('  - Name:', userData.full_name || userData.email);
      console.log('  - Admin:', userData.is_admin);
    }
  } catch (error) {
    console.error('❌ Erreur inspection:', error);
    return;
  }

  // 8. Test validité session
  console.log('\n8️⃣ Test validité session...');
  try {
    const { isSessionValid } = await import('./offlineStorage');
    const valid = await isSessionValid();
    console.log('Session valide (< 7 jours):', valid ? '✅ Oui' : '❌ Non');
  } catch (error) {
    console.error('❌ Erreur test validité:', error);
    return;
  }

  console.log('\n=== FIN DES TESTS ===');
}

// Fonction pour afficher l'état complet
export async function showOfflineState() {
  console.log('=== ÉTAT AUTHENTIFICATION HORS LIGNE ===\n');

  try {
    const { getFromStore, getAllFromStore } = await import('./offlineStorage');

    // Auth store
    console.log('📦 AUTH STORE:');
    const authKeys = ['session', 'credentials'];
    for (const key of authKeys) {
      const data = await getFromStore('auth', key);
      if (data) {
        console.log(`  ✅ ${key}:`, data);
      } else {
        console.log(`  ❌ ${key}: Manquant`);
      }
    }

    // User data store
    console.log('\n👤 USER DATA STORE:');
    const userData = await getFromStore('userData', 'current_user');
    if (userData) {
      console.log('  ✅ User:', userData);
    } else {
      console.log('  ❌ User data manquant');
    }

    // Sync queue
    console.log('\n🔄 SYNC QUEUE:');
    const queue = await getAllFromStore('syncQueue');
    console.log(`  ${queue.length} opération(s) en attente`);
    if (queue.length > 0) {
      console.log('  Opérations:', queue);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Fonction pour nettoyer le cache (debug)
export async function clearOfflineCache() {
  console.log('🗑️ Nettoyage du cache hors ligne...');
  try {
    const { clearAuthCache } = await import('./offlineStorage');
    await clearAuthCache();
    console.log('✅ Cache nettoyé');
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
  }
}

// Export pour utilisation dans la console
if (typeof window !== 'undefined') {
  window.testOfflineAuth = testOfflineAuth;
  window.showOfflineState = showOfflineState;
  window.clearOfflineCache = clearOfflineCache;
  console.log('✅ Fonctions de test disponibles:');
  console.log('  - testOfflineAuth() : Lance tous les tests');
  console.log('  - showOfflineState() : Affiche l\'état actuel');
  console.log('  - clearOfflineCache() : Nettoie le cache');
}
