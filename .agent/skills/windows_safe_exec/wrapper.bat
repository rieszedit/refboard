@echo off
REM Helper script to execute commands safely by ignoring trailing garbage (quotes)
REM Usage: wrapper.bat "your command here"
REM Example: wrapper.bat "git status"

%~1 & REM
