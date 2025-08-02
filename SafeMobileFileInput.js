// SafeMobileFileInput.js
import React, { useRef } from 'react';

export default function SafeMobileFileInput({ onFilesSelected, accept = '*/*', multiple = false }) {
  const inputRef = useRef();

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    inputRef.current?.click();
  };

  const handleChange = (e) => {
    if (e.target.files?.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      onFilesSelected(selectedFiles);
    }
    // Important : reset la valeur sinon pas de changement détecté si on reprend le même fichier
    e.target.value = '';
  };

  return (
    <div>
      <button type="button" onClick={handleClick} className="btn btn-primary">
        📎 Ajouter un fichier
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
