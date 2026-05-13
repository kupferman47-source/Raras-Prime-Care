import React from 'react';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';

export function Card(props: { children: React.ReactNode, className?: string, onClick?: any, id?: string, key?: any }) {
  const { children, className, ...rest } = props;
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)} {...rest}>
      {children}
    </div>
  );
}

export function Button(props: { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', 
  size?: 'sm' | 'md' | 'lg' | 'icon',
  children?: React.ReactNode,
  className?: string,
  onClick?: any,
  disabled?: boolean,
  type?: 'button' | 'submit' | 'reset',
  title?: string
}) {
  const { 
    className, 
    variant = 'primary', 
    size = 'md', 
    children,
    ...rest 
  } = props;

  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    outline: "bg-transparent border border-slate-200 text-slate-600 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-500 hover:bg-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm font-semibold",
    md: "px-5 py-2.5 text-sm font-semibold",
    lg: "px-6 py-3 text-base font-semibold",
    icon: "p-2",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Input(props: {
  label?: string,
  error?: string,
  className?: string,
  id?: string,
  type?: string,
  value?: any,
  onChange?: any,
  required?: boolean,
  placeholder?: string,
  name?: string,
  defaultValue?: any,
  step?: string
}) {
  const { label, error, className, id, ...rest } = props;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1" htmlFor={id}>{label}</label>}
      <input
        id={id}
        className={cn(
          "w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md transition-all focus:bg-white focus:ring-2 focus:ring-teal-100 focus:border-teal-400 outline-none placeholder:text-slate-400",
          error && "border-red-300 focus:ring-red-100 focus:border-red-400",
          className
        )}
        {...rest}
      />
      {error && <span className="text-[10px] text-red-500 ml-1 mt-0.5">{error}</span>}
    </div>
  );
}

export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl z-10 relative overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto max-h-[80vh]">
          {children}
        </div>
      </div>
    </div>
  );
}
