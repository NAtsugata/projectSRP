#!/bin/bash
# Script de vérification des composants modernes

echo "🔍 DIAGNOSTIC DES COMPOSANTS MODERNES"
echo "===================================="
echo ""

echo "✅ 1. Vérification des fichiers JS:"
if [ -f "src/components/intervention/InterventionHeader.js" ]; then
  echo "   ✓ InterventionHeader.js existe"
else
  echo "   ✗ InterventionHeader.js MANQUANT"
fi

if [ -f "src/components/intervention/TimeDisplay.js" ]; then
  echo "   ✓ TimeDisplay.js existe"
else
  echo "   ✗ TimeDisplay.js MANQUANT"
fi

if [ -f "src/components/intervention/QuickActionsBar.js" ]; then
  echo "   ✓ QuickActionsBar.js existe"
else
  echo "   ✗ QuickActionsBar.js MANQUANT"
fi

if [ -f "src/components/intervention/SmartAlerts.js" ]; then
  echo "   ✓ SmartAlerts.js existe"
else
  echo "   ✗ SmartAlerts.js MANQUANT"
fi

echo ""
echo "✅ 2. Vérification des fichiers CSS:"
if [ -f "src/pages/InterventionDetailView_Modern.css" ]; then
  echo "   ✓ InterventionDetailView_Modern.css existe"
else
  echo "   ✗ InterventionDetailView_Modern.css MANQUANT"
fi

echo ""
echo "✅ 3. Vérification de l'import dans index.js:"
if grep -q "InterventionHeader" "src/components/intervention/index.js"; then
  echo "   ✓ InterventionHeader exporté"
else
  echo "   ✗ InterventionHeader NON exporté"
fi

echo ""
echo "✅ 4. Vérification de l'import du CSS dans InterventionDetailView.js:"
if grep -q "InterventionDetailView_Modern.css" "src/pages/InterventionDetailView.js"; then
  echo "   ✓ CSS moderne importé"
else
  echo "   ✗ CSS moderne NON importé"
fi

echo ""
echo "✅ 5. Vérification de l'utilisation dans InterventionDetailView.js:"
if grep -q "intervention-detail-modern" "src/pages/InterventionDetailView.js"; then
  echo "   ✓ Classe 'intervention-detail-modern' utilisée"
else
  echo "   ✗ Classe 'intervention-detail-modern' NON utilisée"
fi

if grep -q "<InterventionHeader" "src/pages/InterventionDetailView.js"; then
  echo "   ✓ InterventionHeader utilisé dans le render"
else
  echo "   ✗ InterventionHeader NON utilisé"
fi

if grep -q "<TimeDisplay" "src/pages/InterventionDetailView.js"; then
  echo "   ✓ TimeDisplay utilisé dans le render"
else
  echo "   ✗ TimeDisplay NON utilisé"
fi

if grep -q "<QuickActionsBar" "src/pages/InterventionDetailView.js"; then
  echo "   ✓ QuickActionsBar utilisé dans le render"
else
  echo "   ✗ QuickActionsBar NON utilisé"
fi

if grep -q "<SmartAlerts" "src/pages/InterventionDetailView.js"; then
  echo "   ✓ SmartAlerts utilisé dans le render"
else
  echo "   ✗ SmartAlerts NON utilisé"
fi

echo ""
echo "✅ 6. Vérification du commit actuel:"
git log --oneline -1

echo ""
echo "✅ 7. Vérification de la branche:"
git branch --show-current

echo ""
echo "===================================="
echo "📋 RÉSUMÉ"
echo "===================================="
echo ""
echo "Si tous les tests sont ✓, les composants modernes sont bien présents."
echo "Pour les voir dans l'application:"
echo ""
echo "1. Redémarrer le serveur:"
echo "   npm start"
echo ""
echo "2. Vider le cache du navigateur:"
echo "   Chrome/Edge: Ctrl+Shift+Delete"
echo "   Ou mode navigation privée"
echo ""
echo "3. Ouvrir une intervention dans l'app"
echo "   URL: http://localhost:3000/planning/intervention/[ID]"
echo ""
