import React, { useState } from 'react';
import { storageService, payslipService } from '../lib/supabase';
import { CustomFileInput } from '../components/SharedUI';
import { DownloadIcon, TrashIcon } from '../components/SharedUI';

export default function AdminVaultView({ users, showToast, showConfirmationModal }) {
    const [selectedUser, setSelectedUser] = useState(null);
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    
    const handleUserSelect = async (user) => {
        setSelectedUser(user);
        const { data, error } = await payslipService.getPayslips(user.id);
        if (error) {
            showToast("Erreur de chargement des fichiers.", "error");
            setFiles([]);
        } else {
            setFiles(data);
        }
    };
    
    const handleFilesChange = (e) => {
        setSelectedFiles(e.target.files);
    };
    
    const handleUpload = async () => {
        if (selectedFiles.length === 0 || !selectedUser) return;
        setUploading(true);
        for (const file of selectedFiles) {
            const { error } = await storageService.uploadVaultFile(file, selectedUser.id);
            if (error) {
                showToast('Erreur d\'upload pour ' + file.name + '.', "error");
            }
        }
        setUploading(false);
        showToast("Téléchargement terminé.", "success");
        handleUserSelect(selectedUser);
    };
    
    const handleDeleteFile = (file) => {
        showConfirmationModal({
            title: "Supprimer le fichier ?",
            message: 'Êtes-vous sûr de vouloir supprimer "' + file.name + '" ? Cette action est irréversible.',
            onConfirm: async () => {
                const { error } = await storageService.deleteVaultFile(file.path);
                if (error) {
                    showToast("Erreur lors de la suppression.", "error");
                } else {
                    showToast("Fichier supprimé.");
                    handleUserSelect(selectedUser);
                }
            }
        });
    };
    
    return (
        <div>
            <h2 className="view-title">Coffre-fort Administrateur</h2>
            <div className="grid-2-cols">
                <div className="card-white">
                    <h3>Employés</h3>
                    <ul className="document-list">
                        {users.filter(u => !u.is_admin).map(user => (
                            <li key={user.id} onClick={() => handleUserSelect(user)} style={{cursor: 'pointer', background: selectedUser?.id === user.id ? '#f1f5f9' : 'transparent'}}>
                                {user.full_name}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="card-white">
                    {selectedUser ? (
                        <>
                            <h3>Documents pour {selectedUser.full_name}</h3>
                            <ul className="document-list">
                                {files.map(file => (
                                    <li key={file.id}>
                                        <span>{file.name}</span>
                                        <div className="flex items-center gap-2">
                                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn-icon"><DownloadIcon/></a>
                                            <button onClick={() => handleDeleteFile(file)} className="btn-icon-danger"><TrashIcon/></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className="section">
                                <h4>Ajouter des documents</h4>
                                <CustomFileInput multiple onChange={handleFilesChange}>
                                    Choisir des documents
                                </CustomFileInput>
                                <button onClick={handleUpload} disabled={uploading} className="btn btn-success mt-2 w-full">
                                    {uploading ? "Envoi en cours..." : "Envoyer"}
                                </button>
                            </div>
                        </>
                    ) : <p>Sélectionnez un employé pour voir ses documents.</p>}
                </div>
            </div>
        </div>
    );
}
