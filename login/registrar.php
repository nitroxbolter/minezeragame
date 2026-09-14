<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

redirect_if_logged_in();

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    validate_csrf();

    $login = clean_name((string) ($_POST['login'] ?? ''));
    $senha = (string) ($_POST['senha'] ?? '');
    $confirmarSenha = (string) ($_POST['confirmar_senha'] ?? '');
    $personagem = clean_name((string) ($_POST['personagem'] ?? ''));
    $classeId = 0;

    if (!valid_login($login)) {
        $error = 'Use um login com 3 a 40 caracteres: letras, numeros e underline.';
    } elseif (strlen($senha) < 6) {
        $error = 'A senha precisa ter pelo menos 6 caracteres.';
    } elseif ($senha !== $confirmarSenha) {
        $error = 'As senhas nao conferem.';
    } elseif (!valid_character_name($personagem)) {
        $error = 'O nome do personagem deve ter 3 a 40 caracteres.';
    } else {
        try {
            $pdo = db();
            $pdo->beginTransaction();

            $stmt = $pdo->prepare('INSERT INTO contas (login, senha_hash) VALUES (?, ?)');
            $stmt->execute([$login, password_hash($senha, PASSWORD_DEFAULT)]);
            $contaId = (int) $pdo->lastInsertId();

            $stmt = $pdo->prepare(
                'INSERT INTO personagens
                    (conta_id, nome, classe_id, nivel, exp, hp,
                     skill_lenhador, skill_cooking, skill_mining, skill_crafting,
                     skill_farming, forca, kills)
                 VALUES
                    (?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, 0)'
            );

            $hp = 20;
            $lenhador = $classeId === 1 ? 5 : 1;
            $cooking = $classeId === 3 ? 3 : 1;
            $mining = $classeId === 2 ? 5 : 1;
            $crafting = $classeId === 4 ? 5 : 1;
            $farming = $classeId === 3 ? 5 : 1;
            $forca = 10;

            $stmt->execute([
                $contaId,
                $personagem,
                $classeId,
                $hp,
                $lenhador,
                $cooking,
                $mining,
                $crafting,
                $farming,
                $forca,
            ]);

            $pdo->commit();

            session_regenerate_id(true);
            $_SESSION['conta_id'] = $contaId;

            header('Location: painel.php');
            exit;
        } catch (PDOException $e) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }

            if ($e->getCode() === '23000') {
                $error = 'Esse login ou nome de personagem ja esta em uso.';
            } else {
                $error = 'Nao foi possivel criar a conta agora.';
            }
        }
    }
}
?>
<!doctype html>
<html lang="pt-br">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Minezera - Criar conta</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main class="auth-shell">
        <section class="auth-card">
            <h1>Criar conta</h1>
            <p>Seu personagem ja nasce com os atributos basicos salvos no banco.</p>

            <?php if ($error !== ''): ?>
                <div class="alert"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
            <?php endif; ?>

            <form method="post" autocomplete="on">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8'); ?>">

                <label for="login">Login</label>
                <input id="login" name="login" type="text" maxlength="40" required autofocus>

                <label for="senha">Senha</label>
                <input id="senha" name="senha" type="password" minlength="6" required>

                <label for="confirmar_senha">Confirmar senha</label>
                <input id="confirmar_senha" name="confirmar_senha" type="password" minlength="6" required>

                <label for="personagem">Nome do personagem</label>
                <input id="personagem" name="personagem" type="text" maxlength="40" required>

                <button type="submit">Cadastrar</button>
            </form>

            <a class="link" href="../index.php">Ja tenho conta</a>
        </section>
    </main>
</body>
</html>
