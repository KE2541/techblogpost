<?php
require_once __DIR__ . '/config.php';
$pdo = getDB();
$pdo->exec("UPDATE posts SET likes = 0, dislikes = 0, views = 0, rating = 0, rating_count = 0");
$pdo->exec("DELETE FROM comments");
echo "Done. All posts reset to 0 likes/views/rating. All comments deleted.";
