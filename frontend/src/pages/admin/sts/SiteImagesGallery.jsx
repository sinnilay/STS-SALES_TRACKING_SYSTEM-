import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Images, Search, RefreshCw, MapPin, Camera, User } from 'lucide-react';
import { stsService } from '../../../services/stsService';
import Spinner from '../../../components/Spinner';
import Modal from '../../../components/Modal';
import SiteImagesModal from '../../sales/SiteImagesModal';
import { getStatusMeta } from '../../../constants/stsPipeline';

const SiteImagesGallery = () => {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);

  const fetchImages = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true); else setIsRefreshing(true);
    try {
      const data = await stsService.getAllSiteImages();
      setImages(data);
    } catch (error) {
      toast.error('Failed to load site images');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchImages(); }, []);

  const groups = useMemo(() => {
    const map = new Map();
    images.forEach((img) => {
      if (!map.has(img.salesDataId)) {
        map.set(img.salesDataId, {
          salesDataId: img.salesDataId,
          companyName: img.companyName,
          companyID: img.companyID,
          cityDistrict: img.cityDistrict,
          status: img.status,
          images: [],
          uploaders: new Set(),
          latestCapturedAt: img.capturedAt,
        });
      }
      const group = map.get(img.salesDataId);
      group.images.push(img);
      if (img.uploadedBy?.fullName) group.uploaders.add(img.uploadedBy.fullName);
      if (new Date(img.capturedAt) > new Date(group.latestCapturedAt)) group.latestCapturedAt = img.capturedAt;
    });

    return Array.from(map.values())
      .filter((g) => searchTerm
        ? (g.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || g.companyID?.toLowerCase().includes(searchTerm.toLowerCase()))
        : true)
      .sort((a, b) => new Date(b.latestCapturedAt) - new Date(a.latestCapturedAt));
  }, [images, searchTerm]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 border border-gray-100 dark:border-slate-700 shadow-sm transition-colors duration-300">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              Site Visit Gallery
              <Images className="w-7 h-7 text-primary-500" />
            </h2>
            <p className="mt-2 text-base text-gray-500 dark:text-slate-400 max-w-2xl">
              Every site-visit photo your Field Sales team has uploaded, grouped by lead — with proof of whether it
              was captured live on camera or uploaded from a device.
            </p>
          </div>
          <button
            onClick={() => fetchImages(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-300">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 text-sm transition-colors duration-300"
            placeholder="Search by company name or STS ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-12"><Spinner /></div>
      ) : groups.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-12 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors duration-300">
          <div className="w-16 h-16 bg-gray-50 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-600 mb-4">
            <Images className="w-8 h-8 text-gray-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No site images yet</h3>
          <p className="text-gray-500 dark:text-slate-400 mt-1 max-w-sm">
            Once a Field Sales employee uploads photos from a site visit, they'll show up here grouped by lead.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {groups.map((group) => (
            <button
              key={group.salesDataId}
              onClick={() => setSelectedGroup(group)}
              className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group"
            >
              <div className="relative h-36 bg-gray-100 dark:bg-slate-900">
                <img src={group.images[0].imageUrl} alt={group.companyName} className="w-full h-full object-cover" />
                {group.images.length > 1 && (
                  <span className="absolute bottom-2 right-2 text-[11px] font-bold px-2 py-1 rounded-full bg-black/60 text-white backdrop-blur-sm">
                    +{group.images.length - 1} more
                  </span>
                )}
                <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full ring-1 ring-inset ${getStatusMeta(group.status).badge}`}>
                  {group.status || 'New'}
                </span>
              </div>
              <div className="p-4 space-y-1.5">
                <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{group.companyName}</p>
                <p className="text-[11px] font-mono text-gray-400 dark:text-slate-500 truncate">{group.companyID}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 truncate">
                  <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{group.cityDistrict || '—'}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 truncate">
                  <User className="w-3 h-3 shrink-0" /> <span className="truncate">{Array.from(group.uploaders).join(', ') || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-50 dark:border-slate-700/50">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 dark:text-primary-400">
                    <Camera className="w-3 h-3" /> {group.images.length} photo{group.images.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500">
                    {new Date(group.latestCapturedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Images Modal (read-only for Admin) */}
      <Modal
        isOpen={!!selectedGroup}
        onClose={() => setSelectedGroup(null)}
        title="Site Images"
        maxWidthClass="max-w-lg"
      >
        {selectedGroup && (
          <SiteImagesModal
            subtitle={`${selectedGroup.companyName} (${selectedGroup.companyID})`}
            images={selectedGroup.images}
          />
        )}
      </Modal>
    </div>
  );
};

export default SiteImagesGallery;
