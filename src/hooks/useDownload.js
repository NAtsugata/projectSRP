import { useDownload as useDownloadContext } from '../contexts/DownloadContext';

export const useDownload = () => {
    return useDownloadContext();
};
