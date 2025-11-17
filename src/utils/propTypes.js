// src/utils/propTypes.js
// PropTypes communs réutilisables pour validation

import PropTypes from 'prop-types';

/**
 * PropTypes pour un utilisateur/profil
 */
export const userPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  full_name: PropTypes.string,
  is_admin: PropTypes.bool,
  created_at: PropTypes.string
});

/**
 * PropTypes pour une intervention
 */
export const interventionPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  client: PropTypes.string.isRequired,
  address: PropTypes.string.isRequired,
  service: PropTypes.string.isRequired,
  date: PropTypes.string.isRequired,
  time: PropTypes.string,
  status: PropTypes.string,
  employee_id: PropTypes.string,
  client_phone: PropTypes.string,
  client_email: PropTypes.string,
  ticket_number: PropTypes.string,
  scheduled_dates: PropTypes.arrayOf(PropTypes.string),
  created_at: PropTypes.string
});

/**
 * PropTypes pour une demande de congé
 */
export const leaveRequestPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  user_id: PropTypes.string.isRequired,
  start_date: PropTypes.string.isRequired,
  end_date: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  reason: PropTypes.string,
  status: PropTypes.string.isRequired,
  created_at: PropTypes.string
});

/**
 * PropTypes pour une note de frais
 */
export const expensePropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  user_id: PropTypes.string.isRequired,
  date: PropTypes.string.isRequired,
  category: PropTypes.string.isRequired,
  amount: PropTypes.number.isRequired,
  description: PropTypes.string,
  status: PropTypes.string.isRequired,
  receipts: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      url: PropTypes.string.isRequired,
      type: PropTypes.string
    })
  ),
  created_at: PropTypes.string
});

/**
 * PropTypes pour un fichier uploadé
 */
export const filePropType = PropTypes.shape({
  name: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  type: PropTypes.string,
  size: PropTypes.number
});

/**
 * PropTypes pour un rapport d'intervention
 */
export const reportPropType = PropTypes.shape({
  description: PropTypes.string,
  issues: PropTypes.string,
  photos: PropTypes.arrayOf(filePropType),
  files: PropTypes.arrayOf(filePropType),
  signature: PropTypes.string,
  notes: PropTypes.string,
  needs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      qty: PropTypes.number,
      urgent: PropTypes.bool,
      note: PropTypes.string,
      category: PropTypes.string,
      estimated_price: PropTypes.number
    })
  )
});

/**
 * PropTypes pour les callbacks courants
 */
export const callbackPropTypes = {
  // Callbacks simples
  onClick: PropTypes.func,
  onChange: PropTypes.func,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  onDelete: PropTypes.func,
  onUpdate: PropTypes.func,
  
  // Callbacks avec données
  onItemClick: PropTypes.func,
  onItemSelect: PropTypes.func,
  onItemDelete: PropTypes.func,
  onItemUpdate: PropTypes.func,
  
  // Toast et modal
  showToast: PropTypes.func,
  showConfirmationModal: PropTypes.func
};

/**
 * PropTypes pour les options de sélection
 */
export const optionPropType = PropTypes.shape({
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  disabled: PropTypes.bool
});

/**
 * PropTypes pour les filtres
 */
export const filterPropType = PropTypes.shape({
  field: PropTypes.string.isRequired,
  value: PropTypes.any,
  operator: PropTypes.oneOf(['equals', 'contains', 'startsWith', 'endsWith', 'gt', 'lt', 'gte', 'lte'])
});

/**
 * PropTypes pour la pagination
 */
export const paginationPropType = PropTypes.shape({
  page: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired
});

/**
 * PropTypes pour les composants avec children
 */
export const childrenPropTypes = {
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.func
  ])
};

/**
 * Helper pour marquer plusieurs props comme required
 * @param {Object} propTypes - PropTypes object
 * @param {Array<string>} requiredKeys - Keys to mark as required
 * @returns {Object} PropTypes with required keys
 */
export const makeRequired = (propTypes, requiredKeys) => {
  const result = { ...propTypes };
  requiredKeys.forEach(key => {
    if (result[key]) {
      result[key] = result[key].isRequired;
    }
  });
  return result;
};

export default {
  userPropType,
  interventionPropType,
  leaveRequestPropType,
  expensePropType,
  filePropType,
  reportPropType,
  callbackPropTypes,
  optionPropType,
  filterPropType,
  paginationPropType,
  childrenPropTypes,
  makeRequired
};
