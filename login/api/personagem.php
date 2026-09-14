<?php
declare(strict_types=1);

require_once __DIR__ . '/../auth.php';

header('Content-Type: application/json; charset=utf-8');

$user = current_user();

if ($user === null) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'erro' => 'nao_autenticado']);
    exit;
}

echo json_encode([
    'ok' => true,
    'conta' => [
        'id' => (int) $user['conta_id'],
        'login' => $user['login'],
    ],
    'personagem' => [
        'id' => (int) $user['personagem_id'],
        'nome' => $user['personagem_nome'],
        'classe_id' => (int) $user['classe_id'],
        'classe_nome' => $user['classe_nome'],
        'nivel' => (int) $user['nivel'],
        'exp' => (int) $user['exp'],
        'hp' => (int) $user['hp'],
        'hunger' => (int) $user['hunger'],
        'posicao' => [
            'x' => $user['pos_x'] !== null ? (float) $user['pos_x'] : null,
            'y' => $user['pos_y'] !== null ? (float) $user['pos_y'] : null,
            'z' => $user['pos_z'] !== null ? (float) $user['pos_z'] : null,
        ],
        'yaw' => (float) $user['yaw'],
        'pitch' => (float) $user['pitch'],
        'inventario' => $user['inventory_json'] !== null ? json_decode((string) $user['inventory_json'], true) : null,
        'hotbar' => (int) $user['hotbar'],
        'skills' => [
            'lenhador' => (int) $user['skill_lenhador'],
            'cooking' => (int) $user['skill_cooking'],
            'mining' => (int) $user['skill_mining'],
            'crafting' => (int) $user['skill_crafting'],
            'farming' => (int) $user['skill_farming'],
        ],
        'forca' => (int) $user['forca'],
        'kills' => (int) $user['kills'],
        'dias_jogados' => (int) $user['dias_jogados'],
    ],
], JSON_UNESCAPED_UNICODE);
