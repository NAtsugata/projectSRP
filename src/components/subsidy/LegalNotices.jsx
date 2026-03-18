// src/components/subsidy/LegalNotices.jsx
// Mentions légales obligatoires pour les estimations de primes

import React from 'react';
import './LegalNotices.css';

const LegalNotices = ({ calculationType = 'individual', generatedDate = new Date() }) => {
  const currentYear = new Date().getFullYear();
  const formattedDate = generatedDate.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="legal-notices">
      <div className="legal-header">
        <h3>⚖️ Mentions Légales et Avertissements</h3>
        <p className="legal-date">Document généré le {formattedDate}</p>
      </div>

      <div className="legal-content">
        <section className="legal-section">
          <h4>📋 Nature du Document</h4>
          <p>
            Le présent document constitue une <strong>estimation indicative et non contractuelle</strong> des
            aides financières potentiellement disponibles pour votre projet de rénovation énergétique.
            Cette estimation est basée sur les informations que vous avez fournies et les barèmes en vigueur
            au {formattedDate}.
          </p>
        </section>

        <section className="legal-section">
          <h4>⚠️ Avertissements Importants</h4>
          <ul>
            <li>
              <strong>Vérification obligatoire :</strong> Les montants calculés sont indicatifs et doivent
              être confirmés par les organismes officiels (ANAH, France Rénov', fournisseurs CEE) avant
              tout engagement de travaux.
            </li>
            <li>
              <strong>Conditions d'éligibilité :</strong> L'obtention effective des aides est soumise au
              respect de critères techniques, administratifs et de ressources. La conformité de votre
              situation doit être validée par les organismes compétents.
            </li>
            <li>
              <strong>Évolution des barèmes :</strong> Les montants et conditions des aides sont susceptibles
              d'évoluer. Consultez les barèmes officiels en vigueur au moment de votre demande.
            </li>
            <li>
              <strong>Montants CEE variables :</strong> Les Certificats d'Économies d'Énergie (CEE) varient
              selon les fournisseurs d'énergie et peuvent être négociés. Les montants indiqués sont des
              estimations moyennes.
            </li>
            {calculationType === 'copro' && (
              <li>
                <strong>Copropriétés :</strong> Les travaux en copropriété nécessitent un vote en assemblée
                générale et l'accompagnement par un Mon Accompagnateur Rénov' agréé est obligatoire.
              </li>
            )}
          </ul>
        </section>

        <section className="legal-section">
          <h4>✅ Obligations et Recommandations</h4>
          <ul>
            <li>
              <strong>Devis RGE obligatoire :</strong> Les travaux doivent être réalisés par des
              professionnels certifiés RGE (Reconnu Garant de l'Environnement).
            </li>
            <li>
              <strong>Dépôt de dossier avant travaux :</strong> Les demandes d'aides doivent être déposées
              AVANT le début des travaux. Aucune aide ne peut être accordée rétroactivement.
            </li>
            <li>
              <strong>Accompagnement recommandé :</strong> Pour les projets individuels, l'accompagnement
              par un Mon Accompagnateur Rénov' est vivement recommandé. Il est obligatoire pour les
              copropriétés et certains projets individuels (MPR Parcours Accompagné).
            </li>
            <li>
              <strong>Audit énergétique :</strong> Un audit énergétique peut être requis selon le type de
              travaux et d'aide demandée.
            </li>
            <li>
              <strong>Cumul des aides :</strong> Les aides CEE et MaPrimeRénov' sont cumulables dans la
              limite de l'écrêtement applicable (40% à 90% selon les profils).
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h4>🔗 Sources et Références Officielles</h4>
          <ul>
            <li>
              <strong>France Rénov' :</strong> Service public de la rénovation de l'habitat
              <br />
              <a href="https://france-renov.gouv.fr" target="_blank" rel="noopener noreferrer">
                france-renov.gouv.fr
              </a> - Tél : 0 808 800 700 (gratuit)
            </li>
            <li>
              <strong>ANAH :</strong> Agence Nationale de l'Habitat
              <br />
              <a href="https://www.anah.fr" target="_blank" rel="noopener noreferrer">
                www.anah.fr
              </a>
            </li>
            <li>
              <strong>Barèmes CEE :</strong> Ministère de la Transition Écologique
              <br />
              <a href="https://www.ecologie.gouv.fr" target="_blank" rel="noopener noreferrer">
                www.ecologie.gouv.fr
              </a>
            </li>
            <li>
              <strong>Plafonds de ressources :</strong> Mis à jour annuellement par l'ANAH
              <br />
              Consultables sur france-renov.gouv.fr
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h4>📞 Contacts et Assistance</h4>
          <ul>
            <li>
              <strong>France Rénov' :</strong> 0 808 800 700 (service gratuit + prix appel)
              <br />
              Du lundi au vendredi de 9h à 18h
            </li>
            <li>
              <strong>Espace conseil France Rénov' :</strong> Trouvez votre conseiller local sur
              france-renov.gouv.fr/espaces-conseil
            </li>
            <li>
              <strong>Mon Accompagnateur Rénov' :</strong> Liste des accompagnateurs agréés disponible
              sur france-renov.gouv.fr
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h4>⏰ Validité du Document</h4>
          <p>
            Cette estimation est valable pour les barèmes en vigueur en <strong>{currentYear}</strong>.
            Les conditions et montants des aides sont révisés périodiquement par l'État. Pour tout projet,
            vérifiez les conditions en vigueur au moment de votre demande.
          </p>
        </section>

        <section className="legal-section">
          <h4>🚫 Limitation de Responsabilité</h4>
          <p>
            Ce calculateur est fourni à titre informatif uniquement. Aucune garantie n'est donnée quant
            à l'exactitude, l'exhaustivité ou l'actualité des informations fournies. L'utilisateur est
            seul responsable de l'utilisation qu'il fait de cette estimation. En cas de divergence entre
            cette estimation et les barèmes officiels, ces derniers prévalent.
          </p>
          <p>
            Le concepteur de cet outil ne saurait être tenu responsable :
          </p>
          <ul>
            <li>Du refus d'octroi d'une aide par un organisme compétent</li>
            <li>D'une différence entre les montants estimés et les montants réellement perçus</li>
            <li>De l'évolution des barèmes ou des conditions d'éligibilité</li>
            <li>Des conséquences financières liées à l'utilisation de cette estimation</li>
          </ul>
        </section>

        <section className="legal-section legal-footer">
          <p className="legal-signature">
            <strong>Document généré par le Calculateur de Primes Énergétiques</strong>
            <br />
            Conforme aux barèmes {currentYear} - CEE et MaPrimeRénov'
            <br />
            Pour toute question, contactez France Rénov' au 0 808 800 700
          </p>
        </section>
      </div>
    </div>
  );
};

export default LegalNotices;
