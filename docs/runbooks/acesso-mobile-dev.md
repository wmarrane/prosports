# Runbook — Acessar o ambiente de DEV pelo celular (Wi‑Fi)

Como abrir o painel ProSports de **desenvolvimento** no celular, na mesma rede
Wi‑Fi da estação Windows.

## Acesso rápido

1. Conecte o celular na **mesma rede Wi‑Fi** do PC.
2. No navegador do celular, abra:

   **http://192.168.15.141:8080**

3. Faça login normalmente.

> `192.168.15.141` é o IP **atual** do Wi‑Fi do PC e é **DHCP — pode mudar**.
> Se parar de funcionar, redescubra o IP (seção abaixo) ou fixe um IP.

---

## Como funciona (a ponte de rede)

A VM de dev fica numa rede **host-only** do VirtualBox (`192.168.56.113`), que o
celular **não** alcança direto. A estação Windows está nas duas redes (Wi‑Fi +
host-only) e faz um **portproxy** encaminhando o tráfego:

```
Celular (Wi‑Fi)  →  192.168.15.141:8080 (PC)  →  192.168.56.113:8080 (VM dev)
```

Portas já encaminhadas hoje:
- **8080** → painel admin (SPA) — é a que você usa no celular
- **3000** → API do backend (o SPA já chama a API por dentro; normalmente não
  precisa acessar a 3000 direto)

O site público de dev (porta **8081**) **não** está encaminhado (veja "Extras").

---

## Descobrir o IP do Wi‑Fi (se mudou)

No PowerShell:
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object InterfaceAlias -eq 'Wi-Fi' | Select-Object IPAddress
```
Use o IP retornado no lugar de `192.168.15.141`.

---

## Recriar a ponte (se sumir / trocar de VM)

Rode o **PowerShell como Administrador**.

Portproxy (encaminha 8080 do PC para a VM de dev):
```powershell
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=192.168.56.113
```

Liberar no firewall do Windows:
```powershell
New-NetFirewallRule -DisplayName "PortProxy 8080 -> VM Dev" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

Conferir o que está ativo:
```powershell
netsh interface portproxy show all
```

Remover (se precisar):
```powershell
netsh interface portproxy delete v4tov4 listenport=8080 listenaddress=0.0.0.0
```

---

## Dica: evitar que o IP mude

O IP do Wi‑Fi é DHCP. Para um endereço estável, faça uma **reserva de DHCP** no
roteador (associando o MAC do PC a um IP fixo) ou defina IP estático no Windows.
Assim o link do celular não muda.

---

## Troubleshooting

- **Não abre no celular:** confirme que o celular está no **mesmo Wi‑Fi** (não
  em 4G/5G) e que o IP do PC ainda é `192.168.15.141` (pode ter mudado).
- **VPN ativa no PC:** há um adaptador McAfee VPN na máquina. Se a VPN estiver
  capturando o tráfego, pode atrapalhar o acesso pela LAN — teste desligando a
  VPN.
- **Funciona no PC mas não no celular:** provavelmente firewall. Confira a regra
  "PortProxy 8080 -> VM Dev" (seção acima).
- **Página abre mas API falha:** confirme que a VM de dev está de pé
  (`http://192.168.56.113:8080` a partir do PC) e que o backend responde.

---

## Extras — expor também o site público de dev (porta 8081)

Se quiser ver o **site público** de dev (`192.168.56.113:8081`) no celular,
adicione (PowerShell como Admin):
```powershell
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=192.168.56.113
New-NetFirewallRule -DisplayName "PortProxy 8081 -> VM Dev" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow
```
Depois acesse `http://192.168.15.141:8081` no celular.
