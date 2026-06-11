# Kit marketing — Padel Meet

Tout ce qu'il faut pour lancer, dans un seul dossier.

| Fichier | Quoi | Comment l'utiliser |
|---------|------|--------------------|
| `flyer-club.html` | Flyer A6 imprimable (4 par A4) avec QR | Ouvre dans le navigateur → **Imprimer** → A4, marges « aucune ». Dépose-les au comptoir du club. |
| `qr-code.png` | QR code vers l'app (mascotte au centre) | Affiches, stories, flyers. Pointe vers `padel-meet.vercel.app`. |
| `social-content.md` | Calendrier 2 semaines + scripts Reels + bio + hashtags + DM influenceurs | Tourne 3 Reels/semaine. Réutilise le module Apprendre comme contenu. |
| `aso-store-listing.md` | Fiches App Store / Play Store (FR + EN) + plan des captures | Copie-colle au moment de la soumission. |
| `og-image.png` *(dans /public)* | Image d'aperçu quand on partage le lien | Déjà branchée dans le site. |

## La règle d'or du lancement
**Ne lance pas partout.** Une app de mise en relation a besoin de **densité locale** : choisis
**1 club / 1 ville**, recrute ~100 joueurs du même endroit, génère de vrais matchs → bouche-à-oreille.
Quand un club « tourne », tu dupliques sur le suivant.

## Ordre conseillé
1. **Avant** : QR + flyers au club, story « on lance à [club] ».
2. **Semaine 1-2** : Reels tips (règle des 80 %, chiquita…) + posts problème→solution.
3. **Quand ça mord** : micro-influenceurs padel locaux (DM type fourni).
4. **En parallèle** : la landing + waitlist (chantier séparé) pour capter les emails.

## À personnaliser avant impression / soumission
- Remplace l'URL `padel-meet.vercel.app` par ton **domaine final** (puis régénère le QR).
- Mets une **vraie adresse de contact** dans les pages légales (`src/screens/LegalScreen.jsx`).
- Ajoute ta **ville** dans les hashtags locaux (`#padel[ville]`).
