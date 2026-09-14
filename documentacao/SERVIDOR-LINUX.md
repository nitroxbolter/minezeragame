# Rodando em servidor Linux Ubuntu 22.04

## Requisitos

- Ubuntu 22.04.
- Node.js 18 ou superior.
- MySQL ou MariaDB.
- Nginx como proxy reverso.
- Porta liberada no firewall.
- Opcional: HTTPS com Certbot.

## O que o Node faz agora

O `server.js` virou o servidor principal do Minezera:

- renderiza login, cadastro e painel;
- cria sessao por cookie `minezera_sid`;
- usa CSRF nos formularios;
- valida/cria senha com bcrypt;
- conecta no MySQL com `mysql2`;
- injeta `window.MINEZERA_PLAYER` no jogo;
- serve `/game` e tambem `/game.php` por compatibilidade;
- mantem as APIs antigas usadas pelo `index.html`: `/login/api/personagem.php`, `/login/api/salvar_personagem.php` e `/login/api/mundo.php`;
- abre WebSocket em `/multiplayer` para jogadores online se enxergarem;
- salva o mundo em `storage/world/world.json`.

Os arquivos PHP antigos podem ficar no repositorio como referencia, mas nao sao necessarios para rodar pelo Node.

## Instalar pacotes no Ubuntu

```bash
sudo apt update
sudo apt install -y mysql-server nginx
```

Instale Node.js 18+ pelo repositorio que voce preferir. Exemplo com NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## Criar banco

Entre no MySQL:

```bash
sudo mysql
```

Crie usuario e banco. Troque `SENHA_FORTE_AQUI`:

```sql
CREATE DATABASE IF NOT EXISTS minezera CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'minezera'@'localhost' IDENTIFIED BY 'SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON minezera.* TO 'minezera'@'localhost';
FLUSH PRIVILEGES;
```

Depois importe o schema:

```bash
mysql -u minezera -p minezera < database/minezera.sql
```

## Instalar o projeto

Exemplo usando `/var/www/minezera`:

```bash
cd /var/www/minezera
npm install --omit=dev
```

Garanta permissao de escrita no storage:

```bash
sudo chown -R www-data:www-data /var/www/minezera/storage
sudo chmod -R 775 /var/www/minezera/storage
```

## Variaveis de ambiente

O servidor aceita:

- `HOST`: padrao `0.0.0.0`;
- `PORT`: padrao `8765`;
- `DB_HOST`: padrao `127.0.0.1`;
- `DB_NAME`: padrao `minezera`;
- `DB_USER`: padrao `root`;
- `DB_PASS`: padrao vazio;
- `DB_CHARSET`: padrao `utf8mb4`;
- `DB_POOL_LIMIT`: padrao `10`;
- `SESSION_TTL_HOURS`: padrao `168`.

## Testar manualmente

```bash
DB_USER=minezera DB_PASS=SENHA_FORTE_AQUI npm start
```

Acesse:

```text
http://IP_DA_VPS:8765/
```

Teste de saude:

```bash
curl http://127.0.0.1:8765/health
```

Resposta esperada:

```json
{"ok":true,"app":"Minezera","server":"node"}
```

## Rodar com systemd

Crie `/etc/systemd/system/minezera.service`:

```ini
[Unit]
Description=Minezera Node server
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/var/www/minezera
ExecStart=/usr/bin/node /var/www/minezera/server.js
Environment=HOST=127.0.0.1
Environment=PORT=8765
Environment=DB_HOST=127.0.0.1
Environment=DB_NAME=minezera
Environment=DB_USER=minezera
Environment=DB_PASS=SENHA_FORTE_AQUI
Environment=SESSION_TTL_HOURS=168
Restart=always
RestartSec=3
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now minezera
sudo systemctl status minezera
```

Logs:

```bash
journalctl -u minezera -f
```

Quando jogadores entram e saem, o console mostra linhas como:

```text
[multiplayer] eduardo conectado (conta 1, personagem 1). Online: 1
[multiplayer] maria conectado (conta 2, personagem 2). Online: 2
[multiplayer] maria desconectou. Online: 1
```

Quando um jogador ataca outro em PvP, aparece:

```text
[pvp] eduardo atacou maria causando 4 de dano.
```

## Nginx como proxy reverso

Crie um arquivo em `/etc/nginx/sites-available/minezera`:

```nginx
server {
    server_name seu-dominio.com;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative:

```bash
sudo ln -s /etc/nginx/sites-available/minezera /etc/nginx/sites-enabled/minezera
sudo nginx -t
sudo systemctl reload nginx
```

Depois aplique HTTPS com Certbot.

## Observacao importante

O Node agora substitui a parte PHP para servidor web, conta, personagem, APIs, presenca multiplayer e PvP basico. Mesmo assim, a simulacao do jogo ainda roda no navegador. O servidor salva os dados e retransmite posicao/dano, mas ainda nao e autoritativo em tempo real. Para multiplayer completo, a proxima etapa e sincronizar blocos, mobs, drops, inventario e validacao das acoes no servidor.
