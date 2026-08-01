const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB, saveDB } = require('../db');

router.get('/', (req, res) => {
  const db = getDB();
  const { category, search, sort, page, limit } = req.query;
  const now = new Date().toISOString();
  let posts = [...db.posts];
  if (req.query.admin !== 'true') {
    posts = posts.filter(p => {
      if (!p.published) return false;
      if (p.scheduledAt && p.scheduledAt > now) return false;
      return true;
    });
  }
  if (category) posts = posts.filter(p => p.category === category);
  if (search) posts = posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase()));
  if (sort === 'popular') posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  else if (sort === 'oldest') posts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  else posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 0;
  if (limitNum > 0) {
    const total = posts.length;
    const start = (pageNum - 1) * limitNum;
    const sliced = posts.slice(start, start + limitNum);
    return res.json({ posts: sliced, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  }
  res.json(posts);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  post.views = (post.views || 0) + 1;
  saveDB(db);
  res.json(post);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { title, content, excerpt, category, tags, coverImage, videoUrl, author, published, scheduledAt } = req.body;
  const post = {
    id: uuidv4(),
    title,
    content,
    excerpt: excerpt || content.replace(/<[^>]*>/g, '').substring(0, 200),
    category: category || 'AI',
    tags: tags || [],
    coverImage: coverImage || '',
    videoUrl: videoUrl || '',
    author: author || 'Admin',
    published: published !== undefined ? published : true,
    scheduledAt: scheduledAt || null,
    likes: 0,
    dislikes: 0,
    rating: 0,
    ratingCount: 0,
    views: 0,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.posts.push(post);
  saveDB(db);
  res.status(201).json(post);
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const idx = db.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  const { title, content, excerpt, category, tags, coverImage, videoUrl, author, published, scheduledAt } = req.body;
  if (title !== undefined) db.posts[idx].title = title;
  if (content !== undefined) db.posts[idx].content = content;
  if (excerpt !== undefined) db.posts[idx].excerpt = excerpt;
  if (category !== undefined) db.posts[idx].category = category;
  if (tags !== undefined) db.posts[idx].tags = tags;
  if (coverImage !== undefined) db.posts[idx].coverImage = coverImage;
  if (videoUrl !== undefined) db.posts[idx].videoUrl = videoUrl;
  if (author !== undefined) db.posts[idx].author = author;
  if (published !== undefined) db.posts[idx].published = published;
  if (scheduledAt !== undefined) db.posts[idx].scheduledAt = scheduledAt;
  db.posts[idx].updatedAt = new Date().toISOString();
  saveDB(db);
  res.json(db.posts[idx]);
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const idx = db.posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  db.posts.splice(idx, 1);
  saveDB(db);
  res.json({ message: 'Post deleted' });
});

router.post('/:id/like', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  post.likes = (post.likes || 0) + 1;
  saveDB(db);
  res.json({ likes: post.likes, dislikes: post.dislikes });
});

router.post('/:id/dislike', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  post.dislikes = (post.dislikes || 0) + 1;
  saveDB(db);
  res.json({ likes: post.likes, dislikes: post.dislikes });
});

router.post('/:id/rate', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
  const total = (post.rating || 0) * (post.ratingCount || 0) + rating;
  post.ratingCount = (post.ratingCount || 0) + 1;
  post.rating = total / post.ratingCount;
  saveDB(db);
  res.json({ rating: post.rating, ratingCount: post.ratingCount });
});

router.get('/:id/comments', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post.comments || []);
});

router.post('/:id/comments', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const { name, email, content } = req.body;
  if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (content.split(/\s+/).length > 200) return res.status(400).json({ error: 'Comment exceeds 200 words' });
  const comment = {
    id: uuidv4(),
    name: name || 'Anonymous',
    email: email || '',
    content: content.trim(),
    likes: 0,
    dislikes: 0,
    emojis: [],
    createdAt: new Date().toISOString()
  };
  if (!post.comments) post.comments = [];
  post.comments.push(comment);
  saveDB(db);
  res.status(201).json(comment);
});

router.post('/:id/comments/:cid/emoji', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comment = post.comments.find(c => c.id === req.params.cid);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });
  if (!comment.emojis) comment.emojis = [];
  comment.emojis.push({ emoji, createdAt: new Date().toISOString() });
  saveDB(db);
  res.json(comment);
});

router.post('/:id/comments/:cid/like', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comment = post.comments.find(c => c.id === req.params.cid);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  comment.likes = (comment.likes || 0) + 1;
  saveDB(db);
  res.json(comment);
});

router.post('/:id/comments/:cid/dislike', (req, res) => {
  const db = getDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comment = post.comments.find(c => c.id === req.params.cid);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  comment.dislikes = (comment.dislikes || 0) + 1;
  saveDB(db);
  res.json(comment);
});

module.exports = router;
