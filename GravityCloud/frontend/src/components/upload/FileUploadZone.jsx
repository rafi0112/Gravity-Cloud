import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { uploadFile } from '../../services/api';
import { useDocStore } from '../../context/docStore';
import toast from 'react-hot-toast';

function ProgressBar({ value }) {
  return (
    <div className="h-1 rounded-full mt-2" style={{ background: 'var(--surface-200)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'var(--accent)', width: `${value}%` }}
        transition={{ duration: 0.2 }}
      />
    </div>
  );
}

export default function FileUploadZone() {
  const [uploads, setUploads] = useState([]); // [{file, progress, status, id}]
  const { addDoc } = useDocStore();

  const update = (id, patch) =>
    setUploads(u => u.map(x => x.id === id ? { ...x, ...patch } : x));

  const getUploadErrorMessage = (err) => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }

    const responseMessage = err?.response?.data?.message;
    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return responseMessage.trim();
    }

    if (typeof err?.message === 'string' && err.message.trim()) {
      return err.message.trim();
    }

    return 'Upload failed';
  };

  const handleUpload = useCallback(async (files) => {
    const newUploads = files.map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      progress: 0,
      status: 'uploading', // uploading | done | error
    }));
    setUploads(u => [...newUploads, ...u]);

    for (const item of newUploads) {
      try {
        await uploadFile(item.file, (pct) => update(item.id, { progress: pct }));
        update(item.id, { status: 'done', progress: 100 });
        addDoc({ name: item.file.name, size: item.file.size });
        toast.success(`${item.file.name} uploaded`);
      } catch (err) {
        update(item.id, { status: 'error' });
        toast.error(`Failed: ${item.file.name} - ${getUploadErrorMessage(err)}`);
      }
    }
  }, [addDoc]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    onDrop: handleUpload,
    multiple: true,
  });

  const remove = (id) => setUploads(u => u.filter(x => x.id !== id));

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div {...getRootProps()} className={`
        cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center
        transition-all duration-200
        ${isDragActive
          ? 'scale-[1.02]'
          : 'hover:scale-[1.005]'}
      `}
        style={{
          borderColor: isDragActive ? 'var(--accent)' : 'var(--border)',
          background: isDragActive ? 'rgba(var(--accent-rgb),0.06)' : 'var(--surface-100)',
        }}>
        <input {...getInputProps()} />
        <motion.div animate={{ y: isDragActive ? -4 : 0 }} transition={{ duration: 0.2 }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(var(--accent-rgb),0.15)' }}>
            <Upload size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <p className="font-medium text-[var(--text-primary)] mb-1">
            {isDragActive ? 'Drop your PDFs here' : 'Drag & drop PDF files'}
          </p>
          <p className="text-sm text-[var(--text-muted)]">or click to browse · PDF only</p>
        </motion.div>
      </div>

      {/* Upload queue */}
      <AnimatePresence>
        {uploads.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'var(--surface-100)', border: '1px solid var(--border)' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
              <FileText size={15} style={{ color: 'var(--accent)' }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.file.name}</p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {(item.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {item.status === 'uploading' && <ProgressBar value={item.progress} />}
            </div>

            <div className="shrink-0">
              {item.status === 'uploading' && <Loader size={15} className="animate-spin" style={{ color: 'var(--accent)' }} />}
              {item.status === 'done' && <CheckCircle size={15} className="text-emerald-400" />}
              {item.status === 'error' && <AlertCircle size={15} className="text-rose-400" />}
            </div>

            <button onClick={() => remove(item.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
