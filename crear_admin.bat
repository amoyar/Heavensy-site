@echo off
echo ============================================================
echo Heavensy - Crear Usuario Admin
echo ============================================================
echo.

echo [1/3] Desinstalando paquete bson conflictivo...
pip uninstall -y bson 2>nul

echo.
echo [2/3] Instalando dependencias correctas...
pip install --upgrade pymongo bcrypt

echo.
echo [3/3] Ejecutando script de creacion...
python crear_admin_simple.py

echo.
echo ============================================================
echo Proceso completado
echo ============================================================
pause
