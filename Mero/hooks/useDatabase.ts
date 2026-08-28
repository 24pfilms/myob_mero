import { useEffect, useState } from 'react';
import { db } from '../src/db/Database';
import { MigrationService } from '../src/db/services/MigrationService';

export interface DatabaseState {
  isInitialized: boolean;
  isMigrating: boolean;
  migrationResult: any;
  databaseInfo: any;
  error: string | null;
}

/**
 * Hook for database initialization and management
 */
export const useDatabase = () => {
  const [state, setState] = useState<DatabaseState>({
    isInitialized: false,
    isMigrating: false,
    migrationResult: null,
    databaseInfo: null,
    error: null,
  });

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        setState(prev => ({ ...prev, isMigrating: true, error: null }));

        // Open database connection
        await db.open();

        // Check if migration is needed
        const migrationInfo = await MigrationService.getMigrationInfo();
        
        let migrationResult = null;
        if (!migrationInfo.hasMigrated && migrationInfo.localStorageData) {
          migrationResult = await MigrationService.migrateFromLocalStorage();
        }

        // Initialize default data if needed
        await db.initializeDefaultSettings();
        await db.createDefaultFolders();

        const databaseInfo = await db.getDatabaseInfo();

        setState({
          isInitialized: true,
          isMigrating: false,
          migrationResult,
          databaseInfo,
          error: null,
        });

        console.log('✅ Database initialized successfully');
      } catch (error) {
        console.error('❌ Database initialization failed:', error);
        setState(prev => ({
          ...prev,
          isInitialized: false,
          isMigrating: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    initializeDatabase();
  }, []);

  return {
    ...state,
    // Expose database instance for direct access
    db,
    // Retry initialization
    retryInitialization: () => {
      setState(prev => ({ ...prev, isInitialized: false, error: null }));
    },
    // Clear all data (for reset)
    clearAllData: async () => {
      try {
        await db.clearAllData();
        window.location.reload();
      } catch (error) {
        console.error('Failed to clear database:', error);
        throw error;
      }
    },
  };
};