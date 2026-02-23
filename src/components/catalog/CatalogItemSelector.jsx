// =============================
// FILE: src/components/catalog/CatalogItemSelector.jsx
// Dropdown component to select catalog items when creating quotes/invoices
// =============================
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useCatalogSearch, useCatalogItems } from '../../hooks/useCatalog';
import './CatalogItemSelector.css';

const formatAmount = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount || 0);
};

function CatalogItemSelector({ onSelect, itemType = null, placeholder = 'Rechercher dans le catalogue...' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showFavorites, setShowFavorites] = useState(true);
  const wrapperRef = useRef(null);

  // Recherche dans le catalogue
  const { data: searchResults = [], isLoading: isSearching } = useCatalogSearch(searchTerm, itemType);

  // Favoris (affiches par defaut)
  const { items: favoriteItems = [] } = useCatalogItems({
    itemType,
    activeOnly: true,
    limit: 10
  });

  // Favoris filtres
  const favorites = favoriteItems.filter(i => i.is_favorite);

  // Fermer le dropdown au clic externe
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Selectionner un article
  const handleSelect = useCallback((item) => {
    onSelect?.({
      description: item.name + (item.description ? ` - ${item.description}` : ''),
      quantity: 1,
      unit: item.unit || 'unite',
      unit_price: item.unit_price || 0,
      tax_rate: item.tax_rate ?? 20,
      discount_percent: 0,
      catalog_item_id: item.id
    });
    setSearchTerm('');
    setIsOpen(false);
  }, [onSelect]);

  // Articles a afficher
  const displayItems = searchTerm.length >= 2 ? searchResults : (showFavorites ? favorites : []);

  return (
    <div className="catalog-item-selector" ref={wrapperRef}>
      <div className="selector-input-wrapper">
        <input
          type="text"
          className="selector-input"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
        {isSearching && <span className="selector-spinner" />}
      </div>

      {isOpen && (
        <div className="selector-dropdown">
          {/* Tabs favoris / recherche */}
          {searchTerm.length < 2 && (
            <div className="selector-tabs">
              <button
                className={`selector-tab ${showFavorites ? 'active' : ''}`}
                onClick={() => setShowFavorites(true)}
              >
                Favoris
              </button>
              <button
                className={`selector-tab ${!showFavorites ? 'active' : ''}`}
                onClick={() => setShowFavorites(false)}
              >
                Tapez pour chercher...
              </button>
            </div>
          )}

          {/* Resultats */}
          {displayItems.length > 0 ? (
            <div className="selector-results">
              {displayItems.map(item => (
                <div
                  key={item.id}
                  className="selector-item"
                  onClick={() => handleSelect(item)}
                >
                  <div className="selector-item-info">
                    <span className={`selector-type-badge ${item.item_type}`}>
                      {item.item_type === 'product' ? 'F' : 'S'}
                    </span>
                    <div className="selector-item-details">
                      <span className="selector-item-name">
                        {item.is_favorite && '\u2605 '}{item.name}
                      </span>
                      {item.reference && (
                        <span className="selector-item-ref">{item.reference}</span>
                      )}
                    </div>
                  </div>
                  <div className="selector-item-price">
                    <span className="price">{formatAmount(item.unit_price)}</span>
                    <span className="unit">/ {item.unit}</span>
                    <span className="tva">{item.tax_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="selector-empty">
              {searchTerm.length >= 2
                ? (isSearching ? 'Recherche...' : 'Aucun resultat')
                : (showFavorites && favorites.length === 0 ? 'Aucun favori' : 'Tapez au moins 2 caracteres')
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CatalogItemSelector;
