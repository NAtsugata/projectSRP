/**
 * Fichier utilitaire pour les fonctions partagées dans l'application.
 */

/**
 * Formate les noms des employés assignés à partir d'un tableau d'assignations.
 * @param {Array} assignments - Le tableau `intervention_assignments` d'une intervention.
 * @returns {string} Une chaîne de caractères avec les noms séparés par des virgules, ou 'Personne' si personne n'est assigné.
 */
export const getAssignedUsersNames = (assignments) => {
    // Si le tableau est vide ou non défini, on retourne 'Personne'
    if (!assignments || assignments.length === 0) {
        return 'Personne';
    }

    // On utilise `map` pour extraire les noms complets.
    // L'opérateur de chaînage optionnel `?.` évite une erreur si `profiles` est manquant.
    // On retourne 'Nom Inconnu' si `full_name` n'est pas trouvé pour une assignation.
    return assignments
        .map(a => a.profiles?.full_name || 'Nom Inconnu')
        .join(', ');
};
