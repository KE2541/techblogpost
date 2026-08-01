<?php
header('Content-Type: text/html; charset=utf-8');
$root = dirname(__FILE__);
$config = '<?php
define(\'DB_HOST\', \'sql209.infinityfree.com\');
define(\'DB_PORT\', \'3306\');
define(\'DB_USER\', \'if0_42344574\');
define(\'DB_PASS\', \'Thurwa202612\');
define(\'DB_NAME\', \'if0_42344574_techblogs\');

function getDB() {
  static $pdo = null;
  if ($pdo === null) {
    try {
      $pdo = new PDO("mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => true
      ]);
    } catch (PDOException $e) {
      http_response_code(500);
      echo json_encode([\'error\' => \'Database connection failed: \' . $e->getMessage()]);
      exit;
    }
  }
  return $pdo;
}';
$ok = file_put_contents("$root/config.php", $config);
echo "<pre>";
echo $ok !== false ? "[OK ($ok bytes)] root/config.php fixed" : "[FAILED] root/config.php";
echo "\n\n";
echo "Now visit: <a href='/?i=1'>https://techieblogs.freedev.app/?i=1</a>";
echo "\nThen delete update.php and fix.php from the server.";
echo "</pre>";
