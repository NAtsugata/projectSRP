import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { runMobileDiagnostics, generateDiagnosticReport, testFileUpload } from '../utils/mobileDiagnostics';
import {
    isNotificationSupported,
    isNotificationEnabled,
    requestNotificationPermission,
    testNotification
} from '../services/pushNotificationService';
import MobileDiagnosticsPage from './MobileDiagnosticsPage';

const MobileDiagnosticsPageContainer = () => {
    const navigate = useNavigate();
    const [diagnostics, setDiagnostics] = useState(null);
    const [report, setReport] = useState('');
    const [testResults, setTestResults] = useState(null);
    const [testing, setTesting] = useState(false);
    const [notificationStatus, setNotificationStatus] = useState({
        supported: false,
        permission: 'default',
        enabled: false
    });

    useEffect(() => {
        const diag = runMobileDiagnostics();
        setDiagnostics(diag);
        setReport(generateDiagnosticReport(diag));

        setNotificationStatus({
            supported: isNotificationSupported(),
            permission: isNotificationSupported() ? Notification.permission : 'default',
            enabled: isNotificationEnabled()
        });
    }, []);

    const handleFileTest = async (file) => {
        if (!file) return;

        setTesting(true);
        try {
            const results = await testFileUpload(file);
            setTestResults(results);
        } catch (error) {
            setTestResults({ error: error.message });
        } finally {
            setTesting(false);
        }
    };

    const handleRequestNotificationPermission = async () => {
        try {
            const granted = await requestNotificationPermission();
            setNotificationStatus({
                supported: isNotificationSupported(),
                permission: Notification.permission,
                enabled: granted
            });
            return granted;
        } catch (error) {
            throw error;
        }
    };

    const handleTestNotification = async () => {
        await testNotification();
    };

    const handleGoBack = () => navigate(-1);

    return (
        <MobileDiagnosticsPage
            diagnostics={diagnostics}
            report={report}
            testResults={testResults}
            testing={testing}
            notificationStatus={notificationStatus}
            onFileTest={handleFileTest}
            onRequestNotificationPermission={handleRequestNotificationPermission}
            onTestNotification={handleTestNotification}
            onGoBack={handleGoBack}
        />
    );
};

export default MobileDiagnosticsPageContainer;
