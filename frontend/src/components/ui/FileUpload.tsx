import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface FileUploadProps {
  onFileContent: (content: string) => void;
  accept?: string;
  label?: string;
}

export function FileUpload({
  onFileContent,
  accept = '.csv,.txt',
  label = 'Upload CSV or text file',
}: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileContent(content);
      };
      reader.readAsText(file);
    },
    [onFileContent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const clearFile = () => {
    setFileName(null);
    onFileContent('');
  };

  return (
    <div className="w-full">
      <label className="label-text">{label}</label>

      {fileName ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-dark-800/80 border border-dark-600/50 rounded-lg">
          <FileText className="w-5 h-5 text-primary-400 shrink-0" />
          <span className="text-sm text-dark-200 truncate flex-1">{fileName}</span>
          <button
            type="button"
            onClick={clearFile}
            className="p-1 rounded-md text-dark-400 hover:text-red-400 hover:bg-dark-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center gap-2 px-6 py-8
            border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200
            ${
              isDragging
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-dark-600/50 bg-dark-800/30 hover:border-dark-500/50 hover:bg-dark-800/50'
            }
          `}
        >
          <Upload
            className={`w-8 h-8 ${isDragging ? 'text-primary-400' : 'text-dark-500'}`}
          />
          <div className="text-center">
            <p className="text-sm text-dark-300">
              <span className="text-primary-400 font-medium">Click to upload</span> or drag
              and drop
            </p>
            <p className="text-xs text-dark-500 mt-1">CSV or TXT files</p>
          </div>
          <input
            type="file"
            accept={accept}
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
