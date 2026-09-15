<?php
declare(strict_types=1);

require_once __DIR__ . '/login/auth.php';

$user = require_login();

$html = (string) file_get_contents(__DIR__ . '/index.html');
$bootstrap = '<script>window.MINEZERA_PLAYER = ' . json_encode([
    'conta_id' => (int) $user['conta_id'],
    'personagem_id' => (int) $user['personagem_id'],
    'nome' => $user['personagem_nome'],
    'classe_id' => (int) $user['classe_id'],
    'nivel' => (int) $user['nivel'],
    'exp' => (int) $user['exp'],
    'dias_jogados' => (int) $user['dias_jogados'],
    'hp' => (int) $user['hp'],
    'hunger' => (int) $user['hunger'],
    'pos_x' => $user['pos_x'] !== null ? (float) $user['pos_x'] : null,
    'pos_y' => $user['pos_y'] !== null ? (float) $user['pos_y'] : null,
    'pos_z' => $user['pos_z'] !== null ? (float) $user['pos_z'] : null,
    'yaw' => (float) $user['yaw'],
    'pitch' => (float) $user['pitch'],
    'inventory' => $user['inventory_json'] !== null ? json_decode((string) $user['inventory_json'], true) : null,
    'hotbar' => (int) $user['hotbar'],
    'skin' => (string) $user['skin_id'],
    'kills' => (int) $user['kills'],
], JSON_UNESCAPED_UNICODE) . ';</script>';

echo str_replace('</head>', $bootstrap . "\n</head>", $html);
