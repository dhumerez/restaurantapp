import { useQuery } from "@tanstack/react-query";
import * as ordersApi from "../../api/orders";
import type { Table } from "../../types";

interface Props {
  isOpen: boolean;
  title: string;
  currentTableId: string;
  onSelect: (table: Table) => void;
  onCancel: () => void;
}

export function TablePickerModal({ isOpen, title, currentTableId, onSelect, onCancel }: Props) {
  const { data: tables = [] } = useQuery({
    queryKey: ["tables"],
    queryFn: ordersApi.fetchTables,
    enabled: isOpen,
    staleTime: Infinity,
  });

  if (!isOpen) return null;

  const availableTables = tables.filter((t) => t.isActive && t.id !== currentTableId);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative bg-surface-1 border-t md:border border-surface-border rounded-t-2xl md:rounded-2xl shadow-modal w-full md:max-w-sm md:mx-auto animate-slide-up md:animate-fade-up"
        style={{ animationDuration: "0.2s" }}
      >
        {/* Drag handle on mobile */}
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-border" />
        </div>
        <div className="px-5 md:px-6 py-4 md:py-5">
          <h2 className="font-display text-lg md:text-xl font-semibold text-ink-primary mb-1 tracking-wide">
            {title}
          </h2>
          <p className="text-sm text-ink-muted mb-4">Selecciona la mesa destino</p>

          {availableTables.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-6">No hay otras mesas disponibles</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
              {availableTables
                .sort((a, b) => a.number - b.number)
                .map((table) => (
                  <button
                    key={table.id}
                    onClick={() => onSelect(table)}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-surface-border
                      bg-surface-2/50 hover:border-primary-500/40 hover:bg-primary-500/5 active:scale-95
                      transition-all"
                  >
                    <span className="text-[10px] text-ink-muted leading-tight">Mesa</span>
                    <span className="text-lg font-bold text-ink-primary font-mono">{table.number}</span>
                    <span className="text-[10px] text-ink-muted">{table.seats} sillas</span>
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="px-5 md:px-6 pb-5 pb-safe">
          <button
            onClick={onCancel}
            className="w-full px-4 py-3 md:py-2 text-sm font-medium text-ink-muted hover:text-ink-primary
              hover:bg-surface-2 rounded-xl transition-colors min-h-[2.75rem]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
