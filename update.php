<?php
header('Content-Type: text/html; charset=utf-8');
$results = [];
$root = dirname(__FILE__);

function writeFile($path, $content) {
  $dir = dirname($path);
  if (!is_dir($dir)) @mkdir($dir, 0755, true);
  $ok = file_put_contents($path, $content);
  return $ok !== false ? "OK ($ok bytes)" : "FAILED (check permissions)";
}

// 1. public/config.php
$configPhp = '<?php
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
$results['public/config.php'] = writeFile("$root/public/config.php", $configPhp);

// 2. public/js/api.js
$apiJs = <<<'JSEOF'
const IS_NETLIFY = window.location.hostname.includes('netlify.app');
const API_BASE = IS_NETLIFY
  ? '/.netlify/functions/api?route='
  : '/api.php?route=';

let backendAvailable = true;

const api = {
  _adminToken: sessionStorage.getItem('adminToken') || null,

  setAdminToken(token) {
    this._adminToken = token;
    if (token) sessionStorage.setItem('adminToken', token);
    else sessionStorage.removeItem('adminToken');
  },

  _getAuthHeaders() {
    if (this._adminToken) {
      return { 'Authorization': 'Bearer ' + this._adminToken };
    }
    return {};
  },

  async request(path, options = {}) {
    if (!backendAvailable) {
      throw new Error('backend_offline');
    }
    const [routePath, qs] = path.includes('?') ? path.split('?') : [path, ''];
    let url = `${API_BASE}${routePath}`;
    if (qs) url += `&${qs}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...this._getAuthHeaders(),
        ...(options.headers || {})
      },
      ...options
    };
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }
    try {
      const res = await fetch(url, config);
      if (res.status === 401) {
        this.setAdminToken(null);
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('unauthorized');
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
      }
      const text = await res.text();
      if (!text || text.startsWith('<')) {
        backendAvailable = false;
        throw new Error('backend_offline');
      }
      return JSON.parse(text);
    } catch (e) {
      if (e.message === 'backend_offline') throw e;
      if (e.message === 'unauthorized') throw e;
      if (e.name === 'TypeError' || e.name === 'SyntaxError') {
        backendAvailable = false;
      }
      throw e;
    }
  },

  adminLogin(username, password) {
    return this.request('/admin/login', { method: 'POST', body: { username, password } });
  },
  adminVerify() { return this.request('/admin/verify'); },
  getEvents() { return this.request('/events'); },
  getPosts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/posts${q ? `?${q}` : ''}`);
  },
  getPostsPaginated(params = {}) {
    const q = new URLSearchParams({ ...params, limit: params.limit || '6' }).toString();
    return this.request(`/posts${q ? `?${q}` : ''}`);
  },
  getPost(id) { return this.request(`/posts/${id}`); },
  createPost(data) { return this.request('/posts', { method: 'POST', body: data }); },
  updatePost(id, data) { return this.request(`/posts/${id}`, { method: 'PUT', body: data }); },
  deletePost(id) { return this.request(`/posts/${id}`, { method: 'DELETE' }); },
  likePost(id) { return this.request(`/posts/${id}/like`, { method: 'POST' }); },
  dislikePost(id) { return this.request(`/posts/${id}/dislike`, { method: 'POST' }); },
  ratePost(id, rating) { return this.request(`/posts/${id}/rate`, { method: 'POST', body: { rating } }); },
  getComments(postId) { return this.request(`/posts/${postId}/comments`); },
  addComment(postId, data) { return this.request(`/posts/${postId}/comments`, { method: 'POST', body: data }); },
  addEmoji(postId, commentId, emoji) { return this.request(`/posts/${postId}/comments/${commentId}/emoji`, { method: 'POST', body: { emoji } }); },
  likeComment(postId, commentId) { return this.request(`/posts/${postId}/comments/${commentId}/like`, { method: 'POST' }); },
  dislikeComment(postId, commentId) { return this.request(`/posts/${postId}/comments/${commentId}/dislike`, { method: 'POST' }); },
  uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/uploads/image', { method: 'POST', headers: {}, body: formData });
  },
  uploadVideo(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/uploads/video', { method: 'POST', headers: {}, body: formData });
  },
  getAnalytics() { return this.request('/analytics'); },
  subscribeNewsletter(email) { return this.request('/newsletter', { method: 'POST', body: { email } }); },
  getSubscribers() { return this.request('/newsletter'); },
  getAds() { return this.request('/ads'); },
  saveAds(config) { return this.request('/ads', { method: 'POST', body: config }); }
};
JSEOF;
$results['public/js/api.js'] = writeFile("$root/public/js/api.js", $apiJs);

// 3. public/index.php - with /public/ base path fix
$indexPhp = '<?php
require_once __DIR__ . \'/config.php\';
$basePath = \'/public\';
$initialPosts = \'[]\';
$initialTotal = 0;
try {
  $pdo = getDB();
  $stmt = $pdo->prepare("SELECT * FROM posts WHERE published = 1 AND (scheduled_at IS NULL OR scheduled_at <= NOW()) ORDER BY created_at DESC LIMIT 6");
  $stmt->execute();
  $posts = $stmt->fetchAll();
  $countStmt = $pdo->query("SELECT COUNT(*) FROM posts WHERE published = 1 AND (scheduled_at IS NULL OR scheduled_at <= NOW())");
  $initialTotal = (int)$countStmt->fetchColumn();
  foreach ($posts as &$p) {
    $p[\'tags\'] = is_string($p[\'tags\']) ? json_decode($p[\'tags\'], true) : ($p[\'tags\'] ?? []);
    $p[\'comments\'] = [];
    $cStmt = $pdo->prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC");
    $cStmt->execute([$p[\'id\']]);
    $p[\'comments\'] = $cStmt->fetchAll();
    foreach ($p[\'comments\'] as &$c) {
      $c[\'emojis\'] = is_string($c[\'emojis\']) ? json_decode($c[\'emojis\'], true) : ($c[\'emojis\'] ?? []);
    }
    unset($c);
  }
  unset($p);
  $initialPosts = json_encode($posts, JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {}
?>
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="TechBlog - Exploring the Future of Technology with AI, ML, Cloud Computing, and breakthrough innovations.">
  <meta name="keywords" content="technology, AI, machine learning, cloud computing, deep learning, LLM, ICT">
  <meta name="author" content="TechBlog">
  <meta property="og:title" content="TechBlog - Technology Trends Shaping the Digital Future">
  <meta property="og:description" content="Stay ahead with the latest in AI, Machine Learning, Cloud Computing, and breakthrough technologies shaping tomorrow.">
  <meta property="og:type" content="website">
  <title>TechBlog - Exploring the Future of Technology</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <link rel="stylesheet" href="<?php echo $basePath; ?>/css/style.css">
  <script>
    window.__INITIAL_POSTS__ = <?php echo $initialPosts; ?>;
    window.__INITIAL_TOTAL__ = <?php echo $initialTotal; ?>;
  </script>
</head>
<body>
  <header class="header">
    <div class="container">
      <nav class="navbar">
        <a href="#" class="logo" onclick="navigate(\'home\');return false;"><i class="fas fa-brain"></i> TechBlog</a>
        <div class="nav-links" id="navLinks">
          <a href="#" onclick="navigate(\'home\');return false;" class="active">Home</a>
          <div class="nav-dropdown">
            <a href="#" class="dropdown-toggle" onclick="return false;">Categories <i class="fas fa-chevron-down"></i></a>
            <div class="dropdown-menu">
              <a href="#" onclick="filterByCategory(\'AI\');return false;">AI</a>
              <a href="#" onclick="filterByCategory(\'ML\');return false;">ML</a>
              <a href="#" onclick="filterByCategory(\'LLM\');return false;">LLM</a>
              <a href="#" onclick="filterByCategory(\'Cloud\');return false;">Cloud</a>
              <a href="#" onclick="filterByCategory(\'Deep Learning\');return false;">Deep Learning</a>
              <a href="#" onclick="filterByCategory(\'ICT\');return false;">ICT</a>
            </div>
          </div>
          <a href="#" onclick="renderAbout(document.getElementById(\'pageContent\'));return false;">About</a>
        </div>
        <div class="nav-actions">
          <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
            <i class="fas fa-moon"></i>
          </button>
          <button class="menu-toggle" onclick="toggleMenu()" aria-label="Toggle menu">
            <i class="fas fa-bars"></i>
          </button>
        </div>
      </nav>
    </div>
    <div class="ad-slot" id="adHeader"></div>
  </header>
  <div class="container">
    <div class="main-layout">
      <div class="main-content-area">
        <div class="main-content" id="pageContent">
          <div class="loading"><i class="fas fa-spinner spinner"></i><p>Loading...</p></div>
        </div>
      </div>
      <aside class="sidebar-content">
        <div class="sidebar-ad ad-slot" id="adSidebar"><div class="ad-placeholder small">Advertisement</div></div>
      </aside>
    </div>
  </div>
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <h4><i class="fas fa-brain"></i> TechBlog</h4>
          <p>Exploring the latest trends in AI, Machine Learning, Cloud Computing, and breakthrough technologies shaping the digital future.</p>
          <div class="social-links">
            <a href="#" title="Twitter"><i class="fab fa-twitter"></i></a>
            <a href="#" title="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
            <a href="#" title="GitHub"><i class="fab fa-github"></i></a>
            <a href="#" title="YouTube"><i class="fab fa-youtube"></i></a>
          </div>
        </div>
        <div class="footer-col">
          <h4><i class="fas fa-folder"></i> Categories</h4>
          <ul>
            <li><a href="#" onclick="filterByCategory(\'AI\');return false;">Artificial Intelligence</a></li>
            <li><a href="#" onclick="filterByCategory(\'ML\');return false;">Machine Learning</a></li>
            <li><a href="#" onclick="filterByCategory(\'LLM\');return false;">Large Language Models</a></li>
            <li><a href="#" onclick="filterByCategory(\'Cloud\');return false;">Cloud Computing</a></li>
            <li><a href="#" onclick="filterByCategory(\'Deep Learning\');return false;">Deep Learning</a></li>
            <li><a href="#" onclick="filterByCategory(\'ICT\');return false;">ICT</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4><i class="fas fa-envelope"></i> Stay Connected</h4>
          <p>Subscribe to our newsletter for the latest technology insights and blog updates.</p>
          <form class="newsletter-form" onsubmit="subscribeNewsletter(event)">
            <input type="email" placeholder="Enter your email" required>
            <button type="submit"><i class="fas fa-paper-plane"></i></button>
          </form>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 TechBlog. All rights reserved.</span>
        <span>Made with <i class="fas fa-heart" style="color:var(--danger);"></i> for tech enthusiasts</span>
      </div>
    </div>
    <div class="ad-slot" id="adFooter"></div>
  </footer>
  <button class="scroll-top" id="scrollTop" title="Scroll to top">
    <i class="fas fa-arrow-up"></i>
  </button>
  <script src="<?php echo $basePath; ?>/js/api.js"></script>
  <script src="<?php echo $basePath; ?>/js/main.js"></script>
</body>
</html>';
$results['public/index.php'] = writeFile("$root/public/index.php", $indexPhp);

// 4. public/api.php - add /events route
$apiPhpFile = "$root/public/api.php";
$apiPhp = @file_get_contents($apiPhpFile);
if ($apiPhp !== false && strpos($apiPhp, "'/events'") === false) {
  $eventsRoute = "\n  // === Events (sync) ===\n  if (\$route === '/events') {\n    if (\$method === 'GET') {\n      \$stmt = \$pdo->query(\"SELECT MAX(updated_at) as lastUpdate FROM posts\");\n      \$row = \$stmt->fetch();\n      json(['lastUpdate' => \$row ? strtotime(\$row['lastUpdate']) * 1000 : time() * 1000]);\n    }\n  }\n\n";
  $apiPhp = str_replace("  // === 404 ===", $eventsRoute . "  // === 404 ===", $apiPhp);
  $results['public/api.php'] = writeFile($apiPhpFile, $apiPhp) . " (events route added)";
} else {
  $results['public/api.php'] = ($apiPhp !== false && strpos($apiPhp, "'/events'") !== false) ? "ALREADY UPDATED" : "READ FAILED";
}

// 5. Root index.php proxy
$rootIndex = '<?php require_once __DIR__ . \'/public/index.php\';';
$results['root/index.php'] = writeFile("$root/index.php", $rootIndex);

// 6. Root api.php proxy
$rootApi = '<?php require_once __DIR__ . \'/public/api.php\';';
$results['root/api.php'] = writeFile("$root/api.php", $rootApi);
?>
<!DOCTYPE html>
<html>
<head><title>TechBlog Updater</title>
<style>
body{font-family:monospace;background:#0a0a1a;color:#e8e8f0;padding:40px;max-width:700px;margin:0 auto;}
h1{color:#6c5ce7;margin-bottom:30px;}
.ok{color:#00b894;} .fail{color:#e17055;} .skip{color:#fdcb6e;}
pre{background:#12122a;padding:16px;border-radius:8px;margin:8px 0;overflow-x:auto;}
a{color:#a29bfe;}
</style>
</head>
<body>
<h1>TechBlog Auto-Updater</h1>
<?php foreach ($results as $file => $status): ?>
<pre><span class="<?= strpos($status, 'OK') !== false ? 'ok' : (strpos($status, 'ALREADY') !== false ? 'skip' : 'fail') ?>">[<?= htmlspecialchars($status) ?>]</span> <?= htmlspecialchars($file) ?></pre>
<?php endforeach; ?>
<br>
<h2>Done!</h2>
<p><a href="/?i=1">Test Homepage (?i=1)</a></p>
<p><a href="/api.php?route=/posts&limit=100&page=1">Test API</a></p>
<p style="color:#e17055;margin-top:30px;"><strong>Delete this file (update.php) after confirming everything works!</strong></p>
</body>
</html>
