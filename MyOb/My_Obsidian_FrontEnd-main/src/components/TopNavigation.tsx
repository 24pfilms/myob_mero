import { Link, useLocation } from 'react-router-dom';
import { FileText } from 'lucide-react';

const TABS = [
  { 
    id: 'notes', 
    name: 'Notes', 
    path: '/notes', 
    icon: FileText,
    description: 'Markdown editor & knowledge base'
  },
];

export function TopNavigation() {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto">
        <div className="flex items-center h-14">
          {/* Tabs */}
          <div className="flex flex-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;
              
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  className={`
                    flex items-center gap-2 px-6 py-3 
                    border-b-2 transition-all
                    ${isActive 
                      ? 'border-primary text-primary bg-primary/10' 
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
                    }
                  `}
                  title={tab.description}
                >
                  <Icon size={18} />
                  <span className="font-medium">{tab.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
