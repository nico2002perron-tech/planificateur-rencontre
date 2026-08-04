// Remplaçant de `server-only` pour Vitest UNIQUEMENT (voir vitest.config.ts).
//
// Le vrai paquet lève une erreur dès qu'il est chargé hors d'un composant
// serveur, ce qui est sa raison d'être — et ce qui empêche de tester les
// modules qui l'importent. Cet alias ne vaut QUE pour les tests : dans
// l'application, la garde d'origine s'applique intégralement.
export {};
