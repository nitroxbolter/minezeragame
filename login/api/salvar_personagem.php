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

$payload = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'erro' => 'json_invalido']);
    exit;
}

$diasJogados = max(1, min(999999999, (int) ($payload['dias_jogados'] ?? $user['dias_jogados'])));
$hp = max(0, min(999999, (int) ($payload['hp'] ?? $user['hp'])));
$nivel = max(1, min(999999, (int) ($payload['nivel'] ?? $user['nivel'])));
$exp = max(0, min(999999999, (int) ($payload['exp'] ?? $user['exp'])));
$kills = max(0, min(999999999, (int) ($payload['kills'] ?? $user['kills'])));
$hunger = max(0, min(20, (int) ($payload['hunger'] ?? $user['hunger'])));
$x = isset($payload['x']) ? (float) $payload['x'] : $user['pos_x'];
$y = isset($payload['y']) ? (float) $payload['y'] : $user['pos_y'];
$z = isset($payload['z']) ? (float) $payload['z'] : $user['pos_z'];
$yaw = isset($payload['yaw']) ? (float) $payload['yaw'] : (float) $user['yaw'];
$pitch = isset($payload['pitch']) ? (float) $payload['pitch'] : (float) $user['pitch'];
$hotbar = max(0, min(8, (int) ($payload['hotbar'] ?? $user['hotbar'])));
$inventory = $payload['inventory'] ?? null;
$inventoryJson = null;

if (is_array($inventory)) {
    $inventory = array_slice($inventory, 0, 36);
    $inventoryJson = json_encode($inventory, JSON_UNESCAPED_UNICODE);
}

$stmt = db()->prepare(
    'UPDATE personagens
     SET dias_jogados = GREATEST(dias_jogados, ?),
         nivel = GREATEST(nivel, ?),
         exp = ?,
         hp = ?,
         hunger = ?,
         pos_x = ?,
         pos_y = ?,
         pos_z = ?,
         yaw = ?,
         pitch = ?,
         inventory_json = COALESCE(?, inventory_json),
         hotbar = ?,
         kills = GREATEST(kills, ?)
     WHERE conta_id = ?'
);
$stmt->execute([
    $diasJogados,
    $nivel,
    $exp,
    $hp,
    $hunger,
    $x,
    $y,
    $z,
    $yaw,
    $pitch,
    $inventoryJson,
    $hotbar,
    $kills,
    (int) $user['conta_id'],
]);

echo json_encode(['ok' => true]);
