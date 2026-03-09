# 🚀 Guide de publication sur le VS Code Marketplace

Ce guide explique comment publier l'extension FrançaisScript
sur le Marketplace officiel de VS Code, étape par étape.

---

## Prérequis

- **Node.js** installé (v16 ou plus récent) → https://nodejs.org
- **Git** installé → https://git-scm.com
- Un compte **Microsoft** (gratuit) → https://account.microsoft.com

---

## Étape 1 — Créer un compte Azure DevOps

1. Allez sur https://dev.azure.com
2. Connectez-vous avec votre compte Microsoft
3. Créez une organisation (ex: `francaisscript`)

---

## Étape 2 — Créer un Personal Access Token (PAT)

1. Dans Azure DevOps, cliquez sur votre avatar → **User Settings** → **Personal Access Tokens**
2. Cliquez sur **New Token**
3. Remplissez :
   - **Name** : `vsce-publish`
   - **Organization** : `All accessible organizations`
   - **Expiration** : 1 an
   - **Scopes** : cochez **Marketplace → Manage**
4. Cliquez **Create** et **copiez le token** (il ne s'affiche qu'une fois !)

---

## Étape 3 — Créer un Publisher sur le Marketplace

1. Allez sur https://marketplace.visualstudio.com/manage
2. Connectez-vous avec votre compte Microsoft
3. Cliquez **Create publisher**
4. Remplissez :
   - **ID** : `francaisscript` ← doit correspondre au `"publisher"` dans `package.json`
   - **Name** : `FrançaisScript`
   - **Description** : Le premier langage de programmation en français
5. Validez

---

## Étape 4 — Installer vsce

Ouvrez un terminal dans ce dossier et exécutez :

```bash
npm install -g @vscode/vsce
```

---

## Étape 5 — Se connecter avec vsce

```bash
vsce login francaisscript
```

Quand il vous demande le PAT, collez le token copié à l'étape 2.

---

## Étape 6 — Tester le package localement (optionnel)

Créez un fichier `.vsix` pour le tester avant de publier :

```bash
vsce package --no-dependencies
```

Cela génère `francaisscript-1.0.0.vsix`.
Pour l'installer dans VS Code : `Ctrl+Shift+P` → `Install from VSIX`.

---

## Étape 7 — Publier ! 🎉

```bash
vsce publish --no-dependencies
```

Votre extension sera disponible sur le Marketplace en quelques minutes à l'adresse :

```
https://marketplace.visualstudio.com/items?itemName=francaisscript.francaisscript
```

---

## Mettre à jour l'extension

Pour publier une nouvelle version, modifiez `"version"` dans `package.json`
(ex: `"1.0.1"`) puis relancez :

```bash
vsce publish --no-dependencies
```

Ou utilisez le raccourci de version automatique :

```bash
vsce publish patch   # 1.0.0 → 1.0.1
vsce publish minor   # 1.0.0 → 1.1.0
vsce publish major   # 1.0.0 → 2.0.0
```

---

## (Bonus) Publier aussi sur Open VSX

Open VSX est le Marketplace alternatif pour VSCodium et d'autres éditeurs.

1. Créez un compte sur https://open-vsx.org
2. Générez un token dans votre profil
3. Publiez avec :

```bash
npx ovsx publish francaisscript-1.0.0.vsix -p <votre-token>
```

---

## Structure du dossier (rappel)

```
francaisscript-vscode/
├── src/
│   └── extension.js          ← Logique principale + interpréteur
├── syntaxes/
│   └── francaisscript.tmLanguage.json  ← Coloration syntaxique
├── snippets/
│   └── francaisscript.json   ← Snippets de code
├── icons/
│   ├── icon.png              ← Icône 128×128 (Marketplace)
│   └── file-icon.svg         ← Icône des fichiers .fs
├── images/
│   └── screenshot.png        ← Capture d'écran (README)
├── language-configuration.json ← Indentation, guillemets...
├── package.json              ← Manifeste de l'extension
├── README.md                 ← Page du Marketplace
├── CHANGELOG.md              ← Historique des versions
├── LICENSE                   ← Licence MIT
├── .vscodeignore             ← Fichiers exclus du package
└── .gitignore
```

---

## Commandes utiles

| Commande | Description |
|---|---|
| `vsce package` | Créer le `.vsix` sans publier |
| `vsce publish` | Publier sur le Marketplace |
| `vsce ls` | Lister les fichiers qui seront inclus |
| `vsce show francaisscript.francaisscript` | Voir les infos publiées |

---

*Guide rédigé pour FrançaisScript v1.0.0 — 2026*
