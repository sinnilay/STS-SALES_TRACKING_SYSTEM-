import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Camera, Upload, ImageOff, Loader2, X, Aperture } from 'lucide-react';

const METHOD_META = {
  'Camera Capture': { label: 'Camera Capture', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', icon: Camera },
  'Manual Upload': { label: 'Manual Upload', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: Upload },
};

// Reused by both the Field Sales side (with upload controls, via `onUpload`) and the Admin
// gallery (read-only — pass pre-loaded `images` and omit `onUpload`).
const SiteImagesModal = ({ subtitle, images: providedImages, fetchImages, onUpload, maxImages = 4 }) => {
  const [images, setImages] = useState(providedImages || []);
  const [isLoading, setIsLoading] = useState(!providedImages && !!fetchImages);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (providedImages) {
      setImages(providedImages);
      return;
    }
    if (!fetchImages) return;
    setIsLoading(true);
    fetchImages()
      .then((data) => setImages(data.images || []))
      .catch(() => toast.error('Failed to load site images'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  // Always release the camera when the popup closes/unmounts, not just on explicit cancel.
  useEffect(() => () => stopCamera(), []);

  // Attach the stream once the <video> element has actually mounted (isCameraOpen turned true) —
  // a setTimeout-based approach here is unreliable, since it can fire before React commits the DOM.
  useEffect(() => {
    if (isCameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen]);

  const uploadFile = async (file, method) => {
    setIsUploading(true);
    try {
      const result = await onUpload(file, method);
      setImages((prev) => [result.image, ...prev]);
      toast.success('Site image uploaded');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller');
      return;
    }
    await uploadFile(file, 'Manual Upload');
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('This browser cannot access a camera. Try "Upload from Device" instead.');
      return;
    }
    setIsCameraStarting(true);
    try {
      // Prefer a rear camera on phones; laptops only have the one camera, so this is ignored there.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (error) {
      toast.error('Could not access the camera — check browser permissions, or use "Upload from Device".');
    } finally {
      setIsCameraStarting(false);
    }
  };

  const closeCamera = () => {
    stopCamera();
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      closeCamera();
      const file = new File([blob], `site-visit-${Date.now()}.jpg`, { type: 'image/jpeg' });
      await uploadFile(file, 'Camera Capture');
    }, 'image/jpeg', 0.9);
  };

  const remaining = Math.max(0, maxImages - images.length);
  const canUpload = !!onUpload && remaining > 0 && !isUploading;

  return (
    <div className="space-y-4">
      {subtitle && <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">{subtitle}</p>}

      {/* Live camera overlay */}
      {isCameraOpen && (
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-black relative">
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-72 object-contain bg-black" />
          <div className="absolute inset-x-0 bottom-0 p-3 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent">
            <button
              onClick={capturePhoto}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-gray-900 text-sm font-bold shadow-lg hover:bg-gray-100 disabled:opacity-60 transition-colors"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Aperture className="w-4 h-4" />}
              Capture
            </button>
            <button
              onClick={closeCamera}
              className="flex items-center gap-1 px-3 py-2 rounded-full bg-white/20 text-white text-sm font-bold hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {onUpload && !isCameraOpen && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700 rounded-xl p-3">
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
            {images.length}/{maxImages} photos used
          </span>
          <div className="flex gap-2">
            <button
              onClick={openCamera}
              disabled={!canUpload || isCameraStarting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isCameraStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              Open Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!canUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload from Device
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleManualFileChange}
          />
        </div>
      )}

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-slate-500" />
        </div>
      ) : images.length === 0 ? (
        <div className="py-10 flex flex-col items-center text-center">
          <ImageOff className="w-8 h-8 mb-2 text-gray-300 dark:text-slate-600" />
          <p className="text-sm text-gray-500 dark:text-slate-400">No site images uploaded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {images.map((img) => {
            const meta = METHOD_META[img.uploadMethod] || METHOD_META['Manual Upload'];
            const MethodIcon = meta.icon;
            return (
              <div key={img.id} className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                <a href={img.imageUrl} target="_blank" rel="noreferrer">
                  <img src={img.imageUrl} alt="Site visit" className="w-full h-36 object-cover" />
                </a>
                <div className="p-2 space-y-1">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${meta.badge}`}>
                    <MethodIcon className="w-2.5 h-2.5" /> {meta.label}
                  </span>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400">
                    {new Date(img.capturedAt).toLocaleString()}
                  </p>
                  {img.uploadedBy?.fullName && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate">By {img.uploadedBy.fullName}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SiteImagesModal;
