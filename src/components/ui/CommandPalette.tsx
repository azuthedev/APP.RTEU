import React, { useState, useEffect } from 'react';
import { Search, Calendar, CheckCircle, Clock, Filter, X, ArrowRight, Command } from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string[];
  action: () => void;
  category?: string;
}

interface CommandPaletteProps {
  items: CommandItem[];
  placeholder?: string;
  hotkey?: string;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  items,
  placeholder = 'Search or use a command...',
  hotkey = '⌘K',
  className = '',
  isOpen,
  onClose
}) => {
  const [search, setSearch] = useState('');
  const [filteredItems, setFilteredItems] = useState<CommandItem[]>(items);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset search and selected item when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setFilteredItems(items);
    }
  }, [isOpen, items]);

  // Filter items based on search
  useEffect(() => {
    if (search.trim() === '') {
      setFilteredItems(items);
    } else {
      const lowercasedSearch = search.toLowerCase();
      const filtered = items.filter(item => 
        item.title.toLowerCase().includes(lowercasedSearch) || 
        (item.description && item.description.toLowerCase().includes(lowercasedSearch))
      );
      setFilteredItems(filtered);
    }
    setSelectedIndex(0);
  }, [search, items]);

  // Group items by category
  const groupedItems: Record<string, CommandItem[]> = {};
  filteredItems.forEach(item => {
    const category = item.category || 'General';
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  });

  // Handle keyboard navigation and selection
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prevIndex) => 
        prevIndex < filteredItems.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prevIndex) => prevIndex > 0 ? prevIndex - 1 : 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-start justify-center pt-[15vh] z-50 overflow-y-auto" onClick={onClose}>
      <div 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full mx-4 max-h-[60vh] overflow-hidden ${className}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-2 relative">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-md text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
            <div className="absolute right-3 top-2.5 p-0.5 rounded bg-gray-200 dark:bg-gray-600 text-xs text-gray-500 dark:text-gray-400">
              {hotkey}
            </div>
          </div>

          <div className="mt-2 overflow-y-auto max-h-[calc(60vh-4rem)]">
            {Object.keys(groupedItems).length === 0 ? (
              <div className="py-6 text-center text-gray-500 dark:text-gray-400">
                No results found
              </div>
            ) : (
              Object.entries(groupedItems).map(([category, categoryItems]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {category}
                  </div>
                  <ul>
                    {categoryItems.map((item, index) => {
                      const itemIndex = filteredItems.findIndex(i => i.id === item.id);
                      const isSelected = itemIndex === selectedIndex;
                      
                      return (
                        <li 
                          key={item.id}
                          className={`px-2 py-2 rounded-md cursor-pointer flex items-center justify-between ${
                            isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => {
                            item.action();
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                        >
                          <div className="flex items-center">
                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center mr-2 text-gray-400 dark:text-gray-500">
                              {item.icon || <Command className="h-4 w-4" />}
                            </span>
                            <div>
                              <div className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'}`}>
                                {item.title}
                              </div>
                              {item.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {item.shortcut && (
                            <div className="flex-shrink-0 flex items-center">
                              {item.shortcut.map((key, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <span className="mx-1 text-gray-400 dark:text-gray-500">+</span>}
                                  <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 font-mono">
                                    {key}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between px-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Use ↑↓ to navigate</span>
            <span>Press Enter to select</span>
            <span>Esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;