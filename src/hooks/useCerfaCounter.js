import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getOrgId } from '../utils/orgHelper';
import {
    getCurrentFicheInfo,
    getCurrentFicheInfoFromDB,
    getNextFicheNumberFromDB,
} from '../utils/cerfaService';

/**
 * Hook de numérotation CERFA.
 * Charge le compteur depuis Supabase (partagé entre appareils) et expose :
 *  - ficheInfo     : { year, count, nextNumber, formatted, cerfaType, source }
 *  - getNextNumber : async () => string  — incrémente le compteur et retourne le numéro
 *  - refresh       : async () => void    — relit le compteur sans incrémenter
 *
 * Toute nouvelle page CERFA appelle simplement :
 *   const { ficheInfo, getNextNumber, refresh } = useCerfaCounter('XXXXX');
 */
export function useCerfaCounter(cerfaType) {
    const [ficheInfo, setFicheInfo] = useState(() => getCurrentFicheInfo(cerfaType));

    // Chargement initial depuis Supabase
    useEffect(() => {
        getCurrentFicheInfoFromDB(cerfaType).then(setFicheInfo).catch(() => {});
    }, [cerfaType]);

    // Relire le compteur (après génération, ou manuellement)
    const refresh = useCallback(async () => {
        try {
            const info = await getCurrentFicheInfoFromDB(cerfaType);
            setFicheInfo(info);
        } catch {
            setFicheInfo(getCurrentFicheInfo(cerfaType));
        }
    }, [cerfaType]);

    // Incrémenter et retourner le numéro formaté
    const getNextNumber = useCallback(async () => {
        const number = await getNextFicheNumberFromDB(cerfaType);
        // Actualiser l'affichage après incrément
        getCurrentFicheInfoFromDB(cerfaType).then(setFicheInfo).catch(() => {});
        return number;
    }, [cerfaType]);

    // Forcer le compteur à une valeur précise (CERFA papiers, correction)
    const setCounter = useCallback(async (count) => {
        const orgId = getOrgId();
        const year = new Date().getFullYear();
        if (orgId) {
            const { error } = await supabase.rpc('set_cerfa_counter', {
                p_org_id: orgId,
                p_cerfa_type: cerfaType,
                p_count: count,
                p_year: year,
            });
            if (error) throw error;
        }
        // Aussi mettre à jour le localStorage (fallback)
        try {
            const key = 'cerfa_fiche_counters';
            const all = JSON.parse(localStorage.getItem(key) || '{}');
            all[cerfaType] = { year, count };
            localStorage.setItem(key, JSON.stringify(all));
        } catch { /* ignore */ }
        await refresh();
    }, [cerfaType, refresh]);

    return { ficheInfo, getNextNumber, setCounter, refresh };
}
