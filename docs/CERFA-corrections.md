# Corrections du remplissage CERFA

Les trois modèles PDF d'origine sont conservés. Aucune dépendance ni aucun service payant n'a été ajouté.

- **15497** : dates françaises ou ISO, conservation des quantités égales à zéro, absence de fuite non affirmée lorsque le champ est inconnu, texte « autre intervention » transmis au bon champ.
- **15498** : raison sociale, numéro de rue, voie, code postal, commune et courriel repris correctement depuis l'entreprise.
- **1301** : réparation du drapeau Radio absent des trois groupes du modèle ; correspondance réelle des choix de locaux, usage et qualité du client. Les déclarations de surface, surélévation et travaux énergétiques disposent de cases distinctes et ne sont plus déduites d'un type de travaux.
- Les valeurs d'un brouillon ne sont plus remplacées par les informations d'entreprise par défaut. Les liens contenant un pourcentage restent lisibles.
- Les dates envoyées à la base sont normalisées. Le brouillon est conservé si la sauvegarde en ligne échoue, avec un message distinguant téléchargement et enregistrement.
- Les compteurs 15498 et 1301 utilisent leur propre type.

Les téléchargements conservent le fonctionnement existant en PDF statique. L'option interne `{ flatten: false }` permet de vérifier les champs et de conserver une copie éditable. Les références de widgets supprimés sont nettoyées lors de l'aplatissement.

## Vérification

`node --test tests/*.test.mjs` : 22 tests, dont des tests sur les vrais modèles avec pdf-lib. Les valeurs canoniques, les choix et l'absence de widgets sur les documents statiques sont vérifiés. Les trois sorties ont également été ouvertes avec pypdf et rendues pour contrôle visuel. La compilation des modules internes et du CSS a réussi ; elle ne remplace pas le build Vite de Vercel.

## Connexions externes

Odoo et Claude ne sont pas connectés par cette modification. Aucune clé API n'a été créée et aucun abonnement, crédit ou service facturable n'a été activé. Le raccordement est différé tant que l'accès inclus dans les offres existantes et les autorisations nécessaires ne sont pas confirmés. Les signatures et mesures techniques ne sont pas inventées.
