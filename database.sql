CREATE TABLE IF NOT EXISTS `posts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL,
  `content` LONGTEXT,
  `excerpt` TEXT,
  `category` VARCHAR(100) DEFAULT 'AI',
  `tags` JSON DEFAULT (JSON_ARRAY()),
  `cover_image` VARCHAR(500) DEFAULT '',
  `video_url` VARCHAR(500) DEFAULT '',
  `author` VARCHAR(200) DEFAULT 'Admin',
  `published` TINYINT(1) DEFAULT 1,
  `scheduled_at` DATETIME DEFAULT NULL,
  `likes` INT DEFAULT 0,
  `dislikes` INT DEFAULT 0,
  `rating` DECIMAL(3,2) DEFAULT 0.00,
  `rating_count` INT DEFAULT 0,
  `views` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `comments` (
  `id` VARCHAR(36) PRIMARY KEY,
  `post_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(200) DEFAULT 'Anonymous',
  `email` VARCHAR(200) DEFAULT '',
  `content` TEXT NOT NULL,
  `likes` INT DEFAULT 0,
  `dislikes` INT DEFAULT 0,
  `emojis` JSON DEFAULT (JSON_ARRAY()),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `subscribers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(200) NOT NULL UNIQUE,
  `subscribed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ads_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slot_name` VARCHAR(100) NOT NULL UNIQUE,
  `code` TEXT,
  `active` TINYINT(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `ads_config` (`slot_name`, `code`, `active`) VALUES
('header', '', 0),
('sidebar', '', 0),
('inline', '', 0),
('footer', '', 0),
('popup', '', 0);

CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `token` VARCHAR(36) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `posts` (`id`, `title`, `content`, `excerpt`, `category`, `tags`, `cover_image`, `video_url`, `author`, `published`, `likes`, `dislikes`, `rating`, `rating_count`, `views`, `created_at`, `updated_at`) VALUES
('seed-1', 'The Rise of Generative AI: Transforming Content Creation', '<p>Generative AI is reshaping how we create content, from text and images to music and video. Discover how these technologies are changing creative workflows.</p><p>Generative AI refers to deep learning models that can generate new content based on training data. These models have become increasingly sophisticated, capable of producing human-like text, photorealistic images, and even music compositions.</p><p>The impact on creative industries has been profound. Writers use AI to overcome writer''s block and generate draft content. Designers use AI image generators to rapidly prototype visual concepts. Musicians collaborate with AI to explore new musical styles.</p><p>However, generative AI also raises important questions about authorship, copyright, and the nature of creativity. As these tools become more accessible, society must grapple with these challenges while embracing the creative possibilities they offer.</p>', 'Generative AI is reshaping how we create content, from text and images to music and video. Discover how these technologies are changing creative workflows.', 'AI', '["generative-ai", "content-creation", "deep-learning"]', '', '', 'TechBlog Editor', 1, 245, 5, 4.50, 42, 1580, '2026-06-01 08:00:00', '2026-06-01 08:00:00'),
('seed-2', 'Machine Learning in Healthcare: Revolutionizing Patient Care', '<p>ML algorithms are improving diagnosis accuracy, personalizing treatment plans, and accelerating drug discovery. Explore the impact on modern medicine.</p><p>Machine learning has found numerous applications in healthcare, from analyzing medical images to predicting patient outcomes. Deep learning models can detect anomalies in X-rays, MRIs, and CT scans with accuracy that rivals or exceeds human radiologists.</p><p>Personalized medicine is another area where ML shines. By analyzing a patient''s genetic data, lifestyle factors, and medical history, ML algorithms can recommend tailored treatment plans that are more effective than one-size-fits-all approaches.</p><p>Drug discovery has been dramatically accelerated by ML models that can predict molecular interactions and identify promising drug candidates in weeks rather than years. This was particularly evident during the COVID-19 pandemic, where ML helped accelerate vaccine development.</p>', 'ML algorithms are improving diagnosis accuracy, personalizing treatment plans, and accelerating drug discovery. Explore the impact on modern medicine.', 'ML', '["healthcare", "medical-ai", "diagnosis"]', '', '', 'TechBlog Editor', 1, 189, 3, 4.20, 35, 1240, '2026-05-28 10:00:00', '2026-05-28 10:00:00'),
('seed-3', 'Understanding Large Language Models: GPT, Claude, and Beyond', '<p>LLMs have become central to modern AI applications. This guide explains how they work and what they mean for the future of computing.</p><p>Large Language Models (LLMs) are neural networks trained on vast amounts of text data, enabling them to understand and generate human-like text. Models like GPT-4, Claude, and Gemini have demonstrated remarkable abilities in reasoning, translation, summarization, and creative writing.</p><p>These models use the transformer architecture, which allows them to process and generate text by attending to different parts of the input sequence. The ''large'' in LLM refers to the billions of parameters these models contain, which enable them to capture complex patterns in language.</p><p>Applications of LLMs range from chatbots and virtual assistants to code generation, content creation, and scientific research. As these models continue to improve, they are expected to become integral to how we interact with computers and access information.</p>', 'LLMs have become central to modern AI applications. This guide explains how they work and what they mean for the future of computing.', 'LLM', '["llm", "gpt", "transformer", "nlp"]', '', '', 'TechBlog Editor', 1, 312, 8, 4.80, 67, 2100, '2026-05-25 14:00:00', '2026-05-25 14:00:00'),
('seed-4', 'Cloud Computing Trends 2026: What to Expect', '<p>From edge computing to multi-cloud strategies, the cloud landscape continues to evolve. Stay ahead with these key trends.</p><p>Cloud computing continues to evolve at a rapid pace. In 2026, several key trends are shaping the industry. Serverless computing has become mainstream, allowing developers to focus on code without managing infrastructure. Edge computing brings computation closer to data sources, reducing latency for real-time applications.</p><p>Multi-cloud and hybrid cloud strategies are now the norm, with organizations distributing workloads across multiple providers to avoid vendor lock-in and optimize costs. AI and ML services are increasingly integrated into cloud platforms, making advanced analytics accessible to all businesses.</p><p>Sustainability has also become a major focus, with cloud providers investing in renewable energy and efficient data center designs. The cloud is not just a technology platform but a driver of digital transformation across every industry.</p>', 'From edge computing to multi-cloud strategies, the cloud landscape continues to evolve. Stay ahead with these key trends.', 'Cloud', '["cloud-computing", "edge-computing", "serverless", "multi-cloud"]', '', '', 'TechBlog Editor', 1, 167, 2, 4.00, 28, 980, '2026-05-22 09:00:00', '2026-05-22 09:00:00'),
('seed-5', 'Deep Learning Breakthroughs in Computer Vision', '<p>Recent advances in deep learning are pushing the boundaries of what machines can see and understand. A look at the latest innovations.</p><p>Computer vision has made remarkable progress thanks to deep learning. Convolutional neural networks (CNNs) have been the backbone of image recognition for years, but new architectures like vision transformers (ViTs) are challenging their dominance.</p><p>Self-supervised learning has emerged as a powerful paradigm, allowing models to learn visual representations from unlabeled data. This reduces the need for expensive manually labeled datasets and enables AI systems to learn from the vast amount of visual data available on the internet.</p><p>Applications include autonomous vehicles that can navigate complex environments, medical imaging systems that detect diseases with superhuman accuracy, and augmented reality systems that understand and interact with the physical world in real-time.</p>', 'Recent advances in deep learning are pushing the boundaries of what machines can see and understand. A look at the latest innovations.', 'Deep Learning', '["computer-vision", "deep-learning", "cnn", "transformer"]', '', '', 'TechBlog Editor', 1, 203, 4, 4.60, 51, 1450, '2026-05-19 11:00:00', '2026-05-19 11:00:00'),
('seed-6', 'ICT Infrastructure for Smart Cities', '<p>Information and Communication Technology forms the backbone of smart city initiatives worldwide. Learn about the technologies powering urban innovation.</p><p>Smart cities leverage ICT to improve efficiency, sustainability, and quality of life for residents. Key technologies include IoT sensors that monitor air quality, traffic flow, and energy usage; 5G networks that provide high-speed connectivity; and AI systems that analyze data to optimize city operations.</p><p>Digital twins - virtual replicas of physical infrastructure - allow city planners to simulate scenarios and make data-driven decisions. Smart grids optimize energy distribution, while intelligent transportation systems reduce congestion and emissions.</p><p>Challenges include ensuring data privacy, bridging the digital divide, and creating interoperable systems. Despite these challenges, smart city initiatives continue to grow, driven by urbanization and the need for sustainable development.</p>', 'Information and Communication Technology forms the backbone of smart city initiatives worldwide. Learn about the technologies powering urban innovation.', 'ICT', '["smart-cities", "iot", "5g", "digital-twin"]', '', '', 'TechBlog Editor', 1, 98, 1, 3.90, 19, 720, '2026-05-16 07:00:00', '2026-05-16 07:00:00');

INSERT INTO `comments` (`id`, `post_id`, `name`, `email`, `content`, `likes`, `dislikes`, `emojis`, `created_at`) VALUES
('c-seed-1', 'seed-1', 'Alex', 'alex@example.com', 'Great article! Generative AI is truly transforming the creative landscape.', 12, 1, '[{"emoji": "🔥", "createdAt": "2026-06-01T10:00:00Z"}]', '2026-06-01 09:00:00');
