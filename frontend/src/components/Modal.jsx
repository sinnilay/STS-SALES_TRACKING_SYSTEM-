import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, maxWidthClass = 'max-w-md' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`my-auto bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full ${maxWidthClass} max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden border border-gray-200 dark:border-slate-700`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center gap-4 p-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
          <button
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 text-gray-700 dark:text-slate-300 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
