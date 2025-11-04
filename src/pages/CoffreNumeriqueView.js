import React, { useState, useMemo } from 'react';
import {
  DownloadIcon,
  SearchIcon,
  FilterIcon,
  CalendarIcon,
  ExternalLinkIcon,
  FolderIcon
} from '../components/SharedUI';
import './CoffreNumeriqueView.css';

// Icônes par type de fichier
const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return '🖼️';
  } else if (ext === 'pdf') {
    return '📄';
  } else if (['doc', 'docx'].includes(ext)) {
    return '📝';
  } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return '📊';
  } else if (['zip', 'rar', '7z'].includes(ext)) {
    return '📦';
  } else {
    return '📎';
  }
};

// Catégorisation automatique basée sur le nom du fichier
const getCategoryFromName = (fileName) => {
  const nameLower = fileName.toLowerCase();

  if (nameLower.includes('fiche') && nameLower.includes('paie')) {
    return 'Fiches de paie';
  } else if (nameLower.includes('contrat') || nameLower.includes('avenant')) {
    return 'Contrats';
  } else if (nameLower.includes('attestation') || nameLower.includes('certificat')) {
    return 'Attestations';
  } else if (nameLower.includes('conge') || nameLower.includes('congé') || nameLower.includes('absence')) {
    return 'Congés & Absences';
  } else if (nameLower.includes('formation')) {
    return 'Formations';
  } else {
    return 'Autres documents';
  }
};

// Formatage de la date
const formatDate = (dateString) => {
  if (!dateString) return 'Date inconnue';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

export default function CoffreNumeriqueView({ vaultDocuments = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc'); // date-desc, date-asc, name-asc, name-desc

  // Enrichir les documents avec catégorie et métadonnées
  const enrichedDocuments = useMemo(() => {
    return vaultDocuments.map(doc => ({
      ...doc,
      category: getCategoryFromName(doc.file_name),
      icon: getFileIcon(doc.file_name),
      fileExt: doc.file_name.split('.').pop()?.toUpperCase() || 'FILE'
    }));
  }, [vaultDocuments]);

  // Liste des catégories uniques
  const categories = useMemo(() => {
    const cats = enrichedDocuments.map(d => d.category);
    return ['all', ...new Set(cats)];
  }, [enrichedDocuments]);

  // Compteur par catégorie
  const categoryCounts = useMemo(() => {
    const counts = { all: enrichedDocuments.length };
    enrichedDocuments.forEach(doc => {
      counts[doc.category] = (counts[doc.category] || 0) + 1;
    });
    return counts;
  }, [enrichedDocuments]);

  // Filtrage et tri
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = enrichedDocuments;

    // Filtrer par recherche
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.file_name.toLowerCase().includes(term) ||
        doc.category.toLowerCase().includes(term)
      );
    }

    // Filtrer par catégorie
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === selectedCategory);
    }

    // Trier
    const sorted = [...filtered];
    switch (sortBy) {
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'name-asc':
        sorted.sort((a, b) => a.file_name.localeCompare(b.file_name));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.file_name.localeCompare(a.file_name));
        break;
      default:
        break;
    }

    return sorted;
  }, [enrichedDocuments, searchTerm, selectedCategory, sortBy]);

  // Grouper par catégorie pour l'affichage
  const documentsByCategory = useMemo(() => {
    const grouped = {};
    filteredAndSortedDocuments.forEach(doc => {
      if (!grouped[doc.category]) {
        grouped[doc.category] = [];
      }
      grouped[doc.category].push(doc);
    });
    return grouped;
  }, [filteredAndSortedDocuments]);

  return (
    <div className="coffre-view">
      <div className="coffre-header">
        <div className="header-top">
          <h2 className="view-title">
            <FolderIcon className="title-icon" />
            Votre Coffre-fort numérique
          </h2>
          <p className="header-subtitle">
            Tous vos documents personnels au même endroit
          </p>
        </div>

        {/* Statistiques rapides */}
        <div className="coffre-stats">
          <div className="stat-card">
            <span className="stat-number">{vaultDocuments.length}</span>
            <span className="stat-label">Documents</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{categories.length - 1}</span>
            <span className="stat-label">Catégories</span>
          </div>
        </div>
      </div>

      {vaultDocuments.length === 0 ? (
        <div className="empty-vault">
          <div className="empty-icon">📂</div>
          <h3>Votre coffre-fort est vide</h3>
          <p>Les documents envoyés par votre administrateur apparaîtront ici.</p>
        </div>
      ) : (
        <>
          {/* Barre de recherche et filtres */}
          <div className="coffre-controls">
            <div className="search-box">
              <SearchIcon className="search-icon" />
              <input
                type="text"
                placeholder="Rechercher un document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filters">
              <div className="filter-group">
                <FilterIcon className="filter-icon" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">Toutes les catégories ({categoryCounts.all})</option>
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({categoryCounts[cat] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">Trier par:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="filter-select"
                >
                  <option value="date-desc">Plus récent d'abord</option>
                  <option value="date-asc">Plus ancien d'abord</option>
                  <option value="name-asc">Nom (A → Z)</option>
                  <option value="name-desc">Nom (Z → A)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Résultats */}
          {filteredAndSortedDocuments.length === 0 ? (
            <div className="no-results">
              <SearchIcon className="no-results-icon" />
              <p>Aucun document ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="documents-container">
              {Object.entries(documentsByCategory).map(([category, docs]) => (
                <div key={category} className="category-section">
                  <h3 className="category-title">
                    <FolderIcon className="category-icon" />
                    {category}
                    <span className="category-count">({docs.length})</span>
                  </h3>

                  <div className="documents-grid">
                    {docs.map(doc => (
                      <div key={doc.id} className="document-card">
                        <div className="document-preview">
                          <span className="file-icon">{doc.icon}</span>
                          <span className="file-ext">{doc.fileExt}</span>
                        </div>

                        <div className="document-content">
                          <h4 className="document-title" title={doc.file_name}>
                            {doc.file_name}
                          </h4>

                          <div className="document-meta">
                            <span className="meta-item">
                              <CalendarIcon className="meta-icon" />
                              {formatDate(doc.created_at)}
                            </span>
                          </div>
                        </div>

                        <div className="document-actions">
                          <a
                            href={doc.file_url}
                            download
                            className="btn-action btn-download"
                            title="Télécharger"
                          >
                            <DownloadIcon />
                            <span>Télécharger</span>
                          </a>
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-action btn-view"
                            title="Voir"
                          >
                            <ExternalLinkIcon />
                            <span>Ouvrir</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
