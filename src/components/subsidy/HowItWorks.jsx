// src/components/subsidy/HowItWorks.jsx
// Explications détaillées du calcul des primes - Style CEDEO

import React, { useState } from 'react';
import './HowItWorks.css';

const HowItWorks = ({ calculationType = 'individual' }) => {
  const [activeTab, setActiveTab] = useState('cee');

  if (calculationType === 'copro') {
    return <HowItWorksCopro />;
  }

  return (
    <div className="how-it-works">
      <h2 className="how-title">💡 Comment sont calculées vos aides ?</h2>
      <p className="how-subtitle">
        Comprendre le calcul des Certificats d'Économies d'Énergie (CEE) et MaPrimeRénov'
      </p>

      {/* Onglets */}
      <div className="how-tabs">
        <button
          className={`how-tab ${activeTab === 'cee' ? 'active' : ''}`}
          onClick={() => setActiveTab('cee')}
        >
          ⚡ Prime CEE
        </button>
        <button
          className={`how-tab ${activeTab === 'mpr' ? 'active' : ''}`}
          onClick={() => setActiveTab('mpr')}
        >
          🏠 MaPrimeRénov'
        </button>
        <button
          className={`how-tab ${activeTab === 'ceiling' ? 'active' : ''}`}
          onClick={() => setActiveTab('ceiling')}
        >
          🎯 Écrêtement
        </button>
        <button
          className={`how-tab ${activeTab === 'eligibility' ? 'active' : ''}`}
          onClick={() => setActiveTab('eligibility')}
        >
          ✅ Éligibilité
        </button>
      </div>

      {/* Contenu CEE */}
      {activeTab === 'cee' && (
        <div className="how-content">
          <h3>⚡ Prime Énergie (CEE) - Certificats d'Économies d'Énergie</h3>

          <div className="how-section">
            <h4>📋 Principe de calcul (Fiche BAR-TH-171 révisée 2026)</h4>
            <p>
              Les CEE sont calculés selon une <strong>formule standardisée</strong> qui prend en compte :
            </p>
            <ol>
              <li>
                <strong>Type de logement</strong> : Maison ou Appartement
                <ul>
                  <li>Maisons : Seuils 70m² et 90m²</li>
                  <li>Appartements : Seuils 35m² et 60m²</li>
                </ul>
              </li>
              <li>
                <strong>Surface chauffée</strong> : Surface habitable équipée de la PAC
                <ul>
                  <li>Petite : &lt; 70m² (maison) ou &lt; 35m² (appart)</li>
                  <li>Moyenne : 70-90m² (maison) ou 35-60m² (appart)</li>
                  <li>Grande : &gt; 90m² (maison) ou &gt; 60m² (appart)</li>
                </ul>
              </li>
              <li>
                <strong>Zone climatique</strong> : Selon votre localisation
                <ul>
                  <li><strong>H1</strong> (Nord/Est) : Climat froid → Prime + élevée</li>
                  <li><strong>H2</strong> (Centre/Ouest) : Climat tempéré</li>
                  <li><strong>H3</strong> (Sud/Méditerranée) : Climat doux → Prime - élevée</li>
                </ul>
              </li>
              <li>
                <strong>ETAS (Efficacité Énergétique Saisonnière)</strong> : Performance de la PAC
                <ul>
                  <li>ETAS 111-140% : Montant standard</li>
                  <li>ETAS &gt; 140% : Montant bonifié (~20% supplémentaire)</li>
                </ul>
              </li>
              <li>
                <strong>Niveau de revenus</strong> :
                <ul>
                  <li><strong>Précarité énergétique</strong> (Bleu/Jaune) : Coup de pouce × 5</li>
                  <li><strong>Classique</strong> (Violet/Rose) : Montant de base</li>
                </ul>
              </li>
            </ol>
          </div>

          <div className="how-section">
            <h4>🧮 Formule de calcul</h4>
            <div className="formula-box">
              <p><strong>Prime CEE =</strong></p>
              <code>
                kWh cumac × Prix CEE (€/MWhc)
              </code>
              <p className="formula-detail">
                <strong>kWh cumac</strong> = Économies d'énergie cumulées actualisées sur la durée de vie<br />
                <strong>Prix CEE</strong> ≈ 11€/MWhc (Précarité) ou 7,8€/MWhc (Classique)
              </p>
            </div>
          </div>

          <div className="how-section example-box">
            <h4>📊 Exemple concret</h4>
            <p><strong>Maison 95m² en zone H1, ménage Bleu</strong></p>
            <ul>
              <li>Type logement : Maison → Catégorie "Grande" (&gt;90m²)</li>
              <li>Zone H1 : Climat froid</li>
              <li>Précaire : Coup de pouce × 5</li>
              <li>→ <strong>Prime CEE = 5 300 €</strong></li>
            </ul>
          </div>

          <div className="how-section">
            <h4>📚 Références officielles</h4>
            <ul>
              <li>Fiche CEE : <strong>BAR-TH-171</strong> (Pompe à chaleur air/eau)</li>
              <li>Arrêté du 12 décembre 2025 (applicabilité 01/01/2026)</li>
              <li>Ministère de la Transition Écologique</li>
            </ul>
          </div>
        </div>
      )}

      {/* Contenu MaPrimeRénov' */}
      {activeTab === 'mpr' && (
        <div className="how-content">
          <h3>🏠 MaPrimeRénov' pour Pompe à Chaleur Air/Eau</h3>

          <div className="how-section">
            <h4>💰 Barème 2026 (selon revenus)</h4>
            <table className="bareme-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Revenus</th>
                  <th>Montant PAC</th>
                </tr>
              </thead>
              <tbody>
                <tr className="cat-blue">
                  <td><strong>Bleu</strong> (Très modeste)</td>
                  <td>≤ Plafonds ANAH</td>
                  <td><strong>5 000 €</strong></td>
                </tr>
                <tr className="cat-yellow">
                  <td><strong>Jaune</strong> (Modeste)</td>
                  <td>≤ Plafonds ANAH</td>
                  <td><strong>4 000 €</strong></td>
                </tr>
                <tr className="cat-violet">
                  <td><strong>Violet</strong> (Intermédiaire)</td>
                  <td>≤ Plafonds ANAH</td>
                  <td><strong>3 000 €</strong></td>
                </tr>
                <tr className="cat-rose">
                  <td><strong>Rose</strong> (Supérieur)</td>
                  <td>&gt; Plafonds Violet</td>
                  <td><strong>0 €</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="how-section">
            <h4>🎁 Bonus cumulables</h4>
            <table className="bonus-table">
              <thead>
                <tr>
                  <th>Bonus</th>
                  <th>Condition</th>
                  <th>Bleu</th>
                  <th>Jaune</th>
                  <th>Violet</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Sortie passoire</strong></td>
                  <td>F/G → E minimum</td>
                  <td>+500€</td>
                  <td>+500€</td>
                  <td>+500€</td>
                </tr>
                <tr>
                  <td><strong>Objectif BBC</strong></td>
                  <td>Atteindre A ou B</td>
                  <td>+500€</td>
                  <td>+500€</td>
                  <td>+500€</td>
                </tr>
                <tr>
                  <td><strong>Remplacement fioul</strong></td>
                  <td>Dépose cuve fioul</td>
                  <td>+1 200€</td>
                  <td>+800€</td>
                  <td>+400€</td>
                </tr>
                <tr>
                  <td><strong>Remplacement gaz</strong></td>
                  <td>Dépose chaudière gaz</td>
                  <td>+400€</td>
                  <td>+400€</td>
                  <td>0€</td>
                </tr>
                <tr>
                  <td><strong>Remplacement charbon</strong></td>
                  <td>Dépose chaudière charbon</td>
                  <td>+800€</td>
                  <td>+800€</td>
                  <td>+400€</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="how-section example-box">
            <h4>📊 Exemple calcul complet</h4>
            <p><strong>Ménage Bleu remplaçant chaudière fioul + sortie passoire</strong></p>
            <div className="calculation-steps">
              <div className="calc-step">
                <span>Aide de base Bleu :</span>
                <strong>5 000 €</strong>
              </div>
              <div className="calc-step">
                <span>+ Bonus sortie passoire :</span>
                <strong>500 €</strong>
              </div>
              <div className="calc-step">
                <span>+ Bonus remplacement fioul :</span>
                <strong>1 200 €</strong>
              </div>
              <div className="calc-step total">
                <span><strong>= Total MaPrimeRénov' :</strong></span>
                <strong>6 700 €</strong>
              </div>
            </div>
          </div>

          <div className="how-section">
            <h4>📋 Conditions importantes</h4>
            <ul>
              <li>✅ Bâtiment construit depuis <strong>plus de 2 ans</strong></li>
              <li>✅ Installation par un professionnel <strong>RGE</strong></li>
              <li>✅ Demande <strong>AVANT</strong> le début des travaux</li>
              <li>✅ Plafond de dépenses : <strong>12 000 € HT</strong></li>
              <li>✅ Revenus fiscaux de référence (RFR) année N-1</li>
            </ul>
          </div>
        </div>
      )}

      {/* Contenu Écrêtement */}
      {activeTab === 'ceiling' && (
        <div className="how-content">
          <h3>🎯 Écrêtement des Aides (Plafond de cumul)</h3>

          <div className="how-section">
            <h4>⚖️ Principe du double plafond 2026</h4>
            <p>
              L'écrêtement limite le montant total des aides cumulées (CEE + MaPrimeRénov' + Bonus).
              Il existe <strong>2 plafonds simultanés</strong>, on retient le plus restrictif :
            </p>
          </div>

          <div className="how-section">
            <h4>🔢 Plafond 1 : Montant absolu maximum</h4>
            <table className="ceiling-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>Plafond absolu</th>
                </tr>
              </thead>
              <tbody>
                <tr className="cat-blue">
                  <td><strong>Bleu</strong></td>
                  <td><strong>10 800 €</strong></td>
                </tr>
                <tr className="cat-yellow">
                  <td><strong>Jaune</strong></td>
                  <td><strong>9 000 €</strong></td>
                </tr>
                <tr className="cat-violet">
                  <td><strong>Violet</strong></td>
                  <td><strong>7 200 €</strong></td>
                </tr>
                <tr className="cat-rose">
                  <td><strong>Rose</strong></td>
                  <td><strong>4 800 €</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="how-section">
            <h4>📊 Plafond 2 : Pourcentage du coût des travaux</h4>
            <table className="ceiling-table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th>% Maximum</th>
                  <th>Exemple (12 000€)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="cat-blue">
                  <td><strong>Bleu</strong></td>
                  <td>90%</td>
                  <td>10 800 €</td>
                </tr>
                <tr className="cat-yellow">
                  <td><strong>Jaune</strong></td>
                  <td>75%</td>
                  <td>9 000 €</td>
                </tr>
                <tr className="cat-violet">
                  <td><strong>Violet</strong></td>
                  <td>60%</td>
                  <td>7 200 €</td>
                </tr>
                <tr className="cat-rose">
                  <td><strong>Rose</strong></td>
                  <td>40%</td>
                  <td>4 800 €</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="how-section example-box">
            <h4>🧮 Formule d'écrêtement</h4>
            <div className="formula-box">
              <code>
                Aide finale = MIN(<br />
                &nbsp;&nbsp;Aide totale calculée,<br />
                &nbsp;&nbsp;Plafond absolu,<br />
                &nbsp;&nbsp;% × Coût travaux<br />
                )
              </code>
            </div>
          </div>

          <div className="how-section example-box">
            <h4>📊 Exemple d'écrêtement</h4>
            <p><strong>Ménage Bleu - Travaux 12 000 € - Aides calculées 11 500 €</strong></p>
            <div className="calculation-steps">
              <div className="calc-step">
                <span>Aide totale calculée :</span>
                <strong>11 500 €</strong>
              </div>
              <div className="calc-step">
                <span>Plafond absolu Bleu :</span>
                <strong>10 800 €</strong>
              </div>
              <div className="calc-step">
                <span>Plafond 90% × 12000€ :</span>
                <strong>10 800 €</strong>
              </div>
              <div className="calc-step warning">
                <span>MIN(11 500, 10 800, 10 800) =</span>
                <strong>10 800 €</strong>
              </div>
              <div className="calc-step total">
                <span><strong>Aide finale écrêtée :</strong></span>
                <strong>10 800 €</strong>
              </div>
              <div className="calc-step reduction">
                <span>Réduction appliquée :</span>
                <strong>-700 €</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenu Éligibilité */}
      {activeTab === 'eligibility' && (
        <div className="how-content">
          <h3>✅ Conditions d'Éligibilité Technique</h3>

          <div className="how-section">
            <h4>🔧 Critères PAC Air/Eau 2026</h4>
            <table className="eligibility-table">
              <thead>
                <tr>
                  <th>Critère</th>
                  <th>Requis</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>ETAS minimum</strong></td>
                  <td>111%</td>
                  <td>Efficacité Énergétique Saisonnière (norme EN 14825)</td>
                </tr>
                <tr>
                  <td><strong>Régulateur</strong></td>
                  <td>Classe IV min</td>
                  <td>Régulateur de température obligatoire</td>
                </tr>
                <tr>
                  <td><strong>Certification</strong></td>
                  <td>NF PAC</td>
                  <td>Ou Eurovent Certified Performance</td>
                </tr>
                <tr>
                  <td><strong>Âge bâtiment</strong></td>
                  <td>&gt; 2 ans</td>
                  <td>Construction achevée depuis plus de 2 ans</td>
                </tr>
                <tr>
                  <td><strong>Professionnel</strong></td>
                  <td>RGE</td>
                  <td>Reconnu Garant de l'Environnement (QualiPAC)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="how-section">
            <h4>📋 Obligations administratives</h4>
            <ul className="checklist">
              <li>✅ <strong>Devis signé AVANT</strong> le début des travaux</li>
              <li>✅ <strong>Dépôt demande</strong> CEE et MaPrimeRénov' avant travaux</li>
              <li>✅ <strong>Facture détaillée</strong> mentionnant les caractéristiques techniques</li>
              <li>✅ <strong>Attestation sur l'honneur</strong> (fournie par l'installateur)</li>
              <li>✅ <strong>Justificatifs revenus</strong> (avis d'imposition N-1)</li>
              <li>✅ <strong>DPE</strong> (Diagnostic Performance Énergétique) si bonus</li>
            </ul>
          </div>

          <div className="how-section warning-box">
            <h4>⚠️ Refus fréquents - À éviter</h4>
            <ul>
              <li>❌ Travaux commencés avant dépôt de dossier</li>
              <li>❌ Installateur non RGE ou certification expirée</li>
              <li>❌ ETAS insuffisant (&lt;111%)</li>
              <li>❌ Absence de régulateur ou classe trop faible</li>
              <li>❌ Facture incomplète (manque ETAS, puissance, etc.)</li>
              <li>❌ Bâtiment trop récent (&lt;2 ans)</li>
            </ul>
          </div>

          <div className="how-section">
            <h4>📞 Contacts utiles</h4>
            <ul>
              <li>
                <strong>France Rénov'</strong> : 0 808 800 700 (service gratuit + prix appel)
                <br />
                <a href="https://france-renov.gouv.fr" target="_blank" rel="noopener noreferrer">
                  france-renov.gouv.fr
                </a>
              </li>
              <li>
                <strong>ANAH</strong> (MaPrimeRénov') :
                <a href="https://www.anah.fr" target="_blank" rel="noopener noreferrer">
                  www.anah.fr
                </a>
              </li>
              <li>
                <strong>Liste installateurs RGE</strong> :
                <a href="https://france-renov.gouv.fr/annuaire-rge" target="_blank" rel="noopener noreferrer">
                  Annuaire RGE
                </a>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// Composant pour les copropriétés (simplifié)
const HowItWorksCopro = () => {
  return (
    <div className="how-it-works">
      <h2 className="how-title">💡 Comment sont calculées les aides copropriété ?</h2>
      <div className="how-content">
        <div className="how-section">
          <h3>🏢 MaPrimeRénov' Copropriété - Règles spécifiques</h3>
          <p>
            Les aides pour les copropriétés suivent des règles différentes des logements individuels.
            Voir la documentation complète dans <code>COPRO_SUBSIDY.md</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
