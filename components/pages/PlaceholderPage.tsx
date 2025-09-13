

import React from 'react';

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title }) => {
  return (
    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl flex items-center justify-center h-[80vh]">
      <div className="text-center text-slate-600 dark:text-slate-400">
        <h2 className="text-4xl font-bold mb-4">{title}</h2>
        <p className="text-lg">این صفحه در حال ساخت می باشد.</p>
        <div className="mt-8 w-24 h-2 bg-blue-500 mx-auto rounded-full"></div>
      </div>
    </div>
  );
};

export default PlaceholderPage;
