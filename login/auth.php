<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

$sessionPath = dirname(__DIR__) . '/storage/sessions';
if (!is_dir($sessionPath)) {
    mkdir($sessionPath, 0775, true);
}
session_save_path($sessionPath);
session_start();

function current_user(): ?array
{
    if (empty($_SESSION['conta_id'])) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT
            c.id AS conta_id,
            c.login,
            p.id AS personagem_id,
            p.nome AS personagem_nome,
            p.classe_id,
            p.nivel,
            p.exp,
            p.hp,
            p.hunger,
            p.pos_x,
            p.pos_y,
            p.pos_z,
            p.yaw,
            p.pitch,
            p.inventory_json,
            p.hotbar,
            p.skill_lenhador,
            p.skill_cooking,
            p.skill_mining,
            p.skill_crafting,
            p.skill_farming,
            p.forca,
            p.kills,
            p.dias_jogados,
            cl.nome AS classe_nome
        FROM contas c
        INNER JOIN personagens p ON p.conta_id = c.id
        INNER JOIN classes cl ON cl.id = p.classe_id
        WHERE c.id = ?'
    );
    $stmt->execute([(int) $_SESSION['conta_id']]);
    $user = $stmt->fetch();

    return $user ?: null;
}

function require_login(): array
{
    $user = current_user();

    if ($user === null) {
        header('Location: index.php');
        exit;
    }

    return $user;
}

function redirect_if_logged_in(): void
{
    if (current_user() !== null) {
        header('Location: painel.php');
        exit;
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf_token'];
}

function validate_csrf(): void
{
    $token = $_POST['csrf_token'] ?? '';
    if (!is_string($token) || !hash_equals(csrf_token(), $token)) {
        http_response_code(400);
        exit('Token de seguranca invalido.');
    }
}

function clean_name(string $value): string
{
    return trim($value);
}

function valid_login(string $login): bool
{
    return (bool) preg_match('/^[a-zA-Z0-9_]{3,40}$/', $login);
}

function valid_character_name(string $name): bool
{
    return (bool) preg_match('/^[a-zA-Z0-9_ ]{3,40}$/', $name);
}
