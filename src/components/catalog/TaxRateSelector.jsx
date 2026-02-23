// =============================
// FILE: src/components/catalog/TaxRateSelector.jsx
// Dropdown component for selecting TVA rates
// =============================
import React from 'react';
import { useTaxRates } from '../../hooks/useCatalog';
import './TaxRateSelector.css';

// Fallback rates si les taux ne sont pas charges
const FALLBACK_RATES = [
  { id: 'f1', rate: 20, name: 'TVA 20%' },
  { id: 'f2', rate: 10, name: 'TVA 10%' },
  { id: 'f3', rate: 5.5, name: 'TVA 5.5%' },
  { id: 'f4', rate: 0, name: 'Exonere 0%' }
];

function TaxRateSelector({
  value = 20,
  onChange,
  allowCustom = true,
  size = 'md',
  className = ''
}) {
  const { taxRates = [], isLoading } = useTaxRates();

  const rates = taxRates.length > 0 ? taxRates : FALLBACK_RATES;
  const isCustomValue = !rates.some(r => r.rate === parseFloat(value));

  const handleChange = (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      // Ne pas changer, attendre la saisie manuelle
      return;
    }
    onChange?.(parseFloat(val));
  };

  return (
    <div className={`tax-rate-selector ${size} ${className}`}>
      <select
        value={isCustomValue ? 'custom' : value}
        onChange={handleChange}
        disabled={isLoading}
        className="tax-select"
      >
        {rates.map(rate => (
          <option key={rate.id} value={rate.rate}>
            {rate.name} ({rate.rate}%)
          </option>
        ))}
        {allowCustom && (
          <option value="custom">Autre...</option>
        )}
      </select>

      {isCustomValue && allowCustom && (
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange?.(parseFloat(e.target.value) || 0)}
          className="tax-custom-input"
          placeholder="Taux %"
        />
      )}
    </div>
  );
}

export default TaxRateSelector;
