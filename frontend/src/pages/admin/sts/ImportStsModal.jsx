import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle, Download, Eye } from 'lucide-react';
import { stsService } from '../../../services/stsService';
import Button from '../../../components/Button';

// Minimal columns a row must have to be importable at all.
const REQUIRED_HEADERS = [
  'CompanyName',
  'PhoneNumber',
  'CityDistrict'
];

// Every column the importer understands — required + optional. Shown in full in the
// downloadable template so users can fill in as much detail as they have.
const ALL_HEADERS = [
  'CompanyName',
  'ContactPerson',
  'Designation',
  'CompanyAddress',
  'Address1',
  'Address2',
  'PhoneNumber',
  'Mobile1',
  'Mobile2',
  'Fax',
  'Website',
  'Email',
  'OwnerName',
  'Pincode',
  'State',
  'CityDistrict',
  'Country',
  'LeadBy',
  'Priority',
  'Source',
  'BusinessDescription',
  'OpeningComments',
];

const EXAMPLE_ROWS = [
  {
    CompanyName: 'Acme Corp', ContactPerson: 'Jane Doe', Designation: 'Purchase Manager',
    CompanyAddress: '123 Business Rd', Address1: '123 Business Rd', Address2: 'Near City Mall',
    PhoneNumber: '022-5550100', Mobile1: '9555000100', Mobile2: '', Fax: '',
    Website: 'www.acmecorp.com', Email: 'contact@acmecorp.com', OwnerName: 'Jane Doe',
    Pincode: '400001', State: 'Maharashtra', CityDistrict: 'Mumbai', Country: 'India',
    LeadBy: 'Referral', Priority: 'Highest', Source: 'Yellow Page',
    BusinessDescription: 'Industrial equipment supplier', OpeningComments: 'Interested in bulk order',
  },
  {
    CompanyName: 'Bright Traders', ContactPerson: 'Ramesh Kumar', Designation: 'Owner',
    CompanyAddress: '45 Market Street', Address1: '45 Market Street', Address2: '',
    PhoneNumber: '0551-2223344', Mobile1: '9450046460', Mobile2: '9450046461', Fax: '',
    Website: '', Email: 'ramesh@brighttraders.in', OwnerName: 'Ramesh Kumar',
    Pincode: '273004', State: 'Uttar Pradesh', CityDistrict: 'Gorakhpur', Country: 'India',
    LeadBy: 'Field Visit', Priority: 'High', Source: 'Visiting Card',
    BusinessDescription: 'Retail hardware store', OpeningComments: 'Requested a call back next week',
  },
];

const downloadExampleCsv = () => {
  const csv = Papa.unparse({ fields: ALL_HEADERS, data: EXAMPLE_ROWS.map((r) => ALL_HEADERS.map((h) => r[h] ?? '')) });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sts-import-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Columns shown in the on-screen review table — a readable subset, not every field.
const PREVIEW_COLUMNS = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'mobile1', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'cityDistrict', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'source', label: 'Source' },
  { key: 'priority', label: 'Priority' },
];

const PREVIEW_ROW_LIMIT = 50;

const ImportStsModal = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload a valid CSV file');
        return;
      }
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          setErrors([`Missing required columns: ${missingHeaders.join(', ')}`]);
          setPreviewData(null);
        } else if (results.data.length === 0) {
          setErrors(['The CSV file is empty.']);
          setPreviewData(null);
        } else {
          setErrors([]);
          // Map every recognized column to camelCase for the API; unrecognized/missing
          // optional columns simply come through as empty strings.
          const mappedData = results.data.map(row => ({
            companyName: row['CompanyName'] || '',
            contactPerson: row['ContactPerson'] || '',
            designation: row['Designation'] || '',
            companyAddress: row['CompanyAddress'] || '',
            address1: row['Address1'] || row['CompanyAddress'] || '',
            address2: row['Address2'] || '',
            phoneNumber: row['PhoneNumber'] || '',
            mobile1: row['Mobile1'] || row['PhoneNumber'] || '',
            mobile2: row['Mobile2'] || '',
            fax: row['Fax'] || '',
            website: row['Website'] || '',
            email: row['Email'] || '',
            ownerName: row['OwnerName'] || '',
            pincode: row['Pincode'] || '',
            state: row['State'] || '',
            cityDistrict: row['CityDistrict'] || '',
            country: row['Country'] || 'India',
            leadBy: row['LeadBy'] || '',
            priority: row['Priority'] || 'Highest',
            source: row['Source'] || 'Yellow Page',
            businessDescription: row['BusinessDescription'] || '',
            openingComments: row['OpeningComments'] || '',
            // Legacy fallbacks
            title: row['CompanyName'] || '',
            description: row['CompanyAddress'] || '',
            amount: 0,
          }));
          setPreviewData(mappedData);
        }
      },
      error: (error) => {
        setErrors([`Failed to parse CSV: ${error.message}`]);
      }
    });
  };

  const handleImport = async () => {
    if (!previewData || previewData.length === 0) return;

    setIsUploading(true);
    try {
      await stsService.importSalesData(previewData);
      toast.success(`Successfully imported ${previewData.length} records!`);
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import records');
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewData(null);
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div className="space-y-6">
          {/* Format Guide */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Excel / CSV Format
              </h4>
              <Button type="button" variant="secondary" onClick={downloadExampleCsv} className="shrink-0">
                <Download className="w-4 h-4 mr-2" />
                Download Example CSV
              </Button>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Download the example file below for the full set of supported columns and sample data. Only <strong>{REQUIRED_HEADERS.join(', ')}</strong> are required — every other column is optional and can be left blank. Fill in your data below the header row, save/export as <strong>.csv (Comma delimited)</strong>, then upload it here.
            </p>
            <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    {ALL_HEADERS.map(h => (
                      <th key={h} className="px-3 py-2 border-r border-gray-200 dark:border-slate-700 whitespace-nowrap">
                        {h}{REQUIRED_HEADERS.includes(h) && <span className="text-red-500">*</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-gray-500 dark:text-slate-400">
                  {EXAMPLE_ROWS.map((row, i) => (
                    <tr key={i} className={i > 0 ? 'border-t border-gray-100 dark:border-slate-800' : ''}>
                      {ALL_HEADERS.map((h) => (
                        <td key={h} className="px-3 py-2 border-r border-gray-200 dark:border-slate-700 whitespace-nowrap">{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Click to upload CSV</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">Maximum file size 5MB</p>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3 overflow-hidden">
              <FileSpreadsheet className="w-8 h-8 text-green-500 flex-shrink-0" />
              <div className="truncate">
                <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            {!isUploading && (
              <button onClick={clearFile} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {errors.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1">Invalid Format</h4>
                <ul className="list-disc pl-4 text-sm space-y-1">
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            </div>
          )}

          {previewData && (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl border border-green-100 dark:border-green-800 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <p className="font-medium">File parsed successfully! Review the data below, nothing has been added yet.</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4" /> Preview — {previewData.length} record{previewData.length !== 1 ? 's' : ''} parsed
                </h4>
                <div className="overflow-auto max-h-72 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold border-b border-gray-200 dark:border-slate-700 sticky top-0">
                      <tr>
                        {PREVIEW_COLUMNS.map(c => (
                          <th key={c.key} className="px-3 py-2 border-r border-gray-200 dark:border-slate-700 whitespace-nowrap">{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-gray-600 dark:text-slate-300 divide-y divide-gray-100 dark:divide-slate-800">
                      {previewData.slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                          {PREVIEW_COLUMNS.map((c) => (
                            <td key={c.key} className="px-3 py-2 border-r border-gray-200 dark:border-slate-700 whitespace-nowrap max-w-[180px] truncate" title={row[c.key]}>
                              {row[c.key] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.length > PREVIEW_ROW_LIMIT && (
                  <p className="text-xs text-gray-400 mt-1.5">Showing first {PREVIEW_ROW_LIMIT} of {previewData.length} records.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700 mt-6">
            <Button variant="secondary" onClick={onClose} disabled={isUploading}>Cancel</Button>
            <Button
              onClick={handleImport}
              isLoading={isUploading}
              disabled={errors.length > 0 || !previewData}
            >
              Add {previewData?.length || 0} Record{previewData?.length !== 1 ? 's' : ''} to STS List
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportStsModal;
