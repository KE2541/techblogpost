<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$result = ['status' => 'ok'];

// Test config.php
try {
    require_once __DIR__ . '/config.php';
    $result['config'] = 'loaded';
} catch (Exception $e) {
    $result['config'] = 'error: ' . $e->getMessage();
    echo json_encode($result);
    exit;
}

// Test DB connection
try {
    $pdo = getDB();
    $result['db'] = 'connected';
} catch (Exception $e) {
    $result['db'] = 'error: ' . $e->getMessage();
    echo json_encode($result);
    exit;
}

// Test posts table
try {
    $count = $pdo->query("SELECT COUNT(*) FROM posts")->fetchColumn();
    $result['posts_table'] = 'ok (' . $count . ' posts)';
} catch (Exception $e) {
    $result['posts_table'] = 'error: ' . $e->getMessage();
}

echo json_encode($result, JSON_PRETTY_PRINT);
