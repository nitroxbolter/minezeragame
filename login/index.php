<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

redirect_if_logged_in();

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    validate_csrf();

    $login = clean_name((string) ($_POST['login'] ?? ''));
    $senha = (string) ($_POST['senha'] ?? '');

    if ($login === '' || $senha === '') {
        $error = 'Preencha login e senha.';
    } else {
        $stmt = db()->prepare('SELECT id, senha_hash FROM contas WHERE login = ?');
        $stmt->execute([$login]);
        $conta = $stmt->fetch();

        if (!$conta || !password_verify($senha, $conta['senha_hash'])) {
            $error = 'Login ou senha incorretos.';
        } else {
            session_regenerate_id(true);
            $_SESSION['conta_id'] = (int) $conta['id'];

            $update = db()->prepare('UPDATE contas SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?');
            $update->execute([(int) $conta['id']]);

            header('Location: painel.php');
            exit;
        }
    }
}
?>
<!doctype html>
<html lang="pt-br">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Minezera - Login</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main class="auth-shell">
        <section class="auth-card">
            <h1>Minezera</h1>
            <p>Entre na sua conta para carregar seu personagem.</p>

            <?php if ($error !== ''): ?>
                <div class="alert"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
            <?php endif; ?>

            <form method="post" autocomplete="on">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">

                <label for="login">Login</label>
                <input id="login" name="login" type="text" maxlength="40" required autofocus>

                <label for="senha">Senha</label>
                <input id="senha" name="senha" type="password" required>

                <button type="submit">Entrar</button>
            </form>

            <a class="link" href="registrar.php">Criar uma conta</a>
            <a class="link" href="../index.php">Voltar para o inicio</a>
        </section>
    </main>
</body>
</html>
