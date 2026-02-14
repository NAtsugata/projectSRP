// src/pages/LegalPages.jsx
// Pages légales obligatoires pour la commercialisation (RGPD, CGU, Mentions légales)

import React from 'react';
import { useNavigate } from 'react-router-dom';

const pageStyle = {
  maxWidth: '800px',
  margin: '0 auto',
  padding: '2rem 1.5rem',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#1f2937',
  lineHeight: '1.7',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginBottom: '2rem',
  paddingBottom: '1rem',
  borderBottom: '2px solid #e5e7eb',
};

const backBtnStyle = {
  padding: '0.5rem 1rem',
  backgroundColor: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const sectionStyle = {
  marginBottom: '2rem',
};

const h2Style = {
  fontSize: '1.25rem',
  fontWeight: '600',
  marginBottom: '0.75rem',
  color: '#111827',
};

/**
 * Politique de confidentialité (RGPD)
 */
export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <button style={backBtnStyle} onClick={() => navigate(-1)}>Retour</button>
        <h1>Politique de confidentialit&eacute;</h1>
      </div>

      <p><strong>Derni&egrave;re mise &agrave; jour :</strong> {new Date().toLocaleDateString('fr-FR')}</p>

      <div style={sectionStyle}>
        <h2 style={h2Style}>1. Responsable du traitement</h2>
        <p>
          Le responsable du traitement des donn&eacute;es personnelles collect&eacute;es via cette application
          est la soci&eacute;t&eacute; op&eacute;ratrice de la plateforme. Pour toute question relative &agrave; la
          protection de vos donn&eacute;es, vous pouvez nous contacter via les coordonn&eacute;es
          indiqu&eacute;es dans les mentions l&eacute;gales.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>2. Donn&eacute;es collect&eacute;es</h2>
        <p>Nous collectons les donn&eacute;es suivantes dans le cadre de l&apos;utilisation de l&apos;application :</p>
        <ul>
          <li><strong>Donn&eacute;es d&apos;identification :</strong> nom, pr&eacute;nom, adresse email professionnelle</li>
          <li><strong>Donn&eacute;es professionnelles :</strong> identifiant employ&eacute;, r&ocirc;le, interventions assign&eacute;es</li>
          <li><strong>Donn&eacute;es de g&eacute;olocalisation :</strong> position lors des pointages (si autoris&eacute;e)</li>
          <li><strong>Photos et documents :</strong> photos d&apos;intervention, documents scann&eacute;s, signatures</li>
          <li><strong>Donn&eacute;es de connexion :</strong> logs d&apos;acc&egrave;s, adresse IP, type de navigateur</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>3. Finalit&eacute;s du traitement</h2>
        <p>Vos donn&eacute;es sont trait&eacute;es pour les finalit&eacute;s suivantes :</p>
        <ul>
          <li>Gestion des interventions et du planning</li>
          <li>Suivi des heures de travail et des d&eacute;placements</li>
          <li>G&eacute;n&eacute;ration de rapports et formulaires CERFA</li>
          <li>Gestion des cong&eacute;s et absences</li>
          <li>Gestion des notes de frais</li>
          <li>Communication interne (notifications)</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>4. Base l&eacute;gale</h2>
        <p>
          Le traitement de vos donn&eacute;es est fond&eacute; sur l&apos;ex&eacute;cution du contrat de travail
          (article 6.1.b du RGPD) et l&apos;int&eacute;r&ecirc;t l&eacute;gitime de l&apos;employeur
          (article 6.1.f du RGPD) pour la gestion op&eacute;rationnelle de l&apos;activit&eacute;.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>5. Dur&eacute;e de conservation</h2>
        <ul>
          <li><strong>Donn&eacute;es d&apos;intervention :</strong> 5 ans apr&egrave;s la fin de l&apos;intervention</li>
          <li><strong>Documents comptables :</strong> 10 ans (obligation l&eacute;gale)</li>
          <li><strong>Donn&eacute;es de connexion :</strong> 12 mois</li>
          <li><strong>Donn&eacute;es de profil :</strong> dur&eacute;e du contrat + 3 ans</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>6. Vos droits</h2>
        <p>Conform&eacute;ment au RGPD, vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d&apos;acc&egrave;s :</strong> obtenir une copie de vos donn&eacute;es personnelles</li>
          <li><strong>Droit de rectification :</strong> corriger vos donn&eacute;es inexactes</li>
          <li><strong>Droit &agrave; l&apos;effacement :</strong> demander la suppression de vos donn&eacute;es</li>
          <li><strong>Droit &agrave; la portabilit&eacute; :</strong> recevoir vos donn&eacute;es dans un format structur&eacute;</li>
          <li><strong>Droit d&apos;opposition :</strong> vous opposer au traitement de vos donn&eacute;es</li>
          <li><strong>Droit &agrave; la limitation :</strong> limiter le traitement de vos donn&eacute;es</li>
        </ul>
        <p>
          Pour exercer vos droits, contactez-nous par email aux coordonn&eacute;es indiqu&eacute;es
          dans les mentions l&eacute;gales. Nous r&eacute;pondrons dans un d&eacute;lai de 30 jours.
        </p>
        <p>
          Vous pouvez &eacute;galement introduire une r&eacute;clamation aupr&egrave;s de la CNIL
          (Commission Nationale de l&apos;Informatique et des Libert&eacute;s) : <em>www.cnil.fr</em>.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>7. S&eacute;curit&eacute; des donn&eacute;es</h2>
        <p>
          Nous mettons en oeuvre les mesures techniques et organisationnelles appropri&eacute;es
          pour prot&eacute;ger vos donn&eacute;es : chiffrement en transit (HTTPS/TLS),
          contr&ocirc;le d&apos;acc&egrave;s par r&ocirc;le (RLS), authentification s&eacute;curis&eacute;e,
          et stockage s&eacute;curis&eacute; des fichiers.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>8. Sous-traitants</h2>
        <p>
          Nous utilisons Supabase (h&eacute;bergement des donn&eacute;es et authentification) comme
          sous-traitant. Les donn&eacute;es sont h&eacute;berg&eacute;es dans l&apos;Union Europ&eacute;enne.
        </p>
      </div>
    </div>
  );
}

/**
 * Mentions l&eacute;gales
 */
export function LegalNoticePage() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <button style={backBtnStyle} onClick={() => navigate(-1)}>Retour</button>
        <h1>Mentions l&eacute;gales</h1>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>1. &Eacute;diteur de l&apos;application</h2>
        <p>
          <strong>Raison sociale :</strong> [&Agrave; compl&eacute;ter]<br />
          <strong>Forme juridique :</strong> [&Agrave; compl&eacute;ter]<br />
          <strong>Si&egrave;ge social :</strong> [&Agrave; compl&eacute;ter]<br />
          <strong>SIRET :</strong> [&Agrave; compl&eacute;ter]<br />
          <strong>RCS :</strong> [&Agrave; compl&eacute;ter]<br />
          <strong>Directeur de la publication :</strong> [&Agrave; compl&eacute;ter]<br />
          <strong>Email :</strong> [&Agrave; compl&eacute;ter]<br />
          <strong>T&eacute;l&eacute;phone :</strong> [&Agrave; compl&eacute;ter]
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>2. H&eacute;bergement</h2>
        <p>
          L&apos;application est h&eacute;berg&eacute;e par :<br />
          <strong>Supabase Inc.</strong><br />
          970 Toa Payoh North, #07-04<br />
          Singapore 318992<br />
          <em>Les donn&eacute;es sont h&eacute;berg&eacute;es dans l&apos;Union Europ&eacute;enne.</em>
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>3. Propri&eacute;t&eacute; intellectuelle</h2>
        <p>
          L&apos;ensemble du contenu de cette application (textes, images, logos, code source)
          est prot&eacute;g&eacute; par le droit d&apos;auteur. Toute reproduction, m&ecirc;me partielle,
          est interdite sans autorisation pr&eacute;alable &eacute;crite.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>4. Protection des donn&eacute;es personnelles</h2>
        <p>
          Consultez notre <a href="/privacy-policy">Politique de confidentialit&eacute;</a> pour
          conna&icirc;tre nos engagements en mati&egrave;re de protection des donn&eacute;es personnelles
          conform&eacute;ment au R&egrave;glement G&eacute;n&eacute;ral sur la Protection des Donn&eacute;es (RGPD).
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>5. Cookies</h2>
        <p>
          Cette application utilise des cookies techniques strictement n&eacute;cessaires &agrave; son
          fonctionnement (session d&apos;authentification). Aucun cookie publicitaire ou de
          tracking n&apos;est utilis&eacute;.
        </p>
      </div>
    </div>
  );
}

/**
 * Conditions g&eacute;n&eacute;rales d&apos;utilisation
 */
export function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <button style={backBtnStyle} onClick={() => navigate(-1)}>Retour</button>
        <h1>Conditions g&eacute;n&eacute;rales d&apos;utilisation</h1>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>1. Objet</h2>
        <p>
          Les pr&eacute;sentes conditions g&eacute;n&eacute;rales d&apos;utilisation (CGU) r&eacute;gissent
          l&apos;acc&egrave;s et l&apos;utilisation de l&apos;application de gestion d&apos;interventions.
          En acc&eacute;dant &agrave; l&apos;application, l&apos;utilisateur accepte les pr&eacute;sentes CGU
          sans r&eacute;serve.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>2. Acc&egrave;s &agrave; l&apos;application</h2>
        <p>
          L&apos;acc&egrave;s &agrave; l&apos;application est r&eacute;serv&eacute; aux utilisateurs disposant
          d&apos;un compte cr&eacute;&eacute; par un administrateur. Chaque utilisateur est responsable
          de la confidentialit&eacute; de ses identifiants de connexion.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>3. Utilisation de l&apos;application</h2>
        <p>L&apos;utilisateur s&apos;engage &agrave; :</p>
        <ul>
          <li>Utiliser l&apos;application conform&eacute;ment &agrave; sa destination professionnelle</li>
          <li>Ne pas tenter d&apos;acc&eacute;der aux donn&eacute;es d&apos;autres utilisateurs</li>
          <li>Ne pas modifier, copier ou distribuer le contenu de l&apos;application</li>
          <li>Signaler toute faille de s&eacute;curit&eacute; d&eacute;couverte</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>4. Responsabilit&eacute;s</h2>
        <p>
          L&apos;&eacute;diteur met tout en oeuvre pour assurer la disponibilit&eacute; et la
          s&eacute;curit&eacute; de l&apos;application. Toutefois, il ne peut garantir une
          disponibilit&eacute; ininterrompue et ne saurait &ecirc;tre tenu responsable des
          dommages r&eacute;sultant de l&apos;indisponibilit&eacute; temporaire du service.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>5. Modification des CGU</h2>
        <p>
          L&apos;&eacute;diteur se r&eacute;serve le droit de modifier les pr&eacute;sentes CGU &agrave; tout
          moment. Les utilisateurs seront inform&eacute;s de toute modification substantielle.
          La poursuite de l&apos;utilisation apr&egrave;s modification vaut acceptation des nouvelles CGU.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={h2Style}>6. Droit applicable</h2>
        <p>
          Les pr&eacute;sentes CGU sont r&eacute;gies par le droit fran&ccedil;ais. En cas de litige,
          les tribunaux fran&ccedil;ais seront seuls comp&eacute;tents.
        </p>
      </div>
    </div>
  );
}
