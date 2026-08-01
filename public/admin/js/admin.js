let editingPostId = null;
let quillEditor = null;

document.addEventListener('DOMContentLoaded', async () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.querySelector('.theme-toggle i');
    if (icon) icon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  }

  window.addEventListener('auth:unauthorized', () => {
    handleLogout();
    showToast('Session expired. Please login again.', 'error');
  });

  const token = sessionStorage.getItem('adminToken');
  if (token) {
    api.setAdminToken(token);
    const valid = await verifySession();
    if (valid) {
      showAdmin();
      return;
    }
    api.setAdminToken(null);
  }
  showLogin();

  if (window.innerWidth <= 768) {
    document.querySelector('.menu-toggle').style.display = 'block';
  }
  window.addEventListener('resize', () => {
    document.querySelector('.menu-toggle').style.display = window.innerWidth <= 768 ? 'block' : 'none';
  });
});

async function verifySession() {
  try {
    const result = await api.adminVerify();
    return result && result.valid;
  } catch {
    return false;
  }
}

function showLogin() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('adminLayout').style.display = 'none';
}

function showAdmin() {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('adminLayout').style.display = '';
  showSection('dashboard');
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  const error = document.getElementById('loginError');

  if (!username || !password) {
    error.textContent = 'Please enter username and password';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner spinner"></i> Signing In...';
  error.textContent = '';

  try {
    const result = await api.adminLogin(username, password);
    api.setAdminToken(result.token);
    error.textContent = '';
    showAdmin();
  } catch (err) {
    error.textContent = err.message === 'backend_offline' ? 'Backend is offline. Ensure the API server is running.' : 'Invalid username or password';
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-shield-alt"></i> Sign In';
  }
}

function handleLogout() {
  api.setAdminToken(null);
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
  showLogin();
}

function toggleAdminSidebar() {
  document.querySelector('.sidebar').classList.toggle('show');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

function toggleTheme() {
  const html = document.documentElement;
  const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', theme);
  const icon = document.querySelector('.theme-toggle i');
  icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  localStorage.setItem('theme', theme);
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showSection(section) {
  if (window.innerWidth <= 768) toggleAdminSidebar();
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const activeLink = Array.from(document.querySelectorAll('.sidebar-nav a')).find(a => {
    const onclick = a.getAttribute('onclick') || '';
    return onclick.includes(`showSection('${section}')`);
  });
  if (activeLink) activeLink.classList.add('active');

  document.getElementById('pageTitle').textContent = 
    section === 'dashboard' ? 'Dashboard' :
    section === 'posts' ? 'Manage Posts' :
    section === 'editor' ? (editingPostId ? 'Edit Post' : 'New Post') :
    section === 'analytics' ? 'Analytics' : 'Dashboard';

  switch(section) {
    case 'dashboard': renderDashboard(); break;
    case 'posts': renderPosts(); break;
    case 'editor': renderEditor(); break;
    case 'analytics': renderAnalytics(); break;
    case 'monetization': renderMonetization(); break;
  }
}

async function renderDashboard() {
  const content = document.getElementById('adminContent');
  content.innerHTML = '<div class="loading"><i class="fas fa-spinner spinner"></i><p>Loading dashboard...</p></div>';
  try {
    const [posts, analytics] = await Promise.all([api.getPosts({ admin: 'true' }), api.getAnalytics()]);
    const recentPosts = posts.slice(-5).reverse();
    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon purple"><i class="fas fa-newspaper"></i></div>
          <div class="stat-number">${analytics.totalPosts || 0}</div>
          <div class="stat-label">Total Posts</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-eye"></i></div>
          <div class="stat-number">${analytics.totalViews || 0}</div>
          <div class="stat-label">Total Views</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-thumbs-up"></i></div>
          <div class="stat-number">${analytics.totalLikes || 0}</div>
          <div class="stat-label">Total Likes</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="fas fa-comments"></i></div>
          <div class="stat-number">${analytics.totalComments || 0}</div>
          <div class="stat-label">Total Comments</div>
        </div>
      </div>
      <div class="table-container">
        <div class="table-header">
          <h2>Recent Posts</h2>
          <button class="btn btn-primary btn-sm" onclick="showSection('editor')"><i class="fas fa-plus"></i> New Post</button>
        </div>
        ${recentPosts.length === 0 
          ? '<div class="empty-state"><i class="fas fa-newspaper"></i><p>No posts yet. Create your first post!</p></div>'
          : `<table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${recentPosts.map(p => `
                  <tr>
                    <td class="post-title-cell">${p.title}</td>
                    <td><span class="badge-status published">${p.category}</span></td>
                    <td><span class="badge-status ${p.published ? (p.scheduledAt && p.scheduledAt > new Date().toISOString() ? 'scheduled' : 'published') : 'draft'}">${p.published ? (p.scheduledAt && p.scheduledAt > new Date().toISOString() ? 'Scheduled' : 'Published') : 'Draft'}</span></td>
                    <td>${p.views || 0}</td>
                    <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                    <td class="cell-actions">
                      <button class="btn-edit" onclick="editPost('${p.id}')"><i class="fas fa-edit"></i> Edit</button>
                      <button class="btn-delete" onclick="deletePost('${p.id}')"><i class="fas fa-trash"></i> Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    `;
  } catch (err) {
    const msg = err.message === 'backend_offline' ? 'Backend is offline. Start the Node.js server or deploy with Netlify Functions enabled.' : err.message;
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div>`;
  }
}

async function renderPosts() {
  const content = document.getElementById('adminContent');
  content.innerHTML = '<div class="loading"><i class="fas fa-spinner spinner"></i><p>Loading posts...</p></div>';
  try {
    const posts = await api.getPosts({ admin: 'true' });
    content.innerHTML = `
      <div class="table-container">
        <div class="table-header">
          <h2>All Posts (${posts.length})</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <div class="table-search">
              <input type="text" id="postSearch" placeholder="Search posts..." onkeyup="filterPostsTable()">
            </div>
            <button class="btn btn-primary btn-sm" onclick="showSection('editor')"><i class="fas fa-plus"></i> New Post</button>
          </div>
        </div>
        ${posts.length === 0
          ? '<div class="empty-state"><i class="fas fa-newspaper"></i><p>No posts yet.</p></div>'
          : `<table id="postsTable">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Views</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${posts.map(p => `
                  <tr class="post-row">
                    <td class="post-title-cell" data-title="${p.title.toLowerCase()}">${p.title}</td>
                    <td><span class="badge-status published">${p.category}</span></td>
                    <td><span class="badge-status ${p.published ? (p.scheduledAt && p.scheduledAt > new Date().toISOString() ? 'scheduled' : 'published') : 'draft'}">${p.published ? (p.scheduledAt && p.scheduledAt > new Date().toISOString() ? 'Scheduled' : 'Published') : 'Draft'}</span></td>
                    <td>${p.likes || 0}</td>
                    <td>${(p.comments && p.comments.length) || 0}</td>
                    <td>${p.views || 0}</td>
                    <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                    <td class="cell-actions">
                      <button class="btn-edit" onclick="editPost('${p.id}')"><i class="fas fa-edit"></i></button>
                      <button class="btn-delete" onclick="deletePost('${p.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    `;
  } catch (err) {
    const msg = err.message === 'backend_offline' ? 'Backend is offline. Ensure the API server is running.' : err.message;
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div>`;
  }
}

function filterPostsTable() {
  const q = document.getElementById('postSearch').value.toLowerCase();
  document.querySelectorAll('.post-row').forEach(row => {
    const title = (row.querySelector('.post-title-cell')?.dataset?.title || '').toLowerCase();
    row.style.display = title.includes(q) ? '' : 'none';
  });
}

async function renderEditor(postId) {
  const content = document.getElementById('adminContent');
  if (postId) editingPostId = postId;
  document.getElementById('pageTitle').textContent = editingPostId ? 'Edit Post' : 'New Post';

  let post = { title: '', content: '', excerpt: '', category: 'AI', tags: [], coverImage: '', videoUrl: '', author: 'Admin', published: true, scheduledAt: null };

  if (editingPostId) {
    content.innerHTML = '<div class="loading"><i class="fas fa-spinner spinner"></i><p>Loading post...</p></div>';
    try {
      post = await api.getPost(editingPostId);
    } catch (err) {
      showToast(err.message, 'error');
      editingPostId = null;
    }
  }

  content.innerHTML = `
    <div class="editor-section">
      <h2>${editingPostId ? '<i class="fas fa-edit"></i> Edit Post' : '<i class="fas fa-pen-fancy"></i> Create New Post'}</h2>
      <form id="postForm" onsubmit="savePost(event)">
        <div class="form-row">
          <div class="form-group">
            <label for="title">Post Title</label>
            <input type="text" id="title" value="${escapeHtml(post.title)}" placeholder="Enter an engaging title..." required>
          </div>
          <div class="form-group">
            <label for="category">Category</label>
            <select id="category">
              <option value="AI" ${post.category === 'AI' ? 'selected' : ''}>Artificial Intelligence</option>
              <option value="ML" ${post.category === 'ML' ? 'selected' : ''}>Machine Learning</option>
              <option value="LLM" ${post.category === 'LLM' ? 'selected' : ''}>Large Language Models</option>
              <option value="Deep Learning" ${post.category === 'Deep Learning' ? 'selected' : ''}>Deep Learning</option>
              <option value="Cloud" ${post.category === 'Cloud' ? 'selected' : ''}>Cloud Computing</option>
              <option value="ICT" ${post.category === 'ICT' ? 'selected' : ''}>ICT</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="excerpt">Excerpt (optional)</label>
          <input type="text" id="excerpt" value="${escapeHtml(post.excerpt || '')}" placeholder="Brief description for card preview...">
        </div>

        <div class="form-group">
          <label for="content">Content</label>
          <div id="contentEditor" style="min-height:400px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);"></div>
          <textarea id="content" style="display:none;">${escapeHtml(post.content)}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Cover Image</label>
            <div class="file-upload-area" id="imageUploadArea">
              <i class="fas fa-image"></i>
              <p>Click to upload or drag an image</p>
              <input type="file" accept="image/*" onchange="uploadCoverImage(event)">
              <input type="hidden" id="coverImage" value="${escapeHtml(post.coverImage || '')}">
            </div>
            ${post.coverImage ? `<img src="${post.coverImage}" class="preview-image" id="coverPreview" style="display:block;">` : '<img class="preview-image" id="coverPreview">'}
          </div>
          <div class="form-group">
            <label>Video (optional)</label>
            <div class="file-upload-area" id="videoUploadArea">
              <i class="fas fa-video"></i>
              <p>Click to upload a video</p>
              <input type="file" accept="video/*" onchange="uploadVideo(event)">
              <input type="hidden" id="videoUrl" value="${escapeHtml(post.videoUrl || '')}">
            </div>
            <div id="videoInfo" style="margin-top:8px;font-size:13px;color:var(--text-muted);">${post.videoUrl ? 'Video uploaded' : ''}</div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="tags">Tags (comma-separated)</label>
            <input type="text" id="tags" value="${(post.tags || []).join(', ')}" placeholder="e.g., AI, Neural Networks, GPT">
          </div>
          <div class="form-group">
            <label for="author">Author</label>
            <input type="text" id="author" value="${escapeHtml(post.author || 'Admin')}">
          </div>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" id="published" ${post.published ? 'checked' : ''}>
            Publish immediately
          </label>
        </div>

        <div class="form-group" id="schedulerGroup" style="${post.published ? 'display:none;' : ''}">
          <label for="scheduledAt">Schedule Publish Date</label>
          <input type="datetime-local" id="scheduledAt" value="${post.scheduledAt ? post.scheduledAt.substring(0, 16) : ''}">
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> ${editingPostId ? 'Update Post' : 'Publish Post'}</button>
          <button type="button" class="btn btn-outline" onclick="showSection('posts')"><i class="fas fa-times"></i> Cancel</button>
          ${editingPostId ? `<button type="button" class="btn btn-danger" onclick="deletePost('${editingPostId}')"><i class="fas fa-trash"></i> Delete</button>` : ''}
        </div>
      </form>
    </div>
  `;

  if (quillEditor) quillEditor = null;
  const editorEl = document.getElementById('contentEditor');
  if (editorEl) {
    quillEditor = new Quill('#contentEditor', {
      theme: 'snow',
      placeholder: 'Write your post content here...',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'code-block'],
          [{ color: [] }, { background: [] }],
          ['link', 'image'],
          [{ align: [] }],
          ['clean']
        ]
      }
    });
    const hidden = document.getElementById('content');
    if (hidden && hidden.value) {
      quillEditor.root.innerHTML = hidden.value;
    }
  }
  const pubCheck = document.getElementById('published');
  if (pubCheck) {
    pubCheck.addEventListener('change', function() {
      const sg = document.getElementById('schedulerGroup');
      if (sg) sg.style.display = this.checked ? 'none' : 'block';
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function uploadCoverImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    showToast('Uploading image...');
    const result = await api.uploadImage(file);
    document.getElementById('coverImage').value = result.url;
    const preview = document.getElementById('coverPreview');
    preview.src = result.url;
    preview.style.display = 'block';
    showToast('Image uploaded!');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function uploadVideo(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    showToast('Uploading video...');
    const result = await api.uploadVideo(file);
    document.getElementById('videoUrl').value = result.url;
    document.getElementById('videoInfo').textContent = 'Video uploaded successfully';
    showToast('Video uploaded!');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function savePost(e) {
  e.preventDefault();
  const form = e.target;
  const title = document.getElementById('title').value.trim();
  let content = '';
  if (quillEditor) {
    content = quillEditor.root.innerHTML.trim();
    if (content === '<p><br></p>' || content === '<br>') content = '';
  } else {
    content = document.getElementById('content').value.trim();
  }
  if (!title || !content) return showToast('Title and content are required', 'error');

  const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const plainContent = content.replace(/<[^>]*>/g, '');
  const scheduledAt = document.getElementById('scheduledAt')?.value;
  const data = {
    title,
    content,
    excerpt: document.getElementById('excerpt').value.trim() || plainContent.substring(0, 200),
    category: document.getElementById('category').value,
    tags,
    coverImage: document.getElementById('coverImage').value,
    videoUrl: document.getElementById('videoUrl').value,
    author: document.getElementById('author').value.trim() || 'Admin',
    published: document.getElementById('published').checked,
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null
  };

  try {
    if (editingPostId) {
      await api.updatePost(editingPostId, data);
      showToast('Post updated successfully!');
    } else {
      await api.createPost(data);
      showToast('Post created successfully!');
    }
    editingPostId = null;
    showSection('posts');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editPost(id) {
  editingPostId = id;
  showSection('editor');
}

async function deletePost(id) {
  if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;
  try {
    await api.deletePost(id);
    showToast('Post deleted');
    if (editingPostId === id) editingPostId = null;
    showSection('posts');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderAnalytics() {
  const content = document.getElementById('adminContent');
  content.innerHTML = '<div class="loading"><i class="fas fa-spinner spinner"></i><p>Loading analytics...</p></div>';
  try {
    const [posts, analytics] = await Promise.all([api.getPosts({ admin: 'true' }), api.getAnalytics()]);
    const totalRating = posts.reduce((s, p) => {
      if (p.rating && p.ratingCount) s += p.rating * p.ratingCount;
      return s;
    }, 0);
    const totalRatingCount = posts.reduce((s, p) => s + (p.ratingCount || 0), 0);
    const avgRating = totalRatingCount > 0 ? (totalRating / totalRatingCount) : 0;

    const categoryCounts = {};
    posts.forEach(p => {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    });

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon purple"><i class="fas fa-newspaper"></i></div>
          <div class="stat-number">${analytics.totalPosts || 0}</div>
          <div class="stat-label">Total Posts</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-eye"></i></div>
          <div class="stat-number">${analytics.totalViews || 0}</div>
          <div class="stat-label">Total Views</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-thumbs-up"></i></div>
          <div class="stat-number">${analytics.totalLikes || 0}</div>
          <div class="stat-label">Total Likes</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="fas fa-star"></i></div>
          <div class="stat-number">${avgRating.toFixed(1)}</div>
          <div class="stat-label">Avg Rating</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header">
          <h2>Posts by Category</h2>
        </div>
        <table>
          <thead>
            <tr><th>Category</th><th>Count</th></tr>
          </thead>
          <tbody>
            ${Object.entries(categoryCounts).map(([cat, count]) => `
              <tr><td>${cat}</td><td>${count}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="table-container">
        <div class="table-header">
          <h2>Top Performing Posts</h2>
        </div>
        ${posts.length === 0
          ? '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>No data yet.</p></div>'
          : `<table>
              <thead>
                <tr><th>Title</th><th>Views</th><th>Likes</th><th>Rating</th></tr>
              </thead>
              <tbody>
                ${posts.sort((a,b) => (b.views||0) - (a.views||0)).slice(0, 10).map(p => `
                  <tr>
                    <td class="post-title-cell">${p.title}</td>
                    <td>${p.views || 0}</td>
                    <td>${p.likes || 0}</td>
                    <td>${p.rating ? `${p.rating.toFixed(1)} ⭐` : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    `;
  } catch (err) {
    const msg = err.message === 'backend_offline' ? 'Backend is offline. Ensure the API server is running.' : err.message;
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div>`;
  }
}

async function renderMonetization() {
  const content = document.getElementById('adminContent');
  content.innerHTML = '<div class="loading"><i class="fas fa-spinner spinner"></i><p>Loading monetization settings...</p></div>';
  try {
    const ads = await api.getAds();
    const [subscribers, posts] = await Promise.all([api.getSubscribers(), api.getPosts({ admin: 'true' })]);
    const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
    const estimatedRevenue = (totalViews * 0.02).toFixed(2);

    content.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-users"></i></div>
          <div class="stat-number">${subscribers.length}</div>
          <div class="stat-label">Newsletter Subscribers</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i class="fas fa-eye"></i></div>
          <div class="stat-number">${totalViews}</div>
          <div class="stat-label">Total Page Views</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="fas fa-dollar-sign"></i></div>
          <div class="stat-number">$${estimatedRevenue}</div>
          <div class="stat-label">Est. Ad Revenue (CPM $2.00)</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-chart-line"></i></div>
          <div class="stat-number">${posts.length}</div>
          <div class="stat-label">Monetized Posts</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header">
          <h2><i class="fas fa-ad"></i> Ad Slot Configuration</h2>
          <label style="display:flex;align-items:center;gap:8px;font-size:14px;">
            <input type="checkbox" id="adsEnabled" ${ads.enabled ? 'checked' : ''} onchange="toggleAds()">
            Enable Ads
          </label>
        </div>
        <form id="adsForm" onsubmit="saveAdConfig(event)">
          <div style="padding:20px;display:grid;gap:20px;">
            ${['header', 'sidebar', 'inline', 'footer', 'popup'].map(slot => `
              <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:16px;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                  <strong style="text-transform:capitalize;">${slot} Ad</strong>
                  <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
                    <input type="checkbox" name="${slot}_active" ${ads[slot]?.active ? 'checked' : ''}>
                    Active
                  </label>
                </div>
                <textarea name="${slot}_code" placeholder="Paste your ad code (Google AdSense, etc.)" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-primary);color:var(--text-primary);font-family:monospace;font-size:13px;min-height:80px;resize:vertical;">${escapeHtml(ads[slot]?.code || '')}</textarea>
              </div>
            `).join('')}
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Ad Configuration</button>
          </div>
        </form>
      </div>

      <div class="table-container">
        <div class="table-header">
          <h2><i class="fas fa-envelope"></i> Newsletter Subscribers</h2>
          <span style="color:var(--text-muted);font-size:14px;">${subscribers.length} subscribers</span>
        </div>
        ${subscribers.length === 0
          ? '<div class="empty-state"><i class="fas fa-envelope-open"></i><p>No subscribers yet.</p></div>'
          : `<table>
              <thead><tr><th>Email</th><th>Subscribed</th></tr></thead>
              <tbody>
                ${subscribers.map(s => `
                  <tr><td>${escapeHtml(s.email)}</td><td>${new Date(s.subscribedAt).toLocaleDateString()}</td></tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    `;
  } catch (err) {
    const msg = err.message === 'backend_offline' ? 'Backend is offline. Ensure the API server is running.' : err.message;
    content.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${msg}</p></div>`;
  }
}

function toggleAds() {
  const enabled = document.getElementById('adsEnabled').checked;
  document.querySelectorAll('#adsForm input[type="checkbox"]').forEach(cb => {
    if (cb.id !== 'adsEnabled') cb.disabled = !enabled;
  });
  document.querySelectorAll('#adsForm textarea').forEach(ta => ta.disabled = !enabled);
}

async function saveAdConfig(e) {
  e.preventDefault();
  const form = e.target;
  const enabled = document.getElementById('adsEnabled').checked;
  const config = { enabled };
  ['header', 'sidebar', 'inline', 'footer', 'popup'].forEach(slot => {
    config[slot] = {
      active: form.querySelector(`[name="${slot}_active"]`)?.checked || false,
      code: form.querySelector(`[name="${slot}_code"]`)?.value || ''
    };
  });
  try {
    await api.saveAds(config);
    showToast('Ad configuration saved!');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
