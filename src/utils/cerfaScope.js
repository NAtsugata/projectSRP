export function cerfaStorageKey(base, profile) {
    if (!profile?.id || !profile?.organization_id) return null;
    return `cerfa:v2:${encodeURIComponent(profile.organization_id)}:${encodeURIComponent(profile.id)}:${base}`;
}
