<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$route = isset($_GET['route']) ? '/' . trim($_GET['route'], '/') : '/';
$input = json_decode(file_get_contents('php://input'), true) ?: [];

$segments = array_values(array_filter(explode('/', $route)));
$pdo = getDB();

function uuid() {
  return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
    mt_rand(0, 0xffff), mt_rand(0, 0xffff),
    mt_rand(0, 0xffff),
    mt_rand(0, 0x0fff) | 0x4000,
    mt_rand(0, 0x3fff) | 0x8000,
    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
  );
}

function json($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function error($msg, $code = 400) {
  json(['error' => $msg], $code);
}

function stripHtml($html) {
  return mb_substr(strip_tags($html), 0, 200);
}

function mapPost($p) {
  if (!$p) return $p;
  $p['coverImage'] = $p['cover_image'] ?? '';
  $p['videoUrl'] = $p['video_url'] ?? '';
  $p['scheduledAt'] = $p['scheduled_at'] ?? null;
  $p['createdAt'] = $p['created_at'] ?? '';
  $p['updatedAt'] = $p['updated_at'] ?? '';
  $p['ratingCount'] = (int)($p['rating_count'] ?? 0);
  $p['rating'] = (float)($p['rating'] ?? 0);
  $p['likes'] = (int)($p['likes'] ?? 0);
  $p['dislikes'] = (int)($p['dislikes'] ?? 0);
  $p['views'] = (int)($p['views'] ?? 0);
  $p['published'] = (bool)($p['published'] ?? false);
  $p['tags'] = is_string($p['tags']) ? json_decode($p['tags'], true) : ($p['tags'] ?? []);
  unset($p['cover_image'], $p['video_url'], $p['scheduled_at'], $p['created_at'], $p['updated_at'], $p['rating_count']);
  return $p;
}

function mapComment($c) {
  if (!$c) return $c;
  $c['createdAt'] = $c['created_at'] ?? '';
  $c['emojis'] = is_string($c['emojis']) ? json_decode($c['emojis'], true) : ($c['emojis'] ?? []);
  $c['likes'] = (int)($c['likes'] ?? 0);
  $c['dislikes'] = (int)($c['dislikes'] ?? 0);
  unset($c['created_at'], $c['post_id']);
  return $c;
}

function mapPostsArray($posts) {
  return array_map('mapPost', $posts);
}

try {
  // === POSTS ===
  if ($route === '/posts' || $route === '/') {
    if ($method === 'GET') {
      $category = $_GET['category'] ?? null;
      $search = $_GET['search'] ?? null;
      $sort = $_GET['sort'] ?? 'newest';
      $page = max(1, (int)($_GET['page'] ?? 1));
      $limit = (int)($_GET['limit'] ?? 0);
      $admin = ($_GET['admin'] ?? '') === 'true';

      $where = [];
      $params = [];

      if (!$admin) {
        $where[] = "published = 1 AND (scheduled_at IS NULL OR scheduled_at <= NOW())";
      }

      if ($category) {
        $where[] = "category = ?";
        $params[] = $category;
      }

      if ($search) {
        $where[] = "(title LIKE ? OR content LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
      }

      $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

      $order = "created_at DESC";
      if ($sort === 'popular') $order = "likes DESC";
      else if ($sort === 'oldest') $order = "created_at ASC";

      $countStmt = $pdo->prepare("SELECT COUNT(*) FROM posts $whereClause");
      $countStmt->execute($params);
      $total = (int)$countStmt->fetchColumn();

      if ($limit > 0) {
        $offset = ($page - 1) * $limit;
        $stmt = $pdo->prepare("SELECT * FROM posts $whereClause ORDER BY $order LIMIT $limit OFFSET $offset");
      } else {
        $stmt = $pdo->prepare("SELECT * FROM posts $whereClause ORDER BY $order");
      }
      $stmt->execute($params);
      $posts = mapPostsArray($stmt->fetchAll());

      if ($limit > 0) {
        json(['posts' => $posts, 'total' => $total, 'page' => $page, 'totalPages' => max(1, (int)ceil($total / $limit))]);
      } else {
        json($posts);
      }
    }

    if ($method === 'POST') {
      $id = uuid();
      $title = $input['title'] ?? 'Untitled';
      $content = $input['content'] ?? '';
      $excerpt = $input['excerpt'] ?? stripHtml($content);
      $category = $input['category'] ?? 'AI';
      $tags = json_encode($input['tags'] ?? [], JSON_UNESCAPED_UNICODE);
      $coverImage = $input['coverImage'] ?? '';
      $videoUrl = $input['videoUrl'] ?? '';
      $author = $input['author'] ?? 'Admin';
      $published = isset($input['published']) ? ($input['published'] ? 1 : 0) : 1;
      $scheduledAt = $input['scheduledAt'] ?? null;

      $stmt = $pdo->prepare("INSERT INTO posts (id, title, content, excerpt, category, tags, cover_image, video_url, author, published, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      $stmt->execute([$id, $title, $content, $excerpt, $category, $tags, $coverImage, $videoUrl, $author, $published, $scheduledAt]);

      $stmt = $pdo->prepare("SELECT * FROM posts WHERE id = ?");
      $stmt->execute([$id]);
      json(mapPost($stmt->fetch()), 201);
    }
  }

  // === Single Post by ID ===
  if (preg_match('#^/posts/([a-f0-9\-]+)$#', $route, $m)) {
    $postId = $m[1];

    if ($method === 'GET') {
      $stmt = $pdo->prepare("SELECT * FROM posts WHERE id = ?");
      $stmt->execute([$postId]);
      $post = $stmt->fetch();
      if (!$post) error('Post not found', 404);

      // increment views
      $pdo->prepare("UPDATE posts SET views = views + 1 WHERE id = ?")->execute([$postId]);
      $post['views']++;

      $post = mapPost($post);

      // load comments
      $cStmt = $pdo->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC");
      $cStmt->execute([$postId]);
      $comments = array_map('mapComment', $cStmt->fetchAll());
      $post['comments'] = $comments;

      json($post);
    }

    if ($method === 'PUT') {
      $fields = [];
      $params = [];
      $allowed = ['title', 'content', 'excerpt', 'category', 'tags', 'cover_image', 'video_url', 'author', 'published', 'scheduled_at'];
      $map = [
        'coverImage' => 'cover_image', 'videoUrl' => 'video_url', 'scheduledAt' => 'scheduled_at'
      ];

      foreach ($input as $key => $value) {
        $col = $map[$key] ?? $key;
        if (in_array($col, $allowed)) {
          $val = $col === 'tags' ? json_encode($value, JSON_UNESCAPED_UNICODE) : $value;
          $fields[] = "$col = ?";
          $params[] = $val;
        }
      }

      if (empty($fields)) error('No fields to update');
      $params[] = $postId;

      $stmt = $pdo->prepare("UPDATE posts SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?");
      $stmt->execute($params);

      $stmt = $pdo->prepare("SELECT * FROM posts WHERE id = ?");
      $stmt->execute([$postId]);
      $post = $stmt->fetch();
      if (!$post) error('Post not found', 404);
      json(mapPost($post));
    }

    if ($method === 'DELETE') {
      $stmt = $pdo->prepare("DELETE FROM posts WHERE id = ?");
      $stmt->execute([$postId]);
      if ($stmt->rowCount() === 0) error('Post not found', 404);
      json(['message' => 'Post deleted']);
    }
  }

  // === Post Like ===
  if (preg_match('#^/posts/([a-f0-9\-]+)/like$#', $route, $m)) {
    if ($method === 'POST') {
      $stmt = $pdo->prepare("UPDATE posts SET likes = likes + 1 WHERE id = ?");
      $stmt->execute([$m[1]]);
      if ($stmt->rowCount() === 0) error('Post not found', 404);
      $stmt = $pdo->prepare("SELECT likes, dislikes FROM posts WHERE id = ?");
      $stmt->execute([$m[1]]);
      json($stmt->fetch());
    }
  }

  // === Post Dislike ===
  if (preg_match('#^/posts/([a-f0-9\-]+)/dislike$#', $route, $m)) {
    if ($method === 'POST') {
      $stmt = $pdo->prepare("UPDATE posts SET dislikes = dislikes + 1 WHERE id = ?");
      $stmt->execute([$m[1]]);
      if ($stmt->rowCount() === 0) error('Post not found', 404);
      $stmt = $pdo->prepare("SELECT likes, dislikes FROM posts WHERE id = ?");
      $stmt->execute([$m[1]]);
      json($stmt->fetch());
    }
  }

  // === Post Rating ===
  if (preg_match('#^/posts/([a-f0-9\-]+)/rate$#', $route, $m)) {
    if ($method === 'POST') {
      $rating = $input['rating'] ?? 0;
      if ($rating < 1 || $rating > 5) error('Rating must be 1-5');
      $stmt = $pdo->prepare("SELECT rating, rating_count FROM posts WHERE id = ?");
      $stmt->execute([$m[1]]);
      $post = $stmt->fetch();
      if (!$post) error('Post not found', 404);

      $total = ($post['rating'] * $post['rating_count']) + $rating;
      $newCount = $post['rating_count'] + 1;
      $newRating = $total / $newCount;

      $pdo->prepare("UPDATE posts SET rating = ?, rating_count = ? WHERE id = ?")->execute([$newRating, $newCount, $m[1]]);
      json(['rating' => round($newRating, 2), 'ratingCount' => $newCount]);
    }
  }

  // === Comments ===
  if (preg_match('#^/posts/([a-f0-9\-]+)/comments$#', $route, $m)) {
    $postId = $m[1];

    if ($method === 'GET') {
      $stmt = $pdo->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC");
      $stmt->execute([$postId]);
      json(array_map('mapComment', $stmt->fetchAll()));
    }

    if ($method === 'POST') {
      $content = trim($input['content'] ?? '');
      if (!$content) error('Comment cannot be empty');
      if (str_word_count($content) > 200) error('Comment exceeds 200 words');

      $cid = uuid();
      $name = $input['name'] ?? 'Anonymous';
      $email = $input['email'] ?? '';

      $stmt = $pdo->prepare("INSERT INTO comments (id, post_id, name, email, content) VALUES (?, ?, ?, ?, ?)");
      $stmt->execute([$cid, $postId, $name, $email, $content]);

      $stmt = $pdo->prepare("SELECT * FROM comments WHERE id = ?");
      $stmt->execute([$cid]);
      json(mapComment($stmt->fetch()), 201);
    }
  }

  // === Comment Emoji ===
  if (preg_match('#^/posts/([a-f0-9\-]+)/comments/([a-f0-9\-]+)/emoji$#', $route, $m)) {
    if ($method === 'POST') {
      $emoji = $input['emoji'] ?? '';
      if (!$emoji) error('Emoji required');

      $stmt = $pdo->prepare("SELECT * FROM comments WHERE id = ? AND post_id = ?");
      $stmt->execute([$m[2], $m[1]]);
      $comment = $stmt->fetch();
      if (!$comment) error('Comment not found', 404);

      $emojis = json_decode($comment['emojis'] ?? '[]', true);
      $emojis[] = ['emoji' => $emoji, 'createdAt' => date('c')];
      $pdo->prepare("UPDATE comments SET emojis = ? WHERE id = ?")->execute([json_encode($emojis, JSON_UNESCAPED_UNICODE), $m[2]]);

      $comment['emojis'] = $emojis;
      json(mapComment($comment));
    }
  }

  // === Comment Like ===
  if (preg_match('#^/posts/([a-f0-9\-]+)/comments/([a-f0-9\-]+)/like$#', $route, $m)) {
    if ($method === 'POST') {
      $stmt = $pdo->prepare("UPDATE comments SET likes = likes + 1 WHERE id = ? AND post_id = ?");
      $stmt->execute([$m[2], $m[1]]);
      if ($stmt->rowCount() === 0) error('Comment not found', 404);
      $stmt = $pdo->prepare("SELECT * FROM comments WHERE id = ?");
      $stmt->execute([$m[2]]);
      json(mapComment($stmt->fetch()));
    }
  }

  // === Comment Dislike ===
  if (preg_match('#^/posts/([a-f0-9\-]+)/comments/([a-f0-9\-]+)/dislike$#', $route, $m)) {
    if ($method === 'POST') {
      $stmt = $pdo->prepare("UPDATE comments SET dislikes = dislikes + 1 WHERE id = ? AND post_id = ?");
      $stmt->execute([$m[2], $m[1]]);
      if ($stmt->rowCount() === 0) error('Comment not found', 404);
      $stmt = $pdo->prepare("SELECT * FROM comments WHERE id = ?");
      $stmt->execute([$m[2]]);
      json(mapComment($stmt->fetch()));
    }
  }

  // === Analytics ===
  if ($route === '/analytics') {
    if ($method === 'GET') {
      $totalPosts = $pdo->query("SELECT COUNT(*) FROM posts")->fetchColumn();
      $totalViews = $pdo->query("SELECT COALESCE(SUM(views), 0) FROM posts")->fetchColumn();
      $totalLikes = $pdo->query("SELECT COALESCE(SUM(likes), 0) FROM posts")->fetchColumn();
      $totalComments = $pdo->query("SELECT COUNT(*) FROM comments")->fetchColumn();
      json(['totalViews' => (int)$totalViews, 'totalLikes' => (int)$totalLikes, 'totalComments' => (int)$totalComments, 'totalPosts' => (int)$totalPosts]);
    }
  }

  // === Newsletter ===
  if ($route === '/newsletter') {
    if ($method === 'POST') {
      $email = $input['email'] ?? '';
      if (!$email) error('Email is required');

      $stmt = $pdo->prepare("SELECT id FROM subscribers WHERE email = ?");
      $stmt->execute([$email]);
      if ($stmt->fetch()) {
        json(['message' => 'Already subscribed']);
      }

      $pdo->prepare("INSERT INTO subscribers (email) VALUES (?)")->execute([$email]);
      json(['message' => 'Subscribed successfully']);
    }

    if ($method === 'GET') {
      $stmt = $pdo->query("SELECT email, subscribed_at FROM subscribers WHERE active = 1 ORDER BY subscribed_at DESC");
      json($stmt->fetchAll());
    }
  }

  // === Ads ===
  if ($route === '/ads') {
    if ($method === 'GET') {
      $stmt = $pdo->query("SELECT slot_name, code, active FROM ads_config");
      $rows = $stmt->fetchAll();
      $ads = ['enabled' => true];
      foreach ($rows as $row) {
        $ads[$row['slot_name']] = ['code' => $row['code'] ?? '', 'active' => (bool)$row['active']];
      }
      json($ads);
    }

    if ($method === 'POST') {
      foreach ($input as $slot => $config) {
        if ($slot === 'enabled') continue;
        if (is_array($config)) {
          $stmt = $pdo->prepare("UPDATE ads_config SET code = ?, active = ? WHERE slot_name = ?");
          $stmt->execute([$config['code'] ?? '', ($config['active'] ? 1 : 0), $slot]);
        }
      }
      json(['message' => 'Ad config saved']);
    }
  }

  // === Upload Image ===
  if ($route === '/uploads/image') {
    if ($method === 'POST') {
      if (!isset($_FILES['file'])) error('No file uploaded');
      $file = $_FILES['file'];
      $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!in_array($file['type'], $allowed)) error('Only image files (jpg, png, gif, webp, svg) are allowed');

      $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
      $filename = uuid() . '.' . $ext;
      $uploadDir = __DIR__ . '/uploads/images';

      if (!is_dir($uploadDir)) mkdir($uploadDir, 0775, true);

      if (!move_uploaded_file($file['tmp_name'], "$uploadDir/$filename")) {
        error('Failed to save file', 500);
      }

      $url = 'uploads/images/' . $filename;
      json(['url' => $url, 'filename' => $filename]);
    }
  }

  // === Upload Video ===
  if ($route === '/uploads/video') {
    if ($method === 'POST') {
      if (!isset($_FILES['file'])) error('No file uploaded');
      $file = $_FILES['file'];
      $allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
      if (!in_array($file['type'], $allowed)) error('Only video files (mp4, webm, ogg, mov, avi) are allowed');

      $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
      $filename = uuid() . '.' . $ext;
      $uploadDir = __DIR__ . '/uploads/videos';

      if (!is_dir($uploadDir)) mkdir($uploadDir, 0775, true);

      if (!move_uploaded_file($file['tmp_name'], "$uploadDir/$filename")) {
        error('Failed to save file', 500);
      }

      $url = 'uploads/videos/' . $filename;
      json(['url' => $url, 'filename' => $filename]);
    }
  }

  // === Admin Login ===
  if ($route === '/admin/login') {
    if ($method === 'POST') {
      $username = $input['username'] ?? '';
      $password = $input['password'] ?? '';

      if (!$username || !$password) error('Username and password required');

      $stmt = $pdo->prepare("SELECT * FROM admins WHERE username = ?");
      $stmt->execute([$username]);
      $admin = $stmt->fetch();

      if (!$admin || !password_verify($password, $admin['password_hash'])) {
        error('Invalid username or password', 401);
      }

      $token = uuid();
      $pdo->prepare("UPDATE admins SET token = ? WHERE id = ?")->execute([$token, $admin['id']]);

      json(['token' => $token, 'username' => $admin['username']]);
    }
  }

  // === Admin Verify ===
  if ($route === '/admin/verify') {
    if ($method === 'GET') {
      $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
      if (!preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) error('Unauthorized', 401);

      $token = $m[1];
      $stmt = $pdo->prepare("SELECT id FROM admins WHERE token = ?");
      $stmt->execute([$token]);

      json(['valid' => (bool)$stmt->fetch()]);
    }
  }

  // === Admin reset stats ===
  if ($route === '/admin/reset-stats') {
    if ($method === 'POST') {
      $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
      $token = str_replace('Bearer ', '', $authHeader);
      if (!$token) error('Unauthorized', 401);
      $stmt = $pdo->prepare("SELECT id FROM admins WHERE token = ?");
      $stmt->execute([$token]);
      if (!$stmt->fetch()) error('Unauthorized', 401);

      $pdo->exec("UPDATE posts SET likes = 0, dislikes = 0, views = 0, rating = 0, rating_count = 0");
      $pdo->exec("DELETE FROM comments");
      json(['success' => true, 'message' => 'All stats reset to zero']);
    }
  }

  // === Events (sync) ===
  if ($route === '/events') {
    if ($method === 'GET') {
      $stmt = $pdo->query("SELECT MAX(updated_at) as lastUpdate FROM posts");
      $row = $stmt->fetch();
      json(['lastUpdate' => $row ? strtotime($row['lastUpdate']) * 1000 : time() * 1000]);
    }
  }

  // === 404 ===
  error('Route not found', 404);

} catch (PDOException $e) {
  error('Database error: ' . $e->getMessage(), 500);
} catch (Exception $e) {
  error('Server error: ' . $e->getMessage(), 500);
}
