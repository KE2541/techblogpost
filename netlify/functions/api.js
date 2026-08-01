const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = '/tmp/techblog-db.json';
const SEED_PATH = path.join(__dirname, 'seed.json');

const ADMIN_USER = process.env.ADMIN_USERNAME || 'KE2541';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Thurw@202612';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'techblog-secret-key-change-in-production';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

function uuid() {
  return crypto.randomUUID();
}

function getDB() {
  if (fs.existsSync(DB_PATH)) {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { }
  }
  if (fs.existsSync(SEED_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
      if (!data.posts) data.posts = [];
      if (!data.subscribers) data.subscribers = [];
      if (!data.adsConfig) data.adsConfig = [];
      fs.writeFileSync(DB_PATH, JSON.stringify(data));
      return data;
    } catch { }
  }
  return { posts: [], subscribers: [], adsConfig: [] };
}

function saveDB(data) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data));
  } catch (e) {
    console.error('saveDB error:', e.message);
  }
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function mapPost(p) {
  if (!p) return p;
  p.coverImage = p.coverImage || p.cover_image || '';
  p.videoUrl = p.videoUrl || p.video_url || '';
  p.scheduledAt = p.scheduledAt || p.scheduled_at || null;
  p.createdAt = p.createdAt || p.created_at || '';
  p.updatedAt = p.updatedAt || p.updated_at || '';
  p.ratingCount = p.ratingCount || p.rating_count || 0;
  p.rating = p.rating || 0;
  p.likes = p.likes || 0;
  p.dislikes = p.dislikes || 0;
  p.views = p.views || 0;
  p.published = p.published !== undefined ? p.published : true;
  if (typeof p.tags === 'string') p.tags = JSON.parse(p.tags);
  if (!Array.isArray(p.tags)) p.tags = [];
  delete p.cover_image;
  delete p.video_url;
  delete p.scheduled_at;
  delete p.created_at;
  delete p.updated_at;
  delete p.rating_count;
  return p;
}

function mapComment(c) {
  if (!c) return c;
  c.createdAt = c.createdAt || c.created_at || '';
  if (typeof c.emojis === 'string') c.emojis = JSON.parse(c.emojis);
  if (!Array.isArray(c.emojis)) c.emojis = [];
  c.likes = c.likes || 0;
  c.dislikes = c.dislikes || 0;
  delete c.created_at;
  delete c.post_id;
  return c;
}

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(body)
  };
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

function stripHtml(html) {
  return typeof html === 'string' ? html.replace(/<[^>]*>/g, '').substring(0, 200) : '';
}

function createToken(username) {
  const header = Buffer.from(JSON.stringify({
    username,
    exp: Date.now() + TOKEN_EXPIRY,
    iat: Date.now()
  })).toString('base64');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(header).digest('base64');
  return header + '.' + sig;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(parts[0]).digest('base64');
    if (sig !== parts[1]) return null;
    const data = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    if (Date.now() > data.exp) return null;
    return { username: data.username };
  } catch {
    return null;
  }
}

function getAuthUser(event) {
  const auth = event.headers['authorization'] || event.headers['Authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

function requireAdmin(event) {
  const user = getAuthUser(event);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  const routeParams = event.queryStringParameters || {};
  const method = event.httpMethod;
  const route = routeParams.route ? '/' + routeParams.route.replace(/^\/+/, '') : '/';
  let input = {};
  if (event.body) {
    try { input = JSON.parse(event.body); }
    catch { input = {}; }
  }

  const db = getDB();

  try {
    // === Admin Login ===
    if (route === '/admin/login' && method === 'POST') {
      const { username, password } = input;
      if (!username || !password) return err('Username and password required');
      if (username !== ADMIN_USER || password !== ADMIN_PASS) return err('Invalid credentials', 401);
      const token = createToken(username);
      return json({ token, user: { username } });
    }

    // === Admin Verify Token ===
    if (route === '/admin/verify' && method === 'GET') {
      const authErr = requireAdmin(event);
      if (authErr) return authErr;
      return json({ valid: true, user: getAuthUser(event) });
    }

    // === Events (SSE-style last update) ===
    if (route === '/events' && method === 'GET') {
      const latest = db.posts.reduce((max, p) => {
        const t = new Date(p.updatedAt || p.createdAt || 0).getTime();
        return t > max ? t : max;
      }, 0);
      return json({ lastUpdate: latest, totalPosts: db.posts.length });
    }

    // === GET /posts ===
    if (route === '/posts' || route === '/') {
      if (method === 'GET') {
        const category = routeParams.category || null;
        const search = routeParams.search || null;
        const sort = routeParams.sort || 'newest';
        const page = Math.max(1, parseInt(routeParams.page || '1'));
        const limit = parseInt(routeParams.limit || '0');
        const admin = routeParams.admin === 'true';

        let posts = db.posts || [];

        if (!admin) {
          posts = posts.filter(p => p.published && (!p.scheduledAt || new Date(p.scheduledAt) <= new Date()));
        }

        if (category) {
          posts = posts.filter(p => p.category === category);
        }

        if (search) {
          const q = search.toLowerCase();
          posts = posts.filter(p =>
            (p.title && p.title.toLowerCase().includes(q)) ||
            (p.content && p.content.toLowerCase().includes(q))
          );
        }

        if (sort === 'popular') {
          posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        } else if (sort === 'oldest') {
          posts.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        } else {
          posts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }

        const total = posts.length;

        if (limit > 0) {
          const offset = (page - 1) * limit;
          posts = posts.slice(offset, offset + limit);
        }

        posts = posts.map(mapPost);

        if (limit > 0) {
          return json({
            posts,
            total,
            page,
            totalPages: Math.max(1, Math.ceil(total / limit))
          });
        }
        return json(posts);
      }

      // === POST /posts (admin only) ===
      if (method === 'POST') {
        const authErr = requireAdmin(event);
        if (authErr) return authErr;
        const id = uuid();
        const title = input.title || 'Untitled';
        const content = input.content || '';
        const excerpt = input.excerpt || stripHtml(content);
        const category = input.category || 'AI';
        const tags = Array.isArray(input.tags) ? input.tags.map(t => sanitize(t)) : [];
        const coverImage = input.coverImage || '';
        const videoUrl = input.videoUrl || '';
        const author = input.author || 'Admin';
        const published = input.published !== undefined ? input.published : true;
        const scheduledAt = input.scheduledAt || null;

        const post = {
          id, title, content, excerpt, category, tags,
          coverImage, videoUrl, author, published, scheduledAt,
          likes: 0, dislikes: 0, rating: 0, ratingCount: 0,
          views: 0, comments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.posts.push(post);
        saveDB(db);
        return json(mapPost({ ...post }), 201);
      }
    }

    // === Single Post by ID ===
    const postMatch = route.match(/^\/posts\/([a-f0-9\-]+)$/);
    if (postMatch) {
      const postId = postMatch[1];
      const postIndex = db.posts.findIndex(p => p.id === postId);

      if (postIndex === -1) return err('Post not found', 404);

      // === GET /posts/:id ===
      if (method === 'GET') {
        db.posts[postIndex].views = (db.posts[postIndex].views || 0) + 1;
        saveDB(db);
        const post = mapPost({ ...db.posts[postIndex], comments: db.posts[postIndex].comments || [] });
        return json(post);
      }

      // === PUT /posts/:id (admin only) ===
      if (method === 'PUT') {
        const authErr = requireAdmin(event);
        if (authErr) return authErr;
        const allowed = ['title', 'content', 'excerpt', 'category', 'tags', 'coverImage', 'videoUrl', 'author', 'published', 'scheduledAt'];
        const post = db.posts[postIndex];
        for (const key of Object.keys(input)) {
          if (allowed.includes(key)) {
            post[key] = key === 'tags' ? input.tags.map(t => sanitize(t)) : input[key];
          }
        }
        post.updatedAt = new Date().toISOString();
        saveDB(db);
        return json(mapPost({ ...post }));
      }

      // === DELETE /posts/:id (admin only) ===
      if (method === 'DELETE') {
        const authErr = requireAdmin(event);
        if (authErr) return authErr;
        db.posts.splice(postIndex, 1);
        saveDB(db);
        return json({ message: 'Post deleted' });
      }
    }

    // === Post Like ===
    const likeMatch = route.match(/^\/posts\/([a-f0-9\-]+)\/like$/);
    if (likeMatch && method === 'POST') {
      const post = db.posts.find(p => p.id === likeMatch[1]);
      if (!post) return err('Post not found', 404);
      post.likes = (post.likes || 0) + 1;
      saveDB(db);
      return json({ likes: post.likes, dislikes: post.dislikes || 0 });
    }

    // === Post Dislike ===
    const dislikeMatch = route.match(/^\/posts\/([a-f0-9\-]+)\/dislike$/);
    if (dislikeMatch && method === 'POST') {
      const post = db.posts.find(p => p.id === dislikeMatch[1]);
      if (!post) return err('Post not found', 404);
      post.dislikes = (post.dislikes || 0) + 1;
      saveDB(db);
      return json({ likes: post.likes || 0, dislikes: post.dislikes });
    }

    // === Post Rating ===
    const rateMatch = route.match(/^\/posts\/([a-f0-9\-]+)\/rate$/);
    if (rateMatch && method === 'POST') {
      const rating = input.rating || 0;
      if (rating < 1 || rating > 5) return err('Rating must be 1-5');
      const post = db.posts.find(p => p.id === rateMatch[1]);
      if (!post) return err('Post not found', 404);
      const total = (post.rating || 0) * (post.ratingCount || 0) + rating;
      post.ratingCount = (post.ratingCount || 0) + 1;
      post.rating = total / post.ratingCount;
      saveDB(db);
      return json({ rating: Math.round(post.rating * 100) / 100, ratingCount: post.ratingCount });
    }

    // === Comments ===
    const commentsMatch = route.match(/^\/posts\/([a-f0-9\-]+)\/comments$/);
    if (commentsMatch) {
      const postId = commentsMatch[1];
      const post = db.posts.find(p => p.id === postId);
      if (!post) return err('Post not found', 404);

      if (method === 'GET') {
        return json((post.comments || []).map(mapComment));
      }

      if (method === 'POST') {
        const content = (input.content || '').trim();
        if (!content) return err('Comment cannot be empty');
        if (content.split(/\s+/).length > 200) return err('Comment exceeds 200 words');
        const cid = uuid();
        const name = input.name || 'Anonymous';
        const email = input.email || '';
        const comment = { id: cid, name, email, content, likes: 0, dislikes: 0, emojis: [], createdAt: new Date().toISOString() };
        if (!post.comments) post.comments = [];
        post.comments.push(comment);
        saveDB(db);
        return json(mapComment({ ...comment }), 201);
      }
    }

    // === Comment Emoji ===
    const emojiMatch = route.match(/^\/posts\/([a-f0-9\-]+)\/comments\/([a-f0-9\-]+)\/emoji$/);
    if (emojiMatch && method === 'POST') {
      const post = db.posts.find(p => p.id === emojiMatch[1]);
      if (!post) return err('Post not found', 404);
      const comment = (post.comments || []).find(c => c.id === emojiMatch[2]);
      if (!comment) return err('Comment not found', 404);
      const emoji = input.emoji || '';
      if (!emoji) return err('Emoji required');
      if (!comment.emojis) comment.emojis = [];
      comment.emojis.push({ emoji, createdAt: new Date().toISOString() });
      saveDB(db);
      return json(mapComment({ ...comment }));
    }

    // === Comment Like ===
    const commentLikeMatch = route.match(/^\/posts\/([a-f0-9\-]+)\/comments\/([a-f0-9\-]+)\/like$/);
    if (commentLikeMatch && method === 'POST') {
      const post = db.posts.find(p => p.id === commentLikeMatch[1]);
      if (!post) return err('Post not found', 404);
      const comment = (post.comments || []).find(c => c.id === commentLikeMatch[2]);
      if (!comment) return err('Comment not found', 404);
      comment.likes = (comment.likes || 0) + 1;
      saveDB(db);
      return json(mapComment({ ...comment }));
    }

    // === Comment Dislike ===
    const commentDislikeMatch = route.match(/^\/posts\/([a-f0-9\-]+)\/comments\/([a-f0-9\-]+)\/dislike$/);
    if (commentDislikeMatch && method === 'POST') {
      const post = db.posts.find(p => p.id === commentDislikeMatch[1]);
      if (!post) return err('Post not found', 404);
      const comment = (post.comments || []).find(c => c.id === commentDislikeMatch[2]);
      if (!comment) return err('Comment not found', 404);
      comment.dislikes = (comment.dislikes || 0) + 1;
      saveDB(db);
      return json(mapComment({ ...comment }));
    }

    // === Analytics ===
    if (route === '/analytics' && method === 'GET') {
      const posts = db.posts || [];
      const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
      const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
      const totalComments = posts.reduce((s, p) => s + ((p.comments && p.comments.length) || 0), 0);
      return json({ totalViews, totalLikes, totalComments, totalPosts: posts.length });
    }

    // === Newsletter ===
    if (route === '/newsletter') {
      if (method === 'POST') {
        const email = (input.email || '').trim().toLowerCase();
        if (!email) return err('Email is required');
        if (!db.subscribers) db.subscribers = [];
        if (db.subscribers.find(s => s.email === email)) {
          return json({ message: 'Already subscribed' });
        }
        db.subscribers.push({ email, subscribedAt: new Date().toISOString(), active: true });
        saveDB(db);
        return json({ message: 'Subscribed successfully' });
      }

      if (method === 'GET') {
        const authErr = requireAdmin(event);
        if (authErr) return authErr;
        return json((db.subscribers || []).filter(s => s.active !== false));
      }
    }

    // === Ads ===
    if (route === '/ads') {
      if (method === 'GET') {
        const configs = db.adsConfig || [];
        const ads = { enabled: true };
        configs.forEach(row => {
          ads[row.slot_name] = { code: row.code || '', active: !!row.active };
        });
        return json(ads);
      }

      if (method === 'POST') {
        const authErr = requireAdmin(event);
        if (authErr) return authErr;
        for (const [slot, config] of Object.entries(input)) {
          if (slot === 'enabled') continue;
          if (config && typeof config === 'object') {
            if (!db.adsConfig) db.adsConfig = [];
            const idx = db.adsConfig.findIndex(r => r.slot_name === slot);
            const entry = { slot_name: slot, code: config.code || '', active: config.active ? 1 : 0 };
            if (idx >= 0) db.adsConfig[idx] = entry;
            else db.adsConfig.push(entry);
          }
        }
        saveDB(db);
        return json({ message: 'Ad config saved' });
      }
    }

    // === Upload Image (admin only) ===
    if (route === '/uploads/image' && method === 'POST') {
      const authErr = requireAdmin(event);
      if (authErr) return authErr;
      try {
        const body = typeof event.body === 'string' ? event.body : '';
        const contentType = event.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) {
          const raw = Buffer.from(body, 'base64');
          const filename = uuid() + '.png';
          const uploadDir = '/tmp/uploads/images';
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
          fs.writeFileSync(path.join(uploadDir, filename), raw);
          return json({ url: '/uploads/images/' + filename, filename });
        }
        return err('No file uploaded');
      } catch (e) {
        return err('Upload failed: ' + e.message, 500);
      }
    }

    // === Upload Video (admin only) ===
    if (route === '/uploads/video' && method === 'POST') {
      const authErr = requireAdmin(event);
      if (authErr) return authErr;
      return err('Video upload not supported in serverless mode', 501);
    }

    // === 404 ===
    return err('Route not found', 404);

  } catch (e) {
    return err('Server error: ' + e.message, 500);
  }
};
