import { useMemo } from 'react';
import type { Category } from '@/domain/types';
import { useData } from './DataContext';

/** Categorie ordinate: tutte (anche archiviate, per lo storico) e solo quelle attive (per l'inserimento). */
export function useCategories(): { all: Category[]; active: Category[]; byId: Map<string, Category> } {
  const { db } = useData();
  return useMemo(() => {
    const all = Object.values(db.categories).sort((a, b) => a.order - b.order);
    return { all, active: all.filter((c) => !c.archived), byId: new Map(all.map((c) => [c.id, c])) };
  }, [db.categories]);
}
