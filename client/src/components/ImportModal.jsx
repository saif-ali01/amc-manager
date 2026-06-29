import { useState, useRef } from 'react';
import API from '../services/api';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function ImportModal({ isOpen, onClose, onImportDone }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    try {
      const res = await API.post('/items/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message);
      if (res.data.errors && res.data.errors.length > 0) {
        toast.error(`${res.data.errors.length} row(s) had errors`);
        console.table(res.data.errors);
      }
      if (onImportDone) onImportDone();
      onClose();
      setFile(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ─── Generate and download a sample CSV ─────────────────────
  const downloadSampleCSV = () => {
    const headers = [
      'Name',
      'Type',
      'Provider',
      'Company',
      'Location',
      'Start Date',
      'End Date',
      'Cost',
      'Notes',
      'Reminders'
    ];

    // Example row (optional – you can include one or just headers)
    const exampleRow = [
      'Example License',
      'License',
      'VendorX',
      'My Company',
      'Delhi',
      '2026-07-01',
      '2027-06-30',
      '15000',
      'Sample notes',
      '30,15,7,1'
    ];

    const csvContent = [
      headers.join(','),
      exampleRow.join(',')
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'amc-import-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const modalBg = isDark ? 'bg-zinc-900 border-white/[0.08]' : 'bg-white border-gray-200';
  const btnPrimary = `px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50`;
  const inputStyle = `w-full border rounded-lg p-2 text-sm ${
    isDark ? 'bg-white/[0.05] border-white/[0.1] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`rounded-2xl w-full max-w-md p-6 shadow-xl border ${modalBg}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Import Items</h2>
        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Upload a CSV or Excel file. The file must include headers like:
          <br/><strong>Name, Type, Provider, Company, Location, Start Date, End Date, Cost, Notes, Reminders</strong>
        </p>

        {/* File input */}
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          ref={fileInputRef}
          className={inputStyle}
        />
        {file && <p className={`text-xs mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{file.name}</p>}

        {/* Download sample CSV */}
        <div className="mt-2">
          <button
            type="button"
            onClick={downloadSampleCSV}
            className={`text-xs font-medium underline transition-colors ${
              isDark ? 'text-teal-400 hover:text-teal-300' : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            Download Sample CSV Template
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className={`px-4 py-2 rounded-lg text-sm font-medium border ${
            isDark ? 'border-white/[0.08] text-gray-300 hover:bg-white/[0.04]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>Cancel</button>
          <button onClick={handleImport} disabled={importing || !file} className={btnPrimary}>
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}