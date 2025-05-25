import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  className = '',
  ...props
}) => {
  const inputClasses = `
    w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl
    text-white placeholder-zinc-400 text-sm
    focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 focus:bg-zinc-800/70
    hover:border-zinc-600 hover:bg-zinc-800/60
    transition-all duration-200 ease-in-out
    ${error ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500' : ''}
    ${icon ? 'pl-11' : ''}
    ${className}
  `;

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-zinc-200 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            {icon}
          </div>
        )}
        <input
          className={inputClasses}
          {...props}
        />
      </div>
      {error && (
        <p className="text-sm text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}; 