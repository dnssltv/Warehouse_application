@echo off
:: Запустите от имени администратора, если с других ПК не открывается http://IP-сервера
echo Adding inbound rules for Warehouse App (TCP 80, 8000, 5173)...
netsh advfirewall firewall add rule name="Warehouse App TCP 80" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="Warehouse App TCP 8000" dir=in action=allow protocol=TCP localport=8000
netsh advfirewall firewall add rule name="Warehouse App TCP 5173" dir=in action=allow protocol=TCP localport=5173
echo Done.
pause
