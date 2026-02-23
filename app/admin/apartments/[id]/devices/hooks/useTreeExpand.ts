import { useState } from 'react';
import type { UseTreeExpandReturn } from '../types';

export function useTreeExpand(): UseTreeExpandReturn {
  const [expandedBuildings, setExpandedBuildings] = useState<string[]>([]);
  const [expandedLines, setExpandedLines] = useState<string[]>([]);

  const toggleBuilding = (buildingId: string): void => {
    setExpandedBuildings((prev) =>
      prev.includes(buildingId)
        ? prev.filter((b) => b !== buildingId)
        : [...prev, buildingId],
    );
  };

  const toggleLine = (lineKey: string): void => {
    setExpandedLines((prev) =>
      prev.includes(lineKey)
        ? prev.filter((l) => l !== lineKey)
        : [...prev, lineKey],
    );
  };

  const ensureLineExpanded = (lineKey: string): void => {
    setExpandedLines((prev) =>
      prev.includes(lineKey) ? prev : [...prev, lineKey],
    );
  };

  return {
    expandedBuildings,
    toggleBuilding,
    expandedLines,
    toggleLine,
    ensureLineExpanded,
  };
}
