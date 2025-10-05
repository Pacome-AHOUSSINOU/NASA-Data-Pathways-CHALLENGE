# Guide de Déploiement Render - Smart City

## 🎯 Problème résolu

L'erreur `npm error Missing script: "start"` a été résolue en configurant le projet pour utiliser un environnement Node.js avec le package `serve`.

## ✅ Solution appliquée

### 1. Modifications du `package.json`
- **Ajout du script start** : `"start": "serve -s dist -l $PORT"`
- **Ajout de la dépendance** : `"serve": "^14.2.3"`

### 2. Configuration `render.yaml` finale
```yaml
services:
  - type: web
    name: smartcity-app
    env: node                          # Environnement Node.js (pas static)
    buildCommand: npm ci && npm run build
    startCommand: npm start            # Utilise le script start
    envVars:
      - key: NODE_VERSION
        value: 18
      - key: PORT
        value: 10000
```

## 🔧 Dossier de test

Un dossier `render-test/` a été créé avec :
- **3 configurations différentes** testées
- **Tests locaux** validés
- **Documentation complète** des approches

## 🚀 Étapes de déploiement

1. **Commitez les changements** :
   ```bash
   git add .
   git commit -m "Fix: Add start script and serve dependency for Render deployment"
   git push
   ```

2. **Sur Render** :
   - Le fichier `render.yaml` sera automatiquement détecté
   - Le build utilisera `npm ci && npm run build`
   - Le serveur démarrera avec `npm start`

3. **Variables d'environnement** :
   - `NODE_VERSION=18`
   - `PORT=10000` (géré automatiquement par Render)

## ✨ Pourquoi cette solution fonctionne

- **`env: node`** : Permet d'exécuter des commandes Node.js
- **`serve`** : Package léger pour servir des fichiers statiques
- **`$PORT`** : Variable d'environnement fournie par Render
- **SPA Support** : `serve -s` gère automatiquement les routes React Router

## 🧪 Tests effectués

✅ Build local réussi  
✅ Serveur local fonctionnel  
✅ Configuration Render validée  
✅ Dépendances installées correctement  

Votre application Smart City est maintenant prête pour le déploiement sur Render !
