"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getRepo } from "./repo";

/** Reaktyvūs užklausų kabliukai — perskaičiuojama, kai pasikeičia bet kuri lentelė. */
export function useIndex() { return useLiveQuery(() => getRepo().getCatalogIndex(), []); }
export function useBook(id: string) { return useLiveQuery(() => (id ? getRepo().getBook(id).catch(() => null) : null), [id]); }
export function useMoves(filter: "all" | "open" | "late") { return useLiveQuery(() => getRepo().getMoves(filter), [filter]); }
export function useReadingStats() { return useLiveQuery(() => getRepo().getReadingStats(), []); }
export function useWishes() { return useLiveQuery(() => getRepo().getWishes(), []); }
export function useShelves() { return useLiveQuery(() => getRepo().getShelves(), []); }
export function useStats() { return useLiveQuery(() => getRepo().getStats(), []); }
export function useSettings() { return useLiveQuery(() => getRepo().getSettings(), []); }
export function useLog() { return useLiveQuery(() => getRepo().getLog(), []); }
export function useInventory() { return useLiveQuery(() => getRepo().getInventory(), []); }
export function useDeleted() { return useLiveQuery(() => getRepo().getDeleted(), []); }
export function useRemoteStatus() { return useLiveQuery(() => getRepo().getRemoteStatus(), []); }
