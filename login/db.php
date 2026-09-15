<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_NAME,
        DB_CHARSET
    );

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, pdo_options());
    } catch (PDOException $e) {
        if ($e->getCode() !== 1049 && $e->getCode() !== '1049') {
            throw $e;
        }

        install_database();
        $pdo = new PDO($dsn, DB_USER, DB_PASS, pdo_options());
    }

    migrate_database($pdo);

    return $pdo;
}

function pdo_options(): array
{
    return [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
}

function install_database(): void
{
    $serverDsn = sprintf('mysql:host=%s;charset=%s', DB_HOST, DB_CHARSET);
    $server = new PDO($serverDsn, DB_USER, DB_PASS, pdo_options());
    $schemaPath = dirname(__DIR__) . '/database/minezera.sql';

    if (!is_file($schemaPath)) {
        throw new RuntimeException('Arquivo database/minezera.sql nao encontrado.');
    }

    $server->exec((string) file_get_contents($schemaPath));
}

function migrate_database(PDO $pdo): void
{
    static $migrated = false;

    if ($migrated) {
        return;
    }

    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?'
    );
    $stmt->execute(['personagens', 'dias_jogados']);

    if ((int) $stmt->fetchColumn() === 0) {
        $pdo->exec('ALTER TABLE personagens ADD COLUMN dias_jogados INT UNSIGNED NOT NULL DEFAULT 1 AFTER kills');
    }

    $columns = [
        'hunger' => 'ALTER TABLE personagens ADD COLUMN hunger INT UNSIGNED NOT NULL DEFAULT 20 AFTER hp',
        'pos_x' => 'ALTER TABLE personagens ADD COLUMN pos_x DOUBLE NULL DEFAULT NULL AFTER hunger',
        'pos_y' => 'ALTER TABLE personagens ADD COLUMN pos_y DOUBLE NULL DEFAULT NULL AFTER pos_x',
        'pos_z' => 'ALTER TABLE personagens ADD COLUMN pos_z DOUBLE NULL DEFAULT NULL AFTER pos_y',
        'yaw' => 'ALTER TABLE personagens ADD COLUMN yaw DOUBLE NOT NULL DEFAULT 0 AFTER pos_z',
        'pitch' => 'ALTER TABLE personagens ADD COLUMN pitch DOUBLE NOT NULL DEFAULT 0 AFTER yaw',
        'inventory_json' => 'ALTER TABLE personagens ADD COLUMN inventory_json JSON NULL DEFAULT NULL AFTER pitch',
        'hotbar' => 'ALTER TABLE personagens ADD COLUMN hotbar TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER inventory_json',
        'skin_id' => "ALTER TABLE personagens ADD COLUMN skin_id VARCHAR(20) NOT NULL DEFAULT 'security' AFTER hotbar",
    ];

    foreach ($columns as $column => $sql) {
        $stmt->execute(['personagens', $column]);
        if ((int) $stmt->fetchColumn() === 0) {
            $pdo->exec($sql);
        }
    }

    $migrated = true;
}
