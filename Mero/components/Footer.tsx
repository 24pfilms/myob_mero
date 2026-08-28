import React from 'react';
import { HeartIcon } from './icons';

export const Footer = () => (
  <footer className="fixed bottom-4 right-4 z-50 text-xs text-gray-400">
    <a 
      href="https://aisurftools.com" 
      target="_blank" 
      rel="noopener noreferrer" 
      className="flex items-center gap-1 px-2 py-1 bg-gray-800/50 backdrop-blur-sm rounded-full shadow-sm hover:bg-gray-700 transition-colors"
    >
      Made with <HeartIcon /> by AISurfTools.com
    </a>
  </footer>
);