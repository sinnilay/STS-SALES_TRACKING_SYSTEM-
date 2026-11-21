import React, { useState } from 'react';
import { Search, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { stsService } from '../../../services/stsService';
import Table from '../../../components/Table';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import EditStsForm from './EditStsForm';

const StsSearch = () => {
  const [searchBy, setSearchBy] = useState('Email'); // Email, Name, Mobile
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [loadingEditId, setLoadingEditId] = useState(null);

  const openEdit = async (row) => {
    setLoadingEditId(row.id);
    try {
      const full = await stsService.getSalesDataById(row.id);
      setEditRecord(full);
    } catch (error) {
      toast.error('Failed to load record details');
    } finally {
      setLoadingEditId(null);
    }
  };

  const rerunSearch = async () => {
    try {
      const data = await stsService.searchSalesData(searchBy, query);
      setResults(data);
    } catch (_) { /* keep existing results */ }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsLoading(true);
    try {
      const data = await stsService.searchSalesData(searchBy, query);
      setResults(data);
      setHasSearched(true);
      if (data.length === 0) {
        toast.success('No records found matching your query');
      }
    } catch (error) {
      toast.error('Failed to perform search');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { 
      header: 'Sr No.', 
      render: (row, index) => index + 1 
    },
    { header: 'Profile ID', accessor: 'companyID' },
    { 
      header: 'Company Name', 
      render: (row) => (
        <a href="#" className="text-blue-600 hover:underline">{row.companyName}</a>
      )
    },
    { header: 'Source', render: (row) => row.source || 'N/A' },
    { 
      header: 'Created Date', 
      render: (row) => new Date(row.createdAt).toLocaleDateString()
    },
    { 
      header: 'Last Action', 
      render: (row) => row.lastActionDate ? new Date(row.lastActionDate).toLocaleDateString() : 'N/A'
    },
    { 
      header: 'Status', 
      render: (row) => (
        <span className="text-blue-600 font-medium">
          {row.status || 'New'}
        </span>
      )
    },
    {
      header: 'Allotted To',
      render: (row) => {
        const isAllocatedToTelecaller = row.allocatedTo?.employeeRole === 'Tele Sales';
        const salesTeamName = row.allocatedTo && !isAllocatedToTelecaller ? row.allocatedTo.fullName : 'N/A';
        const telecallerTeamName = isAllocatedToTelecaller
          ? row.allocatedTo.fullName
          : (row.teleExecutive ? row.teleExecutive.fullName : 'N/A');
        return (
          <div className="text-xs space-y-1">
            <div><span className="font-semibold text-gray-500">Sales Team:</span> {salesTeamName}</div>
            <div><span className="font-semibold text-gray-500">Telecaller Team:</span> {telecallerTeamName}</div>
          </div>
        );
      }
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Search Header Form */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="bg-blue-500 px-6 py-3 border-b border-blue-600">
          <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4" /> STS SEARCH
          </h2>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-6 justify-center">
            <div className="flex items-center gap-4 text-sm font-medium text-gray-700 dark:text-slate-300">
              <span className="mr-2">Search By</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="searchBy" 
                  value="Email"
                  checked={searchBy === 'Email'}
                  onChange={(e) => setSearchBy(e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                Email Id
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="searchBy" 
                  value="Name"
                  checked={searchBy === 'Name'}
                  onChange={(e) => setSearchBy(e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                STS Name
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="searchBy" 
                  value="Mobile"
                  checked={searchBy === 'Mobile'}
                  onChange={(e) => setSearchBy(e.target.value)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                Mobile No.
              </label>
            </div>
            
            <div className="w-full max-w-md">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Enter ${searchBy === 'Name' ? 'STS Name' : searchBy === 'Email' ? 'Email ID' : 'Mobile Number'}...`}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-sm"
              />
            </div>
            
            <Button type="submit" isLoading={isLoading} className="px-4 sm:px-8 py-2">
              Search
            </Button>
          </form>
        </div>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors duration-300">
          <div className="bg-gray-50 dark:bg-slate-900/50 px-6 py-3 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Search Results</h3>
            <span className="text-xs text-gray-500">{results.length} record(s) found</span>
          </div>
          <Table
            columns={columns}
            data={results}
            renderActions={(row) => (
              <button
                onClick={() => openEdit(row)}
                disabled={loadingEditId === row.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors disabled:opacity-50"
              >
                <Pencil className="w-3.5 h-3.5" /> {loadingEditId === row.id ? 'Loading…' : 'Edit'}
              </button>
            )}
          />
        </div>
      )}

      <Modal
        isOpen={!!editRecord}
        onClose={() => setEditRecord(null)}
        title={`Edit — ${editRecord?.companyName || ''}`}
        maxWidthClass="max-w-3xl"
      >
        {editRecord && (
          <EditStsForm
            record={editRecord}
            onClose={() => setEditRecord(null)}
            onSuccess={() => {
              setEditRecord(null);
              rerunSearch();
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default StsSearch;
