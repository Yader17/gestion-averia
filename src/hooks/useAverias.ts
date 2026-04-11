import { useState, useCallback, useEffect, useRef } from 'react';
import { Averia, AveriaFormData } from '../types/averia';
import { generateId } from '../utils/idGenerator';
import { saveAverias, loadAverias, clearAverias as clearStorage } from '../services/storageService';

type UseAveriasReturn = {
  averias: Averia[];
  isLoaded: boolean;
  addAveria: (formData: AveriaFormData) => void;
  updateAveria: (id: string, formData: AveriaFormData) => void;
  deleteAveria: (id: string) => void;
  setAverias: (averias: Averia[]) => void;
  clearAverias: () => void;
};

export function useAverias(): UseAveriasReturn {
  const [averias, setAveriasState] = useState<Averia[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const skipSaveRef = useRef(true);

  // Load persisted data on mount
  useEffect(() => {
    loadAverias().then((saved) => {
      if (saved.length > 0) {
        setAveriasState(saved);
      }
      skipSaveRef.current = false;
      setIsLoaded(true);
    });
  }, []);

  // Auto-save whenever averias change (skip initial load)
  useEffect(() => {
    if (skipSaveRef.current) return;
    saveAverias(averias);
  }, [averias]);

  const addAveria = useCallback((formData: AveriaFormData) => {
    const newAveria: Averia = {
      ...formData,
      id: generateId(),
    };
    setAveriasState((prev) => [...prev, newAveria]);
  }, []);

  const updateAveria = useCallback((id: string, formData: AveriaFormData) => {
    setAveriasState((prev) =>
      prev.map((averia) =>
        averia.id === id ? { ...formData, id } : averia
      )
    );
  }, []);

  const deleteAveria = useCallback((id: string) => {
    setAveriasState((prev) => prev.filter((averia) => averia.id !== id));
  }, []);

  const setAverias = useCallback((newAverias: Averia[]) => {
    setAveriasState(newAverias);
  }, []);

  const clearAverias = useCallback(() => {
    setAveriasState([]);
    clearStorage();
  }, []);

  return {
    averias,
    isLoaded,
    addAveria,
    updateAveria,
    deleteAveria,
    setAverias,
    clearAverias,
  };
}
