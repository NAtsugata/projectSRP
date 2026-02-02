// src/pages/AdminMonthlyExportViewContainer.jsx
import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMonthlyExportData } from '../services/monthlyExportService';
import AdminMonthlyExportView from './AdminMonthlyExportView';

const AdminMonthlyExportViewContainer = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: employeeData = [], isLoading, error } = useQuery({
    queryKey: ['monthlyExport', year, month],
    queryFn: async () => {
      const result = await getMonthlyExportData(year, month);
      if (result.error) throw result.error;
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleChangeMonth = useCallback((newYear, newMonth) => {
    setYear(newYear);
    setMonth(newMonth);
  }, []);

  return (
    <AdminMonthlyExportView
      employeeData={employeeData}
      isLoading={isLoading}
      error={error}
      year={year}
      month={month}
      onChangeMonth={handleChangeMonth}
    />
  );
};

export default AdminMonthlyExportViewContainer;
