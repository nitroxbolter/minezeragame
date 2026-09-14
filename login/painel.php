<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$user = require_login();
$maxHp = 20 + max(0, (int) $user['nivel'] - 1) * 2;
$hpAtual = (int) $user['hp'];
if ($hpAtual > $maxHp && $hpAtual <= 100) {
    $hpAtual = (int) ceil($hpAtual / 5);
}
$hpAtual = min($hpAtual, $maxHp);
?>
<!doctype html>
<html lang="pt-br">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Minezera - Personagem</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main class="panel-shell">
        <section class="panel-heading">
            <div>
                <span>Conta: <?php echo htmlspecialchars($user['login'], ENT_QUOTES, 'UTF-8'); ?></span>
                <h1><?php echo htmlspecialchars($user['personagem_nome'], ENT_QUOTES, 'UTF-8'); ?></h1>
                <p>Classe <?php echo (int) $user['classe_id']; ?> - <?php echo htmlspecialchars($user['classe_nome'], ENT_QUOTES, 'UTF-8'); ?></p>
            </div>
            <div class="panel-actions">
                <a class="button-primary" href="../game.php">Abrir jogo</a>
                <a class="button-secondary" href="logout.php">Sair</a>
            </div>
        </section>

        <section class="stats-grid">
            <article>
                <span>Nivel</span>
                <strong><?php echo (int) $user['nivel']; ?></strong>
            </article>
            <article>
                <span>EXP</span>
                <strong><?php echo (int) $user['exp']; ?></strong>
            </article>
            <article>
                <span>HP</span>
                <strong><?php echo $hpAtual; ?> / <?php echo $maxHp; ?></strong>
            </article>
            <article>
                <span>Forca</span>
                <strong><?php echo (int) $user['forca']; ?></strong>
            </article>
            <article>
                <span>Kills</span>
                <strong><?php echo (int) $user['kills']; ?></strong>
            </article>
            <article>
                <span>Dias</span>
                <strong><?php echo (int) $user['dias_jogados']; ?></strong>
            </article>
        </section>

        <section class="skills">
            <h2>Skills</h2>
            <div class="skills-list">
                <span>Lenhador <strong><?php echo (int) $user['skill_lenhador']; ?></strong></span>
                <span>Cooking <strong><?php echo (int) $user['skill_cooking']; ?></strong></span>
                <span>Mining <strong><?php echo (int) $user['skill_mining']; ?></strong></span>
                <span>Crafting <strong><?php echo (int) $user['skill_crafting']; ?></strong></span>
                <span>Farming <strong><?php echo (int) $user['skill_farming']; ?></strong></span>
            </div>
        </section>
    </main>
</body>
</html>
