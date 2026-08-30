/**
 * Cutting module API surface. Screens import only from here, which is what let
 * the module move off its in-memory mock one stage at a time; every function
 * now reaches the real backend.
 */
export * from './cuttingApi';
