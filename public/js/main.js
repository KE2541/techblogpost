let currentCategory = '';
let currentSort = 'latest';
let currentPostId = null;
let currentPage = 1;
let isLoadingMore = false;
let allLoadedPosts = [];
let searchQuery = '';
let relatedPosts = [];
let lastUpdate = Date.now();
let syncInterval = null;
let isHomeView = false;

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

function groupEmojis(emojiArray) {
  const counts = {};
  emojiArray.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
  return Object.entries(counts).map(([emoji, count]) => count > 1 ? `${emoji}x${count}` : emoji);
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const postId = params.get('post');
  const indexParam = params.get('i');

  if (postId) {
    viewPost(postId);
  } else if (indexParam) {
    loadPostByIndex(parseInt(indexParam, 10));
  } else {
    navigate('home');
  }

  loadAds();
  initScrollToTop();
  initSync();
  initKeyboardShortcuts();
});

async function loadPostByIndex(index) {
  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="loading"><i class="fas fa-spinner spinner"></i><p>Loading post...</p></div>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  try {
    const result = await api.getPostsPaginated({ limit: '100', page: '1' });
    const posts = result.posts || [];
    const idx = index - 1;
    if (idx >= 0 && idx < posts.length) {
      currentPostId = posts[idx].id;
      const post = await api.getPost(posts[idx].id);
      const allPosts = await api.getPosts();
      relatedPosts = allPosts.filter(p => p.id !== post.id && (p.category === post.category || p.tags?.some(t => post.tags?.includes(t)))).slice(0, 3);
      renderPostView(post);
    } else {
      content.innerHTML = '<div class="empty-state fade-in"><i class="fas fa-newspaper"></i><p>Post not found for this index.</p></div>';
    }
  } catch (err) {
    if (err.message === 'backend_offline') {
      const staticPost = STATIC_POSTS[index - 1];
      if (staticPost) {
        renderStaticPostView(staticPost);
      } else {
        content.innerHTML = '<div class="empty-state fade-in"><i class="fas fa-newspaper"></i><p>Post not found.</p></div>';
      }
    } else {
      content.innerHTML = '<div class="empty-state fade-in"><i class="fas fa-newspaper"></i><p>Error loading post.</p></div>';
    }
  }
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const input = document.getElementById('searchInput');
      if (input) input.focus();
    }
    if (e.key === 'Escape') {
      const popup = document.querySelector('.popup-overlay');
      if (popup) popup.remove();
    }
  });
}

function initSync() {
  syncInterval = setInterval(async () => {
    try {
      const events = await api.getEvents();
      if (events.lastUpdate && events.lastUpdate > lastUpdate) {
        lastUpdate = events.lastUpdate;
        if (isHomeView && !currentPostId) {
          const params = { limit: '6', page: '1' };
          if (currentCategory) params.category = currentCategory;
          if (currentSort) params.sort = currentSort;
          const result = await api.getPostsPaginated(params);
          const posts = result.posts || [];
          if (posts.length > 0) {
            const container = document.getElementById('pageContent');
            if (container) {
              renderHomeContent(container, posts, result.total || posts.length, result.totalPages > 1);
              loadAds();
            }
          }
        }
      }
    } catch {}
  }, 30000);
}

function initScrollToTop() {
  const btn = document.getElementById('scrollTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

async function loadAds() {
  try {
    const ads = await api.getAds();
    if (!ads.enabled) return;
    ['header', 'sidebar', 'inline', 'footer'].forEach(slot => {
      const cfg = ads[slot];
      if (cfg && cfg.active && cfg.code) {
        const el = document.getElementById(`ad${slot.charAt(0).toUpperCase() + slot.slice(1)}`);
        if (el) el.innerHTML = cfg.code;
      }
    });
    if (ads.popup && ads.popup.active && ads.popup.code) {
      setTimeout(() => {
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.innerHTML = `<div class="popup-ad"><button class="popup-close" onclick="this.parentElement.parentElement.remove()">&times;</button>${ads.popup.code}</div>`;
        document.body.appendChild(overlay);
      }, 5000);
    }
  } catch (e) {
    document.querySelectorAll('.ad-slot').forEach(el => { el.innerHTML = ''; });
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', theme);
  const icon = document.querySelector('.theme-toggle i');
  icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  localStorage.setItem('theme', theme);
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  const icon = document.querySelector('.theme-toggle i');
  if (icon) icon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

function toggleMenu() {
  const nav = document.getElementById('navLinks');
  nav.classList.toggle('show');
  document.body.classList.toggle('menu-open', nav.classList.contains('show'));
}

document.addEventListener('click', function(e) {
  const toggle = e.target.closest('.dropdown-toggle');
  if (toggle && window.innerWidth <= 768) {
    e.preventDefault();
    const menu = toggle.nextElementSibling;
    if (menu) menu.classList.toggle('show');
  }
});

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

async function navigate(page) {
  const content = document.getElementById('pageContent');
  document.getElementById('navLinks').classList.remove('show');
  document.body.classList.remove('menu-open');
  if (page === 'home') {
    renderHome(content);
  } else if (page === 'post') {
    renderPost(content);
  } else if (page === 'about') {
    renderAbout(content);
  }
}

function filterByCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.nav-links a, .dropdown-menu a').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.dropdown-menu a').forEach(a => {
    if (a.textContent.trim() === cat) a.classList.add('active');
  });
  const toggle = document.querySelector('.dropdown-toggle');
  if (toggle) toggle.classList.add('active');
  navigate('home');
  document.querySelectorAll('.nav-links .active, .dropdown-toggle.active').forEach(el => el.classList.remove('active'));
}

function renderSkeleton(container) {
  container.innerHTML = `
    <section class="hero-section">
      <h1>Exploring the Future of Technology</h1>
      <p>Stay ahead with the latest in AI, Machine Learning, Cloud Computing, and breakthrough technologies shaping tomorrow.</p>
      <div class="hero-search">
        <input type="text" placeholder="Search articles..." disabled>
        <button disabled><i class="fas fa-search"></i> Search</button>
      </div>
    </section>
    <div class="blog-grid">
      ${Array(6).fill('').map(() => `
        <div class="blog-card skeleton">
          <div class="blog-card-image skeleton-box" style="height:200px;"></div>
          <div class="blog-card-body">
            <div class="skeleton-box" style="width:80px;height:20px;border-radius:20px;margin-bottom:12px;"></div>
            <div class="skeleton-box" style="width:90%;height:22px;margin-bottom:8px;"></div>
            <div class="skeleton-box" style="width:70%;height:22px;margin-bottom:16px;"></div>
            <div class="skeleton-box" style="width:100%;height:14px;margin-bottom:6px;"></div>
            <div class="skeleton-box" style="width:80%;height:14px;margin-bottom:16px;"></div>
            <div class="blog-card-meta" style="border:none;padding-top:8px;">
              <div class="skeleton-box" style="width:120px;height:14px;"></div>
              <div class="skeleton-box" style="width:60px;height:14px;"></div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function renderHome(container) {
  currentPage = 1;
  allLoadedPosts = [];
  isHomeView = true;
  currentPostId = null;
  renderSkeleton(container);

  const serverPosts = window.__INITIAL_POSTS__;
  const serverTotal = window.__INITIAL_TOTAL__;

  if (serverPosts && serverPosts.length > 0 && !currentCategory && currentSort === 'latest' && currentPage === 1) {
    window.__INITIAL_POSTS__ = null;
    allLoadedPosts = serverPosts;
    const hasMore = serverTotal > 6;
    renderHomeContent(container, serverPosts, serverTotal, hasMore);
    return;
  }

  window.__INITIAL_POSTS__ = null;
  try {
    const params = { limit: '6', page: '1' };
    if (currentCategory) params.category = currentCategory;
    if (currentSort) params.sort = currentSort;
    const result = await api.getPostsPaginated(params);
    const posts = result.posts || [];
    allLoadedPosts = posts;
    const total = result.total || posts.length;
    const totalPages = result.totalPages || 1;
    renderHomeContent(container, posts, total, totalPages > currentPage);
  } catch (err) {
    if (err.message === 'backend_offline') {
      renderStaticHome(container);
    } else {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>Error loading posts: ${err.message}</p></div>` + getAboutHTML();
    }
  }
}

const STATIC_POSTS = [
  { id: 'sample-1', title: 'The Rise of Generative AI: Transforming Content Creation', excerpt: 'Generative AI is reshaping how we create content, from text and images to music and video. Discover how these technologies are changing creative workflows.', category: 'AI', likes: 0, comments: [], views: 0, rating: 0, coverImage: '' },
  { id: 'sample-2', title: 'Machine Learning in Healthcare: Revolutionizing Patient Care', excerpt: 'ML algorithms are improving diagnosis accuracy, personalizing treatment plans, and accelerating drug discovery. Explore the impact on modern medicine.', category: 'ML', likes: 0, comments: [], views: 0, rating: 0, coverImage: '' },
  { id: 'sample-3', title: 'Understanding Large Language Models: GPT, Claude, and Beyond', excerpt: 'LLMs have become central to modern AI applications. This guide explains how they work and what they mean for the future of computing.', category: 'LLM', likes: 0, comments: [], views: 0, rating: 0, coverImage: '' },
  { id: 'sample-4', title: 'Cloud Computing Trends 2026: What to Expect', excerpt: 'From edge computing to multi-cloud strategies, the cloud landscape continues to evolve. Stay ahead with these key trends.', category: 'Cloud', likes: 0, comments: [], views: 0, rating: 0, coverImage: '' },
  { id: 'sample-5', title: 'Deep Learning Breakthroughs in Computer Vision', excerpt: 'Recent advances in deep learning are pushing the boundaries of what machines can see and understand. A look at the latest innovations.', category: 'Deep Learning', likes: 0, comments: [], views: 0, rating: 0, coverImage: '' },
  { id: 'sample-6', title: 'ICT Infrastructure for Smart Cities', excerpt: 'Information and Communication Technology forms the backbone of smart city initiatives worldwide. Learn about the technologies powering urban innovation.', category: 'ICT', likes: 0, comments: [], views: 0, rating: 0, coverImage: '' }
];

function renderStaticHome(container) {
  container.innerHTML = `
    <section class="hero-section fade-in">
      <h1>${currentCategory ? `${currentCategory} Insights` : 'Exploring the Future of Technology'}</h1>
      <p>Stay ahead with the latest in AI, Machine Learning, Cloud Computing, and breakthrough technologies shaping tomorrow.</p>
      <div class="hero-search">
        <input type="text" id="searchInput" placeholder="Search articles..." oninput="debounceSearch()">
        <button onclick="searchPosts()"><i class="fas fa-search"></i> Search</button>
      </div>
    </section>
    <div class="sort-bar fade-in">
      <h2>${currentCategory ? `${currentCategory} Articles` : 'Latest Articles'}</h2>
    </div>
    <div class="blog-grid">
      ${STATIC_POSTS.filter(p => !currentCategory || p.category === currentCategory).slice(0, 6).map((post, i) => `
        <article class="blog-card fade-in" style="animation-delay:${i * 0.1}s" onclick="viewPost('${post.id}')">
          <div class="blog-card-image">
            <i class="fas fa-robot"></i>
          </div>
          <div class="blog-card-body">
            <span class="blog-card-category">${post.category}</span>
            <h3 class="blog-card-title">${post.title}</h3>
            <p class="blog-card-excerpt">${post.excerpt}</p>
            <div class="blog-card-meta">
              <div class="meta-left">
                <span><i class="fas fa-thumbs-up"></i> ${post.likes}</span>
                <span><i class="fas fa-comment"></i> ${post.comments.length}</span>
                <span><i class="fas fa-star"></i> ${post.rating.toFixed(1)}</span>
              </div>
              <span><i class="fas fa-eye"></i> ${post.views}</span>
            </div>
          </div>
        </article>
      `).join('')}
    </div>
    ${getAboutHTML()}
  `;
  setTimeout(() => {
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  }, 50);
}

function getAboutHTML() {
  return `
    <section class="about-section fade-in">
      <div class="about-content">
        <h2>Technology Trends Shaping the Digital Future</h2>
        <p>Technology continues to transform the way we live, work, and communicate. Today, emerging innovations such as Information and Communication Technology (ICT), Artificial Intelligence (AI), Machine Learning (ML), Large Language Models (LLMs), Deep Learning, and Cloud Computing are driving the next wave of digital transformation. Businesses, educators, healthcare providers, and governments are adopting these technologies to improve efficiency, automate processes, and deliver smarter services.</p>
        <p>Artificial Intelligence and Machine Learning enable systems to learn from data, predict outcomes, and support intelligent decision-making. Large Language Models are revolutionizing content creation, programming assistance, customer support, and education through advanced natural language understanding. Deep Learning, a specialized branch of ML, powers applications such as image recognition, speech processing, autonomous vehicles, and medical diagnostics.</p>
        <p>Meanwhile, Cloud Computing provides scalable, secure, and cost-effective infrastructure that supports remote work, big data analytics, and AI-powered applications. Together, these technologies are accelerating innovation across every industry.</p>
        <p>Staying informed about current technology trends is essential for students, professionals, entrepreneurs, and organizations seeking to remain competitive in the digital economy. As technology continues to evolve, embracing continuous learning and digital skills will unlock new opportunities, enhance productivity, and shape a smarter, more connected future for everyone.</p>
      </div>
    </section>
  `;
}

function renderHomeContent(container, posts, total, hasMore) {
  const heroHTML = `
    <section class="hero-section fade-in">
      <h1>${currentCategory ? `${currentCategory} Insights` : 'Exploring the Future of Technology'}</h1>
      <p>Stay ahead with the latest in AI, Machine Learning, Cloud Computing, and breakthrough technologies shaping tomorrow.</p>
      <div class="hero-search">
        <input type="text" id="searchInput" placeholder="Search articles..." oninput="debounceSearch()">
        <button onclick="searchPosts()"><i class="fas fa-search"></i> Search</button>
      </div>
    </section>
  `;
  const sortBar = `
    <div class="sort-bar fade-in">
      <h2>${currentCategory ? `${currentCategory} Articles` : 'Latest Articles'} <span>(${total} posts)</span></h2>
      <div class="sort-buttons">
        <button class="btn btn-sm ${currentSort==='latest'?'btn-primary':'btn-outline'}" onclick="currentSort='latest';navigate('home')">Latest</button>
        <button class="btn btn-sm ${currentSort==='popular'?'btn-primary':'btn-outline'}" onclick="currentSort='popular';navigate('home')">Popular</button>
        <button class="btn btn-sm ${currentSort==='oldest'?'btn-primary':'btn-outline'}" onclick="currentSort='oldest';navigate('home')">Oldest</button>
      </div>
    </div>
  `;
  let postsHTML = '';
  if (posts.length === 0) {
    postsHTML = '<div class="empty-state fade-in"><i class="fas fa-newspaper"></i><p>No posts yet. Check back soon!</p></div>';
  } else {
    postsHTML = '<div class="blog-grid" id="blogGrid">' + posts.map((post, i) => `
      <article class="blog-card fade-in" style="animation-delay:${i * 0.1}s" onclick="viewPost('${post.id}')">
        <div class="blog-card-image">
          ${post.coverImage ? `<img src="${post.coverImage}" alt="${post.title}" loading="lazy">` : `<i class="fas fa-robot"></i>`}
        </div>
        <div class="blog-card-body">
          <span class="blog-card-category">${post.category}</span>
          <h3 class="blog-card-title">${post.title}</h3>
          <p class="blog-card-excerpt">${post.excerpt || stripHtml(post.content).substring(0, 200)}</p>
          <div class="blog-card-meta">
            <div class="meta-left">
              <span><i class="fas fa-thumbs-up"></i> ${post.likes || 0}</span>
              <span><i class="fas fa-comment"></i> ${(post.comments && post.comments.length) || 0}</span>
              <span><i class="fas fa-star"></i> ${post.rating ? post.rating.toFixed(1) : '-'}</span>
            </div>
            <span><i class="fas fa-eye"></i> ${post.views || 0}</span>
          </div>
        </div>
      </article>
    `).join('') + '</div>';
  }
  const aboutSection = `
    <section class="about-section fade-in">
      <div class="about-content">
        <h2>Technology Trends Shaping the Digital Future</h2>
        <p>Technology continues to transform the way we live, work, and communicate. Today, emerging innovations such as Information and Communication Technology (ICT), Artificial Intelligence (AI), Machine Learning (ML), Large Language Models (LLMs), Deep Learning, and Cloud Computing are driving the next wave of digital transformation. Businesses, educators, healthcare providers, and governments are adopting these technologies to improve efficiency, automate processes, and deliver smarter services.</p>
        <p>Artificial Intelligence and Machine Learning enable systems to learn from data, predict outcomes, and support intelligent decision-making. Large Language Models are revolutionizing content creation, programming assistance, customer support, and education through advanced natural language understanding. Deep Learning, a specialized branch of ML, powers applications such as image recognition, speech processing, autonomous vehicles, and medical diagnostics.</p>
        <p>Meanwhile, Cloud Computing provides scalable, secure, and cost-effective infrastructure that supports remote work, big data analytics, and AI-powered applications. Together, these technologies are accelerating innovation across every industry.</p>
        <p>Staying informed about current technology trends is essential for students, professionals, entrepreneurs, and organizations seeking to remain competitive in the digital economy. As technology continues to evolve, embracing continuous learning and digital skills will unlock new opportunities, enhance productivity, and shape a smarter, more connected future for everyone.</p>
      </div>
    </section>
  `;
  const loadMore = hasMore ? `<div class="load-more-container fade-in"><button class="btn btn-primary load-more-btn" onclick="loadMore()" id="loadMoreBtn"><i class="fas fa-plus"></i> Load More</button></div>` : '';
  container.innerHTML = heroHTML + sortBar + postsHTML + aboutSection + loadMore;
  setTimeout(() => {
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  }, 50);
}

async function loadMore() {
  if (isLoadingMore) return;
  isLoadingMore = true;
  const btn = document.getElementById('loadMoreBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner spinner"></i> Loading...'; }
  currentPage++;
  try {
    const params = { limit: '6', page: currentPage.toString() };
    if (currentCategory) params.category = currentCategory;
    if (currentSort) params.sort = currentSort;
    const result = await api.getPostsPaginated(params);
    const newPosts = result.posts || [];
    allLoadedPosts = [...allLoadedPosts, ...newPosts];
    const total = result.total || 0;
    const totalPages = result.totalPages || 1;
    const grid = document.getElementById('blogGrid');
    if (grid) {
      newPosts.forEach((post, i) => {
        const article = document.createElement('article');
        article.className = 'blog-card fade-in';
        article.style.animationDelay = `${i * 0.1}s`;
        article.onclick = () => viewPost(post.id);
        article.innerHTML = `
          <div class="blog-card-image">
            ${post.coverImage ? `<img src="${post.coverImage}" alt="${post.title}" loading="lazy">` : `<i class="fas fa-robot"></i>`}
          </div>
          <div class="blog-card-body">
            <span class="blog-card-category">${post.category}</span>
            <h3 class="blog-card-title">${post.title}</h3>
            <p class="blog-card-excerpt">${post.excerpt || stripHtml(post.content).substring(0, 200)}</p>
            <div class="blog-card-meta">
              <div class="meta-left">
                <span><i class="fas fa-thumbs-up"></i> ${post.likes || 0}</span>
                <span><i class="fas fa-comment"></i> ${(post.comments && post.comments.length) || 0}</span>
                <span><i class="fas fa-star"></i> ${post.rating ? post.rating.toFixed(1) : '-'}</span>
              </div>
              <span><i class="fas fa-eye"></i> ${post.views || 0}</span>
            </div>
          </div>
        `;
        grid.appendChild(article);
        requestAnimationFrame(() => article.classList.add('visible'));
      });
    }
    const container = document.querySelector('.load-more-container');
    if (container) {
      if (currentPage >= totalPages) {
        container.remove();
      } else {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Load More'; }
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
    currentPage--;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-plus"></i> Load More'; }
  }
  isLoadingMore = false;
}

let searchTimeout = null;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = document.getElementById('searchInput').value.trim();
    if (q.length >= 2) searchPosts();
    else if (q.length === 0) navigate('home');
  }, 400);
}

function searchPosts() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return navigate('home');
  searchQuery = q;
  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="loading"><i class="fas fa-spinner spinner"></i><p>Searching...</p></div>';
  const filtered = STATIC_POSTS.filter(p => p.title.toLowerCase().includes(q.toLowerCase()) || p.excerpt.toLowerCase().includes(q.toLowerCase()) || p.category.toLowerCase().includes(q.toLowerCase()));
  const resultsHTML = `
    <div class="sort-bar fade-in">
      <h2>Search Results for "${q}" <span>(${filtered.length} results)</span></h2>
      <button class="btn btn-sm btn-outline" onclick="navigate('home')"><i class="fas fa-arrow-left"></i> Back</button>
    </div>
  `;
  let listHTML = '';
  if (filtered.length === 0) {
    listHTML = '<div class="empty-state fade-in"><i class="fas fa-search"></i><p>No results found. Try different keywords.</p></div>';
  } else {
    listHTML = '<div class="blog-grid">' + filtered.map(post => `
      <article class="blog-card fade-in" onclick="viewPost('${post.id}')">
        <div class="blog-card-image">
          <i class="fas fa-file-alt"></i>
        </div>
        <div class="blog-card-body">
          <span class="blog-card-category">${post.category}</span>
          <h3 class="blog-card-title">${post.title}</h3>
          <p class="blog-card-excerpt">${post.excerpt}</p>
        </div>
      </article>
    `).join('') + '</div>';
  }
  content.innerHTML = resultsHTML + listHTML;
  setTimeout(() => {
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  }, 50);
}

async function viewPost(id) {
  currentPostId = id;
  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="loading"><i class="fas fa-spinner spinner"></i><p>Loading post...</p></div>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  try {
    const post = await api.getPost(id);
    const allPosts = await api.getPosts();
    relatedPosts = allPosts.filter(p => p.id !== id && (p.category === post.category || p.tags?.some(t => post.tags?.includes(t)))).slice(0, 3);
    renderPostView(post);
  } catch (err) {
    const staticPost = STATIC_POSTS.find(p => p.id === id);
    if (err.message === 'backend_offline' && staticPost) {
      renderStaticPostView(staticPost);
    } else {
      content.innerHTML = `<div class="empty-state fade-in"><i class="fas fa-newspaper"></i><p>Post not found. Check back soon for new content!</p>${getAboutHTML()}</div>`;
    }
  }
}

function renderStaticPostView(post) {
  const content = document.getElementById('pageContent');
  const readTime = Math.max(1, Math.ceil((post.excerpt || '').split(/\s+/).length / 200));
  content.innerHTML = `
    <div class="post-detail fade-in">
      <div class="post-detail-header">
        <a href="#" onclick="navigate('home');return false;" class="back-link"><i class="fas fa-arrow-left"></i> Back to articles</a>
        <span class="blog-card-category">${post.category}</span>
        <h1>${post.title}</h1>
        <div class="post-meta">
          <span><i class="fas fa-user"></i> TechBlog Editor</span>
          <span><i class="fas fa-calendar"></i> January 1, 2026</span>
          <span><i class="fas fa-clock"></i> ${readTime} min read</span>
          <span><i class="fas fa-eye"></i> ${post.views} views</span>
        </div>
      </div>
      <div class="post-content fade-in">${post.content || post.excerpt}</div>
      <div class="interaction-bar fade-in">
        <button class="interaction-btn" id="likeBtn"><i class="fas fa-thumbs-up"></i> <span id="likeCount">${post.likes}</span></button>
        <div class="rating-stars">
          ${[1,2,3,4,5].map(i => `<i class="fas fa-star${i <= Math.round(post.rating || 0) ? ' active' : ''}"></i>`).join('')}
        </div>
        <span class="rating-display">${post.rating ? `${post.rating.toFixed(1)}` : 'Not rated'}</span>
      </div>
      <div class="comments-section fade-in">
        <h2><i class="fas fa-comments"></i> Comments <span>(${post.comments.length})</span></h2>
        ${post.comments.length === 0
          ? '<div class="empty-state" style="padding:30px;"><i class="fas fa-comment-dots"></i><p>No comments yet. Be the first to share your thoughts!</p></div>'
          : post.comments.map(c => `
            <div class="comment-card">
              <div class="comment-header">
                <div class="comment-author">
                  <div class="avatar">${(c.name || 'A')[0].toUpperCase()}</div>
                  <span>${c.name}</span>
                </div>
              </div>
              <div class="comment-content">${c.content}</div>
            </div>
          `).join('')}
      </div>
    </div>
  `;
  setTimeout(() => {
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  }, 50);
}

function renderPostView(post) {
  const content = document.getElementById('pageContent');
  const words = stripHtml(post.content).split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(words / 200));
  const shareUrl = encodeURIComponent(window.location.origin + '/?post=' + post.id);
  const shareText = encodeURIComponent(post.title);
  content.innerHTML = `
    <div class="post-detail fade-in">
      <div class="post-detail-header">
        <a href="#" onclick="navigate('home');return false;" class="back-link"><i class="fas fa-arrow-left"></i> Back to articles</a>
        <span class="blog-card-category">${post.category}</span>
        <h1>${post.title}</h1>
        <div class="post-meta">
          <span><i class="fas fa-user"></i> ${post.author}</span>
          <span><i class="fas fa-calendar"></i> ${new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span><i class="fas fa-clock"></i> ${readTime} min read</span>
          <span><i class="fas fa-eye"></i> ${post.views || 0} views</span>
        </div>
        <div class="post-share">
          <span>Share:</span>
          <a href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener" title="Share on Twitter"><i class="fab fa-twitter"></i></a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener" title="Share on LinkedIn"><i class="fab fa-linkedin"></i></a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" title="Share on Facebook"><i class="fab fa-facebook"></i></a>
          <a href="#" onclick="copyShareLink('${window.location.origin}/?post=${post.id}');return false;" title="Copy link"><i class="fas fa-link"></i></a>
        </div>
      </div>

      ${post.coverImage ? `<img src="${post.coverImage}" alt="${post.title}" class="post-cover fade-in" loading="lazy">` : ''}
      ${post.videoUrl ? `<video src="${post.videoUrl}" class="post-video" controls></video>` : ''}

      <div class="post-content fade-in">${post.content}</div>

      ${post.tags && post.tags.length ? `<div class="post-tags fade-in">${post.tags.map(t => `<span class="post-tag">#${t}</span>`).join('')}</div>` : ''}

      <div class="interaction-bar fade-in">
        <button class="interaction-btn" onclick="handleLike('${post.id}')" id="likeBtn">
          <i class="fas fa-thumbs-up"></i> <span id="likeCount">${post.likes || 0}</span>
        </button>
        <button class="interaction-btn" onclick="handleDislike('${post.id}')" id="dislikeBtn">
          <i class="fas fa-thumbs-down"></i> <span id="dislikeCount">${post.dislikes || 0}</span>
        </button>
        <div class="rating-stars" id="ratingStars">
          ${[1,2,3,4,5].map(i => `<i class="fas fa-star" data-rating="${i}" onclick="handleRate('${post.id}', ${i})"></i>`).join('')}
        </div>
        <span class="rating-display" id="ratingDisplay">${post.rating ? `${post.rating.toFixed(1)} (${post.ratingCount} votes)` : 'Not rated'}</span>
      </div>

      <div class="ad-slot fade-in" id="adInline"><div class="ad-placeholder">Advertisement</div></div>

      ${relatedPosts.length > 0 ? `
        <div class="related-posts fade-in">
          <h2><i class="fas fa-layer-group"></i> Related Articles</h2>
          <div class="blog-grid related-grid">
            ${relatedPosts.map(rp => `
              <article class="blog-card" onclick="viewPost('${rp.id}')">
                <div class="blog-card-image" style="height:150px;">
                  ${rp.coverImage ? `<img src="${rp.coverImage}" alt="${rp.title}" loading="lazy">` : `<i class="fas fa-file-alt" style="font-size:32px;"></i>`}
                </div>
                <div class="blog-card-body" style="padding:14px;">
                  <span class="blog-card-category">${rp.category}</span>
                  <h3 class="blog-card-title" style="font-size:16px;">${rp.title}</h3>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="comments-section fade-in" id="commentsSection">
        <h2><i class="fas fa-comments"></i> Comments <span>(${(post.comments && post.comments.length) || 0})</span></h2>

        <div class="comment-form">
          <form id="commentForm" onsubmit="submitComment(event, '${post.id}')">
            <div class="form-row">
              <input type="text" name="name" placeholder="Your name" required>
              <input type="email" name="email" placeholder="Your email (optional)">
            </div>
            <textarea name="content" placeholder="Share your thoughts... (max 200 words)" maxlength="1000" oninput="updateWordCount(this)" required></textarea>
            <div class="word-count"><span id="wordCount">0</span>/200 words</div>
            <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Post Comment</button>
          </form>
        </div>

        <div id="commentsList">
          ${(!post.comments || post.comments.length === 0)
            ? '<div class="empty-state" style="padding:30px;"><i class="fas fa-comment-dots"></i><p>No comments yet. Be the first to share your thoughts!</p></div>'
            : post.comments.slice().reverse().map(c => renderComment(post.id, c)).join('')}
        </div>
      </div>
    </div>
  `;
  const rating = post.rating || 0;
  document.querySelectorAll('.rating-stars i').forEach(star => {
    const val = parseInt(star.dataset.rating);
    if (val <= Math.round(rating)) star.classList.add('active');
  });
  setTimeout(() => {
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  }, 50);
}

function copyShareLink(url) {
  navigator.clipboard.writeText(url).then(() => showToast('Link copied!')).catch(() => showToast('Failed to copy', 'error'));
}

function renderComment(postId, c) {
  const initial = (c.name || 'A')[0].toUpperCase();
  return `
    <div class="comment-card" id="comment-${c.id}">
      <div class="comment-header">
        <div class="comment-author">
          <div class="avatar">${initial}</div>
          <span>${c.name}</span>
        </div>
        <span class="comment-date">${new Date(c.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="comment-content">${c.content}</div>
      <div class="comment-actions">
        <button class="comment-action-btn" onclick="likeComment('${postId}', '${c.id}')"><i class="fas fa-thumbs-up"></i> <span id="clikes-${c.id}">${c.likes || 0}</span></button>
        <button class="comment-action-btn" onclick="dislikeComment('${postId}', '${c.id}')"><i class="fas fa-thumbs-down"></i> <span id="cdislikes-${c.id}">${c.dislikes || 0}</span></button>
        <div class="comment-emojis">
          <button class="emoji-btn" onclick="addEmoji('${postId}', '${c.id}', '👍')" title="Like">👍</button>
          <button class="emoji-btn" onclick="addEmoji('${postId}', '${c.id}', '❤️')" title="Love">❤️</button>
          <button class="emoji-btn" onclick="addEmoji('${postId}', '${c.id}', '🔥')" title="Fire">🔥</button>
          <button class="emoji-btn" onclick="addEmoji('${postId}', '${c.id}', '🚀')" title="Rocket">🚀</button>
          <button class="emoji-btn" onclick="addEmoji('${postId}', '${c.id}', '💡')" title="Idea">💡</button>
          <button class="emoji-btn" onclick="addEmoji('${postId}', '${c.id}', '😂')" title="Funny">😂</button>
        </div>
      </div>
      ${c.emojis && c.emojis.length ? `<div class="emoji-display" id="cemojis-${c.id}">${groupEmojis(c.emojis.map(e => e.emoji)).join(' ')}</div>` : `<div class="emoji-display" id="cemojis-${c.id}"></div>`}
    </div>
  `;
}

function updateWordCount(textarea) {
  const count = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
  document.getElementById('wordCount').textContent = count;
  if (count > 200) textarea.value = textarea.value.trim().split(/\s+/).slice(0, 200).join(' ');
}

async function submitComment(e, postId) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const content = form.content.value.trim();
  if (!content) return showToast('Comment cannot be empty', 'error');
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 200) return showToast('Comment exceeds 200 words', 'error');
  try {
    await api.addComment(postId, { name, email, content });
    showToast('Comment posted successfully!');
    form.reset();
    document.getElementById('wordCount').textContent = '0';
    const updated = await api.getPost(postId);
    const commentsSection = document.getElementById('commentsSection');
    if (commentsSection) {
      commentsSection.innerHTML = `
        <h2><i class="fas fa-comments"></i> Comments <span>(${(updated.comments && updated.comments.length) || 0})</span></h2>
        <div class="comment-form">
          <form id="commentForm" onsubmit="submitComment(event, '${postId}')">
            <div class="form-row">
              <input type="text" name="name" placeholder="Your name" required>
              <input type="email" name="email" placeholder="Your email (optional)">
            </div>
            <textarea name="content" placeholder="Share your thoughts... (max 200 words)" maxlength="1000" oninput="updateWordCount(this)" required></textarea>
            <div class="word-count"><span id="wordCount">0</span>/200 words</div>
            <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Post Comment</button>
          </form>
        </div>
        <div id="commentsList">
          ${updated.comments.length === 0
            ? '<div class="empty-state" style="padding:30px;"><i class="fas fa-comment-dots"></i><p>No comments yet.</p></div>'
            : updated.comments.slice().reverse().map(c => renderComment(postId, c)).join('')}
        </div>
      `;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleLike(postId) {
  try {
    const result = await api.likePost(postId);
    const el = document.getElementById('likeCount');
    if (el) el.textContent = result.likes;
    const btn = document.getElementById('likeBtn');
    if (btn) btn.classList.add('active');
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleDislike(postId) {
  try {
    const result = await api.dislikePost(postId);
    const el = document.getElementById('dislikeCount');
    if (el) el.textContent = result.dislikes;
    const btn = document.getElementById('dislikeBtn');
    if (btn) btn.classList.add('active');
  } catch (err) { showToast(err.message, 'error'); }
}

async function handleRate(postId, rating) {
  try {
    const result = await api.ratePost(postId, rating);
    document.querySelectorAll('.rating-stars i').forEach(star => {
      const val = parseInt(star.dataset.rating);
      star.classList.toggle('active', val <= Math.round(result.rating));
    });
    const display = document.getElementById('ratingDisplay');
    if (display) display.textContent = `${result.rating.toFixed(1)} (${result.ratingCount} votes)`;
    showToast(`Rated ${rating}/5!`);
  } catch (err) { showToast(err.message, 'error'); }
}

async function likeComment(postId, commentId) {
  try {
    const result = await api.likeComment(postId, commentId);
    const el = document.getElementById(`clikes-${commentId}`);
    if (el) el.textContent = result.likes || 0;
  } catch (err) { showToast(err.message, 'error'); }
}

async function dislikeComment(postId, commentId) {
  try {
    const result = await api.dislikeComment(postId, commentId);
    const el = document.getElementById(`cdislikes-${commentId}`);
    if (el) el.textContent = result.dislikes || 0;
  } catch (err) { showToast(err.message, 'error'); }
}

async function addEmoji(postId, commentId, emoji) {
  try {
    await api.addEmoji(postId, commentId, emoji);
    const updated = await api.getPost(postId);
    const comment = updated.comments.find(c => c.id === commentId);
    const emojiDisplay = document.getElementById(`cemojis-${commentId}`);
    if (emojiDisplay && comment && comment.emojis) {
      emojiDisplay.textContent = groupEmojis(comment.emojis.map(e => e.emoji)).join(' ');
      emojiDisplay.classList.add('pop');
      setTimeout(() => emojiDisplay.classList.remove('pop'), 300);
    }
  } catch (err) { showToast(err.message, 'error'); }
}

function renderAbout(container) {
  container.innerHTML = `
    <section class="about-page">
      <div class="about-content">
        <h1>About TechBlog</h1>
        <div class="about-text">
          <h2>Technology Trends Shaping the Digital Future</h2>
          <p>Technology continues to transform the way we live, work, and communicate. Today, emerging innovations such as Information and Communication Technology (ICT), Artificial Intelligence (AI), Machine Learning (ML), Large Language Models (LLMs), Deep Learning, and Cloud Computing are driving the next wave of digital transformation. Businesses, educators, healthcare providers, and governments are adopting these technologies to improve efficiency, automate processes, and deliver smarter services.</p>
          <p>Artificial Intelligence and Machine Learning enable systems to learn from data, predict outcomes, and support intelligent decision-making. Large Language Models are revolutionizing content creation, programming assistance, customer support, and education through advanced natural language understanding. Deep Learning, a specialized branch of ML, powers applications such as image recognition, speech processing, autonomous vehicles, and medical diagnostics.</p>
          <p>Meanwhile, Cloud Computing provides scalable, secure, and cost-effective infrastructure that supports remote work, big data analytics, and AI-powered applications. Together, these technologies are accelerating innovation across every industry.</p>
          <p>Staying informed about current technology trends is essential for students, professionals, entrepreneurs, and organizations seeking to remain competitive in the digital economy. As technology continues to evolve, embracing continuous learning and digital skills will unlock new opportunities, enhance productivity, and shape a smarter, more connected future for everyone.</p>
        </div>
      </div>
    </section>
  `;
}

async function subscribeNewsletter(e) {
  e.preventDefault();
  const email = e.target.querySelector('input').value;
  try {
    await api.subscribeNewsletter(email);
    showToast(`Subscribed with ${email}! Thank you.`);
    e.target.reset();
  } catch (err) {
    if (err.message === 'backend_offline') {
      showToast('Subscribed! (offline mode)', 'success');
      e.target.reset();
    } else {
      showToast(err.message, 'error');
    }
  }
}
