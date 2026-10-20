import { createContext, useContext, useEffect, useRef } from 'react';

/** Provided by the Master Data page; absent elsewhere (HR and production masters share MasterSplitView). */
export const MasterAssistantContext = createContext(null);

/**
 * Puts a master screen within Laya AI's reach. The screen hands over what it already has, and the
 * page's assistant always reads the latest version:
 *   rows, columns?     — the list (columns' dataIndex pick the fields Laya AI is shown)
 *   searchText         — what is typed in the list's search box
 *   search(text)       — type into it
 *   openNew()          — open the add form
 *   openRecord(record) — open a record in the form
 *   close()            — close the form
 *   isOpen, recordId   — whether the form is open, and which record (null for a new one)
 *   form, markDirty()  — the antd form and the screen's "unsaved changes" switch
 *   fillable           — false where Laya AI must not fill the form (Items: new items go by card)
 *   refresh()          — reload the list (after a card created a record)
 * Pass null to stay out of reach. Outside the Master Data page this does nothing.
 */
export function useMasterAssistant(adapter) {
  const registry = useContext(MasterAssistantContext);
  const ref = useRef(adapter);
  useEffect(() => { ref.current = adapter; });
  const register = registry?.register;
  const enabled = !!adapter;
  useEffect(() => (enabled ? register?.(ref) : undefined), [register, enabled]);
}
