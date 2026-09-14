<?php
declare(strict_types=1);

require_once __DIR__ . '/../auth.php';

require_login();

header('Content-Type: application/json; charset=utf-8');

$worldDir = dirname(__DIR__, 2) . '/storage/world';
$worldPath = $worldDir . '/world.json';

if (!is_dir($worldDir)) {
    mkdir($worldDir, 0775, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!is_file($worldPath)) {
        echo json_encode(['ok' => true, 'world' => null]);
        exit;
    }

    readfile($worldPath);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'erro' => 'metodo_invalido']);
    exit;
}

$raw = (string) file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!is_array($payload) || ($payload['version'] ?? null) !== 1) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'erro' => 'mundo_invalido']);
    exit;
}

$json = json_encode(['ok' => true, 'world' => $payload], JSON_UNESCAPED_UNICODE);
if ($json === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'erro' => 'json_invalido']);
    exit;
}

file_put_contents($worldPath, $json, LOCK_EX);

echo json_encode(['ok' => true]);
