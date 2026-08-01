<?php
require_once __DIR__ . "/config.php";
$pdo = getDB();
$posts = [
  ["Future of AI in Healthcare", "Artificial Intelligence is revolutionizing healthcare with predictive diagnostics, personalized treatment plans, and robotic-assisted surgeries. AI algorithms can analyze medical images faster and more accurately than human radiologists, leading to earlier detection of diseases like cancer.", "AI"],
  ["Understanding Large Language Models", "Large Language Models like GPT, Claude, and Gemini are transforming how we interact with technology. These models understand context, generate human-like text, and assist with coding, writing, and research. The latest models can process millions of tokens and handle complex reasoning tasks.", "LLM"],
  ["Cloud Computing Trends 2026", "Cloud technology continues to evolve with serverless computing, edge computing, and multi-cloud strategies dominating the landscape. Organizations are adopting cloud-native architectures to improve scalability, reduce costs, and accelerate digital transformation initiatives.", "Cloud"],
];
$stmt = $pdo->prepare("INSERT IGNORE INTO posts (id, title, content, excerpt, category, published, created_at) VALUES (?, ?, ?, ?, ?, 1, NOW())");
foreach ($posts as $i => $p) {
  $id = "seed-" . ($i + 1);
  $stmt->execute([$id, $p[0], $p[1], mb_substr(strip_tags($p[1]), 0, 200), $p[2]]);
}
echo "Seeded " . count($posts) . " posts.\n";
