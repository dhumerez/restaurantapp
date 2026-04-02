import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import * as ordersApi from "../../api/orders";
import { useToast } from "../ui/Toast";
import type { Order } from "../../types";

interface Props {
  order: Order;
  onApplied: () => void;
}

export function DiscountSection({ order, onApplied }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<"none" | "percentage" | "fixed">(order.discountType ?? "none");
  const [value, setValue] = useState(order.discountValue ? parseFloat(order.discountValue).toString() : "");
  const [reason, setReason] = useState(order.discountReason ?? "");

  const hasDiscount = order.discountType !== "none" && parseFloat(order.discountAmount) > 0;
  const canEdit = order.status !== "cancelled" && order.status !== "draft";

  const discountMut = useMutation({
    mutationFn: () =>
      ordersApi.applyDiscount(
        order.id,
        type,
        type === "none" ? 0 : parseFloat(value) || 0,
        reason || undefined
      ),
    onSuccess: () => {
      onApplied();
      setEditing(false);
      toast(type === "none" ? "Descuento eliminado" : "Descuento aplicado", "success");
    },
    onError: (err: any) => {
      toast(err?.response?.data?.error ?? "Error al aplicar descuento", "error");
    },
  });

  const handleRemove = () => {
    setType("none");
    setValue("");
    setReason("");
    ordersApi
      .applyDiscount(order.id, "none", 0)
      .then(() => {
        onApplied();
        setEditing(false);
        toast("Descuento eliminado", "success");
      })
      .catch(() => toast("Error al eliminar descuento", "error"));
  };

  // Read-only display when there is a discount and not editing
  if (hasDiscount && !editing) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <button
            onClick={() => canEdit && setEditing(true)}
            className={`text-emerald-400 ${canEdit ? "hover:underline cursor-pointer" : ""}`}
          >
            Descuento
            {order.discountType === "percentage" && ` (${parseFloat(order.discountValue)}%)`}
            {order.discountType === "fixed" && ` (fijo)`}
          </button>
          <span className="text-emerald-400">
            −Bs. {parseFloat(order.discountAmount).toFixed(2)}
          </span>
        </div>
        {order.discountReason && (
          <p className="text-[10px] text-ink-muted pl-1">{order.discountReason}</p>
        )}
      </div>
    );
  }

  // No discount and not editing — show add button
  if (!editing) {
    if (!canEdit) return null;
    return (
      <button
        onClick={() => {
          setType("percentage");
          setValue("");
          setReason("");
          setEditing(true);
        }}
        className="text-xs text-primary-400 hover:underline py-0.5"
      >
        + Agregar descuento
      </button>
    );
  }

  // Editing mode
  return (
    <div className="bg-surface-2/50 border border-surface-border rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-primary">Descuento</span>
        <button
          onClick={() => setEditing(false)}
          className="text-xs text-ink-muted hover:text-ink-primary"
        >
          Cancelar
        </button>
      </div>

      {/* Type toggle */}
      <div className="flex gap-1 bg-surface-1 border border-surface-border rounded-lg p-0.5">
        <button
          onClick={() => setType("percentage")}
          className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
            type === "percentage"
              ? "bg-primary-500 text-ink-inverse"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          %
        </button>
        <button
          onClick={() => setType("fixed")}
          className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
            type === "fixed"
              ? "bg-primary-500 text-ink-inverse"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          Bs.
        </button>
      </div>

      {/* Value input */}
      <div className="relative">
        <input
          type="number"
          min="0"
          max={type === "percentage" ? 100 : undefined}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === "percentage" ? "Ej: 10" : "Ej: 5.00"}
          className="w-full px-3 py-1.5 bg-surface-1 border border-surface-border rounded-lg text-sm text-ink-primary
            placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-primary-500/30 pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
          {type === "percentage" ? "%" : "Bs."}
        </span>
      </div>

      {/* Reason input */}
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (opcional)"
        className="w-full px-3 py-1.5 bg-surface-1 border border-surface-border rounded-lg text-xs text-ink-primary
          placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-primary-500/30"
      />

      {/* Actions */}
      <div className="flex gap-2">
        {hasDiscount && (
          <button
            onClick={handleRemove}
            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Eliminar
          </button>
        )}
        <button
          onClick={() => discountMut.mutate()}
          disabled={!value || parseFloat(value) <= 0 || discountMut.isPending}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary-500 text-ink-inverse rounded-lg
            hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
