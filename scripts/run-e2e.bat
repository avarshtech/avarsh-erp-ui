@echo off
REM E2E Test Runner — Windows CMD wrapper
REM Usage: scripts\run-e2e.bat [module]
REM Example: scripts\run-e2e.bat costing

powershell -ExecutionPolicy Bypass -File "%~dp0run-e2e.ps1" -Module %1
