import React from 'react';
import { useDownload } from '../../hooks/useDownload';
import DownloadProgress from './DownloadProgress';
import UploadQueue from './UploadQueue';
import { clearAllUploads } from '../../utils/indexedDBCache';

/**
 * Composant wrapper pour tous les indicateurs mobiles
 * À ajouter une seule fois dans App.js
 */
export const MobileIndicators = () => {
    const { downloads, cancelDownload } = useDownload();

    return (
        <>
            <DownloadProgress downloads={downloads} onCancel={cancelDownload} />
            <UploadQueue onClearCache={clearAllUploads} />
        </>
    );
};

export default MobileIndicators;
