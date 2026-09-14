# Login Minezera

Esta pasta ainda contem a primeira versao PHP do login, cadastro, painel e APIs. Ela fica como referencia/legado.

O caminho recomendado agora e rodar o projeto pelo servidor Node em `server.js`. Ele reaproveita:

- o CSS em `login/style.css`;
- as mesmas tabelas de `database/minezera.sql`;
- as mesmas URLs de API que o `index.html` ja chama: `/login/api/personagem.php`, `/login/api/salvar_personagem.php` e `/login/api/mundo.php`.

## Rodar pelo Node

```bash
npm install
npm start
```

Configure as variaveis `DB_HOST`, `DB_NAME`, `DB_USER` e `DB_PASS` conforme o MySQL da VPS.

## PHP legado

Se quiser rodar a versao antiga com XAMPP/Apache/PHP, os arquivos ainda existem:

- `index.php` na raiz;
- `game.php` na raiz;
- `login/auth.php`;
- `login/db.php`;
- `login/registrar.php`;
- `login/painel.php`;
- `login/api/*.php`.

Essa rota antiga exige Apache/PHP/MySQL e usa `.htaccess` para bloquear acesso direto a `index.html`.
