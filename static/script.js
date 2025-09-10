document.addEventListener('DOMContentLoaded', () => {
    const postForm = document.getElementById('postForm');
    const postsDiv = document.getElementById('posts');

    // 記事一覧取得
    function loadPosts() {
        fetch('/api/posts')
            .then(res => res.json())
            .then(posts => {
                postsDiv.innerHTML = '';
                posts.reverse().forEach(post => {
                    const div = document.createElement('div');
                    div.className = 'post';
                    div.innerHTML = `<h2>${post.title}</h2><p>${post.content}</p>`;
                    postsDiv.appendChild(div);
                });
            });
    }

    // 投稿処理
    postForm.addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('title').value;
        const content = document.getElementById('content').value;
        fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        })
        .then(res => {
            if (!res.ok) throw new Error('投稿失敗');
            return res.json();
        })
        .then(() => {
            postForm.reset();
            loadPosts();
        })
        .catch(alert);
    });

    loadPosts();
}); 