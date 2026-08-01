<?php
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TechBlog Setup</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; background: #0a0a1a; color: #e8e8f0; }
    h1 { color: #6c5ce7; }
    .success { color: #00b894; } .error { color: #e17055; } .info { color: #a29bfe; }
    pre { background: #12122a; padding: 12px; border-radius: 8px; overflow-x: auto; }
    a { color: #a29bfe; }
    .step { margin: 20px 0; padding: 15px; background: #12122a; border-radius: 8px; border-left: 3px solid #6c5ce7; }
  </style>
</head>
<body>
<h1>TechBlog Setup</h1>
<?php
$host = 'sql209.infinityfree.com';
$user = 'if0_42344574';
$pass = 'Thurwa202612';
$dbname = 'if0_42344574_techblogs';

try {
  $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
  ]);

  echo '<div class="step"><h2>Step 1: Creating Tables</h2>';

  $pdo->exec("CREATE TABLE IF NOT EXISTS posts (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content LONGTEXT,
    excerpt TEXT,
    category VARCHAR(100) DEFAULT 'AI',
    tags TEXT DEFAULT '[]',
    cover_image VARCHAR(500) DEFAULT '',
    video_url VARCHAR(500) DEFAULT '',
    author VARCHAR(200) DEFAULT 'Admin',
    published TINYINT(1) DEFAULT 1,
    scheduled_at DATETIME DEFAULT NULL,
    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    views INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  echo '<p class="success">Posts table: OK</p>';

  $pdo->exec("CREATE TABLE IF NOT EXISTS comments (
    id VARCHAR(36) PRIMARY KEY,
    post_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) DEFAULT 'Anonymous',
    email VARCHAR(200) DEFAULT '',
    content TEXT NOT NULL,
    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0,
    emojis TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  echo '<p class="success">Comments table: OK</p>';

  $pdo->exec("CREATE TABLE IF NOT EXISTS subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(200) NOT NULL UNIQUE,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active TINYINT(1) DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  echo '<p class="success">Subscribers table: OK</p>';

  $pdo->exec("CREATE TABLE IF NOT EXISTS ads_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slot_name VARCHAR(100) NOT NULL UNIQUE,
    code TEXT,
    active TINYINT(1) DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  echo '<p class="success">Ads Config table: OK</p>';

  $pdo->exec("CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    token VARCHAR(36) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  echo '<p class="success">Admins table: OK</p>';
  echo '</div>';

  echo '<div class="step"><h2>Step 2: Seeding Ads Config</h2>';
  $pdo->exec("INSERT IGNORE INTO ads_config (slot_name, code, active) VALUES ('header', '', 0), ('sidebar', '', 0), ('inline', '', 0), ('footer', '', 0), ('popup', '', 0)");
  echo '<p class="success">Ads config seeded</p>';
  echo '</div>';

  echo '<div class="step"><h2>Step 3: Seeding Posts</h2>';
  $posts = [
    ["seed-1", "The Rise of Generative AI: Transforming Content Creation", "<p>Generative AI is reshaping how we create content, from text and images to music and video. Discover how these technologies are changing creative workflows.</p><p>Generative AI refers to deep learning models that can generate new content based on training data. These models have become increasingly sophisticated, capable of producing human-like text, photorealistic images, and even music compositions.</p><p>The impact on creative industries has been profound. Writers use AI to overcome writer's block and generate draft content. Designers use AI image generators to rapidly prototype visual concepts. Musicians collaborate with AI to explore new musical styles.</p><p>However, generative AI also raises important questions about authorship, copyright, and the nature of creativity. As these tools become more accessible, society must grapple with these challenges while embracing the creative possibilities they offer.</p>", "Generative AI is reshaping how we create content, from text and images to music and video. Discover how these technologies are changing creative workflows.", "AI", "generative-ai,content-creation,deep-learning", 245, 5, 4.50, 42, 1580, "2026-06-01 08:00:00"],
    ["seed-2", "Machine Learning in Healthcare: Revolutionizing Patient Care", "<p>ML algorithms are improving diagnosis accuracy, personalizing treatment plans, and accelerating drug discovery. Explore the impact on modern medicine.</p><p>Machine learning has found numerous applications in healthcare, from analyzing medical images to predicting patient outcomes. Deep learning models can detect anomalies in X-rays, MRIs, and CT scans with accuracy that rivals or exceeds human radiologists.</p><p>Personalized medicine is another area where ML shines. By analyzing a patient's genetic data, lifestyle factors, and medical history, ML algorithms can recommend tailored treatment plans that are more effective than one-size-fits-all approaches.</p><p>Drug discovery has been dramatically accelerated by ML models that can predict molecular interactions and identify promising drug candidates in weeks rather than years.</p>", "ML algorithms are improving diagnosis accuracy, personalizing treatment plans, and accelerating drug discovery. Explore the impact on modern medicine.", "ML", "healthcare,medical-ai,diagnosis", 189, 3, 4.20, 35, 1240, "2026-05-28 10:00:00"],
    ["seed-3", "Understanding Large Language Models: GPT, Claude, and Beyond", "<p>LLMs have become central to modern AI applications. This guide explains how they work and what they mean for the future of computing.</p><p>Large Language Models (LLMs) are neural networks trained on vast amounts of text data, enabling them to understand and generate human-like text. Models like GPT-4, Claude, and Gemini have demonstrated remarkable abilities in reasoning, translation, summarization, and creative writing.</p><p>These models use the transformer architecture, which allows them to process and generate text by attending to different parts of the input sequence.</p><p>Applications of LLMs range from chatbots and virtual assistants to code generation, content creation, and scientific research.</p>", "LLMs have become central to modern AI applications. This guide explains how they work and what they mean for the future of computing.", "LLM", "llm,gpt,transformer,nlp", 312, 8, 4.80, 67, 2100, "2026-05-25 14:00:00"],
    ["seed-4", "Cloud Computing Trends 2026: What to Expect", "<p>From edge computing to multi-cloud strategies, the cloud landscape continues to evolve. Stay ahead with these key trends.</p><p>Cloud computing continues to evolve at a rapid pace. In 2026, several key trends are shaping the industry. Serverless computing has become mainstream. Edge computing brings computation closer to data sources.</p><p>Multi-cloud and hybrid cloud strategies are now the norm. AI and ML services are increasingly integrated into cloud platforms.</p><p>Sustainability has also become a major focus, with cloud providers investing in renewable energy.</p>", "From edge computing to multi-cloud strategies, the cloud landscape continues to evolve. Stay ahead with these key trends.", "Cloud", "cloud-computing,edge-computing,serverless,multi-cloud", 167, 2, 4.00, 28, 980, "2026-05-22 09:00:00"],
    ["seed-5", "Deep Learning Breakthroughs in Computer Vision", "<p>Recent advances in deep learning are pushing the boundaries of what machines can see and understand. A look at the latest innovations.</p><p>Computer vision has made remarkable progress thanks to deep learning. Convolutional neural networks (CNNs) have been the backbone of image recognition for years, but new architectures like vision transformers (ViTs) are challenging their dominance.</p><p>Self-supervised learning has emerged as a powerful paradigm, allowing models to learn visual representations from unlabeled data.</p><p>Applications include autonomous vehicles, medical imaging systems, and augmented reality systems.</p>", "Recent advances in deep learning are pushing the boundaries of what machines can see and understand.", "Deep Learning", "computer-vision,deep-learning,cnn,transformer", 203, 4, 4.60, 51, 1450, "2026-05-19 11:00:00"],
    ["seed-6", "ICT Infrastructure for Smart Cities", "<p>Information and Communication Technology forms the backbone of smart city initiatives worldwide. Learn about the technologies powering urban innovation.</p><p>Smart cities leverage ICT to improve efficiency, sustainability, and quality of life for residents. Key technologies include IoT sensors, 5G networks, and AI systems.</p><p>Digital twins allow city planners to simulate scenarios and make data-driven decisions.</p><p>Challenges include ensuring data privacy, bridging the digital divide, and creating interoperable systems.</p>", "Information and Communication Technology forms the backbone of smart city initiatives worldwide.", "ICT", "smart-cities,iot,5g,digital-twin", 98, 1, 3.90, 19, 720, "2026-05-16 07:00:00"]
  ];

  $stmt = $pdo->prepare("INSERT IGNORE INTO posts (id, title, content, excerpt, category, tags, author, published, likes, dislikes, rating, rating_count, views, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'TechBlog Editor', 1, ?, ?, ?, ?, ?, ?, ?)");
  $count = 0;
  foreach ($posts as $p) {
    $tags = json_encode(explode(",", $p[5]));
    $stmt->execute([$p[0], $p[1], $p[2], $p[3], $p[4], $tags, $p[6], $p[7], $p[8], $p[9], $p[10], $p[11], $p[11]]);
    if ($stmt->rowCount() > 0) $count++;
  }
  echo "<p class=\"success\">$count posts inserted</p>";
  echo '</div>';

  echo '<div class="step"><h2>Step 4: Seeding Comments</h2>';
  $cStmt = $pdo->prepare("INSERT IGNORE INTO comments (id, post_id, name, email, content, likes, dislikes, emojis, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  $cStmt->execute(['c-seed-1', 'seed-1', 'Alex', 'alex@example.com', 'Great article! Generative AI is truly transforming the creative landscape.', 12, 1, '[{"emoji":"fire","createdAt":"2026-06-01T10:00:00Z"}]', '2026-06-01 09:00:00']);
  echo '<p class="success">Comments seeded</p>';
  echo '</div>';

  echo '<div class="step"><h2>Step 5: Creating Admin Account</h2>';
  $hash = password_hash('Thurw@202612', PASSWORD_DEFAULT);
  $pdo->prepare("INSERT IGNORE INTO admins (username, password_hash) VALUES (?, ?)")->execute(['KE2541', $hash]);
  echo '<p class="success">Admin account: KE2541 / Thurw@202612</p>';
  echo '</div>';

  echo '<div class="step">';
  echo '<h2 class="success">Setup Complete!</h2>';
  echo '<p><a href="index.php">Visit Homepage</a> | <a href="admin/index.html">Admin Panel</a> | <a href="test.php">Test Connection</a></p>';
  echo '<p class="info">You can delete this file after setup for security.</p>';
  echo '</div>';

} catch (PDOException $e) {
  echo '<p class="error">Setup failed: ' . htmlspecialchars($e->getMessage()) . '</p>';
}
?>
</body>
</html>
